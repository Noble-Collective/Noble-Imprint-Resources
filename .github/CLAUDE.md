# Content repo automation (notes for Claude sessions)

Kept under `.github/` on purpose: a root CLAUDE.md would show in Matt's Obsidian vault and could ride into the app's
bundled content.

## Content gate (`workflows/content-gate.yml`)

- Plan: Collective-Shared `plans/2026-11-18-content-gate-live-branch.md`.
- Every push to `main` runs the four content checks (`scripts/check-audience`, `check-book-ids`,
  `check-infographic-icons`, `check-search-terms`, each with its guard tests) on the whole tree. All pass →
  `scripts/advance-live.mjs advance` fast-forwards the `live` branch (non-force `PATCH` of the ref; GitHub refuses a
  non-fast-forward). The public website reads `live` once its `CONTENT_REF=live` (go-live, P3).
- **No `live` branch yet = check only.** The advance step reports "no live" and does nothing; the website snapshot
  refresh keeps the old `deploy-website-on-config` rule (any push touching `meta.json` / `search-terms.json` /
  `icons/`).
- After go-live, the website's `refresh-cache.yml` is dispatched when `live` moves over one of those paths.
- Manual run with no sha = checks only. With a sha + reason (admins only) = advance `live` without the checks, for a
  broken check script only.
- Retired 2026-11-18 (folded into the gate): `check-audience.yml`, `check-book-ids.yml`,
  `check-infographic-icons.yml`, `check-search-terms.yml`, `deploy-website-on-config.yml`. Add a new content check as
  a step in the gate, never as its own workflow.
- **P6 (2026-11-19):** the app's Content Release is dispatched by the gate after `live` moves over app paths (`needsAppPublish`: series/ minus the Test Book, bibles/, search-terms.json, icons/); the app builds the latest `live` (its `content_ref` input, default live; `main` = rollback). `notify-app.yml` is manual only.
- **D8 (2026-11-19):** `live` is moved with a token from the website's GitHub App (noble-collective-content-server, id 4407594; Actions secret `CONTENT_GATE_APP_KEY`, set by Steve). Ruleset 27607357 on `live`: no deletion, no force push, and (once the secret is set) updates only by that app. Without the secret the gate falls back to its own token.
- Tests: `node --test .github/scripts/advance-live.test.mjs` (and each check's `*.test.mjs`).
