# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`. Solo-dev repo (owner decision 2026-11-02, migrating off GitHub Issues — closed issues #6–#14 remain on GitHub as archive/provenance).

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- The epic tracking doc (when a spec is sliced into an epic) is `.scratch/<feature-slug>/epic.md`, linking each ticket file and its blocking edges
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings; completed work uses `Status: done`)
- Blocking edges are a `Blocked by: NN, NN` line near the top of the ticket file (local ticket numbers). A ticket is unblocked when every file it lists is `done`
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the ticket number directly (e.g. "implement epic-1-foundation #3" → `.scratch/epic-1-foundation/issues/03-*.md`).

## Frontier (what's startable now)

Scan `.scratch/<feature>/issues/` for files whose `Status:` is a triage role (not `done`) and whose `Blocked by:` entries are all `done`; lowest number first. The epic doc's Slices table is the index.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.
