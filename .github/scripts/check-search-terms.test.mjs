// Tests for check-search-terms.mjs: the vendored SDK cases, plus this repo's own search-terms.json.
// Run: node --test .github/scripts/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { normalize, validateTerms, collectFolders, checkRepo } from './check-search-terms.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..')
const cases = JSON.parse(readFileSync(join(here, 'check-search-terms.cases.json'), 'utf8'))

const shape = (p) => ({ level: p.level, code: p.code, key: p.key, ...(p.term !== undefined ? { term: p.term } : {}) })
const sorted = (list) => list.map((p) => JSON.stringify(shape(p))).sort()

for (const [input, expected] of cases.normalize) {
  test(`normalize ${JSON.stringify(input)}`, () => assert.equal(normalize(input), expected))
}

for (const c of cases.validate) {
  test(`validate: ${c.name}`, () => assert.deepEqual(sorted(validateTerms(c.terms, c.folders)), sorted(c.problems)))
}

test('folders: every meta.json folder plus "bibles", with meta id and title', () => {
  const folders = collectFolders(repo)
  const byPath = new Map(folders.map((f) => [f.path, f]))
  assert.deepEqual(byPath.get('bibles'), { path: 'bibles' })
  assert.equal(byPath.get('bibles/kjv').title, 'King James Bible')
  assert.equal(byPath.get('bibles/kjv').id, undefined)
  const oi = byPath.get('series/Narrative Journey Series/Essentials/The Open Invitation')
  assert.equal(oi.id, 'the-open-invitation')
  assert.ok(byPath.has('series/Narrative Journey Series/Foundations/L’Appel du Christ'))
  assert.ok(!folders.some((f) => f.path.startsWith('.git')))
})

test("this repo's search-terms.json has no errors", () => {
  const { problems } = checkRepo(repo)
  assert.deepEqual(problems.filter((p) => p.level === 'error'), [])
})
