# frozen_string_literal: true

# P2-1 review fix: pins QuizSession's "generated from exactly one of
# plan/task" invariant into the database floor. CreateQuizSessions left both
# FKs nullable with "exactly one is set in practice" pinned nowhere; this
# check constraint makes it law: `((plan_id IS NOT NULL) <> (task_id IS NOT
# NULL))` holds iff exactly one side is set.
#
# strong_migrations two-step posture (the same pattern as the task↔node FK
# pair in CreateStudyTasks/ValidateTaskForeignKeys): add the constraint NOT
# VALID (instant), then validate. The plain same-migration pair is rejected
# by strong_migrations ("Validating a check constraint while writes are
# blocked is dangerous" — the wrapping DDL transaction blocks writes from its
# start), so this migration declares disable_ddl_transaction! — the
# remediation strong_migrations itself suggests, and honest here: the table
# is brand new and empty, the NOT VALID add is instant, and the validation
# holds only a brief lock. No safety_assured suppression is used.
class AddQuizSessionsExactlyOneOwnerCheck < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def up
    # Non-transactional (disable_ddl_transaction!): a failed earlier attempt
    # leaves the NOT VALID constraint committed with no schema_migrations row —
    # converge on re-run instead of failing on PG::DuplicateObject.
    unless check_constraint_exists?(:quiz_sessions, name: "quiz_sessions_exactly_one_owner_check")
      add_check_constraint :quiz_sessions,
                           "(plan_id IS NOT NULL) <> (task_id IS NOT NULL)",
                           name: "quiz_sessions_exactly_one_owner_check",
                           validate: false
    end
    validate_check_constraint :quiz_sessions, name: "quiz_sessions_exactly_one_owner_check"
  end

  def down
    remove_check_constraint :quiz_sessions, name: "quiz_sessions_exactly_one_owner_check"
  end
end
