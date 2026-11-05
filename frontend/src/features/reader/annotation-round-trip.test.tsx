/**
 * The annotation persistence round-trip (FR-16, epic-13 T3): add → the
 * read-back sweep → the engine re-applies. The REAL seams under test (the
 * stub-GraphQL harness posture): the api hooks (Annotations query +
 * AddAnnotation mutation carrying the AnnotationsDocument refetch sweep),
 * the mapper's strict wire→domain rebuild, and MarkdownView's post-commit
 * engine application — the mark lands in the DOM ONLY after the refetch
 * delivers the server row (nothing is appended client-side). The reload
 * simulation is the honest kind: a FRESH stub client over the same
 * captured server state re-serves the row, and a fresh MarkdownView
 * re-applies it (offsets are text-anchored).
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createElement, type ReactNode } from "react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { createHarnessState, createStubClient, makeStubWrapper, type HarnessState } from "@/test/apollo-harness";
import { useAddAnnotationMutation, useAnnotationsQuery } from "@/api";
import { ANNOTATION_COLORS, type AnnotationColor } from "./annotation-engine";
import MarkdownView from "./markdown-view";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const enDict = (translations as Record<string, Record<string, string>>).en;

const DOC_TEXT = "# First\n\nalpha beta gamma delta\n\n## Second\n\nmore prose here\n";

/** The server-shaped annotation row the echo handlers capture/serve (wire keys verbatim). */
function wireRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    __typename: "Annotation",
    id: "anno-rt-1",
    materialId: "mat-1",
    createdAt: "2026-11-05T12:00:00Z",
    kind: "highlight",
    color: "amber",
    body: "",
    locator: { __typename: "ReadingLocator", kind: "markdown", page: null, sectionId: "first" },
    range: { __typename: "AnnotationRange", sectionId: "first", page: null, start: 6, end: 10, quote: "beta" },
    ...overrides,
  };
}

function annotationsHandlerFor(state: HarnessState) {
  // The harness wraps the payload under the root field (annotations) — the
  // handler returns the ROW ARRAY itself.
  return () => (state as unknown as { serverAnnotations: Record<string, unknown>[] }).serverAnnotations;
}

/** The hooks surface — renders INSIDE the provider wrapper. The view →
 * render-item mapping mirrors ReaderPage's (the engine's chips vocabulary). */
function Surface() {
  const annotationsQuery = useAnnotationsQuery("mat-1");
  const [addAnnotation] = useAddAnnotationMutation();
  const items = (annotationsQuery.data ?? []).map((row) => ({
    id: row.id,
    range: row.range,
    kind: row.kind,
    color: (ANNOTATION_COLORS as readonly string[]).includes(row.color ?? "") ? (row.color as AnnotationColor) : null,
    body: row.body,
  }));
  return (
    <>
      <button
        type="button"
        data-testid="add-annotation"
        onClick={() =>
          void addAnnotation({
            variables: {
              input: {
                materialId: "mat-1",
                locator: { kind: "markdown", sectionId: "first" },
                range: { sectionId: "first", start: 6, end: 10, quote: "beta" },
                kind: "highlight",
                color: "amber",
                body: "",
              },
            },
          })
        }
      >
        add
      </button>
      <MarkdownView text={DOC_TEXT} flashSection={null} annotations={items} introSectionId={null} />
    </>
  );
}

/** The round-trip surface: the real hooks + the real MarkdownView render. */
function RoundTripSurface({ client }: { client: ReturnType<typeof createStubClient> }) {
  const Wrapper = makeStubWrapper(client);
  return (
    <LanguageProvider>
      <Wrapper>
        <Surface />
      </Wrapper>
    </LanguageProvider>
  );
}

describe("the annotation persistence round-trip (add → read-back → re-apply)", () => {
  it("lands the mark only through the server row — and a fresh client (reload) re-applies it", async () => {
    const state = createHarnessState() as HarnessState & { serverAnnotations: Record<string, unknown>[] };
    state.serverAnnotations = [];
    const client = createStubClient(
      {
        Annotations: annotationsHandlerFor(state),
        AddAnnotation: (variables) => {
          const input = (variables as { input: { range: { start: number; end: number; quote: string } } }).input;
          const row = wireRow({
            id: "anno-rt-1",
            range: {
              __typename: "AnnotationRange",
              sectionId: "first",
              page: null,
              start: input.range.start,
              end: input.range.end,
              quote: input.range.quote,
            },
          });
          state.serverAnnotations = [row];
          return { addAnnotation: { annotation: row } };
        },
      },
      state,
    );

    const { unmount } = render(<RoundTripSurface client={client} />);

    // Before the add: the document renders, no marks exist.
    await waitFor(() => expect(screen.getByText("alpha beta gamma delta")).toBeInTheDocument());
    expect(document.querySelector("mark[data-annotation-id='anno-rt-1']")).toBeNull();

    // Add → the mutation resolves AND the read-back sweep re-queries (the
    // echo handler captures the server row) → the engine applies the row.
    fireEvent.click(screen.getByTestId("add-annotation"));
    await waitFor(() => expect(document.querySelector("mark[data-annotation-id='anno-rt-1']")).not.toBeNull());
    const mark = document.querySelector("mark[data-annotation-id='anno-rt-1']");
    expect(mark!.textContent).toBe("beta"); // exactly the quote, never misplaced

    // The reload simulation: a FRESH client over the same server state (the
    // cache is gone; the rows persist), a fresh surface re-applies.
    unmount();
    expect(document.querySelector("mark[data-annotation-id='anno-rt-1']")).toBeNull();
    const freshClient = createStubClient({ Annotations: annotationsHandlerFor(state) }, state);
    render(<RoundTripSurface client={freshClient} />);

    await waitFor(() => expect(document.querySelector("mark[data-annotation-id='anno-rt-1']")).not.toBeNull());
    expect(document.querySelector("mark[data-annotation-id='anno-rt-1']")!.textContent).toBe("beta");

    // The render copy rides bilingually (the stale honesty's tooltip source).
    expect(zhDict["reader.annotationStale"]).toBeTruthy();
    expect(enDict["reader.annotationStale"]).toBeTruthy();
  });
});
