# frozen_string_literal: true

require "rails_helper"

RSpec.describe StudyPlan, type: :model do
  let(:user) { User.create!(email: "study-plan-spec@example.com", password_digest: "digest") }

  let(:model_attributes) { { user: user, topic: "COMP5241 software engineering" } }

  it_behaves_like "a user-owned uuid model"

  it "defaults visibility to private (FR-38 structural)" do
    expect(described_class.new.visibility).to eq("private")

    plan = described_class.create!(model_attributes)

    expect(plan.visibility).to eq("private")
  end

  it "rejects a visibility outside the closed vocabulary at the model seam" do
    expect { described_class.new(model_attributes.merge(visibility: "shared")) }
      .to raise_error(ArgumentError)
  end

  it "carries a check constraint pinning visibility to the closed vocabulary" do
    constraints = ActiveRecord::Base.connection.check_constraints(:study_plans)
    visibility = constraints.find { |c| c.name == "study_plans_visibility_check" }

    expect(visibility).to be_present
    expect(visibility.expression).to include("private")
  end
end
