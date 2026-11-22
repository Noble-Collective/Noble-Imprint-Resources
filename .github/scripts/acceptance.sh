#!/usr/bin/env bash
# Dispatch a product's read-only content-acceptance.yml on this commit and wait for it (content contract C4).
#   acceptance.sh <owner/repo> <branch> <label>      env: GH_TOKEN (Actions read/write on that repo), SHA
# Exit 1 only when the product's run FAILED (that holds live). Anything we couldn't do — no token, dispatch refused,
# run not found, can't read it — is a ::warning:: and exit 0: a GitHub or token problem must never hold content.
# Prints "<label> acceptance run: <url>" for the gate report.
set -u
repo="$1"; ref="$2"; label="$3"
if [ -z "${GH_TOKEN:-}" ]; then echo "::warning::$label acceptance skipped: no token for $repo."; exit 0; fi
reason="gate run ${GITHUB_RUN_ID:-local}"
ok=false
for attempt in 1 2 3; do
  if gh workflow run content-acceptance.yml -R "$repo" --ref "$ref" -f content_sha="$SHA" -f reason="$reason"; then ok=true; break; fi
  sleep $((attempt * 20))
done
[ "$ok" = true ] || { echo "::warning::$label acceptance skipped: could not dispatch it on $repo."; exit 0; }
title="Content acceptance ($SHA · $reason)"
run=""
for i in $(seq 1 30); do
  sleep 10
  run=$(gh run list -R "$repo" --workflow content-acceptance.yml --limit 20 --json databaseId,displayTitle \
          --jq ".[] | select(.displayTitle == \"$title\") | .databaseId" 2>/dev/null | head -1)
  [ -n "$run" ] && break
done
[ -n "$run" ] || { echo "::warning::$label acceptance dispatched but its run couldn't be found (does the token have Actions: read on $repo?)."; exit 0; }
url="https://github.com/$repo/actions/runs/$run"
echo "$label acceptance run: $url"
gh run watch "$run" -R "$repo" --interval 20 > /dev/null 2>&1
conclusion=$(gh run view "$run" -R "$repo" --json conclusion --jq .conclusion 2>/dev/null)
case "$conclusion" in
  success) echo "$label can read ${SHA::7}." ;;
  failure) echo "::error::$label's content acceptance failed for ${SHA::7} — live stays where it is. See $url"; exit 1 ;;
  *) echo "::warning::$label acceptance ended '${conclusion:-unknown}' (not a failure) — not holding. See $url" ;;
esac
