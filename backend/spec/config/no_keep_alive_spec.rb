# frozen_string_literal: true

require "rails_helper"

# The keep-alive guard (AD-19, epic P2-7 ticket 01 — "no ping/keep-alive
# code paths: simplest that works"): keeping the service awake would drain
# Neon's free compute hours in days (the review gate's Render/Neon
# findings), so no spin loop may ever land in our own code. Solid Queue's
# own polling lives inside the gem (not scanned); cold starts are accepted.
RSpec.describe "no keep-alive loops anywhere in the app's own code" do
  ROOTS = %w[app config lib].freeze
  FORBIDDEN = [
    /while\s+true\b/i,
    /loop\s+do\b/,
    /\bkeep.?alive\b/i,
    /sleep\s+until\b/,
    /until\s+sleep\b/
  ].freeze

  it "finds none of the spin-loop shapes in app/, config/, lib/" do
    offenders = []
    ROOTS.each do |root|
      Dir.glob(Rails.root.join(root, "**/*.rb")).each do |path|
        lines = File.readlines(path)
        lines.each_with_index do |line, i|
          next if line.strip.start_with?("#")

          FORBIDDEN.each do |pattern|
            offenders << "#{path.delete_prefix("#{Rails.root}/")}:#{i + 1} #{line.strip}" if line.match?(pattern)
          end
        end
      end
    end

    expect(offenders).to eq([]), <<~MSG
      A potential keep-alive/spin loop was found (AD-19 forbids them):
      #{offenders.join("\n")}
      If this is a legitimate non-loop use of the matched word, rename it —
      the guard is deliberately lexical.
    MSG
  end
end
