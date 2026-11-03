# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL integration walk — the Phase-1 happy path as pure GraphQL ops (epic P2-3 ticket 05)",
               type: :request do
  # THE integration seam (AD-10, ticket 05): one walk executing the FR-1→FR-20
  # main line purely as GraphQL operations over HTTP — every domain row in the
  # walk is born from a mutation, never from a factory (only the account comes
  # from the epic-02 surface, via `register`). Steps, in order:
  #
  #   1. register (epic-02) — the account + the bearer token
  #   2. confirmProposal    — the creation-chat proposal becomes plan + nodes
  #   3. attachMaterial     — client-extracted sections + parse state, plan-attached
  #   4. createTask         — the plan-free branch: second material + auto-node (FR-37)
  #   5. createQuizSession  — plan-scoped, node-attributed questions sourced from
  #                           the attached material's section ids (AD-6 / FR-18)
  #   6. recordEvidence     — graded answers → EvidenceRecords, the wrong one →
  #                           MistakeEntry; the session completes (FR-20's Phase-1 half)
  #   7. aggregate reads    — plan detail / plans / materials×3 scopes / task detail /
  #                           quizSession / evidence — every read reflects the writes
  #   8. appendChatMessage + chatThread read (FR-11)
  #   9. saveReadingProgress + reads (FR-10, FR-25's list)
  #  10. createFlashcards + rateFlashcard (FR-19) — the difficulty write moves no evidence
  #  11. claimSection (FR-15) — a claim is a claim, never evidence
  #
  # THEN the walk runs a SECOND PASS with the SAME client uuids — the
  # idempotency evidence the ticket AC demands. Per-op second-pass semantics
  # (respecting tickets 01–04's deviations):
  #
  #   · confirmProposal / attachMaterial / createTask / createQuizSession /
  #     createFlashcards REPLAY verbatim (the SAME input hashes — same client
  #     uuids): every one must answer Success with the SAME rows, and every
  #     aggregate count stays flat (no duplicates).
  #   · recordEvidence is NOT replayed — it has no client uuid (the Phase-1 op
  #     has none; ticket 03 deviation 5) and the session is already completed.
  #     The walk pins the server-side backstop instead: a verbatim re-grade is
  #     refused VALIDATION_FAILED and writes nothing (the exactly-once
  #     discipline belongs to the client driver, epic-05's wrapper).
  #   · appendChatMessage is NOT replayed either — no client uuid (ticket 04
  #     deviation 4); a re-send would append a duplicate message. The second
  #     pass appends ONE FRESH message (a real new turn, what a real client
  #     does) and asserts exactly-once append: the thread grows 2 → 3, the
  #     pass-1 messages untouched.
  #   · saveReadingProgress re-saves the same material — the upsert IS the
  #     op's idempotency (ticket 04 deviation 6): same row id, fresh position,
  #     still exactly one row.
  #   · claimSection re-claims the still-open claim — open-claim idempotency
  #     (ticket 04 deviation 3): the SAME row comes back, no duplicate.
  #   · register is NOT replayed (the account exists; a duplicate email is
  #     VALIDATION_FAILED) — the second pass re-logins instead (epic-02's
  #     login, fresh token, same account).
  #
  # One example, not several: the second pass is the first pass's replay, and
  # splitting them across examples would need shared mutable state that
  # obscures the exactly-once ordering this file pins. MistakeEntry is visible
  # only through the recordEvidence payload's `mistakes` field — there is no
  # standalone mistake READ by design (ticket 03 deviation 10; FR-23's mistake
  # surfaces arrive with the epic that owns them), so that payload read IS the
  # walk's mistake visibility. SectionMarking has no read at all — its count
  # is asserted directly on the model (the chat spec precedent).

  around do |example|
    original = ENV["JWT_SECRET"]
    ENV["JWT_SECRET"] = "test-signing-secret"
    example.run
  ensure
    if original.nil?
      ENV.delete("JWT_SECRET")
    else
      ENV["JWT_SECRET"] = original
    end
  end

  let(:password) { "known-password-123" }
  let(:email) { "walk-user@example.com" }

  def graphql(query, variables: {}, token: nil)
    headers = token ? { "Authorization" => "Bearer #{token}" } : {}
    post "/graphql", params: { query: query, variables: variables.to_json }, headers: headers
    response.parsed_body
  end

  def error_code(result)
    result.dig("errors", 0, "extensions", "code")
  end

  it "walks the Phase-1 happy path end to end, then replays the idempotent ops with the same client uuids" do
    plan_uuid = SecureRandom.uuid
    material_uuid = SecureRandom.uuid
    second_material_uuid = SecureRandom.uuid
    task_uuid = SecureRandom.uuid
    session_uuid = SecureRandom.uuid
    card_uuids = [ SecureRandom.uuid, SecureRandom.uuid ]

    # ── PASS 1 ──────────────────────────────────────────────────────────────

    # Step 1 — register (epic-02): the only row a factory never touches.
    registered = graphql(<<~GRAPHQL)
      mutation {
        register(input: { email: "#{email}", password: "#{password}" }) {
          token user { id email createdAt }
        }
      }
    GRAPHQL
    token = registered.dig("data", "register", "token")
    aggregate_failures do
      expect(error_code(registered)).to be_nil
      expect(token).to be_present
      expect(registered.dig("data", "register", "user", "email")).to eq(email)
    end

    # Step 2 — confirmProposal: the creation chat's staged proposal (what
    # epic-05's stream produces at runtime) confirms into plan + nodes.
    proposal_input = {
      clientUuid: plan_uuid,
      topic: "分布式系统",
      goal: "期末考到 85 分",
      stages: [
        { name: "基础", nodeTitles: [ "进程与线程", "死锁" ] },
        { name: "核心", nodeTitles: [ "一致性协议" ] }
      ]
    }
    confirmed = graphql(
      <<~GRAPHQL, variables: { input: proposal_input }, token: token
        mutation Confirm($input: ConfirmProposalInput!) {
          confirmProposal(input: $input) {
            plan { id topic goal visibility }
            nodes { id planId taskId stage title order }
          }
        }
      GRAPHQL
    )
    plan = confirmed.dig("data", "confirmProposal", "plan")
    nodes = confirmed.dig("data", "confirmProposal", "nodes")
    aggregate_failures do
      expect(error_code(confirmed)).to be_nil
      expect(plan["id"]).to eq(plan_uuid)
      expect(plan["topic"]).to eq("分布式系统")
      expect(plan["visibility"]).to eq("private") # the FR-38 default
      expect(nodes.map { |n| n["title"] }).to eq([ "进程与线程", "死锁", "一致性协议" ])
      expect(nodes.map { |n| n["stage"] }).to eq([ "基础", "基础", "核心" ])
      expect(nodes.map { |n| n["order"] }).to eq([ 0, 1, 2 ])
      expect(nodes.map { |n| n["planId"] }).to all(eq(plan_uuid))
      expect(nodes.map { |n| n["taskId"] }).to all(be_nil)
    end

    # Step 3 — attachMaterial: the client extracts sections + parse state
    # client-side (AD-7); the attach persists what arrived, plan-attached (FR-2).
    material_input = {
      clientUuid: material_uuid,
      planId: plan_uuid,
      kind: "markdown",
      title: "分布式系统讲义",
      sizeBytes: 48_256,
      parseState: "parsed",
      sections: [
        { id: "intro", title: "引言", text: "分布式系统的核心问题是部分失效下的协调。" },
        { id: "consensus", title: "共识协议", text: "Paxos 与 Raft 都用多数派承诺达成共识。" },
        { id: "summary", title: "小结", text: "本讲义覆盖了从进程到共识的主线。" }
      ]
    }
    attached = graphql(
      <<~GRAPHQL, variables: { input: material_input }, token: token
        mutation Attach($input: AttachMaterialInput!) {
          attachMaterial(input: $input) {
            material { id title kind parseState sizeBytes planId taskId
                       sections { id title text } createdAt }
          }
        }
      GRAPHQL
    )
    material = attached.dig("data", "attachMaterial", "material")
    aggregate_failures do
      expect(error_code(attached)).to be_nil
      expect(material["id"]).to eq(material_uuid)
      expect(material["planId"]).to eq(plan_uuid)
      expect(material["taskId"]).to be_nil
      expect(material["parseState"]).to eq("parsed")
      expect(material["sections"].map { |s| s["id"] }).to eq([ "intro", "consensus", "summary" ])
      expect(material["sections"].second["text"]).to eq("Paxos 与 Raft 都用多数派承诺达成共识。")
    end

    # Step 4 — the plan-free branch (FR-37): a second material attached
    # plan-free, then createTask — one task, one auto-owned node (AD-6), the
    # material back-linked. The detail read is the getTaskNode mirror.
    second_material_input = {
      clientUuid: second_material_uuid,
      kind: "markdown",
      title: "论文精读：Raft",
      sizeBytes: 20_000,
      parseState: "parsed",
      sections: [
        { id: "raft-election", title: "Leader 选举", text: "Raft 把共识拆成选举、日志、安全三块。" }
      ]
    }
    second_attached = graphql(
      <<~GRAPHQL, variables: { input: second_material_input }, token: token
        mutation Attach($input: AttachMaterialInput!) {
          attachMaterial(input: $input) { material { id planId taskId } }
        }
      GRAPHQL
    )
    task_input = { clientUuid: task_uuid, materialId: second_material_uuid }
    tasked = graphql(
      <<~GRAPHQL, variables: { input: task_input }, token: token
        mutation CreateTask($input: CreateTaskInput!) {
          createTask(input: $input) {
            task { id materialId nodeId }
            node { id planId taskId title stage order }
          }
        }
      GRAPHQL
    )
    task = tasked.dig("data", "createTask", "task")
    task_node = tasked.dig("data", "createTask", "node")
    aggregate_failures do
      expect(error_code(tasked)).to be_nil
      expect(second_attached.dig("data", "attachMaterial", "material", "planId")).to be_nil
      expect(task["id"]).to eq(task_uuid)
      expect(task["materialId"]).to eq(second_material_uuid)
      expect(task["nodeId"]).to eq(task_node["id"])
      expect(task_node["planId"]).to be_nil
      expect(task_node["taskId"]).to eq(task_uuid)
      expect(task_node["title"]).to eq("论文精读：Raft") # titled after the material
      expect(task_node["order"]).to eq(0)
    end
    task_read = graphql(
      <<~GRAPHQL, variables: { id: task_uuid }, token: token
        query($id: String!) { task(id: $id) { id materialId nodeId node { id title } } }
      GRAPHQL
    )
    expect(task_read.dig("data", "task", "node", "id")).to eq(task_node["id"])

    # Step 5 — createQuizSession: plan-scoped, "mix" mode, every question
    # node-attributed (AD-6) and sourced from the attached material's section
    # ids (FR-18 provenance).
    quiz_input = {
      clientUuid: session_uuid,
      planId: plan_uuid,
      mode: "mix",
      questions: [
        {
          nodeId: nodes[2]["id"], kind: "choice",
          prompt: "Paxos 与 Raft 的共同目标是什么？",
          options: [ "提高日志吞吐", "在非拜占庭故障下达成共识", "消除所有网络分区" ],
          correctOptionIndex: 1,
          sourceMaterialId: material_uuid, sourceSectionId: "consensus",
          explanation: "FR-18：问题只从讲义的共识协议一节出。"
        },
        {
          nodeId: nodes[0]["id"], kind: "open",
          prompt: "用一句话说明进程与线程的区别。",
          sourceMaterialId: material_uuid, sourceSectionId: "intro",
          keywords: [ "调度", "地址空间" ],
          explanation: "开放题按关键词判分。"
        }
      ]
    }
    quizzed = graphql(
      <<~GRAPHQL, variables: { input: quiz_input }, token: token
        mutation CreateQuiz($input: CreateSessionInput!) {
          createQuizSession(input: $input) {
            session { id planId taskId mode status completedAt }
            questions { id sessionId nodeId kind sourceMaterialId sourceSectionId prompt }
          }
        }
      GRAPHQL
    )
    session = quizzed.dig("data", "createQuizSession", "session")
    questions = quizzed.dig("data", "createQuizSession", "questions")
    aggregate_failures do
      expect(error_code(quizzed)).to be_nil
      expect(session["id"]).to eq(session_uuid)
      expect(session["planId"]).to eq(plan_uuid)
      expect(session["taskId"]).to be_nil
      expect(session["mode"]).to eq("mix")
      expect(session["status"]).to eq("active")
      expect(session["completedAt"]).to be_nil
      expect(questions.length).to eq(2)
      expect(questions.map { |q| q["sessionId"] }).to all(eq(session_uuid))
      expect(questions.map { |q| q["nodeId"] }).to eq([ nodes[2]["id"], nodes[0]["id"] ])
      expect(questions.map { |q| q["sourceSectionId"] }).to eq([ "consensus", "intro" ])
      expect(questions.map { |q| q["id"] }).to all(match(Accounts::UUID_REGEX))
    end

    # Step 6 — recordEvidence: the graded batch (one deliberate wrong answer)
    # writes an EvidenceRecord per answer and auto-logs the MistakeEntry; the
    # session completes. The payload's `mistakes` field is the walk's mistake
    # visibility (no standalone mistake read exists by design — see header).
    evidence_input = {
      sessionId: session_uuid,
      results: [
        { questionId: questions[0]["id"], outcome: "correct",
          userAnswer: "在非拜占庭故障下达成共识", forfeited: false },
        { questionId: questions[1]["id"], outcome: "wrong",
          userAnswer: "线程就是轻量级进程", forfeited: false }
      ]
    }
    graded = graphql(
      <<~GRAPHQL, variables: { input: evidence_input }, token: token
        mutation Record($input: RecordEvidenceInput!) {
          recordEvidence(input: $input) {
            session { id status completedAt }
            evidence { id nodeId sessionId questionId outcome }
            mistakes { id questionId sessionId nodeId userAnswer
                       sourceLocation { kind page sectionId } forfeited }
          }
        }
      GRAPHQL
    )
    grading = graded.dig("data", "recordEvidence")
    aggregate_failures do
      expect(error_code(graded)).to be_nil
      expect(grading["session"]["status"]).to eq("completed")
      expect(grading["session"]["completedAt"]).to be_present
      expect(grading["evidence"].map { |e| e["outcome"] }).to eq(%w[correct wrong])
      expect(grading["evidence"].map { |e| e["nodeId"] }).to eq([ nodes[2]["id"], nodes[0]["id"] ])
      expect(grading["evidence"].map { |e| e["sessionId"] }).to all(eq(session_uuid))
      expect(grading["mistakes"].length).to eq(1)
      mistake = grading["mistakes"].first
      expect(mistake["questionId"]).to eq(questions[1]["id"])
      expect(mistake["userAnswer"]).to eq("线程就是轻量级进程")
      expect(mistake["sourceLocation"]).to eq(
        { "kind" => "markdown", "page" => nil, "sectionId" => "intro" }
      )
      expect(mistake["forfeited"]).to be(false)
    end

    # Step 7 — the aggregate reads reflect the writes.
    plan_detail = graphql(
      <<~GRAPHQL, variables: { id: plan_uuid }, token: token
        query($id: String!) {
          plan(id: $id) {
            id topic goal visibility
            nodes { id title stage order }
            materials { id title parseState }
          }
        }
      GRAPHQL
    )
    detail = plan_detail.dig("data", "plan")
    plans_list = graphql("query { plans { id } }", token: token)
    all_materials = graphql("query { materials { id } }", token: token)
    plan_materials = graphql(
      "query($planId: String!) { materials(planId: $planId) { id } }",
      variables: { planId: plan_uuid }, token: token
    )
    task_materials = graphql(
      "query($taskId: String!) { materials(taskId: $taskId) { id } }",
      variables: { taskId: task_uuid }, token: token
    )
    quiz_read = graphql(
      <<~GRAPHQL, variables: { id: session_uuid }, token: token
        query($id: String!) { quizSession(id: $id) { id status completedAt questions { id nodeId } } }
      GRAPHQL
    )
    all_evidence = graphql("query { evidence { id nodeId outcome sessionId } }", token: token)
    node_evidence = graphql(
      "query($nodeId: String!) { evidence(nodeId: $nodeId) { id nodeId } }",
      variables: { nodeId: nodes[2]["id"] }, token: token
    )
    aggregate_failures do
      expect(detail["nodes"].map { |n| n["title"] }).to eq([ "进程与线程", "死锁", "一致性协议" ])
      # material-1 rides the plan; material-2 is the task's (planId null).
      expect(detail["materials"].map { |m| m["id"] }).to eq([ material_uuid ])
      expect(plans_list.dig("data", "plans").map { |p| p["id"] }).to eq([ plan_uuid ])
      expect(all_materials.dig("data", "materials").map { |m| m["id"] })
        .to contain_exactly(material_uuid, second_material_uuid)
      expect(plan_materials.dig("data", "materials").map { |m| m["id"] }).to eq([ material_uuid ])
      expect(task_materials.dig("data", "materials").map { |m| m["id"] }).to eq([ second_material_uuid ])
      expect(quiz_read.dig("data", "quizSession", "status")).to eq("completed")
      expect(quiz_read.dig("data", "quizSession", "questions").map { |q| q["id"] })
        .to eq(questions.map { |q| q["id"] })
      expect(all_evidence.dig("data", "evidence").length).to eq(2)
      expect(node_evidence.dig("data", "evidence").map { |e| e["nodeId"] }).to all(eq(nodes[2]["id"]))
    end

    # Step 8 — the Companion transcript (FR-11): two appends (server-minted
    # message ids), then the thread read round-trips citations verbatim (AD-2).
    ask_input = {
      materialId: material_uuid,
      message: {
        role: "user", text: "共识协议这一节的核心论点是什么？",
        citations: [ { kind: "markdown", sectionId: "consensus" } ]
      }
    }
    answer_input = {
      materialId: material_uuid,
      message: {
        role: "companion", text: "Paxos 与 Raft 都用多数派承诺达成共识。",
        citations: [ { kind: "markdown", sectionId: "consensus" } ]
      }
    }
    ask = graphql(
      <<~GRAPHQL, variables: { input: ask_input }, token: token
        mutation Append($input: AppendMessageInput!) {
          appendChatMessage(input: $input) {
            message { id role text citations { kind page sectionId } createdAt }
          }
        }
      GRAPHQL
    )
    graphql(<<~GRAPHQL, variables: { input: answer_input }, token: token)
      mutation Append($input: AppendMessageInput!) {
        appendChatMessage(input: $input) { message { id role } }
      }
    GRAPHQL
    thread_read = graphql(
      <<~GRAPHQL, variables: { materialId: material_uuid }, token: token
        query($materialId: String!) {
          chatThread(materialId: $materialId) {
            id materialId updatedAt
            messages { id role text citations { kind page sectionId } createdAt }
          }
        }
      GRAPHQL
    )
    thread = thread_read.dig("data", "chatThread")
    pass1_message_ids = thread["messages"].map { |m| m["id"] }
    aggregate_failures do
      expect(error_code(ask)).to be_nil
      expect(ask.dig("data", "appendChatMessage", "message", "id")).to match(Accounts::UUID_REGEX)
      expect(thread["materialId"]).to eq(material_uuid)
      expect(pass1_message_ids.length).to eq(2)
      expect(thread["messages"].map { |m| m["role"] }).to eq(%w[user companion])
      expect(thread["messages"].first["citations"]).to eq([
        { "kind" => "markdown", "page" => nil, "sectionId" => "consensus" }
      ])
    end

    # Step 9 — reading progress (FR-10): the position rides the domain
    # ReadingPosition verbatim (AD-2); the list is FR-25's continue line.
    progress_input = {
      materialId: material_uuid,
      position: {
        locator: { kind: "markdown", sectionId: "consensus" },
        text: "读到：Paxos 与 Raft 都用多数派承诺达成共识。"
      }
    }
    saved = graphql(
      <<~GRAPHQL, variables: { input: progress_input }, token: token
        mutation Save($input: SaveReadingProgressInput!) {
          saveReadingProgress(input: $input) {
            readingProgress { id materialId position { locator { kind page sectionId } text } updatedAt }
          }
        }
      GRAPHQL
    )
    progress = saved.dig("data", "saveReadingProgress", "readingProgress")
    progress_read = graphql(
      <<~GRAPHQL, variables: { materialId: material_uuid }, token: token
        query($materialId: String!) {
          readingProgress(materialId: $materialId) {
            id materialId position { locator { kind page sectionId } text }
          }
        }
      GRAPHQL
    )
    progress_list = graphql("query { readingProgressList { id materialId } }", token: token)
    aggregate_failures do
      expect(error_code(saved)).to be_nil
      expect(progress["materialId"]).to eq(material_uuid)
      expect(progress["position"]["locator"]).to eq(
        { "kind" => "markdown", "page" => nil, "sectionId" => "consensus" }
      )
      expect(progress["position"]["text"]).to eq("读到：Paxos 与 Raft 都用多数派承诺达成共识。")
      expect(progress_read.dig("data", "readingProgress", "id")).to eq(progress["id"])
      # only material-1 was ever read — the list carries exactly that row.
      expect(progress_list.dig("data", "readingProgressList").map { |r| r["materialId"] })
        .to eq([ material_uuid ])
    end

    # Step 10 — flashcards (FR-19): the deck persists with per-card client
    # uuids; the difficulty self-rating is study-state and moves NO evidence
    # (ADR-0001 — the Mastery Score moves on quiz evidence only).
    deck_input = {
      materialId: material_uuid,
      nodeId: nodes[2]["id"],
      cards: [
        { clientUuid: card_uuids[0], front: "Raft 的三种角色？", back: "Leader、Follower、Candidate" },
        { clientUuid: card_uuids[1], front: "多数派的大小？", back: "过半（n/2 + 1）" }
      ]
    }
    deck = graphql(
      <<~GRAPHQL, variables: { input: deck_input }, token: token
        mutation Cards($input: CreateFlashcardsInput!) {
          createFlashcards(input: $input) {
            cards { id materialId nodeId front back difficulty }
          }
        }
      GRAPHQL
    )
    cards = deck.dig("data", "createFlashcards", "cards")
    rated = graphql(
      <<~GRAPHQL, variables: { input: { id: card_uuids[0], difficulty: "hard" } }, token: token
        mutation Rate($input: RateFlashcardInput!) {
          rateFlashcard(input: $input) { flashcard { id difficulty } }
        }
      GRAPHQL
    )
    deck_read = graphql(
      "query($materialId: String!) { flashcards(materialId: $materialId) { id difficulty } }",
      variables: { materialId: material_uuid }, token: token
    )
    aggregate_failures do
      expect(error_code(deck)).to be_nil
      expect(cards.map { |c| c["id"] }).to eq(card_uuids)
      expect(cards.map { |c| c["difficulty"] }).to all(be_nil)
      expect(rated.dig("data", "rateFlashcard", "flashcard", "difficulty")).to eq("hard")
      expect(deck_read.dig("data", "flashcards").length).to eq(2)
      expect(EvidenceRecord.count).to eq(2) # the rating wrote none
    end

    # Step 11 — claimSection (FR-15): a claim is a claim, NEVER evidence.
    claim_input = { materialId: material_uuid, sectionId: "consensus" }
    claimed = graphql(
      <<~GRAPHQL, variables: { input: claim_input }, token: token
        mutation Claim($input: ClaimSectionInput!) {
          claimSection(input: $input) {
            sectionMarking { id materialId sectionId claimedAt clearedAt }
          }
        }
      GRAPHQL
    )
    marking = claimed.dig("data", "claimSection", "sectionMarking")
    aggregate_failures do
      expect(error_code(claimed)).to be_nil
      expect(marking["materialId"]).to eq(material_uuid)
      expect(marking["sectionId"]).to eq("consensus")
      expect(marking["claimedAt"]).to be_present
      expect(marking["clearedAt"]).to be_nil
      expect(SectionMarking.count).to eq(1)
      expect(EvidenceRecord.count).to eq(2) # the claim wrote none
    end

    # ── PASS 2 — the SAME client uuids (idempotency evidence) ───────────────
    # register is not replayed (the account exists); the client re-logins.

    token2 = login_token(email)

    # confirmProposal replay: Success, the SAME plan + nodes, counts flat.
    confirm2 = graphql(
      <<~GRAPHQL, variables: { input: proposal_input }, token: token2
        mutation Confirm($input: ConfirmProposalInput!) {
          confirmProposal(input: $input) {
            plan { id topic }
            nodes { id title order }
          }
        }
      GRAPHQL
    )
    expect(confirm2.dig("data", "confirmProposal", "plan", "id")).to eq(plan_uuid)
    expect(confirm2.dig("data", "confirmProposal", "nodes").map { |n| n["id"] })
      .to eq(nodes.map { |n| n["id"] })
    expect(graphql("query { plans { id } }", token: token2).dig("data", "plans").length).to eq(1)

    # attachMaterial replay: Success, the SAME material (the payload is NOT
    # re-applied — re-upload safe), counts flat.
    attach2 = graphql(
      <<~GRAPHQL, variables: { input: material_input }, token: token2
        mutation Attach($input: AttachMaterialInput!) {
          attachMaterial(input: $input) { material { id sections { id } } }
        }
      GRAPHQL
    )
    expect(attach2.dig("data", "attachMaterial", "material", "id")).to eq(material_uuid)
    expect(attach2.dig("data", "attachMaterial", "material", "sections").length).to eq(3)
    expect(graphql("query { materials { id } }", token: token2).dig("data", "materials").length).to eq(2)

    # createTask replay: Success, the SAME task + auto-node, counts flat.
    task2 = graphql(
      <<~GRAPHQL, variables: { input: task_input }, token: token2
        mutation CreateTask($input: CreateTaskInput!) {
          createTask(input: $input) { task { id nodeId } node { id taskId } }
        }
      GRAPHQL
    )
    expect(task2.dig("data", "createTask", "task", "id")).to eq(task_uuid)
    expect(task2.dig("data", "createTask", "task", "nodeId")).to eq(task_node["id"])
    expect(graphql("query { tasks { id } }", token: token2).dig("data", "tasks").length).to eq(1)

    # createQuizSession replay: Success, the SAME session + questions (no
    # duplicates), and the completed status is NOT resurrected to active.
    quiz2 = graphql(
      <<~GRAPHQL, variables: { input: quiz_input }, token: token2
        mutation CreateQuiz($input: CreateSessionInput!) {
          createQuizSession(input: $input) {
            session { id status }
            questions { id }
          }
        }
      GRAPHQL
    )
    expect(quiz2.dig("data", "createQuizSession", "session", "id")).to eq(session_uuid)
    expect(quiz2.dig("data", "createQuizSession", "session", "status")).to eq("completed")
    expect(quiz2.dig("data", "createQuizSession", "questions").map { |q| q["id"] })
      .to eq(questions.map { |q| q["id"] })

    # recordEvidence: NOT replayed (no client uuid — ticket 03 deviation 5;
    # the exactly-once discipline belongs to the client driver). The walk pins
    # the backstop: a verbatim re-grade is REFUSED — the session is completed —
    # and nothing is written.
    regrade = graphql(
      <<~GRAPHQL, variables: { input: evidence_input }, token: token2
        mutation Record($input: RecordEvidenceInput!) {
          recordEvidence(input: $input) { session { id } }
        }
      GRAPHQL
    )
    aggregate_failures do
      expect(regrade.dig("data", "recordEvidence")).to be_nil
      expect(error_code(regrade)).to eq("VALIDATION_FAILED")
      expect(EvidenceRecord.count).to eq(2)
      expect(MistakeEntry.count).to eq(1)
    end

    # appendChatMessage: NOT replayed verbatim (no client uuid — a re-send
    # would append a duplicate). One FRESH message goes through (what a real
    # client does: exactly one fire per message) — the thread grows 2 → 3 and
    # the pass-1 messages stand untouched.
    fresh_message_input = {
      materialId: material_uuid,
      message: {
        role: "user", text: "再解释一下 Raft 的选举过程。",
        citations: [ { kind: "markdown", sectionId: "consensus" } ]
      }
    }
    appended2 = graphql(
      <<~GRAPHQL, variables: { input: fresh_message_input }, token: token2
        mutation Append($input: AppendMessageInput!) {
          appendChatMessage(input: $input) { message { id } }
        }
      GRAPHQL
    )
    thread2 = graphql(
      <<~GRAPHQL, variables: { materialId: material_uuid }, token: token2
        query($materialId: String!) {
          chatThread(materialId: $materialId) { messages { id role text } }
        }
      GRAPHQL
    ).dig("data", "chatThread")
    aggregate_failures do
      expect(error_code(appended2)).to be_nil
      expect(thread2["messages"].length).to eq(3)
      expect(thread2["messages"].first(2).map { |m| m["id"] }).to eq(pass1_message_ids)
      expect(thread2["messages"].last["text"]).to eq("再解释一下 Raft 的选举过程。")
    end

    # saveReadingProgress: the upsert IS the idempotency — the re-save lands
    # on the SAME row with the fresh position, still exactly one row.
    progress2_input = {
      materialId: material_uuid,
      position: {
        locator: { kind: "markdown", sectionId: "summary" },
        text: "读到小结。"
      }
    }
    saved2 = graphql(
      <<~GRAPHQL, variables: { input: progress2_input }, token: token2
        mutation Save($input: SaveReadingProgressInput!) {
          saveReadingProgress(input: $input) { readingProgress { id position { locator { sectionId } text } } }
        }
      GRAPHQL
    )
    progress2 = saved2.dig("data", "saveReadingProgress", "readingProgress")
    aggregate_failures do
      expect(progress2["id"]).to eq(progress["id"])
      expect(progress2["position"]["locator"]["sectionId"]).to eq("summary")
      expect(graphql("query { readingProgressList { id } }", token: token2)
        .dig("data", "readingProgressList").length).to eq(1)
    end

    # claimSection: the claim is still open — re-claim returns the SAME row,
    # no duplicate (open-claim idempotency), evidence still untouched.
    claim2 = graphql(
      <<~GRAPHQL, variables: { input: claim_input }, token: token2
        mutation Claim($input: ClaimSectionInput!) {
          claimSection(input: $input) { sectionMarking { id clearedAt } }
        }
      GRAPHQL
    )
    aggregate_failures do
      expect(claim2.dig("data", "claimSection", "sectionMarking", "id")).to eq(marking["id"])
      expect(SectionMarking.count).to eq(1)
      expect(EvidenceRecord.count).to eq(2)
    end

    # createFlashcards replay: the SAME per-card client uuids return the
    # SAME cards, none created; the re-rate is the by-id study-state overwrite.
    deck2 = graphql(
      <<~GRAPHQL, variables: { input: deck_input }, token: token2
        mutation Cards($input: CreateFlashcardsInput!) {
          createFlashcards(input: $input) { cards { id difficulty } }
        }
      GRAPHQL
    )
    rated2 = graphql(
      <<~GRAPHQL, variables: { input: { id: card_uuids[0], difficulty: "easy" } }, token: token2
        mutation Rate($input: RateFlashcardInput!) {
          rateFlashcard(input: $input) { flashcard { id difficulty } }
        }
      GRAPHQL
    )
    aggregate_failures do
      expect(deck2.dig("data", "createFlashcards", "cards").map { |c| c["id"] }).to eq(card_uuids)
      expect(rated2.dig("data", "rateFlashcard", "flashcard", "difficulty")).to eq("easy")
      expect(graphql("query($materialId: String!) { flashcards(materialId: $materialId) { id } }",
                     variables: { materialId: material_uuid }, token: token2)
        .dig("data", "flashcards").length).to eq(2)
      expect(EvidenceRecord.count).to eq(2) # still none from flashcards
    end

    # The final no-duplicates sweep — every aggregate count flat after both passes.
    final = {
      plans: graphql("query { plans { id } }", token: token2).dig("data", "plans").length,
      materials: graphql("query { materials { id } }", token: token2).dig("data", "materials").length,
      tasks: graphql("query { tasks { id } }", token: token2).dig("data", "tasks").length,
      evidence: graphql("query { evidence { id } }", token: token2).dig("data", "evidence").length,
      messages: graphql("query($materialId: String!) { chatThread(materialId: $materialId) { messages { id } } }",
                        variables: { materialId: material_uuid }, token: token2)
        .dig("data", "chatThread", "messages").length,
      cards: graphql("query($materialId: String!) { flashcards(materialId: $materialId) { id } }",
                     variables: { materialId: material_uuid }, token: token2)
        .dig("data", "flashcards").length
    }
    expect(final).to eq(
      plans: 1, materials: 2, tasks: 1, evidence: 2, messages: 3, cards: 2
    )
  end

  private

  def login_token(email)
    result = graphql(<<~GRAPHQL)
      mutation {
        login(input: { email: "#{email}", password: "#{password}" }) { token }
      }
    GRAPHQL
    result.dig("data", "login", "token")
  end
end
