# frozen_string_literal: true

require "rails_helper"

# The manual-task ops on the wire (epic P2-09 T3, FR-27): the auth guard on
# each mutation, the VALIDATION_FAILED surfaces (title bound, boolean done),
# the uniform NOT_FOUND matrix (unknown / foreign / malformed ids — AD-13),
# the idempotent done-toggle (same state → the row comes back with
# updated_at untouched), and the todayHub read-back after every write (the
# hub is the Today page's read; the ops move its manual list + summary).
RSpec.describe "GraphQL manual-task ops (epic P2-09 T3)", type: :request do
  let(:password) { "known-password-123" }
  let(:user) { create(:user, email: "manual-tasker@example.com", password: password) }
  let(:token) { token_for(user.email) }

  it "answers UNAUTHORIZED on every manual-task mutation without a token" do
    aggregate_failures do
      result = graphql('mutation { addManualTask(input: { title: "x" }) { manualTask { id } } }')
      expect(error_code(result)).to eq("UNAUTHORIZED")

      result = graphql("mutation { setManualTaskDone(input: { id: \"#{SecureRandom.uuid}\", done: true }) { manualTask { id } } }")
      expect(error_code(result)).to eq("UNAUTHORIZED")

      result = graphql("mutation { deleteManualTask(input: { id: \"#{SecureRandom.uuid}\" }) { deletedManualTaskId } }")
      expect(error_code(result)).to eq("UNAUTHORIZED")
    end
  end

  describe "addManualTask" do
    it "creates the task and reads it back through todayHub (manual list + summary)" do
      result = graphql(<<~GRAPHQL, token: token)
        mutation {
          addManualTask(input: { title: "整理需求追踪矩阵", dueDate: "2026-11-06" }) {
            manualTask { id title dueDate done createdAt updatedAt }
          }
        }
      GRAPHQL

      task = result.dig("data", "addManualTask", "manualTask")
      aggregate_failures do
        expect(task["title"]).to eq("整理需求追踪矩阵")
        # the plain date, read back at midnight (the DateTime scalar's wire format)
        expect(task["dueDate"]).to eq("2026-11-06T00:00:00+00:00")
        expect(task["done"]).to be(false)
      end

      readback = graphql("query { todayHub { manual { title } summary { manualCount doneCount } } }", token: token)
      hub = readback.dig("data", "todayHub")
      aggregate_failures do
        expect(hub["manual"].map { |row| row["title"] }).to eq([ "整理需求追踪矩阵" ])
        expect(hub["summary"]["manualCount"]).to eq(1)
        expect(hub["summary"]["doneCount"]).to eq(0)
      end
    end

    it "accepts a null dueDate (the unscheduled task)" do
      result = graphql('mutation { addManualTask(input: { title: "someday" }) { manualTask { dueDate } } }', token: token)

      expect(result.dig("data", "addManualTask", "manualTask", "dueDate")).to be_nil
    end

    it "refuses a blank title and a title beyond 200 characters with VALIDATION_FAILED" do
      aggregate_failures do
        result = graphql('mutation { addManualTask(input: { title: "   " }) { manualTask { id } } }', token: token)
        expect(error_code(result)).to eq("VALIDATION_FAILED")

        result = graphql("mutation { addManualTask(input: { title: \"#{'x' * 201}\" }) { manualTask { id } } }", token: token)
        expect(error_code(result)).to eq("VALIDATION_FAILED")
      end
      expect(user.manual_tasks.count).to eq(0)
    end
  end

  describe "setManualTaskDone" do
    let(:task) { create(:manual_task, user: user, title: "整理错题本") }

    it "toggles done and the read-back sweeps the row out of the open list into doneCount" do
      result = graphql(<<~GRAPHQL, token: token)
        mutation {
          setManualTaskDone(input: { id: "#{task.id}", done: true }) {
            manualTask { id done }
          }
        }
      GRAPHQL

      aggregate_failures do
        expect(result.dig("data", "setManualTaskDone", "manualTask", "done")).to be(true)
        expect(task.reload.done).to be(true)
      end

      readback = graphql("query { todayHub { manual { id } summary { manualCount doneCount } } }", token: token)
      hub = readback.dig("data", "todayHub")
      aggregate_failures do
        expect(hub["manual"]).to eq([])
        expect(hub["summary"]["manualCount"]).to eq(0)
        expect(hub["summary"]["doneCount"]).to eq(1)
      end
    end

    it "is idempotent on the wire: same-state toggle returns the row, updated_at untouched" do
      before_updated_at = task.reload.updated_at

      result = graphql(<<~GRAPHQL, token: token)
        mutation {
          setManualTaskDone(input: { id: "#{task.id}", done: false }) {
            manualTask { id done updatedAt }
          }
        }
      GRAPHQL

      payload = result.dig("data", "setManualTaskDone", "manualTask")
      aggregate_failures do
        expect(payload["done"]).to be(false)
        # DB truth: no write happened (microsecond precision — an UPDATE would move it)
        expect(task.reload.updated_at).to eq(before_updated_at)
        # wire truth: the untouched timestamp rides back verbatim
        expect(payload["updatedAt"]).to eq(before_updated_at.iso8601)
      end
    end

    it "answers NOT_FOUND uniformly for unknown, foreign, and malformed ids" do
      foreign = create(:manual_task) # another user's row

      aggregate_failures do
        result = graphql("mutation { setManualTaskDone(input: { id: \"#{SecureRandom.uuid}\", done: true }) { manualTask { id } } }", token: token)
        expect(error_code(result)).to eq("NOT_FOUND")

        result = graphql("mutation { setManualTaskDone(input: { id: \"#{foreign.id}\", done: true }) { manualTask { id } } }", token: token)
        expect(error_code(result)).to eq("NOT_FOUND")
        expect(foreign.reload.done).to be(false)

        result = graphql('mutation { setManualTaskDone(input: { id: "garbage", done: true }) { manualTask { id } } }', token: token)
        expect(error_code(result)).to eq("NOT_FOUND")
      end
    end
  end

  describe "deleteManualTask" do
    let(:task) { create(:manual_task, user: user) }

    it "deletes the task and the read-back empties the list" do
      result = graphql(<<~GRAPHQL, token: token)
        mutation {
          deleteManualTask(input: { id: "#{task.id}" }) {
            deletedManualTaskId
          }
        }
      GRAPHQL

      aggregate_failures do
        expect(result.dig("data", "deleteManualTask", "deletedManualTaskId")).to eq(task.id)
        expect(ManualTask.exists?(task.id)).to be(false)
      end

      readback = graphql("query { todayHub { manual { id } summary { manualCount } } }", token: token)
      hub = readback.dig("data", "todayHub")
      aggregate_failures do
        expect(hub["manual"]).to eq([])
        expect(hub["summary"]["manualCount"]).to eq(0)
      end
    end

    it "answers NOT_FOUND uniformly for unknown, foreign, and malformed ids" do
      foreign = create(:manual_task) # another user's row

      aggregate_failures do
        result = graphql("mutation { deleteManualTask(input: { id: \"#{SecureRandom.uuid}\" }) { deletedManualTaskId } }", token: token)
        expect(error_code(result)).to eq("NOT_FOUND")

        result = graphql("mutation { deleteManualTask(input: { id: \"#{foreign.id}\" }) { deletedManualTaskId } }", token: token)
        expect(error_code(result)).to eq("NOT_FOUND")
        expect(ManualTask.exists?(foreign.id)).to be(true)

        result = graphql('mutation { deleteManualTask(input: { id: "not-even-close" }) { deletedManualTaskId } }', token: token)
        expect(error_code(result)).to eq("NOT_FOUND")
      end
    end
  end
end
