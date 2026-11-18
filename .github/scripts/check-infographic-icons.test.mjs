// node --test .github/scripts/check-infographic-icons.test.mjs
// Every <Item icon="…"> needs icons/infographic/<name>.svg, and every drawing there must be usable by the app and
// the website (Collective-Shared plans/2026-11-18-infographic-icons-one-source.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkInfographicIcons, svgProblems } from './check-infographic-icons.mjs';

const GOOD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>';

function repo({ icons = {}, sessions = {} }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'info-icons-'));
  fs.mkdirSync(path.join(root, 'icons', 'infographic'), { recursive: true });
  for (const [name, text] of Object.entries(icons)) fs.writeFileSync(path.join(root, 'icons', 'infographic', name), text);
  for (const [rel, text] of Object.entries(sessions)) {
    fs.mkdirSync(path.dirname(path.join(root, 'series', rel)), { recursive: true });
    fs.writeFileSync(path.join(root, 'series', rel), text);
  }
  return root;
}

const graphic = (...icons) =>
  `<Infographic title="T" type="menu">\nIntro.\n${icons.map((i) => `<Item icon="${i}" label="L">Body.</Item>`).join('\n')}\n</Infographic>\n`;

test('every used icon has a drawing → no problems', () => {
  const root = repo({
    icons: { 'church.svg': GOOD, 'sec-hearing.svg': GOOD, 'README.md': '# how' },
    sessions: { 'S/B/sessions/01.md': graphic('church', 'sec-hearing'), 'S/commonSeries.md': graphic('church') },
  });
  assert.deepEqual(checkInfographicIcons(root), []);
});

test('a used name with no drawing is named, with where it is used and the fix', () => {
  const root = repo({ icons: { 'church.svg': GOOD }, sessions: { 'S/B/sessions/01.md': graphic('church', 'sec-new') } });
  const problems = checkInfographicIcons(root);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /icon="sec-new"/);
  assert.match(problems[0], /series\/S\/B\/sessions\/01\.md/);
  assert.match(problems[0], /icons\/infographic\/sec-new\.svg/);
});

test('commented-out items and {placeholder} names are not checked', () => {
  const root = repo({ sessions: { 'S/x.md': `<!-- ${graphic('gone')} -->\n${graphic('{icon}')}` } });
  assert.deepEqual(checkInfographicIcons(root), []);
});

test('a badly named or non-SVG file is named', () => {
  const root = repo({ icons: { 'Sec Hearing.svg': GOOD, 'church.png': 'x' } });
  const problems = checkInfographicIcons(root);
  assert.equal(problems.length, 2);
  assert.ok(problems.some((p) => /sec-hearing\.svg/.test(p)));
  assert.ok(problems.some((p) => /only \.svg/.test(p)));
});

test('unusable drawings are refused', () => {
  assert.deepEqual(svgProblems(GOOD), []);
  assert.deepEqual(svgProblems(`<?xml version="1.0"?>\n<!-- Font Awesome -->\n${GOOD}\n`), []);
  assert.match(svgProblems('<svg width="10" height="10"><path/></svg>').join(), /viewBox/);
  assert.match(svgProblems('<png/>').join(), /does not start with <svg/);
  for (const bad of [
    '<script>alert(1)</script>',
    '<style>path{fill:red}</style>',
    '<foreignObject/>',
    '<image href="x.png"/>',
    '<use xlink:href="#a"/>',
    '<path onclick="x()"/>',
  ]) {
    assert.ok(svgProblems(GOOD.replace('</svg>', `${bad}</svg>`)).length > 0, bad);
  }
});

test('the real repo passes', () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
  assert.deepEqual(checkInfographicIcons(root), []);
});
