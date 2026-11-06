# frozen_string_literal: true

require "digest"

# The idempotent demo-account seed (AD-15 / NFR-6, epic P2-2 ticket 03):
# creates the demo user from DEMO_EMAIL/DEMO_PASSWORD plus a small
# shape-stub dataset owned by that user — one private StudyPlan, its
# KnowledgeNodes, and (since epic-16 T1) a truthful prerequisite-edge set:
# every node described, one optional garnish node, both prerequisites
# pointing stage-forward into the practice drill (real demo content is
# seeded closer to the graded window per AD-20). db/seeds.rb is a one-line
# caller.
#
# Idempotency (the rerun-safe AC): every content row is keyed by a STABLE
# uuid — RFC 4122 v5 (SHA-1 over a 16-byte namespace + name) derived from
# this module's fixed demo namespace, so the same name yields the same uuid
# in every environment. v5 over plain fixed uuid constants: the derivation
# documents itself (recompute with DemoSeed.stable_uuid), cannot collide
# with gen_random_uuid() in practice, and extends to future demo rows
# without inventing new magic constants. Rows are then update-or-skip by
# that uuid (never duplicate): a missing row is created with the stable id
# (client-suppliable ids are the AD-12 import-idempotency mechanism); an
# existing row is written only when an attribute actually differs. The demo
# USER is keyed by its unique email instead, and its stable uuid derives
# from that normalized email (`user:#{email}` — one demo account per email,
# so a database that already holds one demo account absorbs a
# differently-configured DEMO_EMAIL without a primary-key collision; the
# original fixed "synapse-demo-user" name collided there). The row carries
# the stable uuid only when the seed creates it: a pre-existing row — e.g.
# registered through the mutations, or seeded with an older password — is
# adopted and its credentials re-keyed to the current DEMO_PASSWORD, so the
# login contract holds on every rerun.
#
# ENV contract (AD-12, no settings gem): DEMO_EMAIL/DEMO_PASSWORD are read
# from ENV at call time; absent/blank falls back to documented dev/test
# defaults (demo@synapse.test / demo-password), but in production the seed
# fails fast with a named error instead of inventing demo credentials. A
# password shorter than the register command's minimum is rejected in every
# environment (register-command parity). backend/.env.example documents the
# contract; backend/.dockerdev/compose.yaml wires the dev values.
module DemoSeed
  # Fixed UUIDv5 namespace for every derived demo uuid. Minted once (random
  # v4) and frozen forever — changing it changes every demo uuid and would
  # orphan already-seeded rows.
  NAMESPACE = "b60a8e5b-6e3a-4d61-8a18-6b9c3d67ee8b"

  DEFAULT_EMAIL = "demo@synapse.test"
  DEFAULT_PASSWORD = "demo-password"

  # Parity with Accounts::RegisterUserCommand (epic P2-2 kickoff delta 4).
  MIN_PASSWORD_LENGTH = Accounts::RegisterUserCommand::MIN_PASSWORD_LENGTH

  # Raised in production when a required demo ENV var is absent/blank:
  # infrastructure misconfiguration fails fast instead of inventing
  # credentials (same posture as TokenCodec::MissingSecretError).
  MissingDemoEnvError = Class.new(StandardError)

  # Raised in every environment when the resolved demo password is shorter
  # than the register mutation's minimum — the demo account satisfies the
  # same credential rules the mutations enforce.
  ShortDemoPasswordError = Class.new(StandardError)

  # The shape-stub dataset — a truthful mini-roadmap (epic-16 T1). A node's
  # `order` doubles as its stable-name suffix (synapse-demo-node-1/-2/-3);
  # an edge's position doubles as its own (synapse-demo-edge-1/-2), with
  # `from`/`to` naming endpoint nodes by their order. The optional node is
  # skippable garnish — the drill works from the spine alone, so the edges
  # read honestly.
  PLAN_TOPIC = "Software engineering interview prep"
  PLAN_GOAL = "Reach 100% mastery on the core plan before the graded window"
  DEMO_NODES = [
    { stage: "foundations", title: "Read the architecture spine",
      description: "The spine's command-layer-first law and where every rule lives", order: 1 },
    { stage: "foundations", title: "Skim the command exemplar",
      description: "A quick pass over System::PingCommand before drilling", order: 2,
      optional: true },
    { stage: "practice", title: "Drill one GraphQL mutation end-to-end",
      description: "Create one plan through the real mutation to feel the flow", order: 3 }
  ].freeze
  DEMO_EDGES = [
    { from: 1, to: 3 },
    { from: 2, to: 3 }
  ].freeze

  class << self
    # Seed the demo account + shape-stub dataset; rerun-safe (see the module
    # comment's idempotency contract). Returns the seeded rows for callers
    # that want them.
    def call(email: nil, password: nil)
      email = resolve_email!(email)
      password = resolve_password!(password)

      user = seed_user!(email, password)
      plan = seed_plan!(user)
      seed_nodes!(user, plan)
      seed_edges!(user, plan)

      { user: user, plan: plan }
    end

    # Derive a stable uuid: RFC 4122 v5 — SHA-1 over the 16-byte namespace
    # digest + name, then version 5 + variant bits set. `namespace:` is
    # injectable so the spec can pin the algorithm against the DNS-namespace
    # oracle instead of trusting this implementation.
    def stable_uuid(name, namespace: NAMESPACE)
      digest = Digest::SHA1.digest([ namespace.delete("-") ].pack("H32") + name)
      bytes = digest.bytes
      bytes[6] = (bytes[6] & 0x0F) | 0x50
      bytes[8] = (bytes[8] & 0x3F) | 0x80
      hex = bytes.pack("C*").unpack1("H32")
      "#{hex[0, 8]}-#{hex[8, 4]}-#{hex[12, 4]}-#{hex[16, 4]}-#{hex[20, 12]}"
    end

    private

    def resolve_email!(provided)
      Accounts.normalize_email(resolve_credential!("DEMO_EMAIL", provided, DEFAULT_EMAIL))
    end

    def resolve_password!(provided)
      password = resolve_credential!("DEMO_PASSWORD", provided, DEFAULT_PASSWORD)
      if password.length < MIN_PASSWORD_LENGTH
        raise ShortDemoPasswordError,
              "DEMO_PASSWORD must be at least #{MIN_PASSWORD_LENGTH} characters " \
              "(the same minimum the register mutation enforces)"
      end
      password
    end

    # One credential value: explicit arg → ENV → dev/test default. Absent or
    # blank fails fast in production (no invented demo credentials there).
    def resolve_credential!(env_key, provided, default)
      value = provided.presence || ENV[env_key].presence
      return value if value

      raise MissingDemoEnvError,
            "#{env_key} is not set — seeding the demo account in production " \
            "requires it (see backend/.env.example)" if Rails.env.production?

      default
    end

    # Keyed by the unique email; the row's uuid derives from that normalized
    # email (`user:#{email}`) when the seed creates it — one demo account per
    # email, so a second demo email seeded into a database that already holds
    # one demo account gets its own uuid instead of colliding on the users
    # primary key (the fixed "synapse-demo-user" name collided there). An
    # existing row is adopted: credentials re-keyed to the current password
    # (the seed owns the demo account), everything else untouched — a
    # pre-registered row keeps its own id. `changed?` gates the write — a
    # matching rerun is a no-op.
    def seed_user!(email, password)
      user = User.find_by(email: email)
      if user.nil?
        user = User.new(email: email, password: password, id: stable_uuid("user:#{email}"))
      elsif !user.authenticate(password)
        user.password = password
      end
      user.save! if user.changed?
      user
    end

    # Plans/nodes keep fixed-name uuids — they are per-DB demo garnish keyed
    # by id, so two different demo emails in one DB share the plan uuid with
    # a different user_id (the upsert reassigns ownership). Accepted: one
    # demo account per DB is the reality this garnish serves.
    def seed_plan!(user)
      upsert_row!(StudyPlan, stable_uuid("synapse-demo-plan"),
                  user_id: user.id,
                  topic: PLAN_TOPIC,
                  goal: PLAN_GOAL,
                  visibility: :private)
    end

    def seed_nodes!(user, plan)
      DEMO_NODES.each do |node|
        upsert_row!(KnowledgeNode, stable_uuid("synapse-demo-node-#{node[:order]}"),
                    user_id: user.id,
                    plan_id: plan.id,
                    stage: node[:stage],
                    title: node[:title],
                    order: node[:order],
                    description: node[:description],
                    optional: node[:optional] == true)
      end
    end

    def seed_edges!(user, plan)
      DEMO_EDGES.each_with_index do |edge, index|
        upsert_row!(KnowledgeNodeEdge, stable_uuid("synapse-demo-edge-#{index + 1}"),
                    user_id: user.id,
                    plan_id: plan.id,
                    from_node_id: stable_uuid("synapse-demo-node-#{edge[:from]}"),
                    to_node_id: stable_uuid("synapse-demo-node-#{edge[:to]}"))
      end
    end

    # Update-or-skip by stable uuid: create with the id when missing; write
    # only when an attribute actually differs — a rerun is no churn and no
    # duplicates.
    def upsert_row!(model, id, attrs)
      record = model.find_or_initialize_by(id: id)
      record.assign_attributes(attrs)
      record.save! if record.changed?
      record
    end
  end
end
