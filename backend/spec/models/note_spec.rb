# frozen_string_literal: true

require "rails_helper"

# The Note entity (FR-40, epic P2-12 T1, delta decision 4): user-scoped (the
# standing shared example) with the DB floor pinning the one-scope rule — the
# scope string and the EXACTLY-ONE matching scope id.
RSpec.describe Note do
  include_examples "user-scoped", described_class

  %w[plan node material].each do |scope|
    it "accepts a well-formed #{scope}-scoped row" do
      note = case scope
      when "plan" then create(:note, user: user)
      when "node" then create(:note, :node_scoped, user: user)
      else create(:note, :material_scoped, user: user)
      end
      expect(note.reload.scope).to eq(scope)
    end
  end

  it "refuses a scope whose matching id is missing (the DB's exactly-one check)" do
    expect { create(:note, user: user, plan: nil) }
      .to raise_error(ActiveRecord::StatementInvalid, /notes_scope_id_xor_check|scope_id_xor/)
  end

  it "refuses two scope ids riding together" do
    node = create(:knowledge_node, user: user)
    expect { create(:note, user: user, node: node) }
      .to raise_error(ActiveRecord::StatementInvalid, /notes_scope_id_xor_check|scope_id_xor/)
  end

  it "refuses a scope value outside the closed vocabulary" do
    # The enum is the model seam's guard (raises on assignment); the check
    # constraint notes_scope_check is the DB floor behind it.
    expect { create(:note, user: user, scope: "stage") }
      .to raise_error(ArgumentError, /not a valid scope/)
  end
end
