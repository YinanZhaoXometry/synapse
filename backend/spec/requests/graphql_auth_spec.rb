# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL auth mutations (epic P2-2 ticket 02)", type: :request do
  # The commands mint real JWTs (Accounts::TokenCodec reads JWT_SECRET from
  # ENV, AD-12 posture) — pin a known secret for each example and restore
  # whatever was there before.
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

  def graphql(query, variables: {})
    post "/graphql", params: { query: query, variables: variables }
    response.parsed_body
  end

  def error_code(result)
    result.dig("errors", 0, "extensions", "code")
  end

  describe "register over HTTP" do
    it "creates the account and returns the token + user payload" do
      result = graphql(<<~GRAPHQL)
        mutation {
          register(input: { email: "new-user@example.com", password: "#{password}" }) {
            token
            user { id email createdAt }
          }
        }
      GRAPHQL

      payload = result.dig("data", "register")
      expect(payload["token"]).to be_present
      expect(payload["user"]["email"]).to eq("new-user@example.com")
      expect(payload["user"]["createdAt"]).to be_present

      # The token is the session credential: it decodes to the new user's uuid.
      decoded = Accounts::TokenCodec.decode(payload["token"])
      expect(decoded).to be_ok
      expect(decoded.user_uuid).to eq(payload["user"]["id"])
      expect(User.exists?(email: "new-user@example.com")).to be(true)
    end

    it "fails VALIDATION_FAILED through the epic-01 presenter for a duplicate email" do
      create(:user, email: "taken@example.com", password: password)

      result = graphql(<<~GRAPHQL)
        mutation {
          register(input: { email: "taken@example.com", password: "#{password}" }) {
            token
          }
        }
      GRAPHQL

      expect(result.dig("data", "register")).to be_nil
      expect(error_code(result)).to eq("VALIDATION_FAILED")
      expect(result.dig("errors", 0, "message")).to eq("email has already been taken")
    end

    it "fails VALIDATION_FAILED for a too-short password" do
      result = graphql(<<~GRAPHQL)
        mutation {
          register(input: { email: "short-pass@example.com", password: "short" }) {
            token
          }
        }
      GRAPHQL

      expect(result.dig("data", "register")).to be_nil
      expect(error_code(result)).to eq("VALIDATION_FAILED")
      expect(result.dig("errors", 0, "message")).to match(/password/i)
    end

    it "is not rate-limited (the limit is login-only, v1)" do
      email = "not-limited@example.com"
      # Trip the window for this email as hard as login would be tripped.
      Accounts::LoginRateLimiter::DEFAULT_THRESHOLD.times do
        Accounts::LoginRateLimiter.attempt(email)
      end

      result = graphql(<<~GRAPHQL)
        mutation {
          register(input: { email: "#{email}", password: "#{password}" }) {
            token
          }
        }
      GRAPHQL

      expect(result.dig("data", "register", "token")).to be_present
    end
  end

  describe "login over HTTP" do
    it "authenticates and returns the token + user payload" do
      user = create(:user, email: "login@example.com", password: password)

      result = graphql(<<~GRAPHQL)
        mutation {
          login(input: { email: "login@example.com", password: "#{password}" }) {
            token
            user { id email }
          }
        }
      GRAPHQL

      payload = result.dig("data", "login")
      expect(payload["user"]["id"]).to eq(user.id)
      expect(payload["user"]["email"]).to eq("login@example.com")

      decoded = Accounts::TokenCodec.decode(payload["token"])
      expect(decoded).to be_ok
      expect(decoded.user_uuid).to eq(user.id)
    end

    it "fails UNAUTHORIZED for wrong credentials" do
      create(:user, email: "wrong@example.com", password: password)

      result = graphql(<<~GRAPHQL)
        mutation {
          login(input: { email: "wrong@example.com", password: "not-the-password" }) {
            token
          }
        }
      GRAPHQL

      expect(result.dig("data", "login")).to be_nil
      expect(error_code(result)).to eq("UNAUTHORIZED")
      expect(result.dig("errors", 0, "message")).to eq("invalid email or password")
    end

    it "fails RATE_LIMITED on the attempt after the window is tripped — before credential verification" do
      email = "tripped@example.com"
      create(:user, email: email, password: password)

      # Burn the whole window with wrong-password attempts (each answered
      # UNAUTHORIZED by the command), then ask again with the CORRECT
      # password: it must be RATE_LIMITED — the limiter denies before any
      # credential check happens.
      Accounts::LoginRateLimiter::DEFAULT_THRESHOLD.times do
        result = graphql(<<~GRAPHQL)
          mutation {
            login(input: { email: "#{email}", password: "not-the-password" }) {
              token
            }
          }
        GRAPHQL

        expect(error_code(result)).to eq("UNAUTHORIZED")
      end

      result = graphql(<<~GRAPHQL)
        mutation {
          login(input: { email: "#{email}", password: "#{password}" }) {
            token
          }
        }
      GRAPHQL

      expect(result.dig("data", "login")).to be_nil
      expect(error_code(result)).to eq("RATE_LIMITED")
    end
  end
end
