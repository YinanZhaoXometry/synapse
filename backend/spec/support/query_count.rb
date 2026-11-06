# frozen_string_literal: true

# Shared query-count instrumentation (epic P3-17 ticket 08): the N+1 guard
# pattern the square + mastery specs hand-rolled inline, promoted to one
# helper so every bounded-read assertion runs the same measurement.
module QueryCount
  # Counts SELECT statements issued inside the block. Run any warm-up request
  # BEFORE calling this — schema-cache chatter must stay out of the count.
  def count_selects
    selects = 0
    subscription = ActiveSupport::Notifications.subscribe("sql.active_record") do |*_args, payload|
      selects += 1 if payload[:sql].to_s.strip.upcase.start_with?("SELECT")
    end
    yield
    selects
  ensure
    ActiveSupport::Notifications.unsubscribe(subscription) if subscription
  end

  # Counts loads of ONE table (the payload name Rails logs, e.g.
  # "EvidenceRecord Load") — for assertions on a specific table's batch
  # behavior, immune to unrelated SELECTs in the same request. Accepts either
  # the table symbol (:evidence_record) or the class name (:EvidenceRecord).
  def count_loads_of(table)
    load_name = "#{table.to_s.classify} Load"
    loads = 0
    subscription = ActiveSupport::Notifications.subscribe("sql.active_record") do |_name, _start, _finish, _id, payload|
      loads += 1 if payload[:name] == load_name
    end
    yield
    loads
  ensure
    ActiveSupport::Notifications.unsubscribe(subscription) if subscription
  end
end

RSpec.configure do |config|
  config.include QueryCount
end
