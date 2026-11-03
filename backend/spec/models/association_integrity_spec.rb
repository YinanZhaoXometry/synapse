# frozen_string_literal: true

require "rails_helper"

# The association-integrity roster (epic P2-2 review, finding P1-A):
# ActiveRecord infers a has_many's foreign key from the MODEL'S name
# (`QuizSession` ⇒ quiz_session_id), and the spine's real columns are
# routinely named differently (`session_id`) — the exact landmine that
# surfaced as PG::UndefinedColumn four times now (StudyPlan in epic P2-2
# ticket 03; KnowledgeNode, QuizSession, StudyTask in this review). T03
# fixed one model; this spec is the sweep with teeth, in the spirit of the
# user-scoping roster: it walks EVERY model's EVERY reflection at spec time,
# so a future misdeclared association fails BY NAME here, with the fix in
# the failure message, instead of exploding in epic-03's first query.
RSpec.describe "association integrity across every model" do
  # Models load lazily in the test env (eager_load is CI-only); load the
  # whole app so the roster cannot silently miss an unreferenced model.
  Rails.application.eager_load! unless Rails.application.config.eager_load

  models = ApplicationRecord.descendants.sort_by(&:name)

  def failure_list(entries)
    entries.map { |entry| "  - #{entry}" }.join("\n")
  end

  it "declares every has_many's foreign key as a real column on the child table" do
    broken = []
    models.each do |model|
      model.reflect_on_all_associations(:has_many).each do |reflection|
        # A through-association's foreign key lives on the source
        # association's table, not the child's — its own example would lie.
        next if reflection.options[:through]

        child = reflection.klass
        next if child.column_names.include?(reflection.foreign_key)

        broken << "#{model}##{reflection.name} → #{child} has no column " \
                  "`#{reflection.foreign_key}` (the inferred foreign key); " \
                  "declare the real one: has_many :#{reflection.name}, foreign_key: :<real_column>"
      end
    end

    expect(broken).to be_empty,
                      "has_many associations whose foreign key is not a column on the child table:\n#{failure_list(broken)}"
  end

  it "declares every belongs_to's foreign key as a real column on this table" do
    broken = []
    models.each do |model|
      model.reflect_on_all_associations(:belongs_to).each do |reflection|
        # A polymorphic belongs_to pairs its foreign key with a _type column
        # resolved per row — no single klass/column pair to pin here.
        next if reflection.polymorphic?
        next if model.column_names.include?(reflection.foreign_key)

        broken << "#{model}##{reflection.name} has no column " \
                  "`#{reflection.foreign_key}` (the inferred foreign key)"
      end
    end

    expect(broken).to be_empty,
                      "belongs_to associations whose foreign key is not a column on the owning table:\n#{failure_list(broken)}"
  end

  it "resolves every declared inverse_of to a real reflection on the other side" do
    broken = []
    models.each do |model|
      model.reflect_on_all_associations.each do |reflection|
        inverse_name = reflection.options[:inverse_of]
        # `inverse_of: true` asks ActiveRecord to find the inverse itself —
        # Rails validates that at reflection-build time, not our job here.
        next unless inverse_name.is_a?(String) || inverse_name.is_a?(Symbol)

        other = reflection.klass
        next if other.reflect_on_association(inverse_name.to_sym)

        broken << "#{model}##{reflection.name} declares inverse_of: :#{inverse_name} " \
                  "but #{other} has no such association"
      end
    end

    expect(broken).to be_empty,
                      "inverse_of declarations with no matching association:\n#{failure_list(broken)}"
  end
end
