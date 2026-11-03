# frozen_string_literal: true

require "rails_helper"

# P2-1 review fix (factory guard): multi-association factories pass `user:`
# down to every association block, so the DEFAULT factory graph must be
# single-owner. If someone overrides `material:`/`node:` with another user's
# record and forgets the matching `user:` override, the triangle silently
# goes cross-owner — this guard catches exactly that regression the way the
# user-scoping roster catches scoping drift.
#
# Lives here, NOT in spec/factories/: factory_bot_rails loads every .rb file
# under spec/factories as a factory DEFINITION at environment boot, and a
# spec file there crashes db:prepare with LoadError (rails_helper).
RSpec.describe "study_task factory default graph" do
  it "builds a single-owner triangle — task.user == material.user == node.user" do
    task = create(:study_task)

    aggregate_failures do
      expect(task.material.user).to eq(task.user)
      expect(task.node.user).to eq(task.user)
    end
  end
end
