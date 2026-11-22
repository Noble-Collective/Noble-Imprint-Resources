// Guard tests for the vendored content contract CLI (content-contract.cjs).
// The rules themselves are tested in Collective-Shared (content.cases.json); these only prove the vendored copy runs
// and that the gate's exit code means what the gate relies on: an error in a PUBLIC book fails, a hidden book's
// problems are warnings only (Steve, 2026-11-22: never auto-hide; hidden books only warn).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = join(dirname(fileURLToPath(import.meta.url)), 'content-contract.cjs');

function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'contract-'));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}

function run(root) {
  const r = spawnSync(process.execPath, [cli, '--content', root, '--no-warnings'], { encoding: 'utf8' });
  rmSync(root, { recursive: true, force: true });
  return r;
}

const book = (status, session) => ({
  'series/S/meta.json': JSON.stringify({ title: 'S', order: 1 }),
  'series/S/B/meta.json': JSON.stringify({ id: 'b', title: 'B', order: 1, status }),
  'series/S/B/cover.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
  'series/S/B/sessions/01-One.md': session,
});

test('a clean public book passes', () => {
  const r = run(tree(book('public', '# One\n\nText.\n')));
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('an unknown tag in a public book fails the gate', () => {
  const r = run(tree(book('public', '# One\n\n<Mystery>x</Mystery>\n')));
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /error/);
});

test('the same problem in a hidden book is only a warning', () => {
  const r = run(tree(book('hidden', '# One\n\n<Mystery>x</Mystery>\n')));
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('<image name> is a known tag', () => {
  const files = book('public', '# One\n\n<image life spheres>\n');
  files['series/S/B/sessions/images/life spheres.png'] = 'png';
  const r = run(tree(files));
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
