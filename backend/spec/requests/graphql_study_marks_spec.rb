# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL study-mark operations (epic-28 T1, FR-47)", type: :request do
  # Direct GraphQL execution over HTTP (the epic-02 request-spec pattern):
  # the wire behavior of nodeStudyMarkSet + the studyMark field read. The
  # command underneath has its own direct spec (spec/commands/nodes/); this
  # file pins the wire contract — auth, error codes, round-trip, and the
  # orthogonality tripwire (a mark write never moves mastery on the wire).

  describe "the auth guard" do
    it "answers UNAUTHORIZED without a token" do
      mutation = "mutation { nodeStudyMarkSet(input: { nodeId: \"#{SecureRandom.uuid}\", " \
                 "mark: \"learning\" }) { node { id } } }"
      expect(error_code(graphql(mutation))).to eq("UNAUTHORIZED")
    end
  end

  describe "nodeStudyMarkSet" do
    it "sets, re-sets, and clears the mark; the field reads back on the node payload" do
      user, token = user_with_token("mark-owner@example.com")
      node = create(:knowledge_node, user: user, plan: create(:study_plan, user: user), order: 1)

      set = graphql(<<~GRAPHQL, variables: { id: node.id }, token: token)
        mutation ($id: String!) {
          nodeStudyMarkSet(input: { nodeId: $id, mark: "learning" }) {
            node { id studyMark masteryScore state }
          }
        }
      GRAPHQL
      expect(set["data"]["nodeStudyMarkSet"]["node"]["studyMark"]).to eq("learning")

      finished = graphql(<<~GRAPHQL, variables: { id: node.id }, token: token)
        mutation ($id: String!) {
          nodeStudyMarkSet(input: { nodeId: $id, mark: "finished" }) {
            node { id studyMark }
          }
        }
      GRAPHQL
      expect(finished["data"]["nodeStudyMarkSet"]["node"]["studyMark"]).to eq("finished")

      cleared = graphql(<<~GRAPHQL, variables: { id: node.id }, token: token)
        mutation ($id: String!) {
          nodeStudyMarkSet(input: { nodeId: $id }) {
            node { id studyMark }
          }
        }
      GRAPHQL
      expect(cleared["data"]["nodeStudyMarkSet"]["node"]["studyMark"]).to be_nil
      expect(node.reload.study_mark).to be_nil
    end

    it "answers VALIDATION_FAILED off the closed enum and NOT_FOUND for a foreign node" do
      user, token = user_with_token("mark-errors@example.com")
      foreign = create(:knowledge_node, user: create(:user), order: 1)

      bad_enum = graphql(<<~GRAPHQL, variables: { id: SecureRandom.uuid }, token: token)
        mutation ($id: String!) {
          nodeStudyMarkSet(input: { nodeId: $id, mark: "done" }) { node { id } }
        }
      GRAPHQL
      expect(error_code(bad_enum)).to eq("VALIDATION_FAILED")

      foreign_node = graphql(<<~GRAPHQL, variables: { id: foreign.id }, token: token)
        mutation ($id: String!) {
          nodeStudyMarkSet(input: { nodeId: $id, mark: "learning" }) { node { id } }
        }
      GRAPHQL
      expect(error_code(foreign_node)).to eq("NOT_FOUND")
    end

    it "leaves mastery untouched — the orthogonality tripwire on the wire" do
      user, token = user_with_token("mark-mastery@example.com")
      node = create(:knowledge_node, user: user, plan: create(:study_plan, user: user), order: 1)

      read = graphql(<<~GRAPHQL, token: token)
        query {
          plan(id: "#{node.plan_id}") {
            nodes { id studyMark masteryScore state }
          }
        }
      GRAPHQL
      node_payload = read["data"]["plan"]["nodes"].first
      expect(node_payload["studyMark"]).to be_nil
      expect(node_payload["masteryScore"]).to eq("0")
      expect(node_payload["state"]).to eq("uncovered")

      graphql(<<~GRAPHQL, variables: { id: node.id }, token: token)
        mutation ($id: String!) {
          nodeStudyMarkSet(input: { nodeId: $id, mark: "finished" }) { node { id } }
        }
      GRAPHQL

      after = graphql(<<~GRAPHQL, token: token)
        query {
          plan(id: "#{node.plan_id}") {
            nodes { id studyMark masteryScore state }
          }
        }
      GRAPHQL
      marked = after["data"]["plan"]["nodes"].first
      aggregate_failures do
        expect(marked["studyMark"]).to eq("finished")
        expect(marked["masteryScore"]).to eq("0")
        expect(marked["state"]).to eq("uncovered")
      end
    end
  end
end
