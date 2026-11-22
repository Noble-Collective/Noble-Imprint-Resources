#!/usr/bin/env node
// Content gate C5 (Collective-Shared plans/2026-11-21-content-contract.md §3 Layer 3 / §5 C5): ONE report per gate run.
//
// The gate's last step gathers what held `live` (contract errors in public books, any older check that failed, the
// app's acceptance) and the warnings, and posts them as a check run named REPORT_NAME on the commit:
//   output.summary = the findings in plain words, grouped by book (also written to the run summary);
//   output.text    = the same as JSON (v1), which the website's content-gate tick reads (it has Checks: read on this
//                    repo; Actions artifacts would need more) to send the hold email after 15 minutes, the all-clear,
//                    and the Monday warnings digest. Nothing is emailed from here: this repo is public.
// The check run is always "neutral": the gate's own run is what passes or fails.
//
// CLI (in the gate): node gate-report.mjs --contract <findings.json> --logs <dir with <step id>.log>
//   env STEPS = toJSON(steps), GITHUB_SHA, RUN_URL, GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_STEP_SUMMARY.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const REPORT_NAME = 'Content gate report';
export const MAX_TEXT = 60000; // GitHub's limit is 65,535 characters

// The gate's checking steps, by step id, in the order they run. Anything failing here holds live.
export const CHECK_STEPS = [
  ['g_live', 'Gate tests (advance-live)'],
  ['g_audience', 'Guard tests (audience)'],
  ['audience', 'Every audience is a known value'],
  ['g_ids', 'Guard tests (book ids)'],
  ['ids', 'Every public book has a good, unique "id"'],
  ['g_icons', 'Guard tests (infographic icons)'],
  ['icons', 'Every infographic icon has a usable drawing'],
  ['g_terms', 'Guard tests (search terms)'],
  ['terms', 'Check search-terms.json'],
  ['g_contract', 'Guard tests (content contract)'],
  ['contract', 'Content contract'],
  ['app', 'App acceptance'],
  ['website', 'Website acceptance'],
  ['institute', 'Institute acceptance'],
];

// The products whose content-acceptance run the gate waits for (scripts/acceptance.sh), by step id.
const PRODUCTS = { app: 'app', website: 'website', institute: 'Institute' };

export function parseLogErrors(log) {
  const out = [];
  for (const line of String(log || '').split(/\r?\n/)) {
    const m = /^::error(?:\s[^:]*)?::(.*)$/.exec(line);
    if (m && m[1].trim()) out.push(m[1].trim());
  }
  return out;
}

const keyOf = (f) => [f.source, f.rule || '', f.path || '', String(f.message || '').replace(/\bline \d+/g, 'line #')].join('|');

// Same problems = same fingerprint, whatever the commit, the order, or the line a problem moved to.
export function fingerprint(holding) {
  if (!holding || !holding.length) return null;
  const keys = [...new Set(holding.map(keyOf))].sort();
  return crypto.createHash('sha256').update(keys.join('\n')).digest('hex').slice(0, 16);
}

const pick = (f, source) => {
  const o = { source, rule: f.rule || null, book: f.book || null, path: f.path || null, message: f.message, fix: f.fix || null };
  if (f.line) o.line = f.line;
  return o;
};

// contract: the CLI's --json array, or null when it didn't produce one. checks: [{ id, name, outcome, log }].
export function buildReport({ sha, runUrl, contract, checks }) {
  const holding = [];
  const warnings = [];
  for (const f of contract || []) (f.severity === 'error' ? holding : warnings).push(pick(f, 'Content contract'));
  for (const c of checks || []) {
    if (c.outcome !== 'failure') continue;
    if (c.id === 'contract') {
      if (!contract) holding.push({ source: c.name, rule: null, book: null, path: null, message: 'The content contract could not run on this commit.', fix: 'Open the gate run: the "Content contract" step shows why.' });
      continue; // its errors are already in
    }
    const product = PRODUCTS[c.id];
    if (product) {
      const link = (/acceptance run: (\S+)/.exec(c.log || '') || [])[1] || null;
      holding.push({ source: c.name, rule: null, book: null, path: null, message: `The ${product} couldn't use this commit: its content acceptance check failed.`, fix: `The ${product} acceptance run says which file or book (Steve can open it).`, link });
      continue;
    }
    const msgs = parseLogErrors(c.log);
    if (msgs.length) for (const m of msgs) holding.push({ source: c.name, rule: null, book: null, path: null, message: m, fix: null });
    else holding.push({ source: c.name, rule: null, book: null, path: null, message: `The check "${c.name}" failed.`, fix: 'Open the gate run for the details.' });
  }
  return { v: 1, sha, runUrl, held: holding.length > 0, fingerprint: fingerprint(holding), holding, warnings, warningsTotal: warnings.length };
}

const bookName = (book) => (book ? book.split('/').pop() : 'Whole repository');

function groupByBook(list) {
  const groups = new Map();
  for (const f of list) {
    const k = bookName(f.book);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  }
  return groups;
}

function mdList(list) {
  const out = [];
  for (const [book, fs_] of groupByBook(list)) {
    out.push(`### ${book}`, '');
    for (const f of fs_) {
      out.push(`- ${f.message}${f.path ? ` (\`${f.path}\`)` : ''}`);
      if (f.fix) out.push(`  Fix: ${f.fix}`);
      if (f.link) out.push(`  ${f.link}`);
    }
    out.push('');
  }
  return out.join('\n');
}

export function renderSummary(r) {
  const head = r.held
    ? `**Held:** ${r.holding.length} problem${r.holding.length === 1 ? '' : 's'} keep this commit (${String(r.sha).slice(0, 7)}) from going public.`
    : `**Nothing holds** this commit (${String(r.sha).slice(0, 7)}).`;
  const parts = ['## Content gate report', '', head, ''];
  if (r.held) parts.push(mdList(r.holding));
  if (r.warningsTotal) parts.push(`<details><summary>${r.warningsTotal} warning${r.warningsTotal === 1 ? '' : 's'} (never hold; emailed weekly)</summary>`, '', mdList(r.warnings), '</details>');
  return parts.join('\n');
}

export function packText(r) {
  let out = { ...r };
  let text = JSON.stringify(out);
  let keep = r.warnings.length;
  while (text.length > MAX_TEXT && keep > 0) {
    keep = Math.floor(keep * 0.8);
    out = { ...r, warnings: r.warnings.slice(0, keep) };
    text = JSON.stringify(out);
  }
  return text;
}

const title = (r) => (r.held ? `${r.holding.length} problem${r.holding.length === 1 ? '' : 's'} hold${r.holding.length === 1 ? 's' : ''} live` : `Nothing holds live · ${r.warningsTotal} warning${r.warningsTotal === 1 ? '' : 's'}`);

export async function publish(r, { token, repo, fetchImpl = fetch }) {
  let summary = renderSummary(r);
  if (summary.length > MAX_TEXT) summary = `${summary.slice(0, MAX_TEXT - 40)}\n\n… (cut; see the gate run)`;
  const res = await fetchImpl(`https://api.github.com/repos/${repo}/check-runs`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json', 'x-github-api-version': '2022-11-28' },
    body: JSON.stringify({
      name: REPORT_NAME, head_sha: r.sha, status: 'completed', conclusion: 'neutral', details_url: r.runUrl || undefined,
      output: { title: title(r), summary, text: packText(r) },
    }),
  });
  if (!res.ok) throw new Error(`check run POST → ${res.status}`);
  return res.json();
}

// --- CLI ---------------------------------------------------------------------------------------------------------
async function main(argv) {
  const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  let contract = null;
  try { contract = JSON.parse(fs.readFileSync(arg('--contract'), 'utf8')); if (!Array.isArray(contract)) contract = null; } catch { contract = null; }
  let steps = {};
  try { steps = JSON.parse(process.env.STEPS || '{}'); } catch { steps = {}; }
  const logs = arg('--logs');
  const checks = CHECK_STEPS.filter(([id]) => steps[id]).map(([id, name]) => {
    let log = '';
    try { log = fs.readFileSync(path.join(logs, `${id}.log`), 'utf8'); } catch { /* no log */ }
    return { id, name, outcome: steps[id].outcome, log };
  });
  const r = buildReport({ sha: process.env.GITHUB_SHA, runUrl: process.env.RUN_URL, contract, checks });
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${renderSummary(r)}\n`);
  console.log(`${title(r)} (fingerprint ${r.fingerprint || '—'})`);
  const out = await publish(r, { token: process.env.GITHUB_TOKEN, repo: process.env.GITHUB_REPOSITORY });
  console.log(`Report: ${out.html_url}`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('gate-report.mjs')) {
  main(process.argv.slice(2)).catch((e) => { console.error(`::warning::Could not post the content gate report: ${e.message}`); process.exit(0); });
}
