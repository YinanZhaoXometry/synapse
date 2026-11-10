# frozen_string_literal: true

# Anki text-export builder (epic-31 T4 — the DeepTutor comparison §3.9's
# GUID trick): one material's flashcard deck as an Anki 2.1.55+ text-import
# file. The GUID is a stable content hash of the card's fields, so
# re-importing a re-export UPDATES the learner's existing Anki notes instead
# of duplicating them. Fields get a minimal Markdown→HTML pass (bold, italic,
# inline code, newlines→<br>; #html:true) with tabs/newlines stripped from
# the tab-separated file — no MathJax translation (in-app card math support
# is not there to preserve, spec D6).
module AnkiExport
  HEADER = <<~HEADER.chomp
    #separator:tab
    #html:true
    #notetype:Basic
    #deck column:3
    #tags column:4
    #guid column:5
  HEADER

  module_function

  # The file text for one material's deck (headers even when the deck is
  # empty — an empty export is valid, never an error).
  def for_material(material)
    deck = "Synapse::#{material.title}"
    tags = "synapse #{slug(material.title)}"
    rows = material.flashcards.order(:created_at, :id).map { |card| card_row(card, deck, tags) }
    ([ HEADER ] + rows).join("\n") + "\n"
  end

  def card_row(card, deck, tags)
    [ field_to_html(card.front), field_to_html(card.back), deck, tags, guid(card) ].join("\t")
  end

  # First 16 hex of SHA-256 over the card's content fields — byte-stable
  # across content-identical re-exports, changes when any field changes.
  def guid(card)
    Digest::SHA256.hexdigest("#{card.front}\0#{card.back}")[0, 16]
  end

  def slug(title)
    title.to_s.downcase.gsub(/[^a-z0-9\u4e00-\u9fff]+/, "-").gsub(/\A-+|-+\z/, "")
  end

  # Escape HTML first, then the minimal Markdown pass; newlines become <br>
  # and tabs are stripped — the field is tab/newline-free afterwards by
  # construction (the file's separators can never leak from card content).
  def field_to_html(text)
    escaped = text.to_s.gsub("&", "&amp;").gsub("<", "&lt;").gsub(">", "&gt;")
    escaped
      .gsub(/\*\*(.+?)\*\*/) { "<b>#{Regexp.last_match(1)}</b>" }
      .gsub(/\*(.+?)\*/) { "<i>#{Regexp.last_match(1)}</i>" }
      .gsub(/`([^`]+)`/) { "<code>#{Regexp.last_match(1)}</code>" }
      .gsub("\n", "<br>")
      .gsub("\t", "")
  end
end
