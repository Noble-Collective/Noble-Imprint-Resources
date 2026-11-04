#!/usr/bin/env node
// Collective membership (M4a): a meta.json may say who can see a book, collection or series —
// "audience": "everyone" | "signed_in" | "members" | "member_churches" | {"orgs": ["<id>", …]} (missing = everyone),
// and "audienceDisplay": "locked" | "hidden" (what people who can't open it see on the website).
// The website enforces it; the app leaves anything not for everyone out of the app and the public content bucket
// (Noble-Imprint-App tool/content_audience.dart). An unknown value fails closed — the book would disappear from the
// app and be locked on the website — so this check names it at the commit. Invalid JSON is the other checks' job.
// Run: node .github/scripts/check-audience.mjs [repo root]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AUDIENCES = ['everyone', 'signed_in', 'members', 'member_churches'];
const DISPLAYS = ['locked', 'hidden'];

function metaFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) metaFiles(p, out);
    else if (e.name === 'meta.json') out.push(p);
  }
  return out;
}

const isAudience = (a) =>
  (typeof a === 'string' && AUDIENCES.includes(a)) ||
  (a !== null && typeof a === 'object' && !Array.isArray(a) && Array.isArray(a.orgs) && a.orgs.length > 0 &&
    a.orgs.every((o) => typeof o === 'string' && o.length > 0));

export function checkAudience(root) {
  const problems = [];
  for (const f of metaFiles(root).sort()) {
    const rel = path.relative(root, f).split(path.sep).join('/');
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch {
      continue;
    }
    if (meta === null || typeof meta !== 'object') continue;
    if ('audience' in meta && !isAudience(meta.audience)) {
      problems.push(`${rel} has "audience": ${JSON.stringify(meta.audience)}. Use one of ${AUDIENCES.map((a) => `"${a}"`).join(', ')}, or {"orgs": ["<organization id>"]} — or leave it out (= everyone).`);
    }
    if ('audienceDisplay' in meta && !DISPLAYS.includes(meta.audienceDisplay)) {
      problems.push(`${rel} has "audienceDisplay": ${JSON.stringify(meta.audienceDisplay)}. Use "locked" or "hidden" — or leave it out (= locked).`);
    }
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const problems = checkAudience(path.resolve(process.argv[2] || '.'));
  if (problems.length) {
    for (const p of problems) console.log(`::error::${p}`);
    console.log(`\n${problems.length} audience problem(s).`);
    process.exit(1);
  }
  console.log('Every "audience" / "audienceDisplay" in a meta.json is one the website and the app understand.');
}
