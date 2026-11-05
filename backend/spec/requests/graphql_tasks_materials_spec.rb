# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL study task + material operations (epic P2-3 ticket 02)", type: :request do
  # Direct GraphQL execution over HTTP (AD-10, the epic-02 request-spec
  # pattern): real register/login for tokens, real second users for scoping,
  # typed failure codes read off extensions.code. The commands underneath
  # have their own direct specs (spec/commands/tasks/, spec/commands/
  # materials/); this file pins the wire behavior.

  describe "the auth guard on every task/material operation (kickoff delta 8)" do
    it "answers UNAUTHORIZED without a token on all seven operations" do
      queries = [
        "query { tasks { id } }",
        'query { task(id: "00000000-0000-0000-0000-000000000000") { id } }',
        "query { materials { id } }",
        'query { material(id: "00000000-0000-0000-0000-000000000000") { id } }'
      ]
      mutations = [
        "mutation { createTask(input: { clientUuid: \"#{SecureRandom.uuid}\", " \
          "materialId: \"#{SecureRandom.uuid}\" }) { task { id } } }",
        "mutation { attachMaterial(input: { clientUuid: \"#{SecureRandom.uuid}\", title: \"t\", " \
          "kind: \"markdown\", sizeBytes: 1, sections: [] }) { material { id } } }",
        "mutation { setMaterialParseResult(input: { id: \"#{SecureRandom.uuid}\", state: \"parsed\", " \
          "sections: [] }) { material { id } } }"
      ]

      queries.each do |query|
        expect(error_code(graphql(query))).to eq("UNAUTHORIZED")
      end
      mutations.each do |mutation|
        expect(error_code(graphql(mutation))).to eq("UNAUTHORIZED")
      end
    end
  end

  describe "createTask mutation" do
    it "creates the task with its auto-owned node in one call (planId null, taskId set, material back-linked)" do
      user, token = user_with_token("task-creator@example.com")
      material = create(:material, user: user)
      client_uuid = SecureRandom.uuid

      result = graphql(
        <<~GRAPHQL, variables: { input: { clientUuid: client_uuid, materialId: material.id } }, token: token
          mutation CreateTask($input: CreateTaskInput!) {
            createTask(input: $input) {
              task { id materialId nodeId createdAt node { id planId taskId title order stage } }
              node { id planId taskId title order stage }
            }
          }
        GRAPHQL
      )

      payload = result.dig("data", "createTask")
      expect(payload["task"]["id"]).to eq(client_uuid)
      expect(payload["task"]["materialId"]).to eq(material.id)
      expect(payload["task"]["createdAt"]).to be_present
      expect(payload["task"]["node"]["id"]).to eq(payload["node"]["id"])
      # AD-6: the task's one auto-created node — planId null, taskId set,
      # titled after the material, stageless, at order 0 (Phase-1 mirror).
      expect(payload["node"]["planId"]).to be_nil
      expect(payload["node"]["taskId"]).to eq(client_uuid)
      expect(payload["node"]["title"]).to eq(material.title)
      expect(payload["node"]["stage"]).to be_nil
      expect(payload["node"]["order"]).to eq(0)

      task = user.study_tasks.find(client_uuid)
      expect(task.node_id).to eq(payload["node"]["id"])
      expect(material.reload.task_id).to eq(client_uuid)
    end

    it "is idempotent on replay with the same client uuid (same rows, no duplicates)" do
      user, token = user_with_token("task-replayer@example.com")
      material = create(:material, user: user)
      client_uuid = SecureRandom.uuid
      first = graphql(
        "mutation { createTask(input: { clientUuid: \"#{client_uuid}\", " \
          "materialId: \"#{material.id}\" }) { task { id } node { id } } }",
        token: token
      )

      replay = graphql(
        "mutation { createTask(input: { clientUuid: \"#{client_uuid}\", " \
          "materialId: \"#{material.id}\" }) { task { id } node { id } } }",
        token: token
      )

      expect(error_code(replay)).to be_nil
      expect(replay.dig("data", "createTask", "task", "id")).to eq(client_uuid)
      expect(replay.dig("data", "createTask", "node", "id"))
        .to eq(first.dig("data", "createTask", "node", "id"))
      expect(user.study_tasks.count).to eq(1)
      expect(user.knowledge_nodes.where(task_id: client_uuid).count).to eq(1)
    end

    it "fails VALIDATION_FAILED when the client uuid belongs to another user (delta 3)" do
      owner, _owner_token = user_with_token("task-uuid-owner@example.com")
      other, other_token = user_with_token("task-uuid-collider@example.com")
      foreign_task = create(:study_task, user: owner)

      result = graphql(
        "mutation { createTask(input: { clientUuid: \"#{foreign_task.id}\", " \
          "materialId: \"#{SecureRandom.uuid}\" }) { task { id } } }",
        token: other_token
      )

      expect(result.dig("data", "createTask")).to be_nil
      expect(error_code(result)).to eq("VALIDATION_FAILED")
      expect(other.study_tasks.count).to eq(0)
    end

    it "answers NOT_FOUND for another user's material id and creates nothing (delta 2)" do
      _owner, _owner_token = user_with_token("material-owner@example.com")
      attacker, attacker_token = user_with_token("task-attacker@example.com")
      foreign_material = create(:material, user: User.find_by!(email: "material-owner@example.com"))

      result = graphql(
        "mutation { createTask(input: { clientUuid: \"#{SecureRandom.uuid}\", " \
          "materialId: \"#{foreign_material.id}\" }) { task { id } } }",
        token: attacker_token
      )

      expect(result.dig("data", "createTask")).to be_nil
      expect(error_code(result)).to eq("NOT_FOUND")
      expect(attacker.study_tasks.count).to eq(0)
      expect(foreign_material.reload.task_id).to be_nil
    end

    it "fails VALIDATION_FAILED when the material already belongs to a study task" do
      user, token = user_with_token("re-tasker@example.com")
      tasked_material = create(:study_task, user: user).material

      result = graphql(
        "mutation { createTask(input: { clientUuid: \"#{SecureRandom.uuid}\", " \
          "materialId: \"#{tasked_material.id}\" }) { task { id } } }",
        token: token
      )

      expect(result.dig("data", "createTask")).to be_nil
      expect(error_code(result)).to eq("VALIDATION_FAILED")
      expect(user.study_tasks.count).to eq(1)
    end
  end

  describe "tasks + task queries" do
    it "lists only the caller's tasks, with a real second user proving the scope" do
      user, token = user_with_token("task-lister@example.com")
      first_task = create(:study_task, user: user)
      second_task = create(:study_task, user: user)
      create(:study_task, user: create(:user))

      result = graphql("query { tasks { id materialId nodeId createdAt } }", token: token)

      tasks = result.dig("data", "tasks")
      expect(tasks.map { |t| t["id"] }).to match_array([ first_task.id, second_task.id ])
      expect(tasks.first["materialId"]).to eq(first_task.material_id)
      expect(tasks.first["nodeId"]).to eq(first_task.node_id)
      expect(tasks.first["createdAt"]).to be_present
    end

    it "returns one task with its auto-owned node readable off it" do
      user, token = user_with_token("task-detail@example.com")
      task = create(:study_task, user: user)

      result = graphql(
        <<~GRAPHQL, variables: { id: task.id }, token: token
          query TaskDetail($id: String!) {
            task(id: $id) {
              id materialId nodeId createdAt
              node { id planId taskId title }
            }
          }
        GRAPHQL
      )

      payload = result.dig("data", "task")
      expect(payload["id"]).to eq(task.id)
      expect(payload["materialId"]).to eq(task.material_id)
      expect(payload["node"]["id"]).to eq(task.node_id)
      expect(payload["node"]["planId"]).to be_nil
      expect(payload["node"]["taskId"]).to eq(task.id)
    end

    it "answers NOT_FOUND for another user's task id (uniform NOT_FOUND, delta 2)" do
      _owner, token = user_with_token("task-not-owner@example.com")
      foreign_task = create(:study_task, user: create(:user))

      result = graphql("query($id: String!) { task(id: $id) { id } }", variables: { id: foreign_task.id },
                                                                                 token: token)

      expect(result.dig("data", "task")).to be_nil
      expect(error_code(result)).to eq("NOT_FOUND")
    end

    it "answers NOT_FOUND for an unknown or non-uuid task id" do
      _user, token = user_with_token("task-unknown@example.com")

      aggregate_failures do
        unknown = graphql("query($id: String!) { task(id: $id) { id } }",
                          variables: { id: SecureRandom.uuid }, token: token)
        expect(error_code(unknown)).to eq("NOT_FOUND")
        malformed = graphql('query { task(id: "garbage") { id } }', token: token)
        expect(error_code(malformed)).to eq("NOT_FOUND")
      end
    end
  end

  describe "attachMaterial mutation" do
    it "attaches a material with metadata, sections, and the derived parse state" do
      user, token = user_with_token("attacher@example.com")
      client_uuid = SecureRandom.uuid

      result = graphql(
        <<~GRAPHQL, variables: { input: attach_input(client_uuid) }, token: token
          mutation AttachMaterial($input: AttachMaterialInput!) {
            attachMaterial(input: $input) {
              material { id title kind sizeBytes planId taskId parseState parseFailureReason
                         sections { id title text } createdAt }
            }
          }
        GRAPHQL
      )

      payload = result.dig("data", "attachMaterial", "material")
      expect(payload["id"]).to eq(client_uuid)
      expect(payload["title"]).to eq("Lecture notes: distributed systems")
      expect(payload["kind"]).to eq("markdown")
      expect(payload["sizeBytes"]).to eq(20_488)
      expect(payload["planId"]).to be_nil
      expect(payload["taskId"]).to be_nil
      # Phase-1 derivation: no parseState given + sections present → "parsed".
      expect(payload["parseState"]).to eq("parsed")
      expect(payload["parseFailureReason"]).to be_nil
      expect(payload["sections"]).to eq(
        [
          { "id" => "sec-1", "title" => "Introduction", "text" => "Scoping, commands, and the spine ER." },
          { "id" => "page-2", "title" => "Page 2", "text" => "The bounded extracted text." }
        ]
      )
      expect(payload["createdAt"]).to be_present
      expect(user.materials.find(client_uuid).sections.length).to eq(2)
    end

    it "attaches under a plan and shows up in the plan's materials association" do
      user, token = user_with_token("plan-attacher@example.com")
      plan = create(:study_plan, user: user)
      client_uuid = SecureRandom.uuid

      result = graphql(
        <<~GRAPHQL, variables: { input: attach_input(client_uuid, planId: plan.id) }, token: token
          mutation AttachMaterial($input: AttachMaterialInput!) {
            attachMaterial(input: $input) { material { id planId } }
          }
        GRAPHQL
      )

      expect(result.dig("data", "attachMaterial", "material", "planId")).to eq(plan.id)

      detail = graphql(
        <<~GRAPHQL, variables: { id: plan.id }, token: token
          query PlanDetail($id: String!) {
            plan(id: $id) { id materials { id planId title } }
          }
        GRAPHQL
      )
      materials = detail.dig("data", "plan", "materials")
      expect(materials.map { |m| m["id"] }).to eq([ client_uuid ])
      expect(materials.first["title"]).to eq("Lecture notes: distributed systems")
    end

    it "defaults the parse state to pending when no sections were extracted" do
      _user, token = user_with_token("pending-attacher@example.com")

      result = graphql(
        "mutation { attachMaterial(input: { clientUuid: \"#{SecureRandom.uuid}\", title: \"t\", " \
          "kind: \"pdf\", sizeBytes: 5, sections: [] }) { material { parseState } } }",
        token: token
      )

      expect(result.dig("data", "attachMaterial", "material", "parseState")).to eq("pending")
    end

    it "persists a failed parse with its reason" do
      _user, token = user_with_token("failed-attacher@example.com")

      result = graphql(
        "mutation { attachMaterial(input: { clientUuid: \"#{SecureRandom.uuid}\", title: \"t\", " \
          "kind: \"pdf\", sizeBytes: 5, sections: [], parseState: \"failed\", " \
          "parseFailureReason: \"encrypted\" }) { material { parseState parseFailureReason } } }",
        token: token
      )

      material = result.dig("data", "attachMaterial", "material")
      expect(material["parseState"]).to eq("failed")
      expect(material["parseFailureReason"]).to eq("encrypted")
    end

    it "is idempotent on re-upload with the same client uuid (replay, original payload stands)" do
      user, token = user_with_token("re-uploader@example.com")
      client_uuid = SecureRandom.uuid
      graphql(<<~GRAPHQL, variables: { input: attach_input(client_uuid) }, token: token)
        mutation AttachMaterial($input: AttachMaterialInput!) {
          attachMaterial(input: $input) { material { id } }
        }
      GRAPHQL

      replay = graphql(
        <<~GRAPHQL, variables: { input: attach_input(client_uuid, title: "re-uploaded title") }, token: token
          mutation AttachMaterial($input: AttachMaterialInput!) {
            attachMaterial(input: $input) { material { id title sections { id } } }
          }
        GRAPHQL
      )

      expect(error_code(replay)).to be_nil
      expect(replay.dig("data", "attachMaterial", "material", "id")).to eq(client_uuid)
      expect(replay.dig("data", "attachMaterial", "material", "title"))
        .to eq("Lecture notes: distributed systems")
      expect(user.materials.count).to eq(1)
    end

    it "fails VALIDATION_FAILED when the client uuid belongs to another user (delta 3)" do
      owner, _owner_token = user_with_token("material-uuid-owner@example.com")
      other, other_token = user_with_token("material-uuid-collider@example.com")
      owned = create(:material, user: owner)

      result = graphql(
        <<~GRAPHQL, variables: { input: attach_input(owned.id) }, token: other_token
          mutation AttachMaterial($input: AttachMaterialInput!) {
            attachMaterial(input: $input) { material { id } }
          }
        GRAPHQL
      )

      expect(result.dig("data", "attachMaterial")).to be_nil
      expect(error_code(result)).to eq("VALIDATION_FAILED")
      expect(other.materials.count).to eq(0)
    end

    it "fails VALIDATION_FAILED beyond the 100,000-character per-section cap (kickoff delta 6)" do
      _user, token = user_with_token("oversized@example.com")

      result = graphql(
        <<~GRAPHQL, token: token
          mutation {
            attachMaterial(input: { clientUuid: "#{SecureRandom.uuid}", title: "t", kind: "markdown",
                                    sizeBytes: 1,
                                    sections: [{ id: "sec-1", title: "Huge", text: "#{("a" * 100_001)}" }] }) {
              material { id }
            }
          }
        GRAPHQL
      )

      expect(result.dig("data", "attachMaterial")).to be_nil
      expect(error_code(result)).to eq("VALIDATION_FAILED")
    end

    it "fails VALIDATION_FAILED for an invalid kind or a reason without a failed state" do
      _user, token = user_with_token("invalid-payload@example.com")

      aggregate_failures do
        bad_kind = graphql(
          "mutation { attachMaterial(input: { clientUuid: \"#{SecureRandom.uuid}\", title: \"t\", " \
            "kind: \"docx\", sizeBytes: 1, sections: [] }) { material { id } } }",
          token: token
        )
        expect(error_code(bad_kind)).to eq("VALIDATION_FAILED")

        orphan_reason = graphql(
          "mutation { attachMaterial(input: { clientUuid: \"#{SecureRandom.uuid}\", title: \"t\", " \
            "kind: \"pdf\", sizeBytes: 1, sections: [], parseState: \"parsed\", " \
            "parseFailureReason: \"corrupt\" }) { material { id } } }",
          token: token
        )
        expect(error_code(orphan_reason)).to eq("VALIDATION_FAILED")
      end
    end

    it "answers NOT_FOUND for a foreign plan scope (delta 2)" do
      _owner, token = user_with_token("scope-attacker@example.com")
      foreign_plan = create(:study_plan, user: create(:user))

      result = graphql(
        <<~GRAPHQL, variables: { input: attach_input(SecureRandom.uuid, planId: foreign_plan.id) }, token: token
          mutation AttachMaterial($input: AttachMaterialInput!) {
            attachMaterial(input: $input) { material { id } }
          }
        GRAPHQL
      )

      expect(result.dig("data", "attachMaterial")).to be_nil
      expect(error_code(result)).to eq("NOT_FOUND")
    end
  end

  describe "setMaterialParseResult mutation" do
    it "writes the parse outcome back: sections replaced and the state parsed" do
      user, token = user_with_token("parse-writer@example.com")
      material = create(:material, user: user) # pending, factory section

      result = graphql(
        <<~GRAPHQL, variables: { input: parse_input(material.id) }, token: token
          mutation SetParseResult($input: SetMaterialParseResultInput!) {
            setMaterialParseResult(input: $input) {
              material { id parseState parseFailureReason sections { id title text } }
            }
          }
        GRAPHQL
      )

      material_payload = result.dig("data", "setMaterialParseResult", "material")
      expect(material_payload["parseState"]).to eq("parsed")
      expect(material_payload["parseFailureReason"]).to be_nil
      expect(material_payload["sections"].map { |s| s["id"] }).to eq([ "sec-parsed" ])
      expect(user.materials.find(material.id).sections.first["text"]).to eq("The parsed extracted text.")
    end

    it "stores a failed outcome with the reason defaulted to unknown when absent" do
      user, token = user_with_token("parse-failer@example.com")
      material = create(:material, user: user)

      result = graphql(
        "mutation { setMaterialParseResult(input: { id: \"#{material.id}\", state: \"failed\", " \
          "sections: [] }) { material { parseState parseFailureReason title } } }",
        token: token
      )

      material_payload = result.dig("data", "setMaterialParseResult", "material")
      expect(material_payload["parseState"]).to eq("failed")
      expect(material_payload["parseFailureReason"]).to eq("unknown")
      # A failure keeps the metadata (Phase-1 mirror).
      expect(material_payload["title"]).to eq("Distributed systems lecture notes")
      expect(user.materials.find(material.id).parse_failure_reason).to eq("unknown")
    end

    it "answers NOT_FOUND for another user's material id and writes nothing (delta 2)" do
      _owner, _owner_token = user_with_token("parse-owner@example.com")
      attacker, attacker_token = user_with_token("parse-attacker@example.com")
      foreign = create(:material, user: User.find_by!(email: "parse-owner@example.com"))

      result = graphql(
        <<~GRAPHQL, variables: { input: parse_input(foreign.id) }, token: attacker_token
          mutation SetParseResult($input: SetMaterialParseResultInput!) {
            setMaterialParseResult(input: $input) { material { id } }
          }
        GRAPHQL
      )

      expect(result.dig("data", "setMaterialParseResult")).to be_nil
      expect(error_code(result)).to eq("NOT_FOUND")
      expect(foreign.reload.parse_state).to eq("pending")
      expect(attacker.materials.count).to eq(0)
    end

    it "fails VALIDATION_FAILED for a write-back state outside parsed/failed" do
      user, token = user_with_token("parse-state@example.com")
      material = create(:material, user: user)

      result = graphql(
        "mutation { setMaterialParseResult(input: { id: \"#{material.id}\", state: \"parsing\", " \
          "sections: [] }) { material { id } } }",
        token: token
      )

      expect(result.dig("data", "setMaterialParseResult")).to be_nil
      expect(error_code(result)).to eq("VALIDATION_FAILED")
      expect(material.reload.parse_state).to eq("pending")
    end
  end

  describe "materials + material queries (scoped reads)" do
    it "lists all of the caller's materials without arguments, own-only via a real second user" do
      user, token = user_with_token("material-lister@example.com")
      own = [ create(:material, user: user), create(:material, user: user, title: "second") ]
      create(:material, user: create(:user))

      result = graphql("query { materials { id title kind sizeBytes createdAt } }", token: token)

      materials = result.dig("data", "materials")
      expect(materials.map { |m| m["id"] }).to match_array(own.map(&:id))
      expect(materials.first["kind"]).to eq("markdown")
      expect(materials.first["sizeBytes"]).to eq(12_345)
    end

    it "scopes by plan (the listMaterialsByPlan mirror) and by task (the listMaterialsByTask mirror)" do
      user, token = user_with_token("material-scope@example.com")
      plan = create(:study_plan, user: user)
      plan_material = create(:material, user: user, plan: plan)
      task = create(:study_task, user: user)
      task_material = task.material
      create(:material, user: user) # unscoped material

      plan_scoped = graphql("query($id: String!) { materials(planId: $id) { id } }",
                            variables: { id: plan.id }, token: token)
      task_scoped = graphql("query($id: String!) { materials(taskId: $id) { id } }",
                            variables: { id: task.id }, token: token)

      expect(plan_scoped.dig("data", "materials").map { |m| m["id"] }).to eq([ plan_material.id ])
      expect(task_scoped.dig("data", "materials").map { |m| m["id"] }).to eq([ task_material.id ])
    end

    it "answers NOT_FOUND when scoping by a foreign plan or task id (delta 2)" do
      _user, token = user_with_token("scope-not-owner@example.com")
      other = create(:user)
      foreign_plan = create(:study_plan, user: other)
      foreign_task = create(:study_task, user: other)

      aggregate_failures do
        plan_scope = graphql("query($id: String!) { materials(planId: $id) { id } }",
                             variables: { id: foreign_plan.id }, token: token)
        expect(plan_scope.dig("data", "materials")).to be_nil
        expect(error_code(plan_scope)).to eq("NOT_FOUND")

        task_scope = graphql("query($id: String!) { materials(taskId: $id) { id } }",
                             variables: { id: foreign_task.id }, token: token)
        expect(task_scope.dig("data", "materials")).to be_nil
        expect(error_code(task_scope)).to eq("NOT_FOUND")
      end
    end

    it "fails VALIDATION_FAILED when scoped by plan and task at once" do
      user, token = user_with_token("double-scope@example.com")
      plan = create(:study_plan, user: user)
      task = create(:study_task, user: user)

      result = graphql(
        "query($p: String!, $t: String!) { materials(planId: $p, taskId: $t) { id } }",
        variables: { p: plan.id, t: task.id },
        token: token
      )

      expect(result.dig("data", "materials")).to be_nil
      expect(error_code(result)).to eq("VALIDATION_FAILED")
    end

    it "returns one material's detail with its sections (the getMaterial mirror)" do
      user, token = user_with_token("material-detail@example.com")
      material = create(:material, user: user)

      result = graphql(
        <<~GRAPHQL, variables: { id: material.id }, token: token
          query MaterialDetail($id: String!) {
            material(id: $id) {
              id title kind sizeBytes planId taskId parseState parseFailureReason
              sections { id title text }
              createdAt
            }
          }
        GRAPHQL
      )

      payload = result.dig("data", "material")
      expect(payload["id"]).to eq(material.id)
      expect(payload["parseState"]).to eq("pending")
      expect(payload["sections"]).to eq(
        [ { "id" => "sec-1", "title" => "Introduction", "text" => "Scoping, commands, and the spine ER." } ]
      )
      expect(payload["taskId"]).to be_nil
    end

    it "answers NOT_FOUND for a foreign, unknown, or non-uuid material id" do
      _owner, token = user_with_token("material-not-owner@example.com")
      foreign = create(:material, user: create(:user))

      aggregate_failures do
        foreign_result = graphql("query($id: String!) { material(id: $id) { id } }",
                                 variables: { id: foreign.id }, token: token)
        expect(error_code(foreign_result)).to eq("NOT_FOUND")

        unknown_result = graphql("query($id: String!) { material(id: $id) { id } }",
                                 variables: { id: SecureRandom.uuid }, token: token)
        expect(error_code(unknown_result)).to eq("NOT_FOUND")

        malformed_result = graphql('query { material(id: "garbage") { id } }', token: token)
        expect(error_code(malformed_result)).to eq("NOT_FOUND")
      end
    end
  end

  # Attachment scope on the wire (FR-44, epic P2-10 T2): attachMaterial gains
  # optional attachmentScope + nodeId, Material carries attachmentScope/nodeId,
  # and the NEW setMaterialScope mutation pins/widens an existing row.
  describe "attachment scope (FR-44, epic P2-10 T2)" do
    it "attaches pinned to a node and reads the scope fields back off the material" do
      user, token = user_with_token("scope-attacher@example.com")
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan: plan, title: "Consensus")

      result = graphql(
        <<~GRAPHQL, variables: { input: attach_input(SecureRandom.uuid, planId: plan.id) }, token: token
          mutation AttachPinned($input: AttachMaterialInput!) {
            attachMaterial(input: $input) { material { id attachmentScope nodeId } }
          }
        GRAPHQL
      )

      expect(result.dig("data", "attachMaterial", "material", "attachmentScope")).to eq("plan")
      expect(result.dig("data", "attachMaterial", "material", "nodeId")).to be_nil

      pinned = graphql(
        <<~GRAPHQL, variables: { input: attach_input(SecureRandom.uuid, planId: plan.id, attachmentScope: "node", nodeId: node.id) }, token: token
          mutation AttachPinned($input: AttachMaterialInput!) {
            attachMaterial(input: $input) { material { id attachmentScope nodeId } }
          }
        GRAPHQL
      )
      expect(pinned.dig("data", "attachMaterial", "material", "attachmentScope")).to eq("node")
      expect(pinned.dig("data", "attachMaterial", "material", "nodeId")).to eq(node.id)
    end

    it "pins an attached material via setMaterialScope and widens it back plan-wide" do
      user, token = user_with_token("scope-pinner@example.com")
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan: plan, title: "Gossip")
      material = create(:material, user: user, plan: plan)

      pinned = graphql(
        <<~GRAPHQL, variables: { input: { materialId: material.id, attachmentScope: "node", nodeId: node.id } }, token: token
          mutation Pin($input: SetMaterialScopeInput!) {
            setMaterialScope(input: $input) { material { id attachmentScope nodeId } }
          }
        GRAPHQL
      )
      expect(pinned.dig("data", "setMaterialScope", "material", "attachmentScope")).to eq("node")
      expect(pinned.dig("data", "setMaterialScope", "material", "nodeId")).to eq(node.id)

      widened = graphql(
        <<~GRAPHQL, variables: { input: { materialId: material.id, attachmentScope: "plan" } }, token: token
          mutation Widen($input: SetMaterialScopeInput!) {
            setMaterialScope(input: $input) { material { id attachmentScope nodeId } }
          }
        GRAPHQL
      )
      expect(widened.dig("data", "setMaterialScope", "material", "attachmentScope")).to eq("plan")
      expect(widened.dig("data", "setMaterialScope", "material", "nodeId")).to be_nil
    end

    it "refuses scope/node combos with VALIDATION_FAILED and foreign material ids with NOT_FOUND" do
      user, token = user_with_token("scope-refuser@example.com")
      material = create(:material, user: user)

      pin_without_node = graphql(
        'mutation { setMaterialScope(input: { materialId: "%s", attachmentScope: "node" }) { material { id } } }' % material.id,
        token: token
      )
      expect(error_code(pin_without_node)).to eq("VALIDATION_FAILED")

      widen_with_node = graphql(
        'mutation { setMaterialScope(input: { materialId: "%s", attachmentScope: "plan", nodeId: "%s" }) { material { id } } }' % [ material.id, SecureRandom.uuid ],
        token: token
      )
      expect(error_code(widen_with_node)).to eq("VALIDATION_FAILED")

      foreign = graphql(
        'mutation { setMaterialScope(input: { materialId: "%s", attachmentScope: "plan" }) { material { id } } }' % create(:material, user: create(:user)).id,
        token: token
      )
      expect(error_code(foreign)).to eq("NOT_FOUND")
    end
  end

  # Task → Plan promotion on the wire (FR-37 stretch half, epic-14 T2; delta
  # decision 4): promoteTaskToPlan moves the task's single auto-node into a
  # new private plan (SAME id — evidence untouched), re-points the material
  # plan-wide, and flips the task row to the read-only pointer
  # (promotedPlanId/promotedAt INFERRED state, readable off StudyTaskType).
  describe "promoteTaskToPlan mutation (epic-14 T2)" do
    it "answers UNAUTHORIZED without a token" do
      result = graphql("mutation { promoteTaskToPlan(input: { taskId: \"#{SecureRandom.uuid}\", " \
                       "clientUuid: \"#{SecureRandom.uuid}\" }) { plan { id } } }")
      expect(error_code(result)).to eq("UNAUTHORIZED")
    end

    it "promotes: new private plan, the node moves (same id), material re-points, task becomes the pointer" do
      user, token = user_with_token("task-promoter@example.com")
      task = create(:study_task, user: user)
      create(:evidence_record, user: user, node: task.node)
      client_uuid = SecureRandom.uuid

      result = graphql(
        <<~GRAPHQL, variables: { input: { taskId: task.id, clientUuid: client_uuid } }, token: token
          mutation Promote($input: PromoteTaskToPlanInput!) {
            promoteTaskToPlan(input: $input) {
              plan { id topic visibility masteryScore }
              task {
                id
                promotedPlanId
                promotedAt
                promotedPlan { id topic }
                node { id planId taskId }
              }
            }
          }
        GRAPHQL
      )

      payload = result.dig("data", "promoteTaskToPlan")
      expect(payload["plan"]["id"]).to eq(client_uuid)
      expect(payload["plan"]["topic"]).to eq(task.material.title) # the default topic
      expect(payload["plan"]["visibility"]).to eq("private")
      expect(payload["plan"]["masteryScore"]).to be_present # the plan rollup is live on the wire

      expect(payload["task"]["id"]).to eq(task.id)
      expect(payload["task"]["promotedPlanId"]).to eq(client_uuid)
      expect(payload["task"]["promotedAt"]).to be_present
      expect(payload["task"]["promotedPlan"]["id"]).to eq(client_uuid)

      # The node kept its id and moved (AD-6 xor flip — task side cleared).
      expect(payload["task"]["node"]["id"]).to eq(task.node_id)
      expect(payload["task"]["node"]["planId"]).to eq(client_uuid)
      expect(payload["task"]["node"]["taskId"]).to be_nil

      # DB truth: material re-pointed, evidence untouched.
      expect(task.reload.promoted_plan_id).to eq(client_uuid)
      expect(task.material.reload.task_id).to be_nil
      expect(task.material.plan_id).to eq(client_uuid)
      expect(user.evidence_records.where(node_id: task.node_id).count).to eq(1)
    end

    it "is idempotent: a same-uuid replay and an already-promoted task both return the existing pointer" do
      user, token = user_with_token("promote-replayer@example.com")
      task = create(:study_task, user: user)
      client_uuid = SecureRandom.uuid

      first = graphql(
        "mutation { promoteTaskToPlan(input: { taskId: \"#{task.id}\", clientUuid: \"#{client_uuid}\" }) " \
        "{ plan { id } task { promotedPlanId } } }",
        token: token
      )
      replay = graphql(
        "mutation { promoteTaskToPlan(input: { taskId: \"#{task.id}\", clientUuid: \"#{client_uuid}\" }) " \
        "{ plan { id } task { promotedPlanId } } }",
        token: token
      )
      other_uuid = SecureRandom.uuid
      pointer = graphql(
        "mutation { promoteTaskToPlan(input: { taskId: \"#{task.id}\", clientUuid: \"#{other_uuid}\" }) " \
        "{ plan { id } task { promotedPlanId } } }",
        token: token
      )

      expect(first.dig("data", "promoteTaskToPlan", "plan", "id")).to eq(client_uuid)
      expect(replay.dig("data", "promoteTaskToPlan", "plan", "id")).to eq(client_uuid)
      # Task-level idempotency: whatever uuid rides, the existing pointer wins.
      expect(pointer.dig("data", "promoteTaskToPlan", "plan", "id")).to eq(client_uuid)
      expect(pointer.dig("data", "promoteTaskToPlan", "task", "promotedPlanId")).to eq(client_uuid)
      expect(user.study_plans.count).to eq(1)
    end

    it "answers the typed refusals: NOT_FOUND (unknown/foreign/malformed task), VALIDATION_FAILED (foreign uuid)" do
      user, token = user_with_token("promote-refuser@example.com")
      foreign_task = create(:study_task, user: create(:user))
      foreign_plan = create(:study_plan, user: create(:user))
      own_task = create(:study_task, user: user)

      unknown = graphql(
        "mutation { promoteTaskToPlan(input: { taskId: \"#{SecureRandom.uuid}\", " \
        "clientUuid: \"#{SecureRandom.uuid}\" }) { plan { id } } }", token: token
      )
      foreign = graphql(
        "mutation { promoteTaskToPlan(input: { taskId: \"#{foreign_task.id}\", " \
        "clientUuid: \"#{SecureRandom.uuid}\" }) { plan { id } } }", token: token
      )
      malformed = graphql(
        "mutation { promoteTaskToPlan(input: { taskId: \"garbage\", " \
        "clientUuid: \"#{SecureRandom.uuid}\" }) { plan { id } } }", token: token
      )
      foreign_uuid = graphql(
        "mutation { promoteTaskToPlan(input: { taskId: \"#{own_task.id}\", " \
        "clientUuid: \"#{foreign_plan.id}\" }) { plan { id } } }", token: token
      )

      aggregate_failures do
        expect(error_code(unknown)).to eq("NOT_FOUND")
        expect(error_code(foreign)).to eq("NOT_FOUND")
        expect(error_code(malformed)).to eq("NOT_FOUND")
        expect(error_code(foreign_uuid)).to eq("VALIDATION_FAILED")
      end
      # Nothing moved on the refusals.
      expect(own_task.reload.promoted_plan_id).to be_nil
      expect(user.study_plans.count).to eq(0)
    end

    it "keeps the pointer readable off the tasks list query (the plans-list read-back's other half)" do
      user, token = user_with_token("promote-lister@example.com")
      task = create(:study_task, user: user)
      client_uuid = SecureRandom.uuid

      graphql(
        "mutation { promoteTaskToPlan(input: { taskId: \"#{task.id}\", clientUuid: \"#{client_uuid}\" }) { plan { id } } }",
        token: token
      )

      result = graphql("query { tasks { id promotedPlanId promotedPlan { id topic } } }", token: token)
      row = result.dig("data", "tasks").find { |entry| entry["id"] == task.id }
      expect(row["promotedPlanId"]).to eq(client_uuid)
      expect(row["promotedPlan"]["id"]).to eq(client_uuid)
    end
  end

  private

  def attach_input(client_uuid, planId: nil, attachmentScope: nil, nodeId: nil, title: "Lecture notes: distributed systems")
    {
      clientUuid: client_uuid,
      title: title,
      kind: "markdown",
      sizeBytes: 20_488,
      planId: planId,
      sections: [
        { id: "sec-1", title: "Introduction", text: "Scoping, commands, and the spine ER." },
        { id: "page-2", title: "Page 2", text: "The bounded extracted text." }
      ],
      attachmentScope: attachmentScope,
      nodeId: nodeId
    }.compact
  end

  def parse_input(material_id)
    {
      id: material_id,
      state: "parsed",
      sections: [ { id: "sec-parsed", title: "Parsed", text: "The parsed extracted text." } ]
    }
  end
end
