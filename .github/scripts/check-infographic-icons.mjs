#!/usr/bin/env node
// Infographic icons have ONE home: icons/infographic/<name>.svg. The app ships them in its content updates and the
// website draws them from here (Collective-Shared plans/2026-11-18-infographic-icons-one-source.md). This check
// names, at the commit, every <Item icon="…"> with no drawing and every drawing that can't be used. The app's
// content publish runs the same rules (Noble-Imprint-App tool/check_infographic_icons.dart) and stops on them.
// Run: node .github/scripts/check-infographic-icons.mjs [repo root]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ICONS_DIR = 'icons/infographic';
export const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Markup the website would refuse to draw inline (and that has no business in a one-colour icon).
const UNSAFE = [
  [/<script\b/i, 'a <script>'],
  [/<style\b/i, 'a <style> block (use attributes instead)'],
  [/<foreignObject\b/i, 'a <foreignObject>'],
  [/<image\b/i, 'an embedded <image> (icons must be drawn shapes)'],
  [/\bhref\s*=/i, 'a link (href)'],
  [/\son[a-z]+\s*=/i, 'an event handler (on…=)'],
  [/<!DOCTYPE|<!ENTITY/i, 'a DOCTYPE/ENTITY'],
];

/** Problems with one icon file's text ([] when it's usable). */
export function svgProblems(text) {
  const out = [];
  const body = text.replace(/^﻿/, '').replace(/<\?xml[\s\S]*?\?>/, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  const root = body.match(/^<svg\b[^>]*>/);
  if (!root) out.push('does not start with <svg');
  else if (!/\bviewBox\s*=/.test(root[0])) out.push('has no viewBox on its <svg> (needed to size it)');
  if (root && !/<\/svg>\s*$/.test(body)) out.push('does not end with </svg>');
  for (const [re, what] of UNSAFE) if (re.test(body)) out.push(`contains ${what}`);
  return out;
}

function mdFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) mdFiles(p, out);
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

/** Icon name → the files that use it (comments ignored; names with a {placeholder} skipped). */
export function usedIcons(root) {
  const used = new Map();
  for (const f of mdFiles(path.join(root, 'series')).sort()) {
    const text = fs.readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const rel = path.relative(root, f).split(path.sep).join('/');
    for (const m of text.matchAll(/<Item\b[^>]*?\bicon="([^"]*)"/g)) {
      const name = m[1].trim();
      if (!name || name.includes('{')) continue;
      if (!used.has(name)) used.set(name, new Set());
      used.get(name).add(rel);
    }
  }
  return used;
}

export function checkInfographicIcons(root) {
  const problems = [];
  const dir = path.join(root, ICONS_DIR);
  const have = new Set();
  if (fs.existsSync(dir)) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isFile() || e.name.startsWith('.') || e.name === 'README.md') continue;
      const rel = `${ICONS_DIR}/${e.name}`;
      if (!e.name.endsWith('.svg')) {
        problems.push(`${rel}: only .svg drawings belong in ${ICONS_DIR}/.`);
        continue;
      }
      const name = e.name.slice(0, -4);
      if (!NAME.test(name)) {
        problems.push(`${rel}: name it with lowercase letters, digits and hyphens, e.g. "${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}.svg".`);
        continue;
      }
      for (const p of svgProblems(fs.readFileSync(path.join(dir, e.name), 'utf8'))) problems.push(`${rel} ${p}.`);
      have.add(name);
    }
  }
  for (const [name, files] of [...usedIcons(root)].sort(([a], [b]) => a.localeCompare(b))) {
    if (have.has(name)) continue;
    const where = [...files];
    problems.push(`icon="${name}" (in ${where[0]}${where.length > 1 ? ` and ${where.length - 1} more` : ''}) has no drawing: add ${ICONS_DIR}/${name}.svg, or use the name of one that is there.`);
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const problems = checkInfographicIcons(path.resolve(process.argv[2] || '.'));
  if (problems.length) {
    for (const p of problems) console.log(`::error::${p}`);
    console.log(`\n${problems.length} infographic icon problem(s). The app's content update will not publish until they are fixed.`);
    process.exit(1);
  }
  console.log('Every infographic icon has a usable drawing.');
}
