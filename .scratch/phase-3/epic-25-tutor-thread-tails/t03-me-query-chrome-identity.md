# T3 — `me` query + real identity in the chrome

Milestone: Phase 2 — post-deadline
Status: done
Epic: epic-25-tutor-thread-tails
Blocked by: T2 (serial: schema.graphql movement)

## AC

1. Backend: `me: MeType` on Query (email — the only field the chrome needs; no
   profile entity). Command-free read (a resolver over current_user!, null for
   unauthenticated is impossible — the field is auth-walled like the rest).
2. schema.graphql + codegen; `src/api` hook `useMeQuery`.
3. Chrome wiring: AppLayout's desktop footer + tablet rail + mobile drawer render the
   session identity — name line = email local-part (demo@synapse.test → "demo"),
   avatar letter = its first grapheme (the 学/S placeholder dies). SettingsPage's
   profile row shows the email too (the 学习资料-profile row's 学/S avatar keeps the
   same rule).
4. While the query loads: keep the placeholder (no flash of wrong identity is
   impossible — placeholder letter only, never a name).
5. Tests: backend resolver spec; frontend the chrome renders the email-derived name
   (jsdom Apollo stub); full gates green.
