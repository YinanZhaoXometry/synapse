# frozen_string_literal: true

require "rails_helper"

RSpec.describe User, type: :model do
  it "fills id from the gen_random_uuid() server default when create omits it" do
    user = described_class.create!(email: "user-spec-a@example.com", password_digest: "digest")

    expect(user.id).to be_a_uuid
    expect(user.persisted?).to be(true)
  end

  it "honors a client-supplied id on create (AD-12 idempotent import)" do
    id = SecureRandom.uuid

    user = described_class.create!(id: id, email: "user-spec-b@example.com", password_digest: "digest")

    expect(user.id).to eq(id)
  end

  it "requires an email and keeps it unique" do
    expect(described_class.new(password_digest: "digest")).not_to be_valid

    described_class.create!(email: "user-spec-c@example.com", password_digest: "digest")

    duplicate = described_class.new(email: "user-spec-c@example.com", password_digest: "digest")
    expect(duplicate).not_to be_valid
  end
end
