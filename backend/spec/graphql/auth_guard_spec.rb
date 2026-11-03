# frozen_string_literal: true

require "rails_helper"

# The auth guard (Mutations::BaseMutation#current_user!) is the seam
# epic-03's operations will call to demand authentication (AD-15, ticket 02).
# It is proven here through the exact execution path it will run on — a real
# mutation subclass on a real schema instance, raised errors surfacing as
# GraphQL errors — via a spec-only probe mutation. Nothing here touches the
# committed contract (the probe schema is never dumped).
RSpec.describe "auth guard on Mutations::BaseMutation" do
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

  include ActiveSupport::Testing::TimeHelpers

  let(:user) { create(:user, email: "guarded@example.com", password: "known-password-123") }
  let(:mint_time) { Time.utc(2026, 11, 4, 12, 0, 0) }
  let(:token) { Accounts::TokenCodec.encode(sub: user.id, now: mint_time) }

  let(:probe_mutation) do
    Class.new(Mutations::BaseMutation) do
      graphql_name "AuthGuardProbe"
      description "Spec-only probe — never part of the committed contract."

      field :email, String, null: false

      def resolve
        { email: current_user!.email }
      end
    end
  end

  let(:probe_schema) do
    # `let` helpers are methods on the example group — inside a Class.new
    # block self is the new class, so capture the probe mutation into a
    # local the closure can carry in.
    mutation = probe_mutation

    mutation_type = Class.new(Types::BaseObject) do
      graphql_name "AuthGuardProbeMutation"
      field :probe, mutation: mutation
    end

    Class.new(ApiSchema) do
      query(Types::QueryType)
      mutation(mutation_type)
    end
  end

  def execute_probe(authorization, now: mint_time)
    travel_to(now) do
      probe_schema.execute(
        "mutation { probe(input: {}) { email } }",
        context: { current_user: CurrentUserResolver.new(authorization) }
      )
    end
  end

  it "hands the authenticated user to the operation" do
    result = execute_probe("Bearer #{token}")

    expect(result.dig("data", "probe", "email")).to eq("guarded@example.com")
    expect(result["errors"]).to be_nil
  end

  it "yields UNAUTHORIZED for an absent header" do
    result = execute_probe(nil)

    expect(result.dig("data", "probe")).to be_nil
    expect(result.dig("errors", 0, "extensions", "code")).to eq("UNAUTHORIZED")
  end

  # P2-6: current_user!'s error payload is now built as a typed
  # ApplicationErrors::Failure and presented through the epic-01
  # ErrorPresenter (one payload-construction site). This pins the wire shape
  # through that path — the refactor must be byte-equivalent on the wire.
  it "keeps the guard's exact wire payload: message + extensions.code" do
    result = execute_probe(nil)

    expect(result.dig("errors", 0, "message")).to eq("authentication required")
    expect(result.dig("errors", 0, "extensions")).to eq({ "code" => "UNAUTHORIZED" })
  end

  it "yields UNAUTHORIZED for a garbage token" do
    result = execute_probe("Bearer not-a-token")

    expect(result.dig("data", "probe")).to be_nil
    expect(result.dig("errors", 0, "extensions", "code")).to eq("UNAUTHORIZED")
  end

  it "yields UNAUTHORIZED for an expired token" do
    result = execute_probe("Bearer #{token}", now: mint_time + Accounts::TokenCodec::TTL)

    expect(result.dig("data", "probe")).to be_nil
    expect(result.dig("errors", 0, "extensions", "code")).to eq("UNAUTHORIZED")
  end

  it "yields UNAUTHORIZED when the context carries no resolver at all (schema use outside the controller)" do
    result = probe_schema.execute("mutation { probe(input: {}) { email } }", context: {})

    expect(result.dig("data", "probe")).to be_nil
    expect(result.dig("errors", 0, "extensions", "code")).to eq("UNAUTHORIZED")
  end
end
