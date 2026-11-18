#!/usr/bin/env node
// The content gate's last step (Collective-Shared plans/2026-11-18-content-gate-live-branch.md §4).
//
// `live` is the branch the public website reads. This moves it forward to a commit that just passed every content
// check, and only forward: the ref update is a non-force PATCH, so GitHub itself refuses anything that isn't a
// fast-forward. It never creates `live` (that is a go-live step, P3): while `live` doesn't exist it reports that and
// does nothing.
//
// It also says whether the website's baked snapshot needs a refresh (refresh-cache.yml), which the old
// deploy-website-on-config.yml did on every meta.json / search-terms.json / icons/ push. Page text needs nothing:
// the website's 30 s cache picks up the new commit.
//
// Usage (in Actions, GITHUB_TOKEN + GITHUB_REPOSITORY set):
//   node .github/scripts/advance-live.mjs probe   <sha> [<before>]   — before the checks: does `live` exist?
//                                                                       If not, today's rule: refresh the website
//                                                                       when before..sha touched its config.
//   node .github/scripts/advance-live.mjs advance <sha> [--override]  — after the checks pass.
// Both write key=value lines to $GITHUB_OUTPUT (live_exists, live_sha, advanced, refresh_website, …).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ZERO_SHA = /^0+$/;

// Pure: what to do with `live`, given where it is and how `sha` relates to it.
//   liveSha       — current live sha, or null when the branch doesn't exist
//   compare       — GitHub compare status of live...sha: 'ahead' (live is an ancestor of sha), 'identical',
//                   'behind' (sha is already in live's history), 'diverged'
//   onMain        — sha is main's head or in main's history
export function decide({ sha, liveSha, compare, onMain }) {
  if (!liveSha) return { action: 'skip', reason: 'no-live', message: '`live` does not exist yet (created at go-live, P3). Nothing to advance.' };
  if (liveSha === sha || compare === 'identical') return { action: 'skip', reason: 'already', message: `live is already at ${short(sha)}.` };
  if (compare === 'behind') return { action: 'skip', reason: 'already-in-live', message: `${short(sha)} is already in live's history (a later push got there first).` };
  if (onMain === false) return { action: 'fail', reason: 'not-on-main', message: `${short(sha)} is not on main. live only follows main.` };
  if (compare === 'ahead') return { action: 'advance', reason: 'ahead', message: `Advance live ${short(liveSha)} → ${short(sha)}.` };
  return {
    action: 'fail',
    reason: 'diverged',
    message: `live (${short(liveSha)}) is not an ancestor of ${short(sha)} (main was rewritten?). Fix: run the Content gate by hand with the sha and a reason.`,
  };
}

// Pure: does this list of changed paths need the website snapshot rebuilt? `truncated` = the list may be incomplete
// (GitHub caps a compare at 300 files), so assume yes.
export function needsWebsiteRefresh(files, { truncated = false } = {}) {
  if (truncated) return true;
  return files.some((f) => f === 'search-terms.json' || f === 'meta.json' || f.endsWith('/meta.json') || f.startsWith('icons/'));
}

const short = (s) => (s ? String(s).slice(0, 7) : String(s));

// --- GitHub REST (injectable for tests) ---------------------------------------------------------------------------

export function githubApi({ token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPOSITORY, fetchImpl = fetch } = {}) {
  const base = `https://api.github.com/repos/${repo}`;
  async function call(method, url, body) {
    const res = await fetchImpl(`${base}${url}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 404) return null;
    const text = await res.text();
    if (!res.ok) throw new Error(`GitHub ${method} ${url} → ${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : {};
  }
  return {
    async liveSha() {
      const ref = await call('GET', '/git/ref/heads/live');
      return ref?.object?.sha ?? null;
    },
    // { status, files: [paths], truncated }
    async compare(baseSha, headSha) {
      const c = await call('GET', `/compare/${baseSha}...${headSha}`);
      if (!c) return null;
      const files = (c.files || []).map((f) => f.filename);
      return { status: c.status, files, truncated: files.length >= 300 || (c.total_commits > 0 && !c.files) };
    },
    async moveLive(sha) {
      await call('PATCH', '/git/refs/heads/live', { sha, force: false });
    },
  };
}

// --- Orchestration (tested with a fake api) -------------------------------------------------------------------------

export async function probe({ api, sha, before }) {
  const liveSha = await api.liveSha();
  const out = { live_exists: liveSha ? 'true' : 'false', live_sha: liveSha || '', refresh_website: 'false' };
  const log = [];
  if (liveSha) {
    log.push(`live is at ${short(liveSha)}.`);
    return { out, log };
  }
  // No live yet: the website still reads main, so keep the old deploy-website-on-config rule (on every push,
  // whatever the checks say).
  log.push('live does not exist yet (P3 creates it). The website reads main; keeping the old snapshot-refresh rule.');
  if (!before) return { out, log };
  if (ZERO_SHA.test(before)) {
    out.refresh_website = 'true';
    log.push('No previous commit to compare with: refreshing the website snapshot to be safe.');
    return { out, log };
  }
  const cmp = await api.compare(before, sha).catch((e) => {
    log.push(`Could not compare ${short(before)}...${short(sha)} (${e.message}): refreshing to be safe.`);
    return null;
  });
  out.refresh_website = !cmp || needsWebsiteRefresh(cmp.files, cmp) ? 'true' : 'false';
  if (cmp) log.push(`${cmp.files.length} file(s) changed; website snapshot refresh: ${out.refresh_website}.`);
  return { out, log };
}

export async function advance({ api, sha }) {
  const liveSha = await api.liveSha();
  const log = [];
  const out = { advanced: 'false', refresh_website: 'false', live_before: liveSha || '', live_after: liveSha || '' };
  if (!liveSha) {
    const d = decide({ sha, liveSha });
    log.push(d.message);
    return { out, log, decision: d };
  }
  const cmp = await api.compare(liveSha, sha);
  let onMain;
  if (cmp?.status === 'ahead') {
    const m = await api.compare(sha, 'main');
    onMain = m ? m.status === 'ahead' || m.status === 'identical' : false;
  }
  const d = decide({ sha, liveSha, compare: cmp?.status, onMain });
  log.push(d.message);
  if (d.action !== 'advance') return { out, log, decision: d };
  await api.moveLive(sha);
  out.advanced = 'true';
  out.live_after = sha;
  out.refresh_website = needsWebsiteRefresh(cmp.files, cmp) ? 'true' : 'false';
  log.push(`live moved to ${short(sha)}. ${cmp.files.length} file(s) since the last live; website snapshot refresh: ${out.refresh_website}.`);
  return { out, log, decision: d };
}

function writeOutputs(out) {
  const lines = Object.entries(out).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, lines);
  else process.stdout.write(lines);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, sha, arg3] = process.argv.slice(2);
  if (!['probe', 'advance'].includes(cmd) || !/^[0-9a-f]{40}$/.test(sha || '')) {
    console.log('::error::Usage: advance-live.mjs probe|advance <40-char sha> [before]');
    process.exit(2);
  }
  const api = githubApi();
  try {
    if (cmd === 'probe') {
      const { out, log } = await probe({ api, sha, before: arg3 });
      log.forEach((l) => console.log(l));
      writeOutputs(out);
    } else {
      const { out, log, decision } = await advance({ api, sha });
      log.forEach((l) => console.log(l));
      writeOutputs(out);
      if (decision.action === 'skip' && decision.reason === 'no-live') console.log(`::notice::${decision.message}`);
      if (decision.action === 'fail') {
        console.log(`::error::${decision.message}`);
        process.exit(1);
      }
    }
  } catch (e) {
    console.log(`::error::${e.message}`);
    process.exit(1);
  }
}
