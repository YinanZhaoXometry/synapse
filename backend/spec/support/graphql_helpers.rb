# frozen_string_literal: true

# The GraphQL request-spec harness, single-sourced (P2-7 of the epic P2-3
# review — the ~10-line JWT_SECRET around-block and the graphql/error_code/
# token_for helpers were copy-pasted across every request spec): a known
# JWT_SECRET pinned around each example (Accounts::TokenCodec reads it from
# ENV — the AD-12 config posture) plus the thin HTTP helpers. Auto-included
# for type: :request groups via the RSpec.configure below.
module GraphqlSpecHelpers
  def self.included(base)
    super
    base.around do |example|
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
    base.let(:password) { "known-password-123" }
  end

  # Direct GraphQL execution over HTTP (AD-10, the epic-02 request-spec
  # pattern): post the query (variables JSON-encoded), optionally as the
  # bearer of a session token.
  def graphql(query, variables: {}, token: nil)
    headers = token ? { "Authorization" => "Bearer #{token}" } : {}
    post "/graphql", params: { query: query, variables: variables.to_json }, headers: headers
    response.parsed_body
  end

  # The typed failure code off the first error's extensions (AD-12's closed enum).
  def error_code(result)
    result.dig("errors", 0, "extensions", "code")
  end

  # A real login over HTTP — the token minting reads JWT_SECRET (pinned above).
  def token_for(email)
    result = graphql(<<~GRAPHQL)
      mutation {
        login(input: { email: "#{email}", password: "#{password}" }) { token }
      }
    GRAPHQL
    result.dig("data", "login", "token")
  end

  # A user row + that user's live session token, in one step.
  def user_with_token(email)
    create(:user, email: email, password: password)
    [ User.find_by!(email: email), token_for(email) ]
  end
end

RSpec.configure do |config|
  config.include GraphqlSpecHelpers, type: :request
end
