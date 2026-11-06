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

  # Independent golden vectors — computed once outside this suite (an
  # independent RFC 4122 v5 implementation, Python's uuid.uuid5, over this
  # module's namespace) and pinned here verbatim. The derivation algorithm
  # itself is proven against the DNS-namespace oracle in the first example
  # below; these pin the demo namespace + stable-name wiring. The USER
  # uuids derive from the normalized demo email (one demo account per email
  # — see DemoSeed.seed_user!), so they are pinned per email: the default
  # demo email and the downcase example's email.
  STABLE_UUIDS = {
    user: "5a1b1f1b-973d-581c-926c-b1f71532c8f7",
    alt_email_user: "abcf3da9-1b8e-5b57-bf67-37919af3f0b7",
    plan: "58b6083b-1e27-5eee-b35b-7086c144a361",
    node_1: "0b44ea76-710a-565b-8da6-f21d01dcb324",
    node_2: "d5828003-d825-5a68-812d-b254a0c8f692",
    node_3: "73655ae9-e3b1-52ae-963d-ab958a6598e1",
    edge_1: "0ccbf14e-ddad-59be-81d5-0bff779c2d96",
    edge_2: "d30c836e-8c90-5615-9cf5-03dab0354bf9"
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
      expect(described_class.stable_uuid("user:demo@synapse.test")).to eq(STABLE_UUIDS[:user])
      expect(described_class.stable_uuid("user:seed.user@example.com")).to eq(STABLE_UUIDS[:alt_email_user])
      expect(described_class.stable_uuid("synapse-demo-plan")).to eq(STABLE_UUIDS[:plan])
      expect(described_class.stable_uuid("synapse-demo-node-1")).to eq(STABLE_UUIDS[:node_1])
      expect(described_class.stable_uuid("synapse-demo-node-2")).to eq(STABLE_UUIDS[:node_2])
      expect(described_class.stable_uuid("synapse-demo-node-3")).to eq(STABLE_UUIDS[:node_3])
      expect(described_class.stable_uuid("synapse-demo-edge-1")).to eq(STABLE_UUIDS[:edge_1])
      expect(described_class.stable_uuid("synapse-demo-edge-2")).to eq(STABLE_UUIDS[:edge_2])
    end
  end

  describe ".call" do
    it "creates the demo user, one private plan, and ordered described nodes with a truthful edge set" do
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

      # The roadmap garnish (epic-16 T1): every node described, at least one
      # optional node, and a truthful stage-forward edge set.
      nodes = plan.knowledge_nodes.order(:order).to_a
      expect(nodes.map(&:id)).to eq([ STABLE_UUIDS[:node_1], STABLE_UUIDS[:node_2], STABLE_UUIDS[:node_3] ])
      expect(nodes.map(&:order)).to eq([ 1, 2, 3 ])
      expect(nodes.map(&:stage)).to all(be_present)
      expect(nodes.map(&:title)).to all(be_present)
      expect(nodes.map(&:description)).to all(be_present)
      expect(nodes.count { |node| node.optional }).to be >= 1

      edges = plan.knowledge_node_edges.order(:created_at, :id).to_a
      expect(edges.map(&:id)).to eq([ STABLE_UUIDS[:edge_1], STABLE_UUIDS[:edge_2] ])
      # Both prerequisites point INTO the practice drill, from its
      # foundations stage — stage-forward by construction.
      expect(edges.map { |edge| [edge.from_node_id, edge.to_node_id] }).to eq([
        [nodes[0].id, nodes[2].id],
        [nodes[1].id, nodes[2].id]
      ])
    end

    it "is rerun-safe: a second run leaves counts, uuids, and timestamps untouched" do
      described_class.call
      first_user = User.find_by(email: "demo@synapse.test")
      first_plan = first_user.study_plans.first
      first_nodes = first_plan.knowledge_nodes.order(:order).to_a
      first_edges = first_plan.knowledge_node_edges.order(:created_at, :id).to_a

      described_class.call

      # Assertions scoped to the demo dataset (the demo email + the rows it
      # owns), not the whole table — a test database may legitimately already
      # carry rows (e.g. a fresh CI database auto-seeds before the suite).
      expect(User.where(email: "demo@synapse.test").count).to eq(1)
      expect(User.find_by(email: "demo@synapse.test").id).to eq(first_user.id)
      expect(first_user.reload.study_plans.count).to eq(1)
      expect(first_user.study_plans.first.id).to eq(first_plan.id)
      expect(first_user.study_plans.first.knowledge_nodes.count).to eq(3)
      expect(first_user.study_plans.first.knowledge_nodes.order(:order).map(&:id)).to eq(first_nodes.map(&:id))
      expect(first_user.study_plans.first.knowledge_node_edges.count).to eq(2)
      expect(first_user.study_plans.first.knowledge_node_edges.order(:created_at, :id).map(&:id))
        .to eq(first_edges.map(&:id))
      # No-churn proof: the second run skipped every write instead of
      # rewriting the rows in place (first_plan / first_nodes / first_edges
      # carry the pre-second-run timestamps).
      expect(first_user.study_plans.first.updated_at).to eq(first_plan.updated_at)
      expect(first_user.study_plans.first.knowledge_nodes.order(:order).map(&:updated_at)).to eq(first_nodes.map(&:updated_at))
      expect(first_user.study_plans.first.knowledge_node_edges.order(:created_at, :id).map(&:updated_at))
        .to eq(first_edges.map(&:updated_at))
    end

    it "adopts a pre-registered demo user instead of duplicating it" do
      # Seed-state-agnostic setup: the database may already carry the demo
      # row (e.g. a fresh CI database auto-seeds before the suite). Either
      # way this example starts from exactly one demo-email row whose
      # credentials are NOT the seed's, so the adoption + re-key contract is
      # exercised identically.
      existing = User.find_by(email: "demo@synapse.test") ||
                 create(:user, email: "demo@synapse.test")
      existing.update!(password: "handmade-password-1")
      expect(existing.authenticate("demo-password")).to be_falsey

      described_class.call

      expect(User.where(email: "demo@synapse.test").count).to eq(1)
      expect(User.find_by(email: "demo@synapse.test").id).to eq(existing.id)
      # The seed owns the demo account's credentials: the adopted row is
      # re-keyed to the current password so the login AC holds everywhere.
      expect(existing.reload.authenticate("demo-password")).to eq(existing)
      # Content uuids stay stable; ownership follows the adopted row.
      plan = existing.reload.study_plans.sole
      expect(plan.id).to eq(STABLE_UUIDS[:plan])
      expect(plan.knowledge_nodes.count).to eq(3)
      expect(plan.knowledge_node_edges.count).to eq(2)
    end
  end

  describe "ENV contract" do
    it "downcases a provided email before create" do
      described_class.call(email: "Seed.User@Example.com", password: "provided-password-1")

      user = User.find_by(email: "seed.user@example.com")
      expect(user).to be_present
      # The stable uuid derives from the NORMALIZED email: the downcased
      # address feeds the derivation, so this row can coexist with any other
      # demo email in the same database (no primary-key collision).
      expect(user.id).to eq(STABLE_UUIDS[:alt_email_user])
      expect(User.find_by(email: "Seed.User@Example.com")).to be_nil
    end

    it "falls back to the documented dev defaults outside production" do
      described_class.call

      user = User.find_by(email: "demo@synapse.test")
      expect(user.authenticate("demo-password")).to eq(user)
    end

    it "fails fast in production when DEMO_EMAIL is absent" do
      production

      expect_error_and_no_user_write(DemoSeed::MissingDemoEnvError, /DEMO_EMAIL/) do
        described_class.call
      end
    end

    it "fails fast in production when DEMO_PASSWORD is absent" do
      production
      ENV["DEMO_EMAIL"] = "demo@synapse.test"

      expect_error_and_no_user_write(DemoSeed::MissingDemoEnvError, /DEMO_PASSWORD/) do
        described_class.call
      end
    end

    it "treats a blank ENV value as absent in production" do
      production
      ENV["DEMO_EMAIL"] = "   "
      ENV["DEMO_PASSWORD"] = "demo-password"

      expect { described_class.call }
        .to raise_error(DemoSeed::MissingDemoEnvError, /DEMO_EMAIL/)
    end

    it "rejects a too-short password in every environment (register-command parity)" do
      expect_error_and_no_user_write(DemoSeed::ShortDemoPasswordError, /8 characters/) do
        described_class.call(password: "short")
      end
    end
  end

  private

  def production
    allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("production"))
  end

  # The failed seed must raise the expected error AND write no user row.
  # Stated as a no-change contract on the users table rather than
  # "zero users": a test database may legitimately already hold rows
  # (e.g. a fresh CI database auto-seeds before the suite), and the contract
  # under test is that the FAILED call adds nothing.
  def expect_error_and_no_user_write(error, message)
    user_count = User.count
    expect { yield }.to raise_error(error, message)
    expect(User.count).to eq(user_count)
  end
end
