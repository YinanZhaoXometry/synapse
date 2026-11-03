# frozen_string_literal: true

require "rails_helper"

RSpec.describe ChatThread, type: :model do
  let(:user) { User.create!(email: "chat-thread-spec@example.com", password_digest: "digest") }
  let(:material) { Material.create!(user: user, title: "Thread anchor", kind: "markdown", size_bytes: 256) }

  def thread_attributes
    { user: user, material: material }
  end

  it "fills id from the gen_random_uuid() server default when create omits it" do
    thread = described_class.create!(thread_attributes)

    expect(thread.id).to be_a_uuid
    expect(thread.persisted?).to be(true)
  end

  it "honors a client-supplied id on create (AD-12 idempotent import)" do
    id = SecureRandom.uuid

    thread = described_class.create!(thread_attributes.merge(id: id))

    expect(thread.id).to eq(id)
  end

  it "scopes to a required user_id (AD-13)" do
    association = described_class.reflect_on_association(:user)

    expect(association).to be_present
    expect(association.klass).to eq(User)
    expect(described_class.column_names).to include("user_id")
    expect(described_class.new(thread_attributes.except(:user))).not_to be_valid
  end

  it "carries an indexed foreign key on user_id" do
    indexes = ActiveRecord::Base.connection.indexes(:chat_threads)

    expect(indexes.map(&:columns)).to include(%w[user_id])
  end

  it "anchors 1:1 to a material — a second thread for the same material is rejected" do
    described_class.create!(thread_attributes)

    expect { described_class.create!(thread_attributes) }
      .to raise_error(ActiveRecord::RecordNotUnique)
  end

  it "starts with an empty messages jsonb (no ChatMessage entity in the ER — embedded)" do
    thread = described_class.create!(thread_attributes)

    expect(thread.messages).to eq([])
  end
end
