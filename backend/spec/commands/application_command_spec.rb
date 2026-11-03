# frozen_string_literal: true

require "rails_helper"

RSpec.describe ApplicationCommand do
  # Tests build throwaway command subclasses — commands are plain objects
  # (AD-10: tested directly, no GraphQL surface involved).
  describe ".call" do
    it "builds the command from dry-initializer options, runs it, and returns its Success" do
      command_class = Class.new(ApplicationCommand) do
        option :greeting

        def call
          Success(greeting: greeting)
        end
      end

      result = command_class.call(greeting: "hi")

      expect(result.success?).to be(true)
      expect(result.value!).to eq(greeting: "hi")
    end

    it "runs the authorize hook first — its typed Failure wins and call never runs" do
      state = { call_ran: false }

      command_class = Class.new(ApplicationCommand) do
        define_method(:authorize) do
          Failure(:UNAUTHORIZED, { message: "sign in first" })
        end

        define_method(:call) do
          state[:call_ran] = true
          Success(:never)
        end
      end

      result = command_class.call

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:UNAUTHORIZED)
      expect(result.failure.context).to eq(message: "sign in first")
      expect(state[:call_ran]).to be(false)
    end

    it "never raises — an unexpected exception in call becomes a typed INTERNAL failure" do
      command_class = Class.new(ApplicationCommand) do
        def call
          raise "boom"
        end
      end

      result = command_class.call

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:INTERNAL)
      expect(result.failure.context[:message]).to include("RuntimeError").and include("boom")
    end

    it "fails fast when a command emits a code outside the closed enum — even through .call" do
      command_class = Class.new(ApplicationCommand) do
        def call
          Failure(:oops)
        end
      end

      # Infrastructure misuse, not a domain outcome: the guard's
      # ArgumentError deliberately escapes the never-raise rescue.
      expect { command_class.call }.to raise_error(ApplicationErrors::InvalidCodeError, /:oops/)
    end
  end
end
