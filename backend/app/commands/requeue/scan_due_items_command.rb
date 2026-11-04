# frozen_string_literal: true

module Requeue
  # Recompute the re-queue schedule for every mistake and flashcard (FR-24,
  # epic P2-7 ticket 02). Correct-on-wake is the correctness rule (AD-19):
  # stage + next_due_at are RE-DERIVED from the source rows' timestamps on
  # every wake and upserted into requeue_schedules — never accumulated while
  # asleep. A service that slept for five days wakes, recomputes the same
  # values it would have computed in one day, and prunes anything whose
  # source row vanished: no backlog inflation, no stale rows. (Kickoff
  # decisions 7–8; interval ladders live on the Requeue module.)
  #
  # The command is user-less (the wake serves every user) — no current_user
  # option, so #authorize's default allow stands; a system-shaped command.
  class ScanDueItemsCommand < ApplicationCommand
    def call
      now = Time.current
      rows = mistake_rows(now) + flashcard_rows(now)

      ActiveRecord::Base.transaction do
        RequeueSchedule.upsert_all(rows, unique_by: %i[schedulable_type schedulable_id]) if rows.any?
        prune_stale_schedules(rows)
      end

      Success(
        due_count: RequeueSchedule.where(next_due_at: ..now).count,
        schedule_count: rows.size,
        scanned_at: now
      )
    end

    private

    # Stage = consecutive `correct` evidence for the question AFTER the
    # mistake (wrong/partial reset to 0); anchor = the newer of the mistake's
    # creation and the latest post-mistake evidence. Everything derives from
    # one evidence query — no per-row round trips.
    def mistake_rows(now)
      evidence_by_question = EvidenceRecord.where(question_id: MistakeEntry.select(:question_id))
                                           .order(:created_at)
                                           .group_by(&:question_id)

      MistakeEntry.find_each.map do |mistake|
        timeline = evidence_by_question.fetch(mistake.question_id, [])
                                      .select { |e| e.created_at > mistake.created_at }

        stage = 0
        timeline.reverse_each do |evidence|
          break unless evidence.outcome == "correct"

          stage += 1
        end
        # Cap the stage at the ladder's end BEFORE indexing (the 7d rung is
        # terminal — a fifth consecutive correct neither crashes the array
        # index nor moves the date further out).
        stage = [ stage, Requeue::MISTAKE_STAGES.length - 1 ].min
        anchor = [ mistake.created_at, timeline.last&.created_at ].compact.max
        due_at = anchor + Requeue::MISTAKE_STAGES[stage]

        schedule_row(mistake, user_id: mistake.user_id, stage: stage, due_at: due_at, anchor: anchor, now: now)
      end
    end

    # The self-rating is the only flashcard write (rateFlashcard — never
    # evidence, ADR-0001): updated_at is the rating moment, difficulty picks
    # the interval, an unrated card (nil) is due immediately.
    def flashcard_rows(now)
      Flashcard.find_each.map do |flashcard|
        interval = Requeue::FLASHCARD_LADDER.fetch(flashcard.difficulty, 0)
        due_at = flashcard.updated_at + interval

        schedule_row(flashcard, user_id: flashcard.user_id, stage: 0, due_at: due_at,
                                anchor: flashcard.updated_at, now: now)
      end
    end

    # The upsert key: one schedule per source row, forever. created_at rides
    # the upsert on conflict (this row is a cache — its insert instant is
    # meaningless; last_source_timestamp is the audit field), so idempotent
    # re-scans rewrite it harmlessly.
    def schedule_row(source, user_id:, stage:, due_at:, anchor:, now:)
      {
        user_id: user_id,
        schedulable_type: source.class.name,
        schedulable_id: source.id,
        stage: stage,
        next_due_at: due_at,
        last_source_timestamp: anchor,
        created_at: now,
        updated_at: now
      }
    end

    # The recompute reconciles in both directions: rows whose source vanished
    # (a deleted mistake/flashcard between scans) are pruned, so the table
    # never accumulates ghosts.
    def prune_stale_schedules(rows)
      %w[MistakeEntry Flashcard].each do |type|
        live_ids = rows.select { |r| r[:schedulable_type] == type }.pluck(:schedulable_id)
        scope = RequeueSchedule.where(schedulable_type: type)
        scope = scope.where.not(schedulable_id: live_ids) if live_ids.any?
        scope.delete_all
      end
    end
  end
end
