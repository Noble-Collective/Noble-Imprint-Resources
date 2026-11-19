// node --test .github/scripts/advance-live.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, needsWebsiteRefresh, probe, advance, githubApi } from './advance-live.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);

test('decide: no live branch → skip, never fail (P3 creates it)', () => {
  const d = decide({ sha: B, liveSha: null });
  assert.equal(d.action, 'skip');
  assert.equal(d.reason, 'no-live');
});

test('decide: live is an ancestor and sha is on main → advance', () => {
  assert.equal(decide({ sha: B, liveSha: A, compare: 'ahead', onMain: true }).action, 'advance');
});

test('decide: already there / already in history → skip', () => {
  assert.equal(decide({ sha: A, liveSha: A, compare: 'identical' }).reason, 'already');
  assert.equal(decide({ sha: A, liveSha: B, compare: 'behind' }).reason, 'already-in-live');
});

test('decide: diverged (main rewritten) → fail loudly', () => {
  const d = decide({ sha: B, liveSha: A, compare: 'diverged' });
  assert.equal(d.action, 'fail');
  assert.match(d.message, /not an ancestor/);
});

test('decide: a commit not on main never becomes live', () => {
  assert.equal(decide({ sha: B, liveSha: A, compare: 'ahead', onMain: false }).reason, 'not-on-main');
});

test('needsWebsiteRefresh: meta.json, search-terms.json, icons/ only', () => {
  assert.equal(needsWebsiteRefresh(['series/X/Book/meta.json']), true);
  assert.equal(needsWebsiteRefresh(['search-terms.json']), true);
  assert.equal(needsWebsiteRefresh(['icons/infographic/heart.svg']), true);
  assert.equal(needsWebsiteRefresh(['series/X/Book/sessions/01.md', 'bibles/bsb/John.md']), false);
  assert.equal(needsWebsiteRefresh(['series/X/meta.json.bak']), false);
  assert.equal(needsWebsiteRefresh([], { truncated: true }), true);
});

function fakeApi({ live = null, compares = {}, failMove = false } = {}) {
  const calls = { moved: [] };
  return {
    calls,
    async liveSha() { return live; },
    async compare(base, head) {
      const c = compares[`${base}...${head}`];
      if (c instanceof Error) throw c;
      return c ?? null;
    },
    async moveLive(sha) {
      if (failMove) throw new Error('422 Update is not a fast forward');
      calls.moved.push(sha);
    },
  };
}

test('advance: no live → does nothing, reports it', async () => {
  const api = fakeApi();
  const r = await advance({ api, sha: B });
  assert.equal(r.decision.reason, 'no-live');
  assert.deepEqual(api.calls.moved, []);
  assert.equal(r.out.advanced, 'false');
  assert.equal(r.out.refresh_website, 'false');
});

test('advance: fast-forward moves live and flags a snapshot refresh for config changes', async () => {
  const api = fakeApi({
    live: A,
    compares: {
      [`${A}...${B}`]: { status: 'ahead', files: ['series/S/Book/meta.json'], truncated: false },
      [`${B}...main`]: { status: 'identical', files: [], truncated: false },
    },
  });
  const r = await advance({ api, sha: B });
  assert.deepEqual(api.calls.moved, [B]);
  assert.equal(r.out.advanced, 'true');
  assert.equal(r.out.live_after, B);
  assert.equal(r.out.refresh_website, 'true');
});

test('advance: text-only change moves live without a snapshot refresh', async () => {
  const api = fakeApi({
    live: A,
    compares: {
      [`${A}...${B}`]: { status: 'ahead', files: ['series/S/Book/sessions/01.md'], truncated: false },
      [`${B}...main`]: { status: 'ahead', files: [], truncated: false },
    },
  });
  const r = await advance({ api, sha: B });
  assert.equal(r.out.advanced, 'true');
  assert.equal(r.out.refresh_website, 'false');
});

test('advance: an older run after a newer one already advanced → skip', async () => {
  const api = fakeApi({ live: C, compares: { [`${C}...${B}`]: { status: 'behind', files: [], truncated: false } } });
  const r = await advance({ api, sha: B });
  assert.equal(r.decision.reason, 'already-in-live');
  assert.deepEqual(api.calls.moved, []);
});

test('advance: diverged → fail, live untouched', async () => {
  const api = fakeApi({ live: A, compares: { [`${A}...${B}`]: { status: 'diverged', files: [], truncated: false } } });
  const r = await advance({ api, sha: B });
  assert.equal(r.decision.action, 'fail');
  assert.deepEqual(api.calls.moved, []);
});

test('advance: GitHub refusing a non-fast-forward surfaces as an error', async () => {
  const api = fakeApi({
    live: A,
    failMove: true,
    compares: {
      [`${A}...${B}`]: { status: 'ahead', files: [], truncated: false },
      [`${B}...main`]: { status: 'identical', files: [], truncated: false },
    },
  });
  await assert.rejects(advance({ api, sha: B }), /fast forward/);
});

test('probe: live exists → no legacy refresh', async () => {
  const r = await probe({ api: fakeApi({ live: A }), sha: B, before: A });
  assert.equal(r.out.live_exists, 'true');
  assert.equal(r.out.refresh_website, 'false');
});

test('probe: no live → keeps the old deploy-website-on-config rule', async () => {
  const cfg = fakeApi({ compares: { [`${A}...${B}`]: { status: 'ahead', files: ['icons/infographic/x.svg'], truncated: false } } });
  assert.equal((await probe({ api: cfg, sha: B, before: A })).out.refresh_website, 'true');
  const text = fakeApi({ compares: { [`${A}...${B}`]: { status: 'ahead', files: ['series/S/B/sessions/1.md'], truncated: false } } });
  const r = await probe({ api: text, sha: B, before: A });
  assert.equal(r.out.live_exists, 'false');
  assert.equal(r.out.refresh_website, 'false');
});

test('probe: no live, unknown range (new branch / compare error) → refresh to be safe', async () => {
  assert.equal((await probe({ api: fakeApi(), sha: B, before: '0'.repeat(40) })).out.refresh_website, 'true');
  const err = fakeApi({ compares: { [`${A}...${B}`]: new Error('boom') } });
  assert.equal((await probe({ api: err, sha: B, before: A })).out.refresh_website, 'true');
});

test('githubApi: 404 on the live ref = no live; PATCH is never a force', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, init });
    if (url.endsWith('/git/ref/heads/live')) return { status: 404, ok: false, text: async () => '' };
    return { status: 200, ok: true, text: async () => '{}' };
  };
  const api = githubApi({ token: 't', repo: 'o/r', fetchImpl });
  assert.equal(await api.liveSha(), null);
  await api.moveLive(B);
  const patch = seen.find((s) => s.init.method === 'PATCH');
  assert.equal(patch.url, 'https://api.github.com/repos/o/r/git/refs/heads/live');
  assert.deepEqual(JSON.parse(patch.init.body), { sha: B, force: false });
});

// --- P6: the app's content publish runs after the gate, only for changes the app ships ------------------------------
import { needsAppPublish } from './advance-live.mjs';

test('needsAppPublish: series, bibles, search terms, icons — never the hidden Test Book, never tooling', () => {
  assert.equal(needsAppPublish(['series/S/Book/sessions/01.md']), true);
  assert.equal(needsAppPublish(['bibles/bsb/references.json']), true);
  assert.equal(needsAppPublish(['search-terms.json']), true);
  assert.equal(needsAppPublish(['icons/infographic/heart.svg']), true);
  assert.equal(needsAppPublish(['series/Narrative Journey Series/Foundations/Test Book/sessions/3.md']), false);
  assert.equal(needsAppPublish(['.github/workflows/content-gate.yml', 'README.md']), false);
  assert.equal(needsAppPublish(['series/Narrative Journey Series/Foundations/Test Book/meta.json', 'series/X/Y/meta.json']), true);
  assert.equal(needsAppPublish([], { truncated: true }), true);
});

test('advance: publish_app follows the files live moved over', async () => {
  const mk = (files) => fakeApi({
    live: A,
    compares: {
      [`${A}...${B}`]: { status: 'ahead', files, truncated: false },
      [`${B}...main`]: { status: 'identical', files: [], truncated: false },
    },
  });
  assert.equal((await advance({ api: mk(['series/S/B/sessions/1.md']), sha: B })).out.publish_app, 'true');
  assert.equal((await advance({ api: mk(['.github/scripts/x.mjs']), sha: B })).out.publish_app, 'false');
  const none = await advance({ api: fakeApi(), sha: B });
  assert.equal(none.out.publish_app, 'false');
});
