// node --test .github/scripts/check-book-ids.test.mjs
// The app build stops on a public book whose meta.json has no "id" (or a malformed or duplicated one) —
// Noble-Imprint-App tool/resource_processor.dart _processBookDirectory / validateBookKeys. This check says so at the
// commit, in plain words, before the app's publish run fails for everyone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkBookIds } from './check-book-ids.mjs';

function repo(books) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'book-ids-'));
  for (const [dir, meta] of Object.entries(books)) {
    const d = path.join(root, 'series', dir);
    fs.mkdirSync(path.join(d, 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(d, 'meta.json'), typeof meta === 'string' ? meta : JSON.stringify(meta));
  }
  // a series folder's own meta.json (no sessions/) is not a book
  fs.writeFileSync(path.join(root, 'series', 'meta.json'), '{"title":"x"}');
  return root;
}

test('every public book has a good, unique id → no problems', () => {
  const root = repo({ 'S/Hear My Son': { title: 'Hear My Son', id: 'hear-my-son' }, 'S/Other': { title: 'Other', id: 'other-1' } });
  assert.deepEqual(checkBookIds(root), []);
});

test('a missing id is named with the book folder and the fix', () => {
  const root = repo({ 'S/New Book': { title: 'New Book' } });
  const p = checkBookIds(root);
  assert.equal(p.length, 1);
  assert.match(p[0], /series\/S\/New Book\/meta\.json has no "id"/);
  assert.match(p[0], /"id": "new-book"/);
});

test('malformed and duplicate ids are problems too', () => {
  const root = repo({ 'S/A': { id: 'Hear_My_Son' }, 'S/B': { id: 'dup' }, 'S/C': { id: 'dup' } });
  const p = checkBookIds(root);
  assert.equal(p.length, 2);
  assert.ok(p.some((x) => /malformed "id" \(Hear_My_Son\)/.test(x)));
  assert.ok(p.some((x) => /Duplicate "id" "dup"/.test(x)));
});

test('hidden books need no id (the app skips them); a broken meta.json is reported', () => {
  const root = repo({ 'S/Test Book': { title: 'Test Book', status: 'hidden' }, 'S/Bad': '{ not json' });
  const p = checkBookIds(root);
  assert.equal(p.length, 1);
  assert.match(p[0], /series\/S\/Bad\/meta\.json is not valid JSON/);
});
