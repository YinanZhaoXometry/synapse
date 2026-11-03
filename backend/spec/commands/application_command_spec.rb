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
  end
end
