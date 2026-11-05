# frozen_string_literal: true

require "rails_helper"

RSpec.describe Annotations::RemoveAnnotationCommand do
  # The FR-16 remove (epic-13 T3): the row goes, nothing else (an
  # annotation has no dependents). Addressing follows the house NOT_FOUND
  # matrix (AD-13): unknown, foreign, and malformed ids answer uniformly
  # NOT_FOUND — through the OWNER's annotations scope, never a bare find.

  let(:user) { create(:user) }

  def call(id:)
    described_class.call(current_user: user, id: id)
  end

  describe ".call" do
    it "deletes the owner's annotation and returns its id" do
      annotation = create(:annotation, :noted, user: user)

      result = call(id: annotation.id)

      aggregate_failures do
        expect(result.success?).to be(true)
        expect(result.value![:deleted_annotation_id]).to eq(annotation.id)
        expect(Annotation.exists?(annotation.id)).to be(false)
      end
    end

    it "answers NOT_FOUND for an unknown id" do
      annotation = create(:annotation, user: user)

      result = call(id: SecureRandom.uuid)

      aggregate_failures do
        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:NOT_FOUND)
        expect(Annotation.count).to eq(1)
        expect(Annotation.exists?(annotation.id)).to be(true)
      end
    end

    it "answers NOT_FOUND for a foreign annotation (never deletes another user's row)" do
      annotation = create(:annotation, user: create(:user))

      result = call(id: annotation.id)

      aggregate_failures do
        expect(result.failure?).to be(true)
        expect(result.failure.code).to eq(:NOT_FOUND)
        expect(Annotation.exists?(annotation.id)).to be(true)
      end
    end

    it "answers NOT_FOUND for a malformed id" do
      result = call(id: "garbage")

      expect(result.failure?).to be(true)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end
  end
end
