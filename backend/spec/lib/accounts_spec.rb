# frozen_string_literal: true

require "rails_helper"

# The Accounts namespace root (app/lib/accounts.rb) carries the context's
# shared identity one-liner. Small enough to look trivial, load-bearing
# enough to pin: four call sites (register, login lookup, limiter key, demo
# seed) compare account identities through this function.
RSpec.describe Accounts do
  describe ".normalize_email" do
    it "downcases — the v1 behavior contract, byte-identical to the inline downcases it replaced" do
      expect(described_class.normalize_email("Mixed@Example.COM")).to eq("mixed@example.com")
    end

    it "coerces non-strings the way the inline `email.to_s.downcase` did" do
      expect(described_class.normalize_email(nil)).to eq("")
      expect(described_class.normalize_email(12_345)).to eq("12345")
    end

    # The P2-7 sweep stays swept: behavior specs cannot catch a site
    # reverting to an inline downcase (the behavior would be identical),
    # so the single-sourcing itself is pinned at the source level. A future
    # non-email `.downcase` trips this by file — extend the allowlist in
    # app/lib/accounts.rb's comment contract consciously, not by accident.
    it "is the only `.downcase` normalization site in app/" do
      offenders = Dir.glob(Rails.root.join("app/**/*.rb")).reject do |path|
        next true if path.end_with?("app/lib/accounts.rb")

        File.readlines(path).none? do |line|
          !line.strip.start_with?("#") && line.include?(".downcase")
        end
      end

      expect(offenders).to be_empty,
                           "identity normalization must go through Accounts.normalize_email; " \
                           "inline .downcase found in: #{offenders.join(', ')}"
    end
  end
end
