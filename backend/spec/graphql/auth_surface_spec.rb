# frozen_string_literal: true

require "rails_helper"

# The epic P2-2 contract immobility guard: the schema grows by exactly the
# register/login mutations + the User type — byte-level idempotence is pinned
# by spec/graphql/schema_dump_spec.rb against the committed schema.graphql;
# this spec pins the surface shape itself.
RSpec.describe "GraphQL auth surface (epic P2-2 ticket 02)" do
  it "exposes exactly the register and login mutations" do
    expect(Types::MutationType.fields.keys).to contain_exactly("register", "login")
  end

  it "exposes no logout mutation (client-side token discard by design — epic-08)" do
    expect(Types::MutationType.fields.keys).not_to include("logout")
  end

  it "exposes a minimal User type — identity only, no credential material" do
    expect(Types::UserType.fields.keys).to contain_exactly("id", "email", "createdAt")
  end
end
