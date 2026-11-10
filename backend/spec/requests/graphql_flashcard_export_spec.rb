# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL flashcardExport query (epic-31 T4)", type: :request do
  # The Anki text export over the wire: the exact file bytes (Anki 2.1.55+
  # headers, deck naming, tag slug, the GUID's update-not-duplicate law),
  # the minimal Markdown→HTML pass, field sanitization, and the uniform
  # NOT_FOUND for unknown/foreign/malformed material ids. The builder has
  # no seams below this one — the file IS the contract.

  let(:password) { "known-password-123" }
  let(:user) { create(:user, email: "deck-exporter@example.com", password: password) }
  let(:token) { token_for(user.email) }

  def export_query(material_id)
    graphql("query { flashcardExport(materialId: \"#{material_id}\") }", token: token)
  end

  def export_text(material_id)
    result = export_query(material_id)
    expect(error_code(result)).to be_nil
    result.dig("data", "flashcardExport")
  end

  it "answers UNAUTHORIZED without a token" do
    material = create(:material, user: user)
    result = graphql("query { flashcardExport(materialId: \"#{material.id}\") }")

    expect(error_code(result)).to eq("UNAUTHORIZED")
  end

  it "emits the Anki headers, deck naming, tag slug, and one row per card" do
    material = create(:material, user: user, title: "Fourier Notes")
    card_a = create(:flashcard, user: user, material: material, front: "What is a transform?", back: "A change of *view*")
    card_b = create(:flashcard, user: user, material: material, front: "Why **convolve**?", back: "Because `linearity`")

    text = export_text(material.id)
    lines = text.split("\n")

    aggregate_failures do
      expect(lines.first(6)).to eq([
        "#separator:tab", "#html:true", "#notetype:Basic",
        "#deck column:3", "#tags column:4", "#guid column:5"
      ])
      expect(lines.count).to eq(8) # 6 headers + 2 cards (+ trailing newline split)
      deck, tags = "Synapse::Fourier Notes", "synapse fourier-notes"
      expect(lines[6]).to eq([ card_a.front, "A change of <i>view</i>", deck, tags, AnkiExport.guid(card_a) ].join("\t"))
      expect(lines[7]).to eq([ "Why <b>convolve</b>?", "Because <code>linearity</code>", deck, tags, AnkiExport.guid(card_b) ].join("\t"))
      expect(text).to end_with("\n")
    end
  end

  it "keeps the GUID byte-stable across content-identical re-exports and changes it when content changes" do
    material = create(:material, user: user)
    card = create(:flashcard, user: user, material: material, front: "front", back: "back")

    first_export = export_text(material.id)
    second_export = export_text(material.id)
    card.update!(back: "back — amended")
    amended_export = export_text(material.id)

    guid = ->(text) { text.split("\n").last&.split("\t")&.last }
    aggregate_failures do
      expect(guid.call(first_export)).to eq(guid.call(second_export))
      expect(guid.call(amended_export)).not_to eq(guid.call(first_export))
    end
  end

  it "passes bold/italic/inline-code through to HTML and strips tabs/newlines from fields" do
    material = create(:material, user: user)
    create(:flashcard, user: user, material: material,
                       front: "line one\nline **two**\twith a tab",
                       back: "`code` and *italics*")

    text = export_text(material.id)
    row = text.split("\n").last
    front, back = row.split("\t")[0], row.split("\t")[1]

    aggregate_failures do
      expect(front).to eq("line one<br>line <b>two</b>with a tab")
      expect(back).to eq("<code>code</code> and <i>italics</i>")
      expect(row.split("\t").length).to eq(5) # the fields never leak separators
    end
  end

  it "answers a headers-only file for an empty deck (not an error)" do
    material = create(:material, user: user, title: "Empty Deck")

    text = export_text(material.id)

    expect(text.split("\n")).to eq(AnkiExport::HEADER.split("\n"))
  end

  it "answers NOT_FOUND uniformly for unknown, foreign, and malformed ids" do
    material = create(:material, user: create(:user)) # foreign
    foreign_token_user, _ = user_with_token("deck-attacker@example.com")

    aggregate_failures do
      expect(error_code(export_query(SecureRandom.uuid))).to eq("NOT_FOUND")
      expect(error_code(export_query(material.id))).to eq("NOT_FOUND")
      expect(error_code(export_query("not-a-uuid"))).to eq("NOT_FOUND")
    end
  end
end
