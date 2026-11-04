# frozen_string_literal: true

require "rails_helper"

RSpec.describe Requeue::ScanDueItemsCommand do
  # The correct-on-wake suite (AD-10 direct command testing; kickoff
  # decisions 7–8). Time comes from Rails' built-in TimeHelpers (travel_to —
  # no extra gem): due-ness must derive from SOURCE timestamps at SCAN time,
  # so every case pins what a wake at that instant would materialize. The
  # ladders under test are the kickoff's recorded values (spec.md).
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { create(:user) }

  after { travel_back }

  def scan
    described_class.call
  end

  def schedule_for(item)
    RequeueSchedule.find_by(schedulable_type: item.class.name, schedulable_id: item.id)
  end

  describe "flashcard intervals (the self-rating picks the ladder)" do
    it "makes an unrated card due immediately (never studied ⇒ due now)" do
      travel_to(Time.zone.parse("2026-11-01 09:00:00 UTC")) do
        card = create(:flashcard, user: user, updated_at: Time.current)

        scan

        expect(schedule_for(card).next_due_at).to eq(card.updated_at)
      end
    end

    it "maps hard/medium/easy to 2d/5d/10d from the rating moment (updated_at)" do
      travel_to(Time.zone.parse("2026-11-01 09:00:00 UTC")) do
        rated = Time.zone.parse("2026-10-28 12:00:00 UTC")
        hard = create(:flashcard, user: user, difficulty: "hard", updated_at: rated)
        medium = create(:flashcard, user: user, difficulty: "medium", updated_at: rated)
        easy = create(:flashcard, user: user, difficulty: "easy", updated_at: rated)

        scan

        aggregate_failures do
          expect(schedule_for(hard).next_due_at).to eq(rated + 2.days)
          expect(schedule_for(medium).next_due_at).to eq(rated + 5.days)
          expect(schedule_for(easy).next_due_at).to eq(rated + 10.days)
        end
      end
    end

    it "re-derives after a re-rating: the new updated_at becomes the anchor" do
      card = nil
      travel_to(Time.zone.parse("2026-11-01 09:00:00 UTC")) do
        card = create(:flashcard, user: user, difficulty: "easy", updated_at: Time.current)
        scan
        expect(schedule_for(card).next_due_at).to eq(Time.current + 10.days)
      end

      travel_to(Time.zone.parse("2026-11-03 09:00:00 UTC")) do
        card.update!(difficulty: "hard") # the rating write moves updated_at
        scan
        expect(schedule_for(card).next_due_at).to eq(Time.current + 2.days)
      end
    end
  end

  describe "mistake stage ladder (consecutive correct evidence after the mistake)" do
    it "makes a fresh mistake due in 1 day from its creation" do
      travel_to(Time.zone.parse("2026-11-01 09:00:00 UTC")) do
        mistake = create(:mistake_entry, user: user, created_at: Time.current)

        scan

        expect(schedule_for(mistake).next_due_at).to eq(mistake.created_at + 1.day)
      end
    end

    it "advances one stage per consecutive correct evidence and anchors on the latest evidence" do
      travel_to(Time.zone.parse("2026-11-01 09:00:00 UTC")) do
        mistake = create(:mistake_entry, user: user, created_at: Time.zone.parse("2026-10-20 09:00:00 UTC"))
        question = mistake.question
        create(:evidence_record, user: user, question: question, node: question.node, outcome: "correct",
                                 created_at: Time.zone.parse("2026-10-25 10:00:00 UTC"))
        create(:evidence_record, user: user, question: question, node: question.node, outcome: "correct",
                                 created_at: Time.zone.parse("2026-10-27 10:00:00 UTC"))

        scan

        schedule = schedule_for(mistake)
        aggregate_failures do
          expect(schedule.stage).to eq(2)
          expect(schedule.next_due_at).to eq(Time.zone.parse("2026-10-27 10:00:00 UTC") + 4.days)
          expect(schedule.last_source_timestamp).to eq(Time.zone.parse("2026-10-27 10:00:00 UTC"))
        end
      end
    end

    it "resets the stage on a wrong or partial answer (the run must END in correct)" do
      travel_to(Time.zone.parse("2026-11-01 09:00:00 UTC")) do
        mistake = create(:mistake_entry, user: user, created_at: Time.zone.parse("2026-10-20 09:00:00 UTC"))
        question = mistake.question
        create(:evidence_record, user: user, question: question, node: question.node, outcome: "correct",
                                 created_at: Time.zone.parse("2026-10-25 10:00:00 UTC"))
        latest_wrong = create(:evidence_record, user: user, question: question, node: question.node, outcome: "wrong",
                                                 created_at: Time.zone.parse("2026-10-26 10:00:00 UTC"))

        scan

        schedule = schedule_for(mistake)
        aggregate_failures do
          expect(schedule.stage).to eq(0)
          expect(schedule.next_due_at).to eq(latest_wrong.created_at + 1.day)
        end
      end
    end

    it "ignores evidence that predates the mistake (and caps the stage at the ladder's end)" do
      travel_to(Time.zone.parse("2026-11-01 09:00:00 UTC")) do
        mistake = create(:mistake_entry, user: user, created_at: Time.zone.parse("2026-10-20 09:00:00 UTC"))
        question = mistake.question
        # Two corrects BEFORE the mistake exist (same question, older study):
        create(:evidence_record, user: user, question: question, node: question.node, outcome: "correct",
                                 created_at: Time.zone.parse("2026-10-10 10:00:00 UTC"))
        create(:evidence_record, user: user, question: question, node: question.node, outcome: "correct",
                                 created_at: Time.zone.parse("2026-10-15 10:00:00 UTC"))
        # Five corrects after — beyond the ladder's last rung (stage caps at 3):
        5.times do |i|
          create(:evidence_record, user: user, question: question, node: question.node, outcome: "correct",
                                   created_at: Time.zone.parse("2026-10-21 10:00:00 UTC") + i.days)
        end

        scan

        schedule = schedule_for(mistake)
        aggregate_failures do
          expect(schedule.stage).to eq(3)
          expect(schedule.next_due_at).to eq(Time.zone.parse("2026-10-25 10:00:00 UTC") + 7.days)
        end
      end
    end
  end

  describe "wrong-sooner ordering (FR-24)" do
    it "resurfaces a fresh mistake sooner than even a hard flashcard" do
      travel_to(Time.zone.parse("2026-11-01 09:00:00 UTC")) do
        anchor = Time.zone.parse("2026-10-28 12:00:00 UTC")
        mistake = create(:mistake_entry, user: user, created_at: anchor)
        hard_card = create(:flashcard, user: user, difficulty: "hard", updated_at: anchor)

        scan

        expect(schedule_for(mistake).next_due_at).to be < schedule_for(hard_card).next_due_at # 1d < 2d
      end
    end

    it "resurfaces a capped mistake sooner than an easy flashcard (7d cap < 10d)" do
      travel_to(Time.zone.parse("2026-11-01 09:00:00 UTC")) do
        anchor = Time.zone.parse("2026-10-28 12:00:00 UTC")
        mistake = create(:mistake_entry, user: user, created_at: anchor)
        question = mistake.question
        5.times do |i|
          create(:evidence_record, user: user, question: question, node: question.node, outcome: "correct",
                                   created_at: anchor + (i + 1).hours)
        end
        easy_card = create(:flashcard, user: user, difficulty: "easy", updated_at: anchor)

        scan

        expect(schedule_for(mistake).next_due_at).to be < schedule_for(easy_card).next_due_at # 7d < 10d
      end
    end
  end

  describe "correct-on-wake (AD-19)" do
    it "recomputes identically after a multi-day sleep — no accumulation, no backlog inflation" do
      card = nil
      mistake = nil
      travel_to(Time.zone.parse("2026-11-01 09:00:00 UTC")) do
        card = create(:flashcard, user: user, difficulty: "hard", updated_at: Time.current)
        mistake = create(:mistake_entry, user: user, created_at: Time.current)
        scan
      end

      before_sleep = RequeueSchedule.order(:schedulable_type, :schedulable_id).pluck(:schedulable_type, :schedulable_id, :next_due_at, :stage)

      # The service sleeps five days, wakes, scans: the same two items, the
      # same due instants (recomputed from the same source timestamps), and
      # nothing multiplied.
      travel_to(Time.zone.parse("2026-11-06 09:00:00 UTC")) do
        result = scan

        after_sleep = RequeueSchedule.order(:schedulable_type, :schedulable_id).pluck(:schedulable_type, :schedulable_id, :next_due_at, :stage)
        aggregate_failures do
          expect(after_sleep).to eq(before_sleep)
          expect(result.value![:schedule_count]).to eq(before_sleep.size)
          expect(result.value![:due_count]).to eq(2) # both fell due during the sleep — still exactly two rows
        end
      end
    end

    it "is idempotent on immediate re-scan (same rows, no duplicates, no drift)" do
      travel_to(Time.zone.parse("2026-11-01 09:00:00 UTC")) do
        create(:flashcard, user: user, difficulty: "medium", updated_at: Time.current)
        create(:mistake_entry, user: user, created_at: Time.current)

        scan
        first_pass = RequeueSchedule.order(:schedulable_type, :schedulable_id)
                                    .pluck(:schedulable_type, :schedulable_id, :next_due_at, :stage, :last_source_timestamp)
        scan
        second_pass = RequeueSchedule.order(:schedulable_type, :schedulable_id)
                                     .pluck(:schedulable_type, :schedulable_id, :next_due_at, :stage, :last_source_timestamp)

        aggregate_failures do
          expect(second_pass).to eq(first_pass)
          expect(RequeueSchedule.count).to eq(2)
        end
      end
    end

    it "updates in place when the source moves (upsert, one row per item forever)" do
      # Sequential non-block travel_to — TimeHelpers refuses nested block form.
      travel_to(Time.zone.parse("2026-11-01 09:00:00 UTC"))
      card = create(:flashcard, user: user, difficulty: "easy", updated_at: Time.current)
      scan
      original_row_id = schedule_for(card).id

      travel_to(Time.zone.parse("2026-11-02 09:00:00 UTC"))
      card.update!(difficulty: "hard")
      scan

      aggregate_failures do
        expect(schedule_for(card).id).to eq(original_row_id)
        expect(RequeueSchedule.count).to eq(1)
      end
    end

    it "prunes schedules whose source row vanished (no ghosts)" do
      card = nil
      mistake = nil
      travel_to(Time.zone.parse("2026-11-01 09:00:00 UTC")) do
        card = create(:flashcard, user: user, difficulty: "hard", updated_at: Time.current)
        mistake = create(:mistake_entry, user: user, created_at: Time.current)
        scan
        expect(RequeueSchedule.count).to eq(2)
      end

      travel_to(Time.zone.parse("2026-11-02 09:00:00 UTC")) do
        card.destroy!
        scan

        aggregate_failures do
          expect(RequeueSchedule.count).to eq(1)
          expect(RequeueSchedule.where(schedulable_type: "MistakeEntry").count).to eq(1)
        end
      end
    end
  end

  it "stays user-less and scoping-clean: rows always carry their own user (the wake serves every user)" do
    other = create(:user)
    travel_to(Time.zone.parse("2026-11-01 09:00:00 UTC")) do
      mine = create(:flashcard, user: user, difficulty: "hard", updated_at: Time.current)
      theirs = create(:flashcard, user: other, difficulty: "hard", updated_at: Time.current)

      scan

      aggregate_failures do
        expect(schedule_for(mine).user_id).to eq(user.id)
        expect(schedule_for(theirs).user_id).to eq(other.id)
        expect(RequeueSchedule.count).to eq(2)
      end
    end
  end
end
