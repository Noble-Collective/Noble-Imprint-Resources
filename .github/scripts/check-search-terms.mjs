#!/usr/bin/env node
// Guard for search-terms.json (the Library search terms; plan Collective-Shared
// plans/2026-10-09-library-search-terms.md §3a). Fails on errors only; warnings are printed and pass.
//
// normalize + validateTerms are a dependency-free copy of @noble-collective/userdata/library-search
// (Collective-Shared packages/userdata/src/library-search, SDK 0.7.0). Keep them in step with it:
// check-search-terms.cases.json is the vendored spec and check-search-terms.test.mjs runs it.
//
// Usage: node .github/scripts/check-search-terms.mjs [repo-root]

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** NFD, strip accents, lowercase, drop ' ’ and backtick, every other non-alphanumeric run → one space, trim. */
export function normalize(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const NODE_FIELDS = new Set(['title', 'id', 'primary', 'terms'])
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const isStringList = (v) => Array.isArray(v) && v.every((t) => typeof t === 'string')

/**
 * Problems in a terms file. folders = every folder with a meta.json (plus "bibles") as {path, id?, title?}.
 * Errors: bad-shape, missing-folder, id-mismatch, duplicate.
 * Warnings: duplicate-normalized, repeats-ancestor, title-mismatch, primary-count, no-terms.
 */
export function validateTerms(terms, folders) {
  const problems = []
  const error = (code, key, message, term) =>
    problems.push({ level: 'error', code, key, ...(term !== undefined ? { term } : {}), message })
  const warn = (code, key, message, term) =>
    problems.push({ level: 'warning', code, key, ...(term !== undefined ? { term } : {}), message })

  if (!isObject(terms)) {
    error('bad-shape', '', 'the file is not a JSON object')
    return problems
  }
  if (terms.version !== 1) error('bad-shape', '', `"version" must be 1 (found ${JSON.stringify(terms.version)})`)
  for (const k of Object.keys(terms)) {
    if (!k.startsWith('_') && k !== 'version' && k !== 'nodes') error('bad-shape', '', `unknown top-level field "${k}"`)
  }
  if (!isObject(terms.nodes)) {
    error('bad-shape', '', '"nodes" must be an object of folder path → node')
    return problems
  }
  const nodes = terms.nodes

  // Shape first; only well-shaped nodes go on to the other checks.
  const good = new Map()
  for (const [key, node] of Object.entries(nodes)) {
    if (key.startsWith('_')) continue
    if (!isObject(node)) {
      error('bad-shape', key, 'a node must be an object')
      continue
    }
    let ok = true
    for (const f of Object.keys(node)) {
      if (!f.startsWith('_') && !NODE_FIELDS.has(f)) {
        error('bad-shape', key, `unknown field "${f}"`)
        ok = false
      }
    }
    if (typeof node.title !== 'string' || !node.title.trim()) {
      error('bad-shape', key, '"title" must be a non-empty string')
      ok = false
    }
    if (node.id !== undefined && typeof node.id !== 'string') {
      error('bad-shape', key, '"id" must be a string')
      ok = false
    }
    for (const list of ['primary', 'terms']) {
      if (!isStringList(node[list])) {
        error('bad-shape', key, `"${list}" must be a list of strings`)
        ok = false
        continue
      }
      for (const t of node[list]) {
        if (!normalize(t)) {
          error('bad-shape', key, `"${t}" has no letters or digits`, t)
          ok = false
        }
      }
    }
    if (ok) good.set(key, node)
  }

  const byPath = new Map(folders.map((f) => [f.path, f]))
  const normSets = new Map()
  for (const [key, node] of good) normSets.set(key, new Set([...node.primary, ...node.terms].map(normalize)))

  for (const [key, node] of good) {
    const folder = byPath.get(key)
    if (!folder) error('missing-folder', key, `no folder "${key}" in the content repo`)
    else {
      if (node.id !== undefined && node.id !== folder.id) {
        error('id-mismatch', key, `id "${node.id}" but meta.json says ${folder.id ? `"${folder.id}"` : 'no id'}`)
      }
      if (folder.title !== undefined && node.title !== folder.title) {
        warn('title-mismatch', key, `title "${node.title}" but meta.json says "${folder.title}"`)
      }
    }
    if (node.primary.length < 3 || node.primary.length > 5) {
      warn('primary-count', key, `${node.primary.length} primary terms (3–5 expected)`)
    }

    const all = [...node.primary, ...node.terms]
    const raw = new Set()
    const rawReported = new Set()
    const norm = new Map() // normalized → first raw spelling
    const normReported = new Set()
    for (const t of all) {
      const r = t.trim().toLowerCase()
      const n = normalize(t)
      if (raw.has(r)) {
        if (!rawReported.has(r)) error('duplicate', key, `"${t.trim()}" is listed twice`, r)
        rawReported.add(r)
      } else if (norm.has(n)) {
        if (!normReported.has(n)) warn('duplicate-normalized', key, `"${norm.get(n)}" and "${t}" search the same`, n)
        normReported.add(n)
      }
      raw.add(r)
      if (!norm.has(n)) norm.set(n, t)
    }

    const fromAbove = new Map()
    for (const [k, set] of normSets) {
      if (key.startsWith(k + '/')) for (const n of set) if (!fromAbove.has(n)) fromAbove.set(n, k)
    }
    for (const n of normSets.get(key)) {
      if (fromAbove.has(n)) warn('repeats-ancestor', key, `"${n}" already comes from "${fromAbove.get(n)}"`, n)
    }
  }

  for (const f of folders) {
    if (f.id && !(f.path in nodes)) warn('no-terms', f.path, `book "${f.id}" has no search terms`)
  }
  return problems
}

/** Every folder under bibles/ and series/ with a meta.json, as {path, id?, title?}, plus the "bibles" shelf. */
export function collectFolders(root) {
  const folders = [{ path: 'bibles' }]
  const walk = (rel) => {
    const abs = join(root, rel)
    const metaPath = join(abs, 'meta.json')
    if (existsSync(metaPath)) {
      const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      folders.push({
        path: rel,
        ...(typeof meta.id === 'string' ? { id: meta.id } : {}),
        ...(typeof meta.title === 'string' ? { title: meta.title } : {}),
      })
    }
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith('.')) walk(`${rel}/${e.name}`)
    }
  }
  for (const top of ['bibles', 'series']) if (existsSync(join(root, top))) walk(top)
  return folders
}

/** Reads <root>/search-terms.json and validates it against the repo's folders. */
export function checkRepo(root) {
  const file = join(root, 'search-terms.json')
  let terms
  try {
    terms = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    return { problems: [{ level: 'error', code: 'bad-shape', key: '', message: `cannot read search-terms.json: ${e.message}` }] }
  }
  return { problems: validateTerms(terms, collectFolders(root)) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..'))
  const { problems } = checkRepo(root)
  const errors = problems.filter((p) => p.level === 'error')
  const warnings = problems.filter((p) => p.level === 'warning')
  const line = (p) => `${p.key || 'search-terms.json'}: ${p.message} [${p.code}]`
  for (const p of warnings) console.log(`::warning title=search-terms.json::${line(p)}`)
  for (const p of errors) console.log(`::error title=search-terms.json::${line(p)}`)
  console.log(`search-terms.json: ${errors.length} error(s), ${warnings.length} warning(s)`)
  process.exit(errors.length ? 1 : 0)
}
