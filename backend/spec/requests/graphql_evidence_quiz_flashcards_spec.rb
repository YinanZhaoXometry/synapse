# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL evidence + quiz + flashcard operations (epic P2-3 ticket 03)", type: :request do
  # Direct GraphQL execution over HTTP (AD-10, the epic-02 request-spec
  # pattern): real register/login for tokens, real second users for scoping,
  # typed failure codes read off extensions.code. The commands underneath
  # have their own direct specs (spec/commands/quiz/, spec/commands/
  # flashcards/); this file pins the wire behavior.

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

  def graphql(query, variables: {}, token: nil)
    headers = token ? { "Authorization" => "Bearer #{token}" } : {}
    post "/graphql", params: { query: query, variables: variables.to_json }, headers: headers
    response.parsed_body
  end

  def error_code(result)
    result.dig("errors", 0, "extensions", "code")
  end

  def token_for(email)
    result = graphql(<<~GRAPHQL)
      mutation {
        login(input: { email: "#{email}", password: "#{password}" }) { token }
      }
    GRAPHQL
    result.dig("data", "login", "token")
  end

  def user_with_token(email)
    create(:user, email: email, password: password)
    [ User.find_by!(email: email), token_for(email) ]
  end

  describe "the auth guard on every quiz/evidence/flashcard operation (kickoff delta 8)" do
    it "answers UNAUTHORIZED without a token on all eight operations" do
      queries = [
        'query { quizSession(id: "00000000-0000-0000-0000-000000000000") { id } }',
        "query { evidence { id } }",
        "query { flashcards(materialId: \"00000000-0000-0000-0000-000000000000\") { id } }"
      ]
      mutations = [
        "mutation { createQuizSession(input: { clientUuid: \"#{SecureRandom.uuid}\", mode: \"open\", " \
          "planId: \"#{SecureRandom.uuid}\", questions: [] }) { session { id } } }",
        "mutation { recordEvidence(input: { sessionId: \"#{SecureRandom.uuid}\", results: [] }) { session { id } } }",
        "mutation { abandonQuizSession(input: { id: \"#{SecureRandom.uuid}\" }) { session { id } } }",
        "mutation { createFlashcards(input: { materialId: \"#{SecureRandom.uuid}\", cards: [] }) { cards { id } } }",
        "mutation { rateFlashcard(input: { id: \"#{SecureRandom.uuid}\", difficulty: \"easy\" }) { flashcard { id } } }"
      ]

      queries.each do |query|
        expect(error_code(graphql(query))).to eq("UNAUTHORIZED")
      end
      mutations.each do |mutation|
        expect(error_code(graphql(mutation))).to eq("UNAUTHORIZED")
      end
    end
  end

  describe "createQuizSession mutation" do
    it "creates the session with its node-attributed questions in one call (plan-scoped, jsonb round-trip)" do
      user, token = user_with_token("quiz-creator@example.com")
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan: plan)
      material = create(:material, user: user, plan: plan)
      client_uuid = SecureRandom.uuid

      result = graphql(
        <<~GRAPHQL, variables: { input: quiz_input(client_uuid, plan.id, node.id, material.id) }, token: token
          mutation CreateQuizSession($input: CreateSessionInput!) {
            createQuizSession(input: $input) {
              session { id planId taskId mode status completedAt createdAt questions { id } }
              questions { id sessionId nodeId kind prompt options correctOptionIndex
                          sourceMaterialId sourceSectionId keywords explanation }
            }
          }
        GRAPHQL
      )

      payload = result.dig("data", "createQuizSession")
      expect(payload["session"]["id"]).to eq(client_uuid)
      expect(payload["session"]["planId"]).to eq(plan.id)
      expect(payload["session"]["taskId"]).to be_nil
      expect(payload["session"]["mode"]).to eq("mix")
      expect(payload["session"]["status"]).to eq("active")
      expect(payload["session"]["completedAt"]).to be_nil

      questions = payload["questions"]
      expect(questions.length).to eq(2)
      expect(questions[0]["nodeId"]).to eq(node.id)
      expect(questions[0]["kind"]).to eq("choice")
      expect(questions[0]["options"]).to eq([ "user_id", "material_id" ])
      expect(questions[0]["correctOptionIndex"]).to eq(0)
      expect(questions[0]["sourceMaterialId"]).to eq(material.id)
      expect(questions[0]["sourceSectionId"]).to eq("sec-1")
      expect(questions[1]["kind"]).to eq("open")
      expect(questions[1]["keywords"]).to eq([ "scoping", "AD-13" ])
      expect(questions.map { |q| q["sessionId"] }).to all(eq(client_uuid))
    end

    it "creates a task-scoped session (the plan-free quiz scope — the task triangle)" do
      user, token = user_with_token("task-quizzer@example.com")
      task = create(:study_task, user: user)
      node = task.node

      result = graphql(
        <<~GRAPHQL, variables: { input: quiz_input(SecureRandom.uuid, nil, node.id, task.material_id, task_id: task.id) }, token: token
          mutation CreateQuizSession($input: CreateSessionInput!) {
            createQuizSession(input: $input) {
              session { id planId taskId }
              questions { id nodeId }
            }
          }
        GRAPHQL
      )

      payload = result.dig("data", "createQuizSession")
      expect(payload["session"]["planId"]).to be_nil
      expect(payload["session"]["taskId"]).to eq(task.id)
      expect(payload["questions"].first["nodeId"]).to eq(node.id)
    end

    it "is idempotent on replay with the same client uuid (same rows, no duplicate questions)" do
      user, token = user_with_token("quiz-replayer@example.com")
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan: plan)
      material = create(:material, user: user, plan: plan)
      client_uuid = SecureRandom.uuid
      first = graphql(
        <<~GRAPHQL, variables: { input: quiz_input(client_uuid, plan.id, node.id, material.id) }, token: token
          mutation CreateQuizSession($input: CreateSessionInput!) {
            createQuizSession(input: $input) { session { id } questions { id } }
          }
        GRAPHQL
      )

      replay = graphql(
        <<~GRAPHQL, variables: { input: quiz_input(client_uuid, plan.id, node.id, material.id) }, token: token
          mutation CreateQuizSession($input: CreateSessionInput!) {
            createQuizSession(input: $input) { session { id } questions { id } }
          }
        GRAPHQL
      )

      expect(error_code(replay)).to be_nil
      expect(replay.dig("data", "createQuizSession", "session", "id")).to eq(client_uuid)
      expect(replay.dig("data", "createQuizSession", "questions").map { |q| q["id"] })
        .to eq(first.dig("data", "createQuizSession", "questions").map { |q| q["id"] })
      expect(user.quiz_sessions.count).to eq(1)
      expect(user.questions.count).to eq(2)
    end

    it "fails VALIDATION_FAILED when the client uuid belongs to another user (delta 3)" do
      owner, _owner_token = user_with_token("quiz-uuid-owner@example.com")
      other, other_token = user_with_token("quiz-uuid-collider@example.com")
      foreign_session = create(:quiz_session, user: owner)

      result = graphql(
        "mutation { createQuizSession(input: { clientUuid: \"#{foreign_session.id}\", mode: \"open\", " \
          "planId: \"#{SecureRandom.uuid}\", questions: [] }) { session { id } } }",
        token: other_token
      )

      expect(result.dig("data", "createQuizSession")).to be_nil
      expect(error_code(result)).to eq("VALIDATION_FAILED")
      expect(other.quiz_sessions.count).to eq(0)
    end

    it "answers NOT_FOUND for a foreign node attribution and creates nothing (delta 2)" do
      _owner, _owner_token = user_with_token("node-owner@example.com")
      attacker, attacker_token = user_with_token("node-attacker@example.com")
      attacker_plan = create(:study_plan, user: attacker)
      foreign_node = create(:knowledge_node, user: User.find_by!(email: "node-owner@example.com"))
      own_material = create(:material, user: attacker, plan: attacker_plan)

      result = graphql(
        <<~GRAPHQL, variables: { input: quiz_input(SecureRandom.uuid, attacker_plan.id, foreign_node.id, own_material.id) }, token: attacker_token
          mutation CreateQuizSession($input: CreateSessionInput!) {
            createQuizSession(input: $input) { session { id } }
          }
        GRAPHQL
      )

      expect(result.dig("data", "createQuizSession")).to be_nil
      expect(error_code(result)).to eq("NOT_FOUND")
      expect(attacker.quiz_sessions.count).to eq(0)
      expect(attacker.questions.count).to eq(0)
    end

    it "fails VALIDATION_FAILED when both planId and taskId are named (the ER's exactly-one-owner law)" do
      user, token = user_with_token("double-scope-quiz@example.com")
      plan = create(:study_plan, user: user)
      task = create(:study_task, user: user)

      result = graphql(
        <<~GRAPHQL, variables: { input: quiz_input(SecureRandom.uuid, plan.id, task.node_id, task.material_id, task_id: task.id) }, token: token
          mutation CreateQuizSession($input: CreateSessionInput!) {
            createQuizSession(input: $input) { session { id } }
          }
        GRAPHQL
      )

      expect(result.dig("data", "createQuizSession")).to be_nil
      expect(error_code(result)).to eq("VALIDATION_FAILED")
      expect(user.quiz_sessions.count).to eq(0)
    end
  end

  describe "recordEvidence mutation" do
    it "writes the evidence batch, auto-logs the wrong answer's mistake, and completes the session" do
      user, token = user_with_token("evidence-writer@example.com")
      plan = create(:study_plan, user: user)
      session = create(:quiz_session, user: user, plan: plan)
      node = create(:knowledge_node, user: user, plan: plan)
      material = create(:material, user: user, plan: plan)
      correct = create(:question, user: user, session: session, node: node, source_material: material)
      wrong = create(:question, user: user, session: session, node: node, source_material: material)

      result = graphql(
        <<~GRAPHQL, variables: { input: evidence_input(session.id, correct.id, wrong.id) }, token: token
          mutation RecordEvidence($input: RecordEvidenceInput!) {
            recordEvidence(input: $input) {
              session { id status completedAt }
              evidence { id nodeId sessionId questionId outcome createdAt }
              mistakes { id questionId sessionId nodeId userAnswer
                         sourceLocation { kind page sectionId } forfeited createdAt }
            }
          }
        GRAPHQL
      )

      payload = result.dig("data", "recordEvidence")
      expect(payload["session"]["status"]).to eq("completed")
      expect(payload["session"]["completedAt"]).to be_present
      expect(payload["evidence"].length).to eq(2)
      expect(payload["evidence"].map { |e| e["outcome"] }).to match_array(%w[correct wrong])
      expect(payload["evidence"].map { |e| e["nodeId"] }).to all(eq(node.id))
      expect(payload["evidence"].map { |e| e["sessionId"] }).to all(eq(session.id))

      expect(payload["mistakes"].length).to eq(1)
      mistake = payload["mistakes"].first
      expect(mistake["questionId"]).to eq(wrong.id)
      expect(mistake["userAnswer"]).to eq("scoping lives in the view")
      # The questionSourceLocator mirror: markdown → {kind, sectionId} (TS keys verbatim).
      expect(mistake["sourceLocation"]).to eq("kind" => "markdown", "sectionId" => "sec-1", "page" => nil)
      expect(mistake["forfeited"]).to be(false)
      expect(user.evidence_records.count).to eq(2)
      expect(user.mistake_entries.count).to eq(1)
    end

    it "records a forfeit as outcome wrong with the forfeited flag (「看答案」— no mastery credit)" do
      user, token = user_with_token("forfeiter@example.com")
      session = create(:quiz_session, user: user)
      question = create(:question, user: user, session: session)

      result = graphql(
        "mutation { recordEvidence(input: { sessionId: \"#{session.id}\", results: " \
          "[{ questionId: \"#{question.id}\", outcome: \"wrong\", userAnswer: \"\", forfeited: true }] }) " \
          "{ evidence { outcome } mistakes { userAnswer forfeited } } }",
        token: token
      )

      payload = result.dig("data", "recordEvidence")
      expect(payload["evidence"].first["outcome"]).to eq("wrong")
      expect(payload["mistakes"].first["forfeited"]).to be(true)
    end

    it "writes nothing when one result references a question outside the session (cross-graph, atomic)" do
      user, token = user_with_token("cross-graph@example.com")
      plan = create(:study_plan, user: user)
      session = create(:quiz_session, user: user, plan: plan)
      own_question = create(:question, user: user, session: session)
      # A same-user question of a DIFFERENT session — must not be gradeable here.
      stray_question = create(:question, user: user)

      result = graphql(
        "mutation { recordEvidence(input: { sessionId: \"#{session.id}\", results: " \
          "[{ questionId: \"#{own_question.id}\", outcome: \"correct\", userAnswer: \"a\", forfeited: false }, " \
          "{ questionId: \"#{stray_question.id}\", outcome: \"correct\", userAnswer: \"a\", forfeited: false }] }) " \
          "{ session { id } } }",
        token: token
      )

      expect(result.dig("data", "recordEvidence")).to be_nil
      expect(error_code(result)).to eq("VALIDATION_FAILED")
      expect(user.evidence_records.count).to eq(0)
      expect(user.mistake_entries.count).to eq(0)
      expect(session.reload.status).to eq("active")
    end

    it "answers NOT_FOUND for another user's session and writes nothing (delta 2)" do
      _owner, _owner_token = user_with_token("evidence-owner@example.com")
      attacker, attacker_token = user_with_token("evidence-attacker@example.com")
      foreign_session = create(:quiz_session, user: User.find_by!(email: "evidence-owner@example.com"))

      result = graphql(
        "mutation { recordEvidence(input: { sessionId: \"#{foreign_session.id}\", results: [] }) " \
          "{ session { id } } }",
        token: attacker_token
      )

      expect(result.dig("data", "recordEvidence")).to be_nil
      expect(error_code(result)).to eq("NOT_FOUND")
      expect(attacker.evidence_records.count).to eq(0)
      expect(foreign_session.reload.status).to eq("active")
    end

    it "fails VALIDATION_FAILED for an outcome outside the evidence vocabulary" do
      user, token = user_with_token("bad-outcome@example.com")
      session = create(:quiz_session, user: user)
      question = create(:question, user: user, session: session)

      result = graphql(
        "mutation { recordEvidence(input: { sessionId: \"#{session.id}\", results: " \
          "[{ questionId: \"#{question.id}\", outcome: \"almost\", userAnswer: \"a\", forfeited: false }] }) " \
          "{ session { id } } }",
        token: token
      )

      expect(result.dig("data", "recordEvidence")).to be_nil
      expect(error_code(result)).to eq("VALIDATION_FAILED")
      expect(user.evidence_records.count).to eq(0)
    end
  end

  describe "abandonQuizSession mutation" do
    it "marks an active session abandoned and writes no evidence" do
      user, token = user_with_token("abandoner@example.com")
      session = create(:quiz_session, user: user)

      result = graphql(
        "mutation { abandonQuizSession(input: { id: \"#{session.id}\" }) { session { id status completedAt } } }",
        token: token
      )

      payload = result.dig("data", "abandonQuizSession")
      expect(payload["session"]["status"]).to eq("abandoned")
      expect(payload["session"]["completedAt"]).to be_nil
      expect(user.evidence_records.count).to eq(0)
    end

    it "answers NOT_FOUND for a foreign session (delta 2)" do
      _owner, token = user_with_token("abandon-not-owner@example.com")
      foreign = create(:quiz_session, user: create(:user))

      result = graphql("mutation { abandonQuizSession(input: { id: \"#{foreign.id}\" }) { session { id } } }",
                       token: token)

      expect(result.dig("data", "abandonQuizSession")).to be_nil
      expect(error_code(result)).to eq("NOT_FOUND")
      expect(foreign.reload.status).to eq("active")
    end
  end

  describe "quizSession query" do
    it "returns one session with its node-attributed questions in generation order" do
      user, token = user_with_token("quiz-reader@example.com")
      session = create(:quiz_session, user: user)
      first_question = create(:question, user: user, session: session)
      second_question = create(:question, user: user, session: session)

      result = graphql(
        <<~GRAPHQL, variables: { id: session.id }, token: token
          query QuizSessionDetail($id: String!) {
            quizSession(id: $id) {
              id planId taskId mode status completedAt createdAt
              questions { id sessionId nodeId kind prompt options keywords explanation
                          sourceMaterialId sourceSectionId correctOptionIndex }
            }
          }
        GRAPHQL
      )

      payload = result.dig("data", "quizSession")
      expect(payload["id"]).to eq(session.id)
      expect(payload["status"]).to eq("active")
      # Generation order: the questions were created first → second, and the
      # association reads back in insertion order (created_at; each INSERT is
      # a separate statement, so the timestamps order deterministically).
      expect(payload["questions"].map { |q| q["id"] }).to eq([ first_question.id, second_question.id ])
    end

    it "answers NOT_FOUND for a foreign, unknown, or non-uuid session id" do
      _owner, token = user_with_token("quiz-not-owner@example.com")
      foreign = create(:quiz_session, user: create(:user))

      aggregate_failures do
        foreign_result = graphql("query($id: String!) { quizSession(id: $id) { id } }",
                                 variables: { id: foreign.id }, token: token)
        expect(error_code(foreign_result)).to eq("NOT_FOUND")

        unknown_result = graphql("query($id: String!) { quizSession(id: $id) { id } }",
                                 variables: { id: SecureRandom.uuid }, token: token)
        expect(error_code(unknown_result)).to eq("NOT_FOUND")

        malformed_result = graphql('query { quizSession(id: "garbage") { id } }', token: token)
        expect(error_code(malformed_result)).to eq("NOT_FOUND")
      end
    end
  end

  describe "evidence query" do
    it "lists all of the caller's evidence, own-only via a real second user" do
      user, token = user_with_token("evidence-lister@example.com")
      own = [
        create(:evidence_record, user: user, node: create(:knowledge_node, user: user)),
        create(:evidence_record, user: user, node: create(:knowledge_node, user: user), outcome: "partial")
      ]
      create(:evidence_record, user: create(:user))

      result = graphql("query { evidence { id nodeId outcome createdAt } }", token: token)

      evidence = result.dig("data", "evidence")
      expect(evidence.map { |e| e["id"] }).to match_array(own.map(&:id))
      expect(evidence.map { |e| e["outcome"] }).to match_array(%w[correct partial])
    end

    it "scopes by node (the listEvidenceByNode mirror) and answers NOT_FOUND for a foreign node" do
      user, token = user_with_token("evidence-scoper@example.com")
      node = create(:knowledge_node, user: user)
      other_node = create(:knowledge_node, user: user)
      records = [
        create(:evidence_record, user: user, node: node, outcome: "wrong"),
        create(:evidence_record, user: user, node: node)
      ]
      create(:evidence_record, user: user, node: other_node)

      scoped = graphql("query($id: String!) { evidence(nodeId: $id) { id nodeId } }",
                       variables: { id: node.id }, token: token)
      expect(scoped.dig("data", "evidence").map { |e| e["id"] }).to match_array(records.map(&:id))

      foreign_node = create(:knowledge_node, user: create(:user))
      foreign = graphql("query($id: String!) { evidence(nodeId: $id) { id } }",
                        variables: { id: foreign_node.id }, token: token)
      expect(foreign.dig("data", "evidence")).to be_nil
      expect(error_code(foreign)).to eq("NOT_FOUND")
    end
  end

  describe "createFlashcards + rateFlashcard mutations" do
    it "persists a deck on the material with its cards in input order" do
      user, token = user_with_token("deck-creator@example.com")
      material = create(:material, user: user)
      first_uuid = SecureRandom.uuid
      second_uuid = SecureRandom.uuid

      result = graphql(
        <<~GRAPHQL, variables: { input: deck_input(material.id, [ first_uuid, second_uuid ]) }, token: token
          mutation CreateFlashcards($input: CreateFlashcardsInput!) {
            createFlashcards(input: $input) {
              cards { id materialId nodeId front back difficulty createdAt }
            }
          }
        GRAPHQL
      )

      cards = result.dig("data", "createFlashcards", "cards")
      expect(cards.map { |c| c["id"] }).to eq([ first_uuid, second_uuid ])
      expect(cards.map { |c| c["materialId"] }).to all(eq(material.id))
      expect(cards.map { |c| c["nodeId"] }).to all(be_nil)
      expect(cards.map { |c| c["difficulty"] }).to all(be_nil)
      expect(cards.first["front"]).to eq("Front 1")
      expect(cards.last["back"]).to eq("Back 2")
    end

    it "is idempotent on replay with the same client uuids (same rows, no duplicates)" do
      user, token = user_with_token("deck-replayer@example.com")
      material = create(:material, user: user)
      card_uuid = SecureRandom.uuid

      graphql("mutation { createFlashcards(input: { materialId: \"#{material.id}\", " \
                "cards: [{ clientUuid: \"#{card_uuid}\", front: \"f\", back: \"b\" }] }) { cards { id } } }",
              token: token)
      replay = graphql("mutation { createFlashcards(input: { materialId: \"#{material.id}\", " \
                         "cards: [{ clientUuid: \"#{card_uuid}\", front: \"f\", back: \"b\" }] }) { cards { id } } }",
                       token: token)

      expect(error_code(replay)).to be_nil
      expect(replay.dig("data", "createFlashcards", "cards").map { |c| c["id"] }).to eq([ card_uuid ])
      expect(user.flashcards.count).to eq(1)
    end

    it "fails VALIDATION_FAILED when a card's client uuid belongs to another user (delta 3)" do
      owner, _owner_token = user_with_token("card-uuid-owner@example.com")
      other, other_token = user_with_token("card-uuid-collider@example.com")
      foreign_card = create(:flashcard, user: owner)

      result = graphql(
        "mutation { createFlashcards(input: { materialId: \"#{SecureRandom.uuid}\", " \
          "cards: [{ clientUuid: \"#{foreign_card.id}\", front: \"f\", back: \"b\" }] }) { cards { id } } }",
        token: other_token
      )

      expect(result.dig("data", "createFlashcards")).to be_nil
      expect(error_code(result)).to eq("VALIDATION_FAILED")
      expect(other.flashcards.count).to eq(0)
    end

    it "answers NOT_FOUND for a foreign material (delta 2)" do
      _owner, token = user_with_token("deck-attacker@example.com")
      foreign_material = create(:material, user: create(:user))

      result = graphql(
        "mutation { createFlashcards(input: { materialId: \"#{foreign_material.id}\", " \
          "cards: [{ clientUuid: \"#{SecureRandom.uuid}\", front: \"f\", back: \"b\" }] }) { cards { id } } }",
        token: token
      )

      expect(result.dig("data", "createFlashcards")).to be_nil
      expect(error_code(result)).to eq("NOT_FOUND")
    end

    it "writes the difficulty self-rating and creates NO evidence (the delta-5 law, over HTTP)" do
      user, token = user_with_token("rater@example.com")
      card = create(:flashcard, user: user)
      node = create(:knowledge_node, user: user)
      create(:evidence_record, user: user, node: node)

      result = graphql(
        "mutation { rateFlashcard(input: { id: \"#{card.id}\", difficulty: \"medium\" }) " \
          "{ flashcard { id difficulty } } }",
        token: token
      )

      expect(result.dig("data", "rateFlashcard", "flashcard", "difficulty")).to eq("medium")
      # The evidence table is untouched by design — the one pre-existing quiz row is all there is.
      expect(user.evidence_records.count).to eq(1)
      expect(card.reload.difficulty).to eq("medium")
    end

    it "answers NOT_FOUND for a foreign card id (delta 2)" do
      _owner, token = user_with_token("rater-not-owner@example.com")
      foreign_card = create(:flashcard, user: create(:user))

      result = graphql(
        "mutation { rateFlashcard(input: { id: \"#{foreign_card.id}\", difficulty: \"easy\" }) " \
          "{ flashcard { id } } }",
        token: token
      )

      expect(result.dig("data", "rateFlashcard")).to be_nil
      expect(error_code(result)).to eq("NOT_FOUND")
      expect(foreign_card.reload.difficulty).to be_nil
    end
  end

  describe "flashcards query" do
    it "scopes by material (the listFlashcardsByMaterial mirror) and by plan (the listFlashcardsByPlan mirror)" do
      user, token = user_with_token("deck-lister@example.com")
      plan = create(:study_plan, user: user)
      plan_material = create(:material, user: user, plan: plan)
      plan_card = create(:flashcard, user: user, material: plan_material)
      task_card = create(:flashcard, user: user)
      unattached_material = create(:material, user: user)
      unattached_card = create(:flashcard, user: user, material: unattached_material)

      by_material = graphql("query($id: String!) { flashcards(materialId: $id) { id } }",
                            variables: { id: task_card.material_id }, token: token)
      expect(by_material.dig("data", "flashcards").map { |c| c["id"] }).to eq([ task_card.id ])

      by_plan = graphql("query($id: String!) { flashcards(planId: $id) { id } }",
                        variables: { id: plan.id }, token: token)
      expect(by_plan.dig("data", "flashcards").map { |c| c["id"] }).to eq([ plan_card.id ])

      # The unscoped material's deck exists but is reachable only via its material/plan scope.
      expect(unattached_card.material_id).to eq(unattached_material.id)
    end

    it "answers NOT_FOUND for a foreign scope and fails VALIDATION_FAILED for both or neither scopes" do
      user, token = user_with_token("deck-scoper@example.com")
      foreign_material = create(:material, user: create(:user))
      foreign_plan = create(:study_plan, user: create(:user))
      own_material = create(:material, user: user)

      aggregate_failures do
        foreign = graphql("query($id: String!) { flashcards(materialId: $id) { id } }",
                          variables: { id: foreign_material.id }, token: token)
        expect(foreign.dig("data", "flashcards")).to be_nil
        expect(error_code(foreign)).to eq("NOT_FOUND")

        foreign_plan_result = graphql("query($id: String!) { flashcards(planId: $id) { id } }",
                                      variables: { id: foreign_plan.id }, token: token)
        expect(foreign_plan_result.dig("data", "flashcards")).to be_nil
        expect(error_code(foreign_plan_result)).to eq("NOT_FOUND")

        both = graphql("query($m: String!, $p: String!) { flashcards(materialId: $m, planId: $p) { id } }",
                       variables: { m: own_material.id, p: SecureRandom.uuid }, token: token)
        expect(both.dig("data", "flashcards")).to be_nil
        expect(error_code(both)).to eq("VALIDATION_FAILED")

        neither = graphql("query { flashcards { id } }", token: token)
        expect(neither.dig("data", "flashcards")).to be_nil
        expect(error_code(neither)).to eq("VALIDATION_FAILED")
      end
    end
  end

  private

  def quiz_input(client_uuid, plan_id, node_id, material_id, task_id: nil)
    {
      clientUuid: client_uuid,
      planId: plan_id,
      taskId: task_id,
      mode: "mix",
      questions: [
        {
          nodeId: node_id,
          kind: "choice",
          prompt: "Which column scopes every user-owned row?",
          options: [ "user_id", "material_id" ],
          correctOptionIndex: 0,
          sourceMaterialId: material_id,
          sourceSectionId: "sec-1",
          explanation: "AD-13: every row carries its owner."
        },
        {
          nodeId: node_id,
          kind: "open",
          prompt: "Why does every row carry a user_id?",
          sourceMaterialId: material_id,
          sourceSectionId: "sec-1",
          keywords: [ "scoping", "AD-13" ],
          explanation: "Node attribution at generation time (AD-6)."
        }
      ]
    }
  end

  def evidence_input(session_id, correct_question_id, wrong_question_id)
    {
      sessionId: session_id,
      results: [
        { questionId: correct_question_id, outcome: "correct", userAnswer: "user_id", forfeited: false },
        { questionId: wrong_question_id, outcome: "wrong", userAnswer: "scoping lives in the view", forfeited: false }
      ]
    }
  end

  def deck_input(material_id, card_uuids)
    {
      materialId: material_id,
      cards: card_uuids.map.with_index do |uuid, index|
        { clientUuid: uuid, front: "Front #{index + 1}", back: "Back #{index + 1}" }
      end
    }
  end
end
