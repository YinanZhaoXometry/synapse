# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL me query (epic-25 T3)", type: :request do
  # The chrome's session identity read on the wire (the epic-02 request-spec
  # pattern): real register/login for a token, the caller's own email back.
  # The resolver is the sanctioned bare read over current_user! (the identity
  # IS the authenticated account — nothing to scope), so the wire behavior is
  # exactly the auth wall plus the email.

  it "answers UNAUTHORIZED without a token (auth-walled like every read — the AD-13 exceptions stay health + the Square path)" do
    expect(error_code(graphql("query { me { email } }"))).to eq("UNAUTHORIZED")
  end

  it "answers the authenticated account's email — the caller's own, a second user notwithstanding" do
    user, token = user_with_token("chrome-identity@example.com")
    create(:user) # a second account exists; the read is still the caller's identity

    result = graphql("query { me { email } }", token: token)

    expect(result.dig("data", "me", "email")).to eq(user.email)
  end
end
