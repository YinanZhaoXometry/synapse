# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL sectionMarkings query (FR-15 read, epic-15 T1)", type: :request do
  # Direct GraphQL execution over HTTP (AD-10, the epic-02 request-spec
  # pattern): real register/login for tokens, real second users for scoping,
  # typed failure codes read off extensions.code. The claim/unclaim writes
  # underneath keep their wire specs in
  # spec/requests/graphql_chat_progress_markings_spec.rb; this file pins the
  # read — all rows (open + cleared) newest-first, the exact SectionMarking
  # field shapes, the uniform NOT_FOUND scoping posture, and the empty-list
  # honest read for an unmarked material.

  def query_markings(token, material_id)
    graphql(
      <<~GRAPHQL, variables: { materialId: material_id }, token: token
        query($materialId: String!) {
          sectionMarkings(materialId: $materialId) {
            id materialId sectionId claimedAt clearedAt
          }
        }
      GRAPHQL
    )
  end

  it "answers ALL rows for the material — open and cleared — newest-first with the exact field shapes" do
    user, token = user_with_token("marking-reader@example.com")
    material = create(:material, user: user)
    oldest_open = create(:section_marking, user: user, material: material, section_id: "sec-1",
                                           claimed_at: 3.hours.ago)
    cleared = create(:section_marking, user: user, material: material, section_id: "sec-2",
                                       claimed_at: 2.hours.ago, cleared_at: 1.hour.ago)
    newest_open = create(:section_marking, user: user, material: material, section_id: "sec-3",
                                           claimed_at: 1.minute.ago)

    result = query_markings(token, material.id)

    rows = result.dig("data", "sectionMarkings")
    aggregate_failures do
      expect(error_code(result)).to be_nil
      # Newest first — claimed_at DESC (rows are history; the cleared row rides).
      expect(rows.map { |r| r["id"] }).to eq([ newest_open.id, cleared.id, oldest_open.id ])
      # The exact SectionMarking shapes: open claims have a null clearedAt,
      # the cleared row carries its clearedAt — the client derives open
      # claims from the rows themselves.
      expect(rows[0]).to include(
        "materialId" => material.id, "sectionId" => "sec-3",
        "claimedAt" => be_present, "clearedAt" => nil
      )
      expect(rows[1]).to include(
        "materialId" => material.id, "sectionId" => "sec-2",
        "claimedAt" => be_present, "clearedAt" => be_present
      )
      expect(rows[2]).to include(
        "materialId" => material.id, "sectionId" => "sec-1",
        "claimedAt" => be_present, "clearedAt" => nil
      )
      expect(rows.map { |r| r["id"] }.uniq.length).to eq(3)
    end
  end

  it "answers an empty list, successfully, for a material with no markings" do
    user, token = user_with_token("marking-empty@example.com")
    material = create(:material, user: user)

    result = query_markings(token, material.id)

    aggregate_failures do
      expect(error_code(result)).to be_nil
      expect(result.dig("data", "sectionMarkings")).to eq([])
    end
  end

  it "answers uniform NOT_FOUND for a foreign, unknown, or malformed material id" do
    user, token = user_with_token("marking-scoper@example.com")
    foreign_material = create(:material, user: create(:user))

    aggregate_failures do
      expect(error_code(query_markings(token, foreign_material.id))).to eq("NOT_FOUND")
      expect(error_code(query_markings(token, SecureRandom.uuid))).to eq("NOT_FOUND")
      expect(error_code(query_markings(token, "garbage"))).to eq("NOT_FOUND")
    end
  end

  it "scopes by owner: another user's rows never leak, and a foreign material is NOT_FOUND — never empty" do
    owner_a, _token_a = user_with_token("marking-owner-a@example.com")
    user_b, token_b = user_with_token("marking-owner-b@example.com")
    material_a = create(:material, user: owner_a)
    create(:section_marking, user: owner_a, material: material_a, section_id: "sec-1", claimed_at: 2.hours.ago)
    create(:section_marking, user: owner_a, material: material_a, section_id: "sec-2", claimed_at: 1.hour.ago)
    material_b = create(:material, user: user_b)
    create(:section_marking, user: user_b, material: material_b, section_id: "sec-9", claimed_at: 30.minutes.ago)

    foreign = query_markings(token_b, material_a.id)
    own = query_markings(token_b, material_b.id)

    aggregate_failures do
      # B's request at A's material errors — A's two rows are never returned
      # (NOT_FOUND, not an empty list, and never the rows themselves).
      expect(error_code(foreign)).to eq("NOT_FOUND")
      expect(foreign.dig("data", "sectionMarkings")).to be_nil
      # B's own material answers B's rows only.
      rows = own.dig("data", "sectionMarkings")
      expect(rows.map { |r| r["sectionId"] }).to eq([ "sec-9" ])
      expect(rows.map { |r| r["materialId"] }.uniq).to eq([ material_b.id ])
    end
  end

  it "answers UNAUTHORIZED without a token" do
    material = create(:material)
    result = query_markings(nil, material.id)
    expect(error_code(result)).to eq("UNAUTHORIZED")
  end
end
