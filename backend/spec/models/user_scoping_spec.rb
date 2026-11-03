# frozen_string_literal: true

require "rails_helper"

# AD-13 / FR-4: every user-owned row is scoped by user_id. This spec is the
# roster keeper — it discovers every concrete model dynamically, so a new
# model joins the roster without an edit here:
#
#   * "keeps every model except User user-scoped" fails when a model forgets
#     `belongs_to :user` / the `user_id` column (or a model lands without any
#     user scoping at all).
#   * "exposes a has_many scoping path on User" fails when the derived
#     `User` has_many (model.name.underscore.pluralize) is missing.
#   * the shared "user-scoped" examples then prove cross-user isolation for
#     every user-owned model (list / find_by / find / same-user read).
RSpec.describe "user scoping across every user-owned model" do
  # Models load lazily in the test env (eager_load is CI-only); load the whole
  # app so the roster below cannot silently miss an unreferenced model.
  Rails.application.eager_load! unless Rails.application.config.eager_load

  models = ApplicationRecord.descendants.sort_by(&:name) - [ User ]

  it "keeps every model except User user-scoped (belongs_to :user + user_id column)" do
    unscoped = models.reject do |model|
      model.reflect_on_association(:user).present? &&
        model.column_names.include?("user_id")
    end

    expect(unscoped).to be_empty,
                        "models without user scoping (AD-13): #{unscoped.map(&:name).join(', ')}"
  end

  it "exposes a has_many scoping path on User for every user-owned model" do
    missing = models.reject do |model|
      User.reflect_on_association(model.name.underscore.pluralize).present?
    end

    expect(missing).to be_empty,
                       "User lacks has_many paths for: #{missing.map(&:name).join(', ')}"
  end

  models.each do |model|
    describe model do
      include_examples "user-scoped", model
    end
  end
end
