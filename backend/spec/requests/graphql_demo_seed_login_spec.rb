# frozen_string_literal: true

require "rails_helper"

RSpec.describe "the seeded demo account logs in over HTTP (epic P2-2 ticket 03)", type: :request do
  # The seed reads DEMO_EMAIL/DEMO_PASSWORD (AD-12 config posture) — pin
  # known values for each example and restore whatever was there before.
  # JWT_SECRET (also config posture) rides the shared request-spec harness
  # (spec/support/graphql_helpers.rb).
  around do |example|
    originals = {
      "DEMO_EMAIL" => ENV["DEMO_EMAIL"],
      "DEMO_PASSWORD" => ENV["DEMO_PASSWORD"]
    }
    ENV["DEMO_EMAIL"] = "seeded-demo@example.com"
    ENV["DEMO_PASSWORD"] = "seeded-demo-password"
    example.run
  ensure
    originals.each do |key, value|
      if value.nil?
        ENV.delete(key)
      else
        ENV[key] = value
      end
    end
  end

  it "seeds via db/seeds.rb and drives the ticket-02 login mutation with the seeded credentials" do
    # The real db:seed payload — the exact artifact `bin/rails db:seed` runs,
    # not a re-implementation of it.
    load Rails.root.join("db/seeds.rb")

    result = graphql(<<~GRAPHQL)
      mutation {
        login(input: { email: "seeded-demo@example.com", password: "seeded-demo-password" }) {
          token
          user { id email createdAt }
        }
      }
    GRAPHQL

    payload = result.dig("data", "login")
    expect(payload["token"]).to be_present
    expect(payload["user"]["email"]).to eq("seeded-demo@example.com")

    # The seed ↔ mutations interlock: the token names the seeded row, and
    # that row owns exactly the shape-stub dataset (AD-13 scoping) — three
    # described nodes and their two prerequisite edges since epic-16 T1.
    decoded = Accounts::TokenCodec.decode(payload["token"])
    expect(decoded).to be_ok
    user = User.find(decoded.user_uuid)
    expect(user.email).to eq("seeded-demo@example.com")
    expect(user.study_plans.count).to eq(1)
    expect(user.study_plans.first.visibility).to eq("private")
    expect(user.study_plans.first.knowledge_nodes.count).to eq(3)
    expect(user.study_plans.first.knowledge_node_edges.count).to eq(2)
  end
end
