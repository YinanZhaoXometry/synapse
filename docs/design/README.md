# docs/design/

BMAD UX artifacts from `/bmad-ux`: `DESIGN.md` (visual rules, tokens, component decisions) and `EXPERIENCE.md` (flows, states, interaction behavior) in `ux-synapse/` — the binding UX spine. Created by the first `/bmad-ux` run.

`ux-synapse/mockups/` holds the spine's early HTML mockups (historical).

Two later visual layers sit alongside the spine (both historical logs — the live token set is `src/index.css`):

- `northstar-import/` — the Northstar visual direction the owner imported 2026-11-02 (superseded the scaffold's blue look; `IMPORT.md` is the token mapping + pass-by-pass changelog, §11 = dark mode + theme palettes).
- `redesign-handoff/` — the 2026-11-01 pre-Northstar handoff package + screenshots; visual sections superseded by the Northstar import (banner at top).

Consumer rule: read before implementation planning for any UI-touching work — UX decisions in `ux-synapse/` bind tickets and code. On visual-token conflicts, `northstar-import/IMPORT.md` + `src/index.css` describe the current state. See [docs/agents/workflow.md](../agents/workflow.md).
