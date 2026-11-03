# frozen_string_literal: true

require "rails_helper"

RSpec.describe StudyPlan, type: :model do
  let(:user) { User.create!(email: "study-plan-spec@example.com", password_digest: "digest") }

  def plan_attributes
    { user: user, topic: "COMP5241 software engineering" }
  end

  it "fills id from the gen_random_uuid() server default when create omits it" do
    plan = described_class.create!(plan_attributes)

    expect(plan.id).to be_a_uuid
    expect(plan.persisted?).to be(true)
  end

  it "honors a client-supplied id on create (AD-12 idempotent import)" do
    id = SecureRandom.uuid

    plan = described_class.create!(plan_attributes.merge(id: id))

    expect(plan.id).to eq(id)
  end

  it "scopes to a required user_id (AD-13)" do
    association = described_class.reflect_on_association(:user)

    expect(association).to be_present
    expect(association.klass).to eq(User)
    expect(described_class.column_names).to include("user_id")
    expect(described_class.new(plan_attributes.except(:user))).not_to be_valid
  end

  it "carries an indexed foreign key on user_id" do
    indexes = ActiveRecord::Base.connection.indexes(:study_plans)

    expect(indexes.map(&:columns)).to include(%w[user_id])
  end

  it "defaults visibility to private (FR-38 structural)" do
    expect(described_class.new.visibility).to eq("private")

    plan = described_class.create!(plan_attributes)

    expect(plan.visibility).to eq("private")
  end

  it "rejects a visibility outside the closed vocabulary at the model seam" do
    expect { described_class.new(plan_attributes.merge(visibility: "shared")) }
      .to raise_error(ArgumentError)
  end

  it "carries a check constraint pinning visibility to the closed vocabulary" do
    constraints = ActiveRecord::Base.connection.check_constraints(:study_plans)
    visibility = constraints.find { |c| c.name == "study_plans_visibility_check" }

    expect(visibility).to be_present
    expect(visibility.expression).to include("private")
  end
end
