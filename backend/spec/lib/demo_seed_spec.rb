# frozen_string_literal: true

require "rails_helper"

RSpec.describe DemoSeed do
  # The seed reads DEMO_EMAIL/DEMO_PASSWORD from ENV (AD-12 config posture) —
  # clear them for each example so the contract is exercised from a known
  # state, and restore whatever was there before.
  around do |example|
    original_email = ENV["DEMO_EMAIL"]
    original_password = ENV["DEMO_PASSWORD"]
    ENV.delete("DEMO_EMAIL")
    ENV.delete("DEMO_PASSWORD")
    example.run
  ensure
    if original_email.nil?
      ENV.delete("DEMO_EMAIL")
    else
      ENV["DEMO_EMAIL"] = original_email
    end
    if original_password.nil?
      ENV.delete("DEMO_PASSWORD")
    else
      ENV["DEMO_PASSWORD"] = original_password
    end
  end

  # Independent golden vectors — computed once outside this suite (scratch
  # script) and pinned here verbatim. The derivation algorithm itself is
  # proven against the DNS-namespace oracle in the first example below; these
  # pin the demo namespace + stable-name wiring.
  STABLE_UUIDS = {
    user: "2e5fdb85-4076-52b6-ad4a-c47ce5b87157",
    plan: "58b6083b-1e27-5eee-b35b-7086c144a361",
    node_1: "0b44ea76-710a-565b-8da6-f21d01dcb324",
    node_2: "d5828003-d825-5a68-812d-b254a0c8f692"
  }.freeze

  describe ".stable_uuid" do
    it "derives RFC 4122 v5 uuids (proven against the DNS-namespace oracle)" do
      dns_namespace = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
      # Independent source of truth: the widely-cited RFC 4122 v5 of the DNS
      # namespace + "example.com" (matches Python's uuid.uuid5 result).
      expect(described_class.stable_uuid("example.com", namespace: dns_namespace))
        .to eq("cfbff0d1-9375-5685-968c-48ce8b15ae17")
    end

    it "pins the demo dataset's golden-vector uuids" do
      expect(described_class.stable_uuid("synapse-demo-user")).to eq(STABLE_UUIDS[:user])
      expect(described_class.stable_uuid("synapse-demo-plan")).to eq(STABLE_UUIDS[:plan])
      expect(described_class.stable_uuid("synapse-demo-node-1")).to eq(STABLE_UUIDS[:node_1])
      expect(described_class.stable_uuid("synapse-demo-node-2")).to eq(STABLE_UUIDS[:node_2])
    end
  end

  describe ".call" do
    it "creates the demo user, one private plan, and two ordered nodes on first run" do
      described_class.call

      user = User.find_by(email: "demo@synapse.test")
      expect(user).to be_present
      expect(user.id).to eq(STABLE_UUIDS[:user])
      expect(user.authenticate("demo-password")).to eq(user)

      plans = user.study_plans.to_a
      expect(plans.count).to eq(1)
      plan = plans.first
      expect(plan.id).to eq(STABLE_UUIDS[:plan])
      expect(plan.visibility).to eq("private")
      expect(plan.topic).to be_present
      expect(plan.goal).to be_present

      nodes = plan.knowledge_nodes.order(:order).to_a
      expect(nodes.map(&:id)).to eq([ STABLE_UUIDS[:node_1], STABLE_UUIDS[:node_2] ])
      expect(nodes.map(&:order)).to eq([ 1, 2 ])
      expect(nodes.map(&:stage)).to all(be_present)
      expect(nodes.map(&:title)).to all(be_present)
    end

    it "is rerun-safe: a second run leaves counts, uuids, and timestamps untouched" do
      described_class.call
      first_user = User.find_by(email: "demo@synapse.test")
      first_plan = first_user.study_plans.first
      first_nodes = first_plan.knowledge_nodes.order(:order).to_a

      described_class.call

      expect(User.count).to eq(1)
      expect(StudyPlan.count).to eq(1)
      expect(KnowledgeNode.count).to eq(2)
      expect(User.find_by(email: "demo@synapse.test").id).to eq(first_user.id)
      expect(StudyPlan.first.id).to eq(first_plan.id)
      expect(KnowledgeNode.order(:order).map(&:id)).to eq(first_nodes.map(&:id))
      # No-churn proof: the second run skipped every write instead of
      # rewriting the rows in place.
      expect(StudyPlan.first.updated_at).to eq(first_plan.updated_at)
      expect(KnowledgeNode.order(:order).map(&:updated_at)).to eq(first_nodes.map(&:updated_at))
    end

    it "adopts a pre-registered demo user instead of duplicating it" do
      existing = create(:user, email: "demo@synapse.test", password: "handmade-password-1")

      described_class.call

      expect(User.count).to eq(1)
      expect(User.find_by(email: "demo@synapse.test").id).to eq(existing.id)
      # The seed owns the demo account's credentials: the adopted row is
      # re-keyed to the current password so the login AC holds everywhere.
      expect(existing.reload.authenticate("demo-password")).to eq(existing)
      # Content uuids stay stable; ownership follows the adopted row.
      plan = existing.reload.study_plans.sole
      expect(plan.id).to eq(STABLE_UUIDS[:plan])
      expect(plan.knowledge_nodes.count).to eq(2)
    end
  end

  describe "ENV contract" do
    it "downcases a provided email before create" do
      described_class.call(email: "Seed.User@Example.com", password: "provided-password-1")

      expect(User.find_by(email: "seed.user@example.com")).to be_present
      expect(User.find_by(email: "Seed.User@Example.com")).to be_nil
    end

    it "falls back to the documented dev defaults outside production" do
      described_class.call

      user = User.find_by(email: "demo@synapse.test")
      expect(user.authenticate("demo-password")).to eq(user)
    end

    it "fails fast in production when DEMO_EMAIL is absent" do
      production

      expect { described_class.call }
        .to raise_error(DemoSeed::MissingDemoEnvError, /DEMO_EMAIL/)
      expect(User.count).to eq(0)
    end

    it "fails fast in production when DEMO_PASSWORD is absent" do
      production
      ENV["DEMO_EMAIL"] = "demo@synapse.test"

      expect { described_class.call }
        .to raise_error(DemoSeed::MissingDemoEnvError, /DEMO_PASSWORD/)
      expect(User.count).to eq(0)
    end

    it "treats a blank ENV value as absent in production" do
      production
      ENV["DEMO_EMAIL"] = "   "
      ENV["DEMO_PASSWORD"] = "demo-password"

      expect { described_class.call }
        .to raise_error(DemoSeed::MissingDemoEnvError, /DEMO_EMAIL/)
    end

    it "rejects a too-short password in every environment (register-command parity)" do
      expect { described_class.call(password: "short") }
        .to raise_error(DemoSeed::ShortDemoPasswordError, /8 characters/)
      expect(User.count).to eq(0)
    end
  end

  private

  def production
    allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("production"))
  end
end
