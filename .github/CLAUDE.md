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
- **C2 (2026-11-22): the gate also runs the shared content contract** (`scripts/content-contract.cjs`, VENDORED from
  Collective-Shared `packages/userdata/dist/content/cli.cjs` — never edit it here; refresh by copying the built file,
  header names the version). Errors in a public book (or an unreadable status) hold `live`; hidden books and warnings
  never do; findings go to the run summary. Plan `plans/2026-11-21-content-contract.md`. The four older checks stay
  until the contract is shown to cover them.
- **C4 (2026-11-22): the gate waits for each product's read-only `content-acceptance.yml`** via
  `scripts/acceptance.sh <repo> <branch> <label>` (dispatch on the pushed sha, find the run by its title, wait): app
  (`develop`, `APP_DISPATCH_TOKEN`, ~4 min), website (`main`, `WEBSITE_DISPATCH_TOKEN`, ~1 min), Institute (`main`,
  `INSTITUTE_DISPATCH_TOKEN`, ~2 min — skipped with a warning until that secret exists). A product run that FAILS holds
  `live`; a missing token, refused dispatch or unreadable run is a warning only. Push events only.
- **C5 (2026-11-22): the gate's last checking step posts a check run "Content gate report"** on the commit
  (`scripts/gate-report.mjs`; push + manual runs, never PRs; always `neutral`, and its own tests are
  `continue-on-error`, so a reporting bug never holds content). `output.summary` = what holds live + the warnings by
  book (also in the run summary); `output.text` = the same as JSON v1 (`holding`, `warnings`, `fingerprint` = the
  problem set, line numbers and order ignored). Each checking step has an `id` and tees its output to
  `$RUNNER_TEMP/logs/<id>.log`, so a failed older check's `::error::` lines and each product's acceptance run link
  (app / website / Institute, headed by the product in the email) reach the report. **No email is sent from this
  public repo:** the website's `content-gate-tick` (every 5 min) reads the report (its GitHub App has Checks: read) and
  sends the hold email to the staff list (Steve + Matt) once main has been held 15 minutes, one per problem set, the
  all clear, and the Monday 8 AM ET warnings digest (website `src/server/content-gate-digest.js`). A new check step
  needs an `id`, the tee, and a line in `CHECK_STEPS`.
- **C5 after the gate (2026-11-22):** a failure AFTER `live` moved (the app's `publish-content.yml`, the website's
  `refresh-cache.yml` / `deploy.yml`) is CI triage's (Collective-Shared `tools/ci-triage/README.md`): Steve gets one
  issue per real failure, as before. When triage's verdict says the CONTENT is at fault (`fault: content`), it also
  posts the verdict to the website (`POST /api/content-gate/after-gate`, GitHub OIDC from `ci-triage.yml` on
  Collective-Shared main, `src/server/after-gate.js`), which emails the content editors (staff list minus Steve) once
  per failed run, with what to change. A run whose title has `[test]` goes to Steve only.
- Tests: `node --test .github/scripts/advance-live.test.mjs` (and each check's `*.test.mjs`, `gate-report.test.mjs`).
