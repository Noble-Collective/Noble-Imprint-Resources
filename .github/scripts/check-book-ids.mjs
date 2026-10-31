#!/usr/bin/env node
// Every public book (a folder under series/ with a meta.json and a sessions/ folder, not "status": "hidden") needs
// a permanent "id" in its meta.json: lowercase letters, digits and hyphens, e.g. "hear-my-son", different from every
// other book's. Saved reading places, tabs and share links name a book by it, and the app's build stops without it
// (Noble-Imprint-App tool/resource_processor.dart; plans/2026-10-03-live-content-sync.md §5.2 there). This check
// says so at the commit. Run: node .github/scripts/check-book-ids.mjs [repo root]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const suggest = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'book-id';

function bookDirs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue;
    const d = path.join(dir, e.name);
    if (fs.existsSync(path.join(d, 'meta.json')) && fs.existsSync(path.join(d, 'sessions'))) out.push(d);
    else bookDirs(d, out);
  }
  return out;
}

export function checkBookIds(root) {
  const problems = [];
  const seen = new Map();
  for (const d of bookDirs(path.join(root, 'series')).sort()) {
    const rel = path.relative(root, path.join(d, 'meta.json')).split(path.sep).join('/');
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(path.join(d, 'meta.json'), 'utf8'));
    } catch (e) {
      problems.push(`${rel} is not valid JSON (${e.message}).`);
      continue;
    }
    if (meta.status === 'hidden') continue;
    const id = meta.id;
    if (id == null) {
      problems.push(`${rel} has no "id". Add one, e.g. "id": "${suggest(meta.title || path.basename(d))}" — lowercase letters, digits and hyphens, never changed later.`);
    } else if (typeof id !== 'string' || !KEY.test(id)) {
      problems.push(`${rel} has a malformed "id" (${id}). Use lowercase letters, digits and hyphens, e.g. "${suggest(String(id))}".`);
    } else if (seen.has(id)) {
      problems.push(`Duplicate "id" "${id}" in ${seen.get(id)} and ${rel}. Every book needs its own.`);
    } else {
      seen.set(id, rel);
    }
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const problems = checkBookIds(path.resolve(process.argv[2] || '.'));
  if (problems.length) {
    for (const p of problems) console.log(`::error::${p}`);
    console.log(`\n${problems.length} book id problem(s). The app's content release will fail until they are fixed.`);
    process.exit(1);
  }
  console.log('Every public book has a good, unique "id".');
}
