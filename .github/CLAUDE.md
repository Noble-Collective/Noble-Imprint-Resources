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
- `notify-app.yml` (the app's content publish) is separate and must stay unchanged until P6.
- Tests: `node --test .github/scripts/advance-live.test.mjs` (and each check's `*.test.mjs`).
