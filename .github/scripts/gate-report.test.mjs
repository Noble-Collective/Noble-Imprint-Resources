// node --test .github/scripts/gate-report.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, parseLogErrors, renderSummary, fingerprint, packText, publish, REPORT_NAME, MAX_TEXT } from './gate-report.mjs';

const SHA = 'a'.repeat(40);
const RUN = 'https://github.com/o/r/actions/runs/1';
const BOOK = 'series/Narrative Journey Series/Foundations/The Call of Christ';
const err = (o = {}) => ({ rule: 'R12', severity: 'error', path: `${BOOK}/sessions/01-One.md`, book: BOOK, message: '<Foo> at 01-One.md line 12 is not a known tag.', fix: 'Use a known tag.', ...o });
const warn = (o = {}) => ({ rule: 'R7', severity: 'warning', path: `${BOOK}/sessions/x.md`, book: BOOK, message: 'x.md is not named NN-Name.md.', fix: 'Rename it next time.', ...o });
const ok = (id, name) => ({ id, name, outcome: 'success', log: '' });

test('parseLogErrors: ::error lines (with or without a title), nothing else', () => {
  const log = 'hello\n::error::Book "A" has no id.\n::warning::meh\n::error title=search-terms.json::"kjv" points at nothing\n\n3 problem(s).';
  assert.deepEqual(parseLogErrors(log), ['Book "A" has no id.', '"kjv" points at nothing']);
  assert.deepEqual(parseLogErrors(''), []);
});

test('all green: nothing holds, the warnings are kept', () => {
  const r = buildReport({ sha: SHA, runUrl: RUN, contract: [warn()], checks: [ok('contract', 'Content contract')] });
  assert.equal(r.v, 1);
  assert.equal(r.sha, SHA);
  assert.equal(r.held, false);
  assert.deepEqual(r.holding, []);
  assert.equal(r.warnings.length, 1);
  assert.equal(r.fingerprint, null);
});

test('contract errors hold; warnings never do', () => {
  const r = buildReport({
    sha: SHA, runUrl: RUN, contract: [err(), warn()],
    checks: [{ id: 'contract', name: 'Content contract', outcome: 'failure', log: '' }],
  });
  assert.equal(r.held, true);
  assert.equal(r.holding.length, 1);
  assert.deepEqual(r.holding[0], { source: 'Content contract', rule: 'R12', book: BOOK, path: err().path, message: err().message, fix: 'Use a known tag.' });
  assert.equal(r.warnings.length, 1);
  assert.match(r.fingerprint, /^[0-9a-f]{16}$/);
});

test('an older check that failed → each of its ::error lines holds', () => {
  const r = buildReport({
    sha: SHA, runUrl: RUN, contract: [],
    checks: [{ id: 'book_ids', name: 'Every public book has a good, unique "id"', outcome: 'failure', log: '::error::Book "X" has no "id".\n1 book id problem(s).' }],
  });
  assert.equal(r.held, true);
  assert.equal(r.holding[0].message, 'Book "X" has no "id".');
  assert.equal(r.holding[0].source, 'Every public book has a good, unique "id"');
});

test('a failed step with no ::error line still holds, with a plain message', () => {
  const r = buildReport({ sha: SHA, runUrl: RUN, contract: [], checks: [{ id: 't', name: 'Guard tests (audience)', outcome: 'failure', log: 'boom' }] });
  assert.equal(r.holding.length, 1);
  assert.match(r.holding[0].message, /"Guard tests \(audience\)" failed/);
});

test('the contract could not run (no JSON) but its step failed → one holding item', () => {
  const r = buildReport({ sha: SHA, runUrl: RUN, contract: null, checks: [{ id: 'contract', name: 'Content contract', outcome: 'failure', log: '' }] });
  assert.equal(r.holding.length, 1);
  assert.match(r.holding[0].message, /could not run/);
});

test('the app acceptance failed → a holding item with the app run link', () => {
  const r = buildReport({
    sha: SHA, runUrl: RUN, contract: [],
    checks: [{ id: 'app', name: 'App acceptance', outcome: 'failure', log: 'App acceptance run: https://github.com/N/App/actions/runs/9\n::error::The app\'s content acceptance failed for aaaaaaa' }],
  });
  assert.equal(r.holding.length, 1);
  assert.equal(r.holding[0].source, 'App acceptance');
  assert.equal(r.holding[0].link, 'https://github.com/N/App/actions/runs/9');
  assert.match(r.holding[0].message, /app/i);
});

test('the website / Institute acceptance failed → a holding item naming that product, with its run link', () => {
  for (const [id, name, product] of [['website', 'Website acceptance', 'website'], ['institute', 'Institute acceptance', 'Institute']]) {
    const r = buildReport({
      sha: SHA, runUrl: RUN, contract: [],
      checks: [{ id, name, outcome: 'failure', log: `${name} run: https://github.com/N/X/actions/runs/7\n::error::failed` }],
    });
    assert.equal(r.holding.length, 1);
    assert.equal(r.holding[0].source, name);
    assert.equal(r.holding[0].link, 'https://github.com/N/X/actions/runs/7');
    assert.match(r.holding[0].message, new RegExp(product));
  }
});

test('a skipped acceptance (no token) is a warning in the log, never a hold', () => {
  const r = buildReport({ sha: SHA, runUrl: RUN, contract: [], checks: [{ id: 'institute', name: 'Institute acceptance', outcome: 'success', log: '::warning::Institute acceptance skipped: no token' }] });
  assert.equal(r.held, false);
});

test('skipped / cancelled steps add nothing', () => {
  const r = buildReport({ sha: SHA, runUrl: RUN, contract: [], checks: [{ id: 'app', name: 'App acceptance', outcome: 'skipped', log: '' }] });
  assert.equal(r.held, false);
});

test('fingerprint: same problems on the next commit = same; line numbers and order do not matter; a new problem = new', () => {
  const a = fingerprint([err(), err({ rule: 'R10', message: 'pic.png is missing.' })].map((f) => ({ ...f, source: 'c' })));
  const b = fingerprint([err({ rule: 'R10', message: 'pic.png is missing.' }), err({ message: '<Foo> at 01-One.md line 40 is not a known tag.' })].map((f) => ({ ...f, source: 'c' })));
  const c = fingerprint([err(), err({ rule: 'R10', message: 'other.png is missing.' })].map((f) => ({ ...f, source: 'c' })));
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(fingerprint([]), null);
});

test('renderSummary groups by book (its folder name), with each fix', () => {
  const r = buildReport({ sha: SHA, runUrl: RUN, contract: [err(), warn(), warn({ book: null, path: '.DS_Store', message: '.DS_Store is a system file.' })], checks: [{ id: 'contract', name: 'Content contract', outcome: 'failure', log: '' }] });
  const md = renderSummary(r);
  assert.match(md, /Held/);
  assert.match(md, /### The Call of Christ/);
  assert.match(md, /Fix: Use a known tag\./);
  assert.match(md, /Whole repository/);
});

test('packText keeps the JSON under the check-run limit by dropping warnings, and says so', () => {
  const many = Array.from({ length: 2000 }, (_, i) => warn({ message: `warning number ${i} `.padEnd(80, '.') }));
  const r = buildReport({ sha: SHA, runUrl: RUN, contract: [err(), ...many], checks: [] });
  const text = packText(r);
  assert.ok(text.length <= MAX_TEXT);
  const back = JSON.parse(text);
  assert.equal(back.holding.length, 1);
  assert.ok(back.warnings.length < many.length);
  assert.equal(back.warningsTotal, many.length);
});

test('publish posts ONE completed, neutral check run named for the website to find', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 201, json: async () => ({ id: 5, html_url: 'h' }) }; };
  const r = buildReport({ sha: SHA, runUrl: RUN, contract: [err()], checks: [] });
  await publish(r, { token: 't', repo: 'o/r', fetchImpl });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.github.com/repos/o/r/check-runs');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.name, REPORT_NAME);
  assert.equal(body.head_sha, SHA);
  assert.equal(body.status, 'completed');
  assert.equal(body.conclusion, 'neutral');
  assert.equal(JSON.parse(body.output.text).fingerprint, r.fingerprint);
  assert.match(body.output.title, /1 problem holds/);
});
