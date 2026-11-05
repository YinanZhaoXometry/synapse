# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GraphQL annotation operations (FR-16, epic-13 T3)", type: :request do
  # Direct GraphQL execution over HTTP (AD-10, the epic-02 request-spec
  # pattern): real register/login for tokens, real second users for scoping,
  # typed failure codes read off extensions.code. The commands underneath
  # have their own direct specs (spec/commands/annotations/); this file pins
  # the wire behavior — the annotations query's user-scoped newest-first
  # order, the add/remove round-trip (jsonb TS keys verbatim, delta 3), and
  # the auth roster (delta 8).

  describe "the auth guard on every annotation operation (kickoff delta 8)" do
    it "answers UNAUTHORIZED without a token on all three operations" do
      uuid = "00000000-0000-0000-0000-000000000000"
      queries = [
        'query { annotations(materialId: "' + uuid + '") { id } }'
      ]
      mutations = [
        'mutation { addAnnotation(input: { materialId: "' + uuid +
          '", locator: { kind: "pdf", page: 1 }, range: { page: 1, start: 0, end: 1, quote: "t" } }) { annotation { id } } }',
        'mutation { removeAnnotation(input: { id: "' + uuid + '" }) { deletedAnnotationId } }'
      ]

      queries.each do |query|
        expect(error_code(graphql(query))).to eq("UNAUTHORIZED")
      end
      mutations.each do |mutation|
        expect(error_code(graphql(mutation))).to eq("UNAUTHORIZED")
      end
    end
  end

  describe "addAnnotation mutation + annotations query" do
    it "adds a highlight and reads it back with the jsonb TS keys verbatim (delta 3)" do
      user, token = user_with_token("annotation-writer@example.com")
      material = create(:material, user: user)

      added = graphql(
        <<~GRAPHQL, variables: add_input(material.id), token: token
          mutation Add($input: AddAnnotationInput!) {
            addAnnotation(input: $input) {
              annotation {
                id materialId kind color body createdAt
                locator { kind page sectionId }
                range { page sectionId start end quote }
              }
            }
          }
        GRAPHQL
      )

      payload = added.dig("data", "addAnnotation", "annotation")
      aggregate_failures do
        expect(payload["materialId"]).to eq(material.id)
        expect(payload["kind"]).to eq("highlight")
        expect(payload["color"]).to eq("amber")
        expect(payload["body"]).to eq("")
        expect(payload["id"]).to match(Accounts::UUID_REGEX)
        expect(payload["createdAt"]).to be_present
        expect(payload["locator"]).to eq({ "kind" => "pdf", "page" => 3, "sectionId" => nil })
        expect(payload["range"]).to eq(
          "page" => 3, "sectionId" => nil, "start" => 12, "end" => 40, "quote" => "Scoping, commands, and the spine ER."
        )
      end

      listed = graphql(
        <<~GRAPHQL, variables: { materialId: material.id }, token: token
          query($materialId: String!) {
            annotations(materialId: $materialId) {
              id kind color body
              locator { kind page sectionId }
              range { page start end quote }
            }
          }
        GRAPHQL
      )

      rows = listed.dig("data", "annotations")
      aggregate_failures do
        expect(rows.length).to eq(1)
        expect(rows.first["kind"]).to eq("highlight")
        expect(rows.first["range"]["start"]).to eq(12)
        expect(rows.first["locator"]["page"]).to eq(3)
      end
    end

    it "round-trips a markdown annotation by sectionId" do
      user, token = user_with_token("annotation-md@example.com")
      material = create(:material, user: user)
      quote = "Scoping, commands, and the spine ER."
      input = add_input(
        material.id,
        kind: "underline",
        color: nil,
        locator: { kind: "markdown", sectionId: "sec-1" },
        range: { sectionId: "sec-1", start: 0, end: 34, quote: quote }
      )

      added = graphql(
        <<~GRAPHQL, variables: input, token: token
          mutation Add($input: AddAnnotationInput!) {
            addAnnotation(input: $input) {
              annotation { kind color locator { kind page sectionId } range { page sectionId start end quote } }
            }
          }
        GRAPHQL
      )

      payload = added.dig("data", "addAnnotation", "annotation")
      aggregate_failures do
        expect(payload["kind"]).to eq("underline")
        expect(payload["color"]).to be_nil
        expect(payload["locator"]).to eq({ "kind" => "markdown", "page" => nil, "sectionId" => "sec-1" })
        expect(payload["range"]).to eq(
          "page" => nil, "sectionId" => "sec-1", "start" => 0, "end" => 34, "quote" => "Scoping, commands, and the spine ER."
        )
      end
    end

    it "defaults kind to highlight when the input omits it" do
      user, token = user_with_token("annotation-default-kind@example.com")
      material = create(:material, user: user)

      input = add_input(material.id).tap { |hash| hash[:input].delete(:kind) }
      added = graphql(
        <<~GRAPHQL, variables: input, token: token
          mutation Add($input: AddAnnotationInput!) {
            addAnnotation(input: $input) { annotation { kind } }
          }
        GRAPHQL
      )

      expect(added.dig("data", "addAnnotation", "annotation", "kind")).to eq("highlight")
    end

    it "lists the material's annotations newest-first, other users' materials NOT_FOUND" do
      user, token = user_with_token("annotation-lister@example.com")
      material = create(:material, user: user)
      create(:annotation, user: user, material: material)
      create(:annotation, user: user, material: material, color: "blue")

      listed = graphql(
        <<~GRAPHQL, variables: { materialId: material.id }, token: token
          query($materialId: String!) { annotations(materialId: $materialId) { id color createdAt } }
        GRAPHQL
      )

      rows = listed.dig("data", "annotations")
      expect(rows.map { |row| row["color"] }).to eq([ "blue", nil ])

      foreign = graphql(
        'query { annotations(materialId: "' + create(:material, user: create(:user)).id + '") { id } }',
        token: token
      )
      expect(error_code(foreign)).to eq("NOT_FOUND")
    end

    it "answers NOT_FOUND on addAnnotation for a foreign, unknown, or malformed material" do
      user, token = user_with_token("annotation-scoper@example.com")

      aggregate_failures do
        expect(error_code(graphql(
          "mutation { addAnnotation(input: #{add_mutation_literal(create(:material, user: create(:user)).id)}) { annotation { id } } }",
          token: token
        ))).to eq("NOT_FOUND")

        expect(error_code(graphql(
          "mutation { addAnnotation(input: #{add_mutation_literal(SecureRandom.uuid)}) { annotation { id } } }",
          token: token
        ))).to eq("NOT_FOUND")

        expect(error_code(graphql(
          "mutation { addAnnotation(input: #{add_mutation_literal("garbage")}) { annotation { id } } }",
          token: token
        ))).to eq("NOT_FOUND")
      end
      expect(Annotation.count).to eq(0)
    end

    it "answers VALIDATION_FAILED on addAnnotation for a shape-law violation (delta 3)" do
      user, token = user_with_token("annotation-shape@example.com")
      material = create(:material, user: user)

      # a markdown locator whose range names a page — the xor/agreement law
      bad = graphql(
        "mutation { addAnnotation(input: { materialId: \"#{material.id}\", " \
        "locator: { kind: \"markdown\", sectionId: \"sec-1\" }, " \
        "range: { page: 3, start: 0, end: 5, quote: \"text\" }, kind: \"highlight\" }) { annotation { id } } }",
        token: token
      )
      expect(error_code(bad)).to eq("VALIDATION_FAILED")

      # a color outside the named palette keys
      bad_color = graphql(
        "mutation { addAnnotation(input: { materialId: \"#{material.id}\", " \
        "locator: { kind: \"pdf\", page: 1 }, " \
        "range: { page: 1, start: 0, end: 5, quote: \"text\" }, kind: \"highlight\", color: \"scarlet\" }) " \
        "{ annotation { id } } }",
        token: token
      )
      expect(error_code(bad_color)).to eq("VALIDATION_FAILED")

      expect(Annotation.count).to eq(0)
    end
  end

  describe "removeAnnotation mutation" do
    it "removes the owner's annotation (the round-trip closes)" do
      user, token = user_with_token("annotation-remover@example.com")
      material = create(:material, user: user)
      annotation = create(:annotation, user: user, material: material)

      removed = graphql(
        <<~GRAPHQL, variables: { id: annotation.id }, token: token
          mutation Remove($id: String!) {
            removeAnnotation(input: { id: $id }) { deletedAnnotationId }
          }
        GRAPHQL
      )

      aggregate_failures do
        expect(removed.dig("data", "removeAnnotation", "deletedAnnotationId")).to eq(annotation.id)
        expect(Annotation.exists?(annotation.id)).to be(false)
      end

      listed = graphql(
        <<~GRAPHQL, variables: { materialId: material.id }, token: token
          query($materialId: String!) { annotations(materialId: $materialId) { id } }
        GRAPHQL
      )
      expect(listed.dig("data", "annotations")).to eq([])
    end

    it "answers NOT_FOUND for a foreign, unknown, or malformed id" do
      user, token = user_with_token("annotation-remove-scoper@example.com")

      aggregate_failures do
        foreign = graphql(
          'mutation { removeAnnotation(input: { id: "' + create(:annotation, user: create(:user)).id + '" }) { deletedAnnotationId } }',
          token: token
        )
        expect(error_code(foreign)).to eq("NOT_FOUND")

        unknown = graphql(
          'mutation { removeAnnotation(input: { id: "' + SecureRandom.uuid + '" }) { deletedAnnotationId } }',
          token: token
        )
        expect(error_code(unknown)).to eq("NOT_FOUND")

        malformed = graphql(
          'mutation { removeAnnotation(input: { id: "garbage" }) { deletedAnnotationId } }',
          token: token
        )
        expect(error_code(malformed)).to eq("NOT_FOUND")
      end
      expect(Annotation.count).to eq(1) # the foreign row survives untouched
    end
  end

  private

  def add_input(material_id,
                kind: "highlight",
                color: "amber",
                locator: { kind: "pdf", page: 3 },
                range: { page: 3, start: 12, end: 40, quote: "Scoping, commands, and the spine ER." })
    { input: { materialId: material_id, locator: locator, range: range, kind: kind, color: color, body: "" } }
  end

  # The malformed-address probes stay one-liner literals (the inline
  # mutation keeps the NOT_FOUND matrix readable).
  def add_mutation_literal(material_id)
    "{ materialId: \"#{material_id}\", locator: { kind: \"pdf\", page: 1 }, " \
      "range: { page: 1, start: 0, end: 1, quote: \"t\" } }"
  end
end
