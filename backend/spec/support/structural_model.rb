# frozen_string_literal: true

# The structural assertions every model spec pins (epic P2-1 ticket 02's
# per-model copies, extracted into shared examples by the P2-1 review fixes —
# 14 files carried the same four examples verbatim). One include per spec:
#
#   it_behaves_like "a user-owned uuid model"
#
# Contract: the including example group defines `model_attributes` — a Hash of
# VALID creation attributes for described_class. For user-owned models the
# Hash must carry the owner under :user (the scoping example builds without
# it and expects invalidity). Model-specific examples (visibility, check
# constraints, jsonb round-trips, 1:1 RecordNotUnique, enums, ...) stay in the
# model specs; nothing here weakens or replaces them.

# The two AD-12/A2 id examples: uuid PK with a gen_random_uuid() server
# default, and a client-suppliable id on create.
RSpec.shared_examples "a uuid primary-key model" do
  it "fills id from the gen_random_uuid() server default when create omits it" do
    record = described_class.create!(model_attributes)

    expect(record.id).to be_a_uuid
    expect(record.persisted?).to be(true)
  end

  it "honors a client-supplied id on create (AD-12 idempotent import)" do
    id = SecureRandom.uuid

    record = described_class.create!(model_attributes.merge(id: id))

    expect(record.id).to eq(id)
  end
end

# The full user-owned surface: the uuid pair above + AD-13 scoping (a required
# belongs_to :user backed by the user_id column) + the indexed user_id FK.
# Not applicable to User itself (the scoping root) — that spec includes only
# "a uuid primary-key model".
RSpec.shared_examples "a user-owned uuid model" do
  include_examples "a uuid primary-key model"

  it "scopes to a required user_id (AD-13)" do
    association = described_class.reflect_on_association(:user)

    expect(association).to be_present
    expect(association.klass).to eq(User)
    expect(described_class.column_names).to include("user_id")
    expect(described_class.new(model_attributes.except(:user))).not_to be_valid
  end

  it "carries an indexed foreign key on user_id" do
    indexes = ActiveRecord::Base.connection.indexes(described_class.table_name)

    expect(indexes.map(&:columns)).to include(%w[user_id])
  end
end
