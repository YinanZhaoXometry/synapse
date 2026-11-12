# frozen_string_literal: true

require "rails_helper"

RSpec.describe Material, type: :model do
  let(:user) { User.create!(email: "material-spec@example.com", password_digest: "digest") }

  let(:model_attributes) { { user: user, title: "Chapter 1", kind: "markdown", size_bytes: 1024 } }

  it_behaves_like "a user-owned uuid model"

  it "starts in the pending parse state (AD-7: parsing stays client-side)" do
    expect(described_class.new.parse_state).to eq("pending")

    material = described_class.create!(model_attributes)

    expect(material.parse_state).to eq("pending")
  end

  it "keeps task_id unique — a task studies exactly one material (spine ER)" do
    index = ActiveRecord::Base.connection.indexes(:materials).find { |i| i.columns == %w[task_id] }

    expect(index).to be_present
    expect(index.unique).to be(true)
  end

  it "extracts sections into a jsonb column — no blob columns (bytes are epic-06)" do
    sections = [ { "id" => "page-1", "title" => "Intro", "text" => "Hello" } ]

    material = described_class.create!(model_attributes.merge(sections: sections))

    expect(material.reload.sections).to eq(sections)
    expect(described_class.column_names).not_to include("blob", "file_data")
  end

  # Attachment scope (FR-44, epic P2-10 T2; kickoff delta decision 4): the
  # default IS plan — existing rows read plan-wide with no backfill.
  it "defaults the attachment scope to plan-wide (backward compatible — no backfill needed)" do
    expect(described_class.new.attachment_scope).to eq("plan")

    material = described_class.create!(model_attributes)

    expect(material.reload.attachment_scope).to eq("plan")
    expect(material.node_id).to be_nil
  end

  it "pins the attachment scope to the closed two values (plan | node)" do
    expect { described_class.new(attachment_scope: "section") }.to raise_error(ArgumentError)

    plan = StudyPlan.create!(user: user, topic: "Scoping")
    node = KnowledgeNode.create!(user: user, plan: plan, title: "A node", order: 0)
    material = described_class.create!(model_attributes.merge(attachment_scope: "node", node: node))
    expect(material.reload.attachment_scope).to eq("node")

    # The database floor: anything outside the two values is refused by the
    # check constraint, not just the enum seam.
    saved = described_class.create!(model_attributes)
    expect {
      saved.update_columns(attachment_scope: "banana")
    }.to raise_error(ActiveRecord::StatementInvalid)
  end

  # Generated lessons (epic-36 T1, spec decision 1): every material starts
  # uploaded (backward compatible — no backfill), and a server-side lesson
  # flips origin explicitly. kind stays {pdf, markdown} — a lesson is always
  # markdown.
  it "defaults origin to uploaded (backward compatible — no backfill)" do
    expect(described_class.new.origin).to eq("uploaded")

    material = described_class.create!(model_attributes)
    expect(material.reload.origin).to eq("uploaded")
  end

  it "carries the generated origin with its generation jsonb (the lesson row shape)" do
    generation = {
      "variant" => "node",
      "sourceMaterialIds" => [ "m-1" ],
      "outline" => [ { "id" => "ch-1", "title" => "Raft", "anchors" => [ { "materialId" => "m-1", "sectionId" => "sec-1" } ], "status" => "pending" } ],
      "pausedKind" => nil,
      "generatedAt" => Time.current.iso8601
    }
    material = described_class.create!(model_attributes.merge(
      origin: "generated", kind: "markdown", parse_state: "parsed",
      size_bytes: 0, generation: generation
    ))

    expect(material.reload.origin).to eq("generated")
    expect(material.generation).to eq(generation.stringify_keys)
  end

  it "pins origin to the closed two values (uploaded | generated) at the database floor" do
    expect { described_class.new(origin: "book") }.to raise_error(ArgumentError)

    saved = described_class.create!(model_attributes)
    expect {
      saved.update_columns(origin: "banana")
    }.to raise_error(ActiveRecord::StatementInvalid)
  end
end
