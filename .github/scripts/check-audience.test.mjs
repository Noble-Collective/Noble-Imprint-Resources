// node --test .github/scripts/check-audience.test.mjs
// Collective membership (M4a): a meta.json may say who can see a book, collection or series —
// "audience" (missing = everyone) and "audienceDisplay" (what non-members see: "locked" or "hidden").
// The website enforces it; the app leaves anything not for everyone out of the app and the public
// content bucket (Noble-Imprint-App tool/content_audience.dart). A misspelt value would hide a book
// everywhere (unknown values fail closed), so this check names it at the commit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkAudience } from './check-audience.mjs';

function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audience-'));
  for (const [rel, meta] of Object.entries(files)) {
    const f = path.join(root, rel, 'meta.json');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, typeof meta === 'string' ? meta : JSON.stringify(meta));
  }
  return root;
}

test('no audience, and every allowed value → no problems', () => {
  const root = repo({
    'series/S': { title: 'S' },
    'series/S/A': { id: 'a' },
    'series/S/B': { id: 'b', audience: 'everyone' },
    'series/S/C': { id: 'c', audience: 'members', audienceDisplay: 'hidden' },
    'series/S/D': { id: 'd', audience: 'member_churches', audienceDisplay: 'locked' },
    'series/S/E': { id: 'e', audience: 'signed_in' },
    'series/S/F': { id: 'f', audience: { orgs: ['abc123'] } },
    'bibles/bsb': { title: 'BSB' },
  });
  assert.deepEqual(checkAudience(root), []);
});

test('a misspelt or wrong-typed audience is named with its file', () => {
  const root = repo({
    'series/S/A': { audience: 'Members' },
    'series/S/B': { audience: 'member' },
    'series/S/C': { audience: { orgs: [] } },
    'series/S/D': { audience: { orgs: [1] } },
    'series/S/E': { audience: true },
  });
  const p = checkAudience(root);
  assert.equal(p.length, 5);
  assert.match(p[0], /series\/S\/A\/meta\.json/);
  assert.match(p[0], /"Members"/);
});

test('audienceDisplay must be locked or hidden', () => {
  const root = repo({ 'series/S/A': { audience: 'members', audienceDisplay: 'Hidden' } });
  const p = checkAudience(root);
  assert.equal(p.length, 1);
  assert.match(p[0], /audienceDisplay/);
});

test('dot-folders are skipped; invalid JSON is left to the other checks', () => {
  const root = repo({ '.github/x': { audience: 'nope' }, 'series/S/Bad': '{ not json' });
  assert.deepEqual(checkAudience(root), []);
});
