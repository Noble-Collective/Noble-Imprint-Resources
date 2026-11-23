#!/usr/bin/env node
// VENDORED — do not edit. @noble-collective/userdata 0.16.4 content contract CLI (Collective-Shared 9b1dcbf, packages/userdata/dist/content/cli.cjs).
// Refresh: copy the built file again (npm run build in packages/userdata). Rules: Collective-Shared ARCHITECTURE §9h.
"use strict";

// src/content/cli.ts
var import_node_fs = require("fs");
var import_node_path = require("path");

// src/content/tree.ts
var COVER_EXTS = ["svg", "png", "jpg", "jpeg", "webp"];
var isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var base = (p) => p.slice(p.lastIndexOf("/") + 1);
var hidden = (name) => name.startsWith(".");
function readMeta(files, dir) {
  const path = `${dir}/meta.json`;
  if (!(path in files)) return { path: null, value: null, error: null };
  const text = files[path];
  if (text == null) return { path, value: null, error: "it could not be read" };
  try {
    const value = JSON.parse(text.replace(/^﻿/, ""));
    if (!isObject(value)) return { path, value: null, error: "it is not a JSON object ({ \u2026 })" };
    return { path, value, error: null };
  } catch (e) {
    return { path, value: null, error: e.message };
  }
}
function statusOf(meta) {
  const s = meta.value && meta.value.status;
  return s === "public" || s === "hidden" ? s : "unknown";
}
var str = (v) => typeof v === "string" && v.trim() ? v : null;
var int = (v) => typeof v === "number" && Number.isInteger(v) ? v : null;
var audienceOf = (m) => m.value && m.value.audience !== void 0 && m.value.audience !== null ? m.value.audience : void 0;
function sessionTitle(text) {
  if (text == null) return null;
  const body = text.replace(/^﻿/, "").replace(/<!--[\s\S]*?-->/g, "");
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = line.match(/^# +(\S.*?)\s*$/);
    return m ? m[1] : null;
  }
  return null;
}
function readTree(files) {
  const paths = Object.keys(files).sort();
  const bookDirs = /* @__PURE__ */ new Set();
  const tooDeep = /* @__PURE__ */ new Set();
  const seriesWithSessions = /* @__PURE__ */ new Set();
  const seriesNames = /* @__PURE__ */ new Set();
  for (const p of paths) {
    const parts = p.split("/");
    if (parts[0] !== "series" || parts.length < 3 || hidden(parts[1])) continue;
    seriesNames.add(parts[1]);
    const i = parts.indexOf("sessions");
    if (i < 0 || i === parts.length - 1) continue;
    if (i === 2) seriesWithSessions.add(parts.slice(0, 2).join("/"));
    else if (i === 3 || i === 4) bookDirs.add(parts.slice(0, i).join("/"));
    else if (i > 4) tooDeep.add(parts.slice(0, i).join("/"));
  }
  const collectionDirs = /* @__PURE__ */ new Set();
  for (const p of paths) {
    const parts = p.split("/");
    if (parts[0] !== "series" || parts.length < 4 || hidden(parts[1]) || hidden(parts[2]) || parts[2] === "sessions") continue;
    const dir = parts.slice(0, 3).join("/");
    if (bookDirs.has(dir)) continue;
    const holdsBook = [...bookDirs].some((b) => b.startsWith(`${dir}/`));
    if (holdsBook || p === `${dir}/meta.json`) collectionDirs.add(dir);
  }
  const metaOf = (dir) => readMeta(files, dir);
  const groupOf = (dir, kind) => {
    const meta = metaOf(dir);
    const v = meta.value || {};
    return {
      path: dir,
      kind,
      title: str(v.title) ?? base(dir),
      subtitle: str(v.subtitle),
      order: int(v.order),
      audience: audienceOf(meta) ?? null,
      meta,
      collections: [],
      books: []
    };
  };
  const series = [...seriesNames].sort().map((s) => groupOf(`series/${s}`, "series"));
  const collections = [...collectionDirs].sort().map((c) => groupOf(c, "collection"));
  const groupByPath = new Map([...series, ...collections].map((g) => [g.path, g]));
  for (const c of collections) groupByPath.get(c.path.split("/").slice(0, 2).join("/"))?.collections.push(c.path);
  const books = [...bookDirs].sort().map((dir) => {
    const parts = dir.split("/");
    const seriesPath = parts.slice(0, 2).join("/");
    const collection = parts.length === 4 ? parts.slice(0, 3).join("/") : null;
    const meta = metaOf(dir);
    const v = meta.value || {};
    const sessionPaths = paths.filter((p) => p.startsWith(`${dir}/sessions/`) && !p.slice(dir.length + 10).includes("/") && p.endsWith(".md"));
    const covers = COVER_EXTS.flatMap((e) => `${dir}/cover.${e}` in files ? [`${dir}/cover.${e}`] : []);
    const audience = audienceOf(meta) ?? (collection ? audienceOf(metaOf(collection)) : void 0) ?? audienceOf(metaOf(seriesPath)) ?? null;
    groupByPath.get(collection ?? seriesPath)?.books.push(dir);
    return {
      path: dir,
      id: str(v.id),
      title: str(v.title) ?? base(dir),
      subtitle: str(v.subtitle),
      order: int(v.order),
      status: statusOf(meta),
      audience,
      cover: covers.find((c) => !c.endsWith(".webp")) ?? null,
      series: seriesPath,
      collection,
      sessions: sessionPaths.map((p) => ({ path: p, file: base(p), title: sessionTitle(files[p]) })),
      meta
    };
  });
  const bibleNames = /* @__PURE__ */ new Set();
  for (const p of paths) {
    const parts = p.split("/");
    if (parts[0] === "bibles" && parts.length >= 3 && !hidden(parts[1])) bibleNames.add(parts[1]);
  }
  const bibles = [...bibleNames].sort().map((b) => {
    const meta = metaOf(`bibles/${b}`);
    return { path: `bibles/${b}`, title: str(meta.value?.title) ?? b, meta };
  });
  const iconFiles = paths.filter((p) => /^icons\/infographic\/[^/]+$/.test(p)).map(base);
  return {
    series,
    collections,
    books,
    bibles,
    tooDeep: [...tooDeep].sort().map((path) => ({ path, meta: metaOf(path) })),
    seriesWithSessions: [...seriesWithSessions].sort(),
    iconFiles
  };
}

// src/library-search/normalize.ts
function normalize(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

// src/library-search/validate.ts
var NODE_FIELDS = /* @__PURE__ */ new Set(["title", "id", "primary", "terms"]);
var isObject2 = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var isStringList = (v) => Array.isArray(v) && v.every((t) => typeof t === "string");
function validateTerms(terms, folders) {
  const problems = [];
  const error = (code, key, message, term) => problems.push({ level: "error", code, key, ...term !== void 0 ? { term } : {}, message });
  const warn = (code, key, message, term) => problems.push({ level: "warning", code, key, ...term !== void 0 ? { term } : {}, message });
  if (!isObject2(terms)) {
    error("bad-shape", "", "the file is not a JSON object");
    return problems;
  }
  if (terms.version !== 1) error("bad-shape", "", `"version" must be 1 (found ${JSON.stringify(terms.version)})`);
  for (const k of Object.keys(terms)) {
    if (!k.startsWith("_") && k !== "version" && k !== "nodes") error("bad-shape", "", `unknown top-level field "${k}"`);
  }
  if (!isObject2(terms.nodes)) {
    error("bad-shape", "", '"nodes" must be an object of folder path \u2192 node');
    return problems;
  }
  const nodes = terms.nodes;
  const good = /* @__PURE__ */ new Map();
  for (const [key, node] of Object.entries(nodes)) {
    if (key.startsWith("_")) continue;
    if (!isObject2(node)) {
      error("bad-shape", key, "a node must be an object");
      continue;
    }
    let ok = true;
    for (const f of Object.keys(node)) {
      if (!f.startsWith("_") && !NODE_FIELDS.has(f)) {
        error("bad-shape", key, `unknown field "${f}"`);
        ok = false;
      }
    }
    if (typeof node.title !== "string" || !node.title.trim()) {
      error("bad-shape", key, '"title" must be a non-empty string');
      ok = false;
    }
    if (node.id !== void 0 && typeof node.id !== "string") {
      error("bad-shape", key, '"id" must be a string');
      ok = false;
    }
    for (const list of ["primary", "terms"]) {
      if (!isStringList(node[list])) {
        error("bad-shape", key, `"${list}" must be a list of strings`);
        ok = false;
        continue;
      }
      for (const t of node[list]) {
        if (!normalize(t)) {
          error("bad-shape", key, `"${t}" has no letters or digits`, t);
          ok = false;
        }
      }
    }
    if (ok) good.set(key, node);
  }
  const byPath = new Map(folders.map((f) => [f.path, f]));
  const normSets = /* @__PURE__ */ new Map();
  for (const [key, node] of good) normSets.set(key, new Set([...node.primary, ...node.terms].map(normalize)));
  for (const [key, node] of good) {
    const folder = byPath.get(key);
    if (!folder) error("missing-folder", key, `no folder "${key}" in the content repo`);
    else {
      if (node.id !== void 0 && node.id !== folder.id) {
        error("id-mismatch", key, `id "${node.id}" but meta.json says ${folder.id ? `"${folder.id}"` : "no id"}`);
      }
      if (folder.title !== void 0 && node.title !== folder.title) {
        warn("title-mismatch", key, `title "${node.title}" but meta.json says "${folder.title}"`);
      }
    }
    if (node.primary.length < 3 || node.primary.length > 5) {
      warn("primary-count", key, `${node.primary.length} primary terms (3\u20135 expected)`);
    }
    const all = [...node.primary, ...node.terms];
    const raw = /* @__PURE__ */ new Set();
    const rawReported = /* @__PURE__ */ new Set();
    const norm = /* @__PURE__ */ new Map();
    const normReported = /* @__PURE__ */ new Set();
    for (const t of all) {
      const r = t.trim().toLowerCase();
      const n = normalize(t);
      if (raw.has(r)) {
        if (!rawReported.has(r)) error("duplicate", key, `"${t.trim()}" is listed twice`, r);
        rawReported.add(r);
      } else if (norm.has(n)) {
        if (!normReported.has(n)) warn("duplicate-normalized", key, `"${norm.get(n)}" and "${t}" search the same`, n);
        normReported.add(n);
      }
      raw.add(r);
      if (!norm.has(n)) norm.set(n, t);
    }
    const fromAbove = /* @__PURE__ */ new Map();
    for (const [k, set] of normSets) {
      if (key.startsWith(k + "/")) {
        for (const n of set) if (!fromAbove.has(n)) fromAbove.set(n, k);
      }
    }
    for (const n of normSets.get(key)) {
      if (fromAbove.has(n)) warn("repeats-ancestor", key, `"${n}" already comes from "${fromAbove.get(n)}"`, n);
    }
  }
  for (const f of folders) {
    if (f.id && !(f.path in nodes)) warn("no-terms", f.path, `book "${f.id}" has no search terms`);
  }
  return problems;
}

// src/membership/audience.ts
var AUDIENCES = ["everyone", "signed_in", "members", "member_churches"];
var AUDIENCE_LIST_ENTRIES = ["signed_in", "members", "member_churches"];
function isOrgs(value) {
  return !!value && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.orgs) && value.orgs.every((o) => typeof o === "string");
}
function isEntry(value) {
  if (typeof value === "string") return AUDIENCE_LIST_ENTRIES.includes(value);
  return isOrgs(value);
}
function isAudience(value) {
  if (Array.isArray(value)) {
    return value.length > 0 && value.every(isEntry) && value.filter((e) => typeof e === "object").length <= 1;
  }
  if (typeof value === "string") return AUDIENCES.includes(value);
  return isOrgs(value);
}

// src/content/tags.json
var tags_default = {
  _about: [
    "The known-tag registry of the content contract (plans/2026-11-21-content-contract.md \xA73a, ARCHITECTURE \xA79h).",
    "A tag is known only when EVERY product that shows the book renders it (website, Institute, app). Products and the",
    "audiobook pipeline read their tag lists from here: add a tag here (with a case in test/content.cases.json) and in",
    "every product before content may use it. Strictest rule wins: where one product is stricter, everyone follows it.",
    "Fields: attributes {name: {required?, values?, flag?}}; oneLine = opens and closes on one line; ownLine = the tag",
    "is alone on its line; content = 'digits' when only digits may sit inside; parent = must sit inside that tag;",
    "selfClosing = written <Tag \u2026 />; void = no closing tag (HTML); name = the rest of the tag is a free-form name",
    "(not attributes) that must not be empty, e.g. <image life spheres> = the picture sessions/images/life spheres.*."
  ],
  version: 1,
  tags: {
    Question: { attributes: { id: { required: true } }, oneLine: true },
    Accent: { attributes: {} },
    Callout: { attributes: {}, oneLine: true },
    ChapterNum: { attributes: {}, oneLine: true, content: "digits" },
    Bibliography: { attributes: {}, ownLine: true },
    Infographic: {
      attributes: { title: {}, type: { values: ["menu", "sequence", "timeline"] } },
      startsLine: true
    },
    Item: {
      attributes: { label: { required: true }, icon: {}, active: { flag: true } },
      parent: "Infographic"
    },
    PracticeSummary: { attributes: { label: { required: true } }, ownLine: true, selfClosing: true },
    br: { attributes: {}, void: true },
    sup: { attributes: {} },
    image: { attributes: {}, name: true, ownLine: true, void: true }
  },
  timeline: { minItems: 2, maxItems: 8 },
  include: {
    keyPattern: "^[A-Za-z][A-Za-z0-9_]*$",
    parameters: ["id", "bold", "active"],
    commonFiles: { series: "commonSeries.md", collection: "commonSubseries.md", book: "commonBook.md" }
  }
};

// src/content/check.ts
var TAGS = tags_default;
var KEY_RE = new RegExp(TAGS.include.keyPattern);
var ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
var HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
var BANNERS = ["Pre-Release", "Preview"];
var LANGUAGES = ["en", "fr"];
var COLOR_KEYS = ["#", "##", "###", "####", "#####", "######"];
var BOOK_FIELDS = ["id", "title", "subtitle", "order", "status", "banner", "language", "color", "maxNavHeadingLevel", "accent", "author", "audiobook", "sessionNumbers", "audience", "audienceDisplay"];
var GROUP_FIELDS = ["title", "subtitle", "order", "audience", "audienceDisplay"];
var DISPLAYS = ["locked", "hidden"];
var IMAGE_EXTS = ["webp", "png", "jpg", "jpeg", "svg"];
var ICONS_DIR = "icons/infographic";
var ICON_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
var isObject3 = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var q = (v) => JSON.stringify(v);
var suggestId = (name) => name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "book-id";
var sevOf = (status) => status === "hidden" ? "warning" : "error";
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function nearest(word, options) {
  let best = null;
  let bestD = Infinity;
  for (const o of options) {
    const dd = distance(word.toLowerCase(), o.toLowerCase());
    if (dd < bestD) [best, bestD] = [o, dd];
  }
  return best !== null && bestD <= Math.max(2, Math.floor(word.length / 3)) ? best : null;
}
var blankComments = (text) => text.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, " "));
var lineAt = (text, index) => text.slice(0, index).split("\n").length;
function parseBlocks(text, file, level) {
  const out = [];
  const re = /<([A-Za-z][A-Za-z0-9_-]*)>\r?\n([\s\S]*?)\r?\n<\/\1>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ name: m[1], body: m[2], file, level, line: lineAt(text, m.index) + 1 });
  }
  return out;
}
function infographicItems(text) {
  const out = [];
  for (const g of text.matchAll(/<Infographic\b[^>]*>([\s\S]*?)<\/Infographic>/g)) {
    for (const it of g[1].matchAll(/<Item\b([^>]*)>([\s\S]*?)<\/Item>/g)) {
      const lm = it[1].match(/\blabel="([^"]*)"/);
      if (lm) out.push({ label: lm[1], body: it[2].trim() });
    }
  }
  return out;
}
var AB_FIELDS = {
  enabled: "boolean",
  language_normalization: "boolean",
  request_stitching: "boolean",
  chunking_strategy: "strategy",
  voice_id: "string",
  model_id: "string",
  spell_numbers: "boolean",
  clean_terminal_punctuation: "boolean",
  chapter_end_pause: "boolean",
  quality_preset: "string",
  voice_settings: "settings",
  books: "books",
  profiles: "profiles",
  project_id: "string?",
  pronunciation_dictionary_id: "string?",
  max_generation: "number",
  skip_sessions: "array",
  pause_style: "string",
  natural_mode: "boolean"
};
var LEGACY_SESSION_RE = /^session\d+\.md$/;
var isPrintOnlyBlock = (name) => /^Cover[A-Z]/.test(name) || name === "SeriesAuthor" || name === "AuthorBio";
var isTestBook = (book) => !!book && book.slice(book.lastIndexOf("/") + 1) === "Test Book";
function check(files) {
  const tree = readTree(files);
  const out = [];
  const add = (rule, severity, path, book, message, fix, line) => {
    if (severity === "warning" && isTestBook(book)) return;
    out.push({ rule, severity, path, book, message, fix, ...line ? { line } : {} });
  };
  const bookByPath = new Map(tree.books.map((b) => [b.path, b]));
  const scopeSev = (dir) => tree.books.some((b) => (b.path === dir || b.path.startsWith(`${dir}/`)) && b.status !== "hidden") ? "error" : "warning";
  const text = (p) => files[p] ?? "";
  for (const p of Object.keys(files).sort()) {
    const name = p.slice(p.lastIndexOf("/") + 1);
    if (name === ".DS_Store" || name === "Thumbs.db" || name.startsWith("~$") || name.endsWith(".tmp") || /~$/.test(name)) {
      add("R16", "warning", p, null, `${p} is a system or temporary file, not content.`, "Delete it from the repository (it was committed by accident).");
    }
  }
  for (const s of tree.seriesWithSessions) {
    add("R1", "error", `${s}/sessions`, null, `${s} has a sessions folder directly inside the series.`, "Sessions belong in a book folder: series \u2192 (collection) \u2192 book \u2192 sessions.");
  }
  for (const d of tree.tooDeep) {
    const status = d.meta.value?.status === "hidden" ? "hidden" : "public";
    add("R1", sevOf(status), d.path, d.path, `${d.path} is a book nested too deep: books sit in a series or in one collection of a series.`, "Move the book folder up to series/<Series>/<Book> or series/<Series>/<Collection>/<Book>.");
  }
  const groupChecks = (g) => {
    const sev = scopeSev(g.path);
    const where = g.meta.path ?? g.path;
    if (!g.meta.path) {
      add("R4", sev, g.path, null, `The ${g.kind} folder ${g.path} has no meta.json.`, `Add ${g.path}/meta.json with "title" and "order" (a whole number); "subtitle" is optional.`);
    } else if (g.meta.error) {
      add("R2", sev, g.meta.path, null, `${g.meta.path} is not valid JSON (${g.meta.error}).`, "Fix the JSON: quotes around every name and text, commas between fields, none after the last.");
    } else {
      const v = g.meta.value;
      for (const f of ["title"]) {
        if (typeof v[f] !== "string" || !v[f].trim()) add("R4", sev, where, null, `${where} has no "${f}".`, `Add "${f}": "\u2026" to ${where}.`);
      }
      if (!Number.isInteger(v.order)) add("R4", sev, where, null, `${where} has no whole-number "order" (found ${q(v.order)}).`, 'Set "order" to a whole number, e.g. "order": 1 (no quotes).');
      for (const f of Object.keys(v)) {
        if (!GROUP_FIELDS.includes(f) && !f.startsWith("_")) {
          const n = nearest(f, GROUP_FIELDS);
          add("R4", "warning", where, null, `${where} has a field no product reads: "${f}".`, n ? `Did you mean "${n}"? Otherwise remove it.` : "Remove it, or ask for it to be added to the contract.");
        }
      }
      audienceChecks(v, where, null, sev);
    }
  };
  function audienceChecks(v, where, book, sev) {
    if ("audience" in v && !isAudience(v.audience)) {
      add("R5", sev, where, book, `${where} has "audience": ${q(v.audience)}, which no product understands.`, 'Use "everyone", "signed_in", "members", "member_churches", {"orgs": ["<organization id>"]} or a list of those \u2014 or leave it out (= everyone).');
    }
    if ("audienceDisplay" in v && !DISPLAYS.includes(v.audienceDisplay)) {
      add("R5", sev, where, book, `${where} has "audienceDisplay": ${q(v.audienceDisplay)}.`, 'Use "locked" or "hidden" \u2014 or leave it out (= locked).');
    }
  }
  for (const g of [...tree.series, ...tree.collections]) groupChecks(g);
  const ids = /* @__PURE__ */ new Map();
  for (const b of tree.books) {
    const sev = sevOf(b.status);
    if (!b.meta.path) {
      add("R1", "error", b.path, b.path, `"${b.title}" (${b.path}) has session files but no meta.json, so nobody can tell whether it should be public.`, `Add ${b.path}/meta.json with "status": "hidden" while it's a draft \u2014 or an "id", "title", "order", "status": "public" and a cover to publish it.`);
    } else if (b.meta.error) {
      add("R2", "error", b.meta.path, b.path, `${b.meta.path} is not valid JSON (${b.meta.error}), so nobody can tell whether "${b.title}" should be public.`, "Fix the JSON: quotes around every name and text, commas between fields, none after the last.");
    } else {
      bookMetaChecks(b, sev);
    }
    if (b.sessions.length === 0) {
      add("R1", sev, b.path, b.path, `"${b.title}" (${b.path}) has a sessions folder with no session (.md) files.`, "Add its sessions, or remove the folder if the book was dropped.");
    }
    if (b.meta.value) coverChecks(b, sev);
    for (const s of b.sessions) {
      if (!s.title) add("R7", sev, s.path, b.path, `${s.path} doesn't start with a "# Title" line.`, 'Make the first line of the session "# " followed by its title.');
      if (!/^\d+-.+\.md$/.test(s.file) && !LEGACY_SESSION_RE.test(s.file)) add("R7", "warning", s.path, b.path, `The session file name ${s.file} isn't "NN-Name.md".`, 'Leave existing files as they are; name new sessions like "01-Opening.md".');
    }
  }
  function bookMetaChecks(b, sev) {
    const where = b.meta.path;
    const v = b.meta.value;
    if (!("status" in v)) add("R3", "error", where, b.path, `${where} has no "status", so nobody can tell whether "${b.title}" should be public.`, `Add "status": "hidden" while it's a draft, or "status": "public" to publish it.`);
    else if (b.status === "unknown") add("R3", "error", where, b.path, `${where} has "status": ${q(v.status)}.`, 'Use "public" or "hidden" (lowercase).');
    if (v.id == null) {
      add("R3", sev, where, b.path, `"${b.title}" (${where}) has no "id".`, `Add one, e.g. "id": "${suggestId(typeof v.title === "string" ? v.title : b.path.split("/").pop())}" \u2014 lowercase letters, digits and hyphens, never changed once published.`);
    } else if (typeof v.id !== "string" || !ID_RE.test(v.id)) {
      add("R3", sev, where, b.path, `${where} has a malformed "id": ${q(v.id)}.`, `Use lowercase letters, digits and hyphens, e.g. "${suggestId(String(v.id))}".`);
    } else if (ids.has(v.id)) {
      add("R3", sev, where, b.path, `Duplicate "id" "${v.id}" in ${ids.get(v.id)} and ${where}.`, "Every book needs its own id; change the newer one.");
    } else ids.set(v.id, where);
    for (const f of ["title"]) {
      if (typeof v[f] !== "string" || !v[f].trim()) add("R3", sev, where, b.path, `${where} has no "${f}".`, `Add "${f}": "\u2026".`);
    }
    if (!Number.isInteger(v.order)) add("R3", sev, where, b.path, `${where} has no whole-number "order" (found ${q(v.order)}).`, 'Set "order" to a whole number, e.g. "order": 1 (no quotes).');
    if ("banner" in v && !BANNERS.includes(v.banner)) add("R3", sev, where, b.path, `${where} has "banner": ${q(v.banner)}.`, `Use ${BANNERS.map(q).join(" or ")}, or leave it out.`);
    if ("language" in v && !LANGUAGES.includes(v.language)) add("R3", sev, where, b.path, `${where} has "language": ${q(v.language)}.`, `Use ${LANGUAGES.map(q).join(" or ")}.`);
    if ("maxNavHeadingLevel" in v && v.maxNavHeadingLevel !== 2 && v.maxNavHeadingLevel !== 3) add("R3", sev, where, b.path, `${where} has "maxNavHeadingLevel": ${q(v.maxNavHeadingLevel)}.`, "Use 2 or 3 (no quotes).");
    if ("accent" in v && !(typeof v.accent === "string" && HEX_RE.test(v.accent))) add("R3", sev, where, b.path, `${where} has "accent": ${q(v.accent)}, which isn't a colour code.`, 'Use a hex colour like "#25a9ad".');
    if ("author" in v && typeof v.author !== "string") add("R3", sev, where, b.path, `${where} has "author": ${q(v.author)}.`, "Use text in quotes.");
    if ("color" in v) {
      if (!isObject3(v.color)) add("R3", sev, where, b.path, `${where} has "color": ${q(v.color)}.`, 'Use an object of heading level \u2192 colour, e.g. {"##": "#25a9ad"}.');
      else
        for (const [k, c] of Object.entries(v.color)) {
          if (!COLOR_KEYS.includes(k)) add("R3", sev, where, b.path, `${where} has a heading colour for "${k}", which isn't a heading level.`, 'Use "#" to "######" (one to six #).');
          else if (!(typeof c === "string" && HEX_RE.test(c))) add("R3", sev, where, b.path, `${where} has the colour ${q(c)} for "${k}".`, 'Use a hex colour like "#25a9ad".');
        }
    }
    if ("sessionNumbers" in v) {
      if (!isObject3(v.sessionNumbers)) add("R7", sev, where, b.path, `${where} has "sessionNumbers": ${q(v.sessionNumbers)}.`, "Use an object of session file name \u2192 number.");
      else
        for (const [file, n] of Object.entries(v.sessionNumbers)) {
          if (!b.sessions.some((s) => s.file === file)) add("R7", sev, where, b.path, `${where} numbers the session "${file}", which isn't in ${b.path}/sessions.`, "Use the session's current file name, or remove the entry.");
          else if (!Number.isInteger(n)) add("R7", sev, where, b.path, `${where} gives "${file}" the number ${q(n)}.`, "Use a whole number (no quotes).");
        }
    }
    for (const f of Object.keys(v)) {
      if (!BOOK_FIELDS.includes(f) && !f.startsWith("_")) {
        const n = nearest(f, BOOK_FIELDS);
        add("R3", "warning", where, b.path, `${where} has a field no product reads: "${f}".`, n ? `Did you mean "${n}"? Otherwise remove it.` : "Remove it, or ask for it to be added to the contract.");
      }
    }
    audienceChecks(v, where, b.path, sev);
    if ("audiobook" in v) audiobookChecks(v.audiobook, where, b.path, sev);
  }
  function coverChecks(b, sev) {
    const covers = COVER_EXTS.flatMap((e) => `${b.path}/cover.${e}` in files ? [`${b.path}/cover.${e}`] : []);
    const webp = covers.filter((c) => c.endsWith(".webp"));
    const good = covers.filter((c) => !c.endsWith(".webp"));
    for (const w of webp) add("R6", sev, w, b.path, `${w}: the app can't show .webp covers.`, "Save the cover as cover.svg, cover.png or cover.jpg instead and delete the .webp.");
    if (good.length === 0 && webp.length === 0) add("R6", sev, b.path, b.path, `"${b.title}" (${b.path}) has no cover.`, `Add ${b.path}/cover.svg (or .png / .jpg).`);
    if (good.length > 1) add("R6", sev, b.path, b.path, `"${b.title}" has ${good.length} covers (${good.map((c) => c.split("/").pop()).join(", ")}).`, "Keep one cover file and delete the others.");
  }
  function audiobookChecks(ab, where, book, sev) {
    const bad = (message, fix) => add("R14", sev, where, book, message, fix);
    if (!isObject3(ab)) return bad(`${where} has "audiobook": ${q(ab)}.`, "Use an object of audiobook settings, or leave it out.");
    const fields = (o, at, allowed) => {
      for (const [k, val] of Object.entries(o)) {
        const type = allowed[k];
        if (!type) {
          const n = nearest(k, Object.keys(allowed));
          bad(`${where} has an audiobook setting no part of the pipeline reads: "${k}"${at}.`, n ? `Did you mean "${n}"? Otherwise remove it.` : "Remove it.");
          continue;
        }
        const ok = type === "boolean" ? typeof val === "boolean" : type === "string" ? typeof val === "string" : type === "string?" ? val === null || typeof val === "string" : type === "number" ? typeof val === "number" : type === "array" ? Array.isArray(val) : type === "strategy" ? val === "linear" || val === "section" : type === "settings" ? isObject3(val) && Object.values(val).every((x) => typeof x === "number" || typeof x === "boolean") : isObject3(val);
        if (!ok) {
          const want = type === "strategy" ? '"linear" or "section"' : type === "settings" ? "an object of numbers" : type === "string?" ? "text or null" : type === "books" || type === "profiles" ? "an object" : `a ${type}`;
          bad(`${where} has the audiobook setting "${k}": ${q(val)}${at}.`, `Use ${want}.`);
        }
      }
    };
    fields(ab, "", AB_FIELDS);
    const profiles = isObject3(ab.profiles) ? ab.profiles : {};
    const { books: _b, profiles: _p, ...profileFields } = AB_FIELDS;
    for (const [name, p] of Object.entries(profiles)) if (isObject3(p)) fields(p, ` (profile "${name}")`, profileFields);
    if (isObject3(ab.books)) {
      for (const [code, entry] of Object.entries(ab.books)) {
        if (!isObject3(entry)) {
          bad(`${where}: audiobook book "${code}" is ${q(entry)}.`, 'Use an object, e.g. {"enabled": true}.');
          continue;
        }
        if ("enabled" in entry && typeof entry.enabled !== "boolean") bad(`${where}: audiobook book "${code}" has "enabled": ${q(entry.enabled)}.`, "Use true or false.");
        if ("profile" in entry && !(typeof entry.profile === "string" && entry.profile in profiles)) {
          bad(`${where}: audiobook book "${code}" names the profile ${q(entry.profile)}, which isn't defined in "profiles".`, `Use one of ${Object.keys(profiles).map(q).join(", ") || "(none defined)"} or define it under "profiles".`);
        }
      }
    }
  }
  const fileNames = TAGS.include.commonFiles;
  const blocksByFile = /* @__PURE__ */ new Map();
  const loadBlocks = (path, level) => {
    if (!(path in files)) return [];
    if (!blocksByFile.has(path)) blocksByFile.set(path, parseBlocks(text(path), path, level));
    return blocksByFile.get(path);
  };
  for (const s of tree.series) loadBlocks(`${s.path}/${fileNames.series}`, "series");
  for (const c of tree.collections) loadBlocks(`${c.path}/${fileNames.collection}`, "collection");
  for (const b of tree.books) loadBlocks(`${b.path}/${fileNames.book}`, "book");
  for (const [file, blocks] of blocksByFile) {
    const dir = file.slice(0, file.lastIndexOf("/"));
    const sev = scopeSev(dir);
    const seen = /* @__PURE__ */ new Set();
    for (const blk of blocks) {
      if (!KEY_RE.test(blk.name)) add("R8", sev, file, null, `The shared block <${blk.name}> in ${file} (line ${blk.line - 1}) has a name the app can't read (only letters, digits and _).`, `Rename it to "${blk.name.replace(/[^A-Za-z0-9_]/g, "_")}" here and in every @include of it.`, blk.line - 1);
      if (seen.has(blk.name)) add("R8", "warning", file, null, `${file} defines the shared block <${blk.name}> twice; only the last one is used.`, "Delete or rename one of them.", blk.line - 1);
      seen.add(blk.name);
    }
  }
  const blocksAt = (seriesPath, collection, book) => {
    const map = /* @__PURE__ */ new Map();
    const lay = (path, level) => {
      for (const blk of loadBlocks(path, level)) if (KEY_RE.test(blk.name)) map.set(blk.name, blk);
    };
    lay(`${seriesPath}/${fileNames.series}`, "series");
    if (collection) lay(`${collection}/${fileNames.collection}`, "collection");
    if (book) lay(`${book}/${fileNames.book}`, "book");
    return map;
  };
  for (const c of tree.collections) {
    const file = `${c.path}/${fileNames.collection}`;
    const seriesNames = new Set(loadBlocks(`${c.path.split("/").slice(0, 2).join("/")}/${fileNames.series}`, "series").map((b) => b.name));
    for (const blk of loadBlocks(file, "collection")) {
      if (seriesNames.has(blk.name)) add("R8", "warning", file, null, `The shared block <${blk.name}> is defined in ${file} and again in the series' ${fileNames.series}.`, "Keep one definition (the collection one replaces the series one for every book in the collection).", blk.line - 1);
    }
  }
  const usedBlocks = /* @__PURE__ */ new Set();
  const usedIcons = /* @__PURE__ */ new Map();
  for (const b of tree.books) {
    const sev = sevOf(b.status);
    const blocks = blocksAt(b.series, b.collection, b.path);
    const questionIds = /* @__PURE__ */ new Map();
    for (const s of b.sessions) {
      const raw = text(s.path);
      const resolved = raw.replace(/<!--\s*@include:\s*([A-Za-z][A-Za-z0-9_-]*)\s*(.*?)\s*-->/g, (full, key, params, at) => {
        const line = lineAt(raw, at);
        const err = (message, fix) => {
          add("R8", sev, s.path, b.path, message, fix, line);
          return "";
        };
        usedBlocks.add(key);
        if (!KEY_RE.test(key)) return err(`${s.path} line ${line} includes "${key}": include names can only have letters, digits and _ (the app can't read "-").`, `Rename the block and this include to "${key.replace(/[^A-Za-z0-9_]/g, "_")}".`);
        const blk = blocks.get(key);
        if (!blk) {
          const n = nearest(key, [...blocks.keys()]);
          return err(`${s.path} line ${line} includes "${key}", but no shared block has that name for this book.`, n ? `Did you mean "${n}"? Otherwise define <${key}> in ${fileNames.series}, ${fileNames.collection} or ${fileNames.book}.` : `Define <${key}> in ${fileNames.series}, ${fileNames.collection} or ${fileNames.book}, or fix the name.`);
        }
        const p = {};
        for (const m of params.matchAll(/(\w+)="([^"]*)"/g)) p[m[1]] = m[2];
        for (const name of Object.keys(p)) {
          if (!TAGS.include.parameters.includes(name)) err(`${s.path} line ${line}: the include of "${key}" has an unknown setting ${name}="\u2026".`, `Use only ${TAGS.include.parameters.map((x) => `${x}="\u2026"`).join(", ")}.`);
        }
        let body = blk.body;
        if (body.includes("{id}")) {
          if (!p.id) return err(`${s.path} line ${line} includes "${key}" without id="\u2026", but the block needs one ({id}).`, `Add id="\u2026" with a short unique name, e.g. <!-- @include: ${key} id="${suggestId(s.file.replace(/\.md$/, ""))}" -->.`);
          body = body.split("{id}").join(p.id);
        }
        if (p.bold !== void 0 && !boldMatches(body, p.bold)) err(`${s.path} line ${line}: bold="${p.bold}" matches no line of the shared block "${key}".`, "Copy the exact text of the line(s) to bold from the block.");
        if (p.active !== void 0 && !infographicItems(body).some((i) => i.label === p.active) && !new RegExp(`<Item\\b[^>]*label="${escapeRe(p.active)}"`).test(body)) {
          err(`${s.path} line ${line}: active="${p.active}" matches no <Item label> in the shared block "${key}".`, `Use one of its labels: ${infographicItems(body).map((i) => q(i.label)).join(", ") || "(none)"}.`);
        }
        return body;
      });
      for (const m of resolved.matchAll(/<Question\s+id="?([^">]+)"?\s*>/gi)) {
        const id = m[1];
        if (questionIds.has(id)) add("R9", sev, s.path, b.path, `The question id "${id}" in ${s.path} is already used in ${questionIds.get(id)}.`, 'Give every question in the book its own id (for a shared block, a different id="\u2026" on each include).');
        else questionIds.set(id, s.path);
      }
      const plain = blankComments(raw);
      const images = [];
      for (const m of plain.matchAll(/!\[[^\]\n]*\]\(/g)) {
        const from = m.index + m[0].length;
        const close = plain.indexOf(")", from);
        const quote = plain.indexOf(' "', from);
        const end = quote >= 0 && (close < 0 || quote < close) ? quote : close;
        if (end < 0) continue;
        images.push({ name: plain.slice(from, end).trim().replace(/^<|>$/g, ""), at: m.index });
      }
      for (const m of plain.matchAll(/^<image\s+(.+?)>\s*$/gm)) images.push({ name: m[1].trim(), at: m.index });
      for (const im of images) {
        if (!im.name || /^[a-z][a-z0-9+.-]*:/i.test(im.name) || im.name.startsWith("//") || im.name.startsWith("#")) continue;
        const at = `${b.path}/sessions/images/${im.name}`;
        const hasExt = /\.[A-Za-z0-9]{2,4}$/.test(im.name);
        const found = hasExt ? at in files : IMAGE_EXTS.some((e) => `${at}.${e}` in files);
        if (!found) add("R10", sev, s.path, b.path, `${s.path} line ${lineAt(plain, im.at)} shows the picture "${im.name}", but ${b.path}/sessions/images/ has no such file.`, hasExt ? `Add ${at}, or fix the name.` : `Add ${at}.png (or .jpg / .svg / .webp), or fix the name.`, lineAt(plain, im.at));
      }
      scanTags(plain, s.path, b.path, sev, blocks);
    }
  }
  for (const [file, blocks] of blocksByFile) {
    const dir = file.slice(0, file.lastIndexOf("/"));
    const parts = dir.split("/");
    const book = bookByPath.get(dir);
    const level = blocks[0]?.level;
    const visible = level === "series" ? blocksAt(dir, null, null) : level === "collection" ? blocksAt(parts.slice(0, 2).join("/"), dir, null) : book ? blocksAt(book.series, book.collection, book.path) : /* @__PURE__ */ new Map();
    for (const blk of blocks) scanTags(blankComments(blk.body), file, book ? book.path : null, scopeSev(dir), visible, blk.line - 1);
    for (const blk of blocks) {
      if (!usedBlocks.has(blk.name) && !isPrintOnlyBlock(blk.name)) add("R8", "warning", file, null, `The shared block <${blk.name}> in ${file} isn't included by any session.`, `Include it where it belongs (<!-- @include: ${blk.name} -->), or delete it.`, blk.line - 1);
    }
  }
  function scanTags(t, file, book, sev, blocks, lineOffset = 0) {
    const unknown = /* @__PURE__ */ new Map();
    const lines = t.split("\n");
    const stack = [];
    const err = (rule, message, fix, line) => add(rule, sev, file, book, message, fix, line);
    let svgDepth = 0;
    for (const m of t.matchAll(/<(\/?)([A-Za-z][A-Za-z0-9_.:@-]*)([^<>\n]*?)(\/?)>/g)) {
      const full = m[0];
      if (/^<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*>$/.test(full) || /^<[^\s<>@]+@[^\s<>]+>$/.test(full)) continue;
      const [, closing, name, attrStr, selfClose] = m;
      if (name === "svg" && !selfClose) svgDepth += closing ? -1 : 1;
      if (svgDepth > 0 && name !== "svg") continue;
      if (svgDepth < 0) svgDepth = 0;
      const line = lineAt(t, m.index) + lineOffset;
      const lineText = lines[lineAt(t, m.index) - 1];
      const rest = t.slice(m.index + full.length, t.indexOf("\n", m.index) < 0 ? t.length : t.indexOf("\n", m.index));
      const spec = TAGS.tags[name];
      if (!spec || name.includes(".")) {
        const u = unknown.get(name) || { line, count: 0, webAddress: name.includes(".") };
        u.count++;
        unknown.set(name, u);
        continue;
      }
      if (closing) {
        if (name === "Infographic") {
          const g = stack.pop();
          if (g && g.type === "timeline") {
            const { minItems, maxItems } = TAGS.timeline;
            if (g.items.length < minItems || g.items.length > maxItems) err("R12", `The timeline infographic at ${file} line ${g.line} has ${g.items.length} item(s); a timeline needs ${minItems} to ${maxItems}.`, `Give it ${minItems}\u2013${maxItems} <Item>s, or use type="menu".`, g.line);
            for (const it of g.items) if (!it.icon) err("R12", `The timeline item "${it.label ?? "?"}" at ${file} (from line ${g.line}) has no icon; every stop on a timeline needs one.`, 'Add icon="\u2026" with the name of a drawing in icons/infographic/.', g.line);
          }
        }
        continue;
      }
      if (spec.name && !attrStr.trim()) err("R12", `<${name}> at ${file} line ${line} names no picture.`, `Write the picture's file name in the tag, e.g. <${name} life spheres> for sessions/images/life spheres.png.`, line);
      const attrs = {};
      if (!spec.name) for (const a of attrStr.replace(/\/\s*$/, "").matchAll(/([A-Za-z_][\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+)))?/g)) {
        attrs[a[1]] = a[2] ?? a[3] ?? a[4] ?? true;
      }
      const known = Object.keys(spec.attributes);
      for (const a of Object.keys(attrs)) {
        if (!(a in spec.attributes)) {
          const n = nearest(a, known);
          err("R12", `<${name}> at ${file} line ${line} has the setting "${a}", which no product reads.`, n ? `Did you mean ${n}="\u2026"? <${name}> takes ${known.map((k) => `${k}`).join(", ") || "no settings"}.` : `<${name}> takes ${known.join(", ") || "no settings"}.`, line);
        }
      }
      for (const [a, rule] of Object.entries(spec.attributes)) {
        if (rule.required && (attrs[a] === void 0 || attrs[a] === true || attrs[a] === "")) {
          if (name === "Question") err("R9", `A question at ${file} line ${line} has no id.`, 'Add id="\u2026" with a short name unique in the book, e.g. <Question id="s1-q1">.', line);
          else err("R12", `<${name}> at ${file} line ${line} has no ${a}="\u2026".`, `Add ${a}="\u2026".`, line);
        }
        if (rule.values && typeof attrs[a] === "string" && !rule.values.includes(attrs[a])) {
          err("R12", `<${name}> at ${file} line ${line} has ${a}="${attrs[a]}".`, `Use ${rule.values.map((x) => `${a}="${x}"`).join(", ")}.`, line);
        }
      }
      if (spec.oneLine && !rest.includes(`</${name}>`)) {
        if (name === "Question") err("R9", `The question at ${file} line ${line} doesn't end on the same line (</Question>).`, "Keep each <Question \u2026>\u2026</Question> on one line; the app reads one line.", line);
        else err("R12", `<${name}> at ${file} line ${line} doesn't close on the same line.`, `Keep <${name}>\u2026</${name}> on one line (the app reads one line).`, line);
      }
      if (spec.content === "digits") {
        const inner = rest.slice(0, rest.indexOf(`</${name}>`) < 0 ? 0 : rest.indexOf(`</${name}>`));
        if (rest.includes(`</${name}>`) && !/^\d+$/.test(inner)) err("R12", `<${name}> at ${file} line ${line} holds "${inner}"; it can only hold digits.`, `Write the number in digits, e.g. <${name}>12</${name}>.`, line);
      }
      if (spec.ownLine && lineText.trim() !== full.trim()) err("R12", `<${name}> at ${file} line ${line} must be alone on its line.`, `Put ${full} on a line by itself.`, line);
      if (spec.startsLine && !lineText.trimStart().startsWith(`<${name}`)) err("R12", `<${name}> at ${file} line ${line} must start its line.`, `Start a new line with <${name} \u2026>.`, line);
      if (spec.selfClosing && !selfClose) err("R12", `<${name}> at ${file} line ${line} must be written <${name} \u2026 />.`, `End it with " />".`, line);
      if (name === "Bibliography" && !t.slice(m.index).includes("</Bibliography>")) err("R12", `<Bibliography> at ${file} line ${line} is never closed.`, "Add </Bibliography> on its own line after the entries.", line);
      if (name === "Infographic") stack.push({ type: typeof attrs.type === "string" ? attrs.type : void 0, items: [], line });
      if (spec.parent) {
        const parent = stack[stack.length - 1];
        if (!parent) err("R12", `<${name}> at ${file} line ${line} isn't inside an <${spec.parent}>.`, `Move it between <${spec.parent} \u2026> and </${spec.parent}>.`, line);
        else parent.items.push({ label: typeof attrs.label === "string" ? attrs.label : void 0, icon: typeof attrs.icon === "string" ? attrs.icon : void 0 });
      }
      if (name === "Item" && typeof attrs.icon === "string" && attrs.icon && !attrs.icon.includes("{")) {
        const list = usedIcons.get(attrs.icon) || [];
        if (!list.some((u) => u.file === file)) list.push({ file, book, sev });
        usedIcons.set(attrs.icon, list);
      }
      if (name === "PracticeSummary" && typeof attrs.label === "string") {
        const hits = [...blocks.values()].flatMap((blk) => infographicItems(blk.body)).filter((i) => i.label === attrs.label);
        if (hits.length === 0) err("R12", `<PracticeSummary label="${attrs.label}"> at ${file} line ${line} matches no practice: no <Item label="${attrs.label}"> in a shared infographic this book can include.`, "Use the label of a practice exactly as the practices infographic writes it.", line);
        else if (hits.length > 1) err("R12", `<PracticeSummary label="${attrs.label}"> at ${file} line ${line} matches more than one practice (${hits.length} <Item label="${attrs.label}">).`, "Keep one practice with that label in the shared infographics.", line);
      }
    }
    for (const g of stack) err("R12", `<Infographic> at ${file} line ${g.line} is never closed.`, "Add </Infographic> after its last <Item>.", g.line);
    const blockNames = [...blocks.keys()];
    for (const [name, u] of unknown) {
      const times = u.count > 1 ? ` (${u.count} times, first on line ${u.line})` : ` (line ${u.line})`;
      if (u.webAddress) {
        err("R12", `${file} has <${name}>${times}: a web address in angle brackets without https:// is read as an unknown tag, so readers don't see it.`, `Write <https://${name}> instead.`, u.line);
      } else if (blockNames.includes(name) || /^[A-Z]/.test(name) && blocksByFile.size && [...blocksByFile.values()].some((bs) => bs.some((x) => x.name === name))) {
        err("R12", `${file} uses <${name}>${times}, the name of a shared block; shared blocks are defined only in common files.`, `To show it here write <!-- @include: ${name} -->.`, u.line);
      } else {
        const n = nearest(name, Object.keys(TAGS.tags));
        err("R12", `${file} uses the tag <${name}>${times}, which not every product can show (readers would lose it).`, n ? `Did you mean <${n}>? Known tags: ${Object.keys(TAGS.tags).map((x) => `<${x}>`).join(", ")}.` : `Remove it, or use a known tag: ${Object.keys(TAGS.tags).map((x) => `<${x}>`).join(", ")}. A new tag must be added to every product first.`, u.line);
      }
    }
  }
  const have = /* @__PURE__ */ new Set();
  for (const name of tree.iconFiles.sort()) {
    if (name.startsWith(".") || name === "README.md") continue;
    const p = `${ICONS_DIR}/${name}`;
    if (!name.endsWith(".svg")) {
      add("R11", "error", p, null, `${p}: only .svg drawings belong in ${ICONS_DIR}/.`, "Save it as .svg, or move it elsewhere.");
      continue;
    }
    const stem = name.slice(0, -4);
    if (!ICON_NAME.test(stem)) {
      add("R11", "error", p, null, `${p}: icon names use lowercase letters, digits and hyphens.`, `Rename it "${suggestId(stem)}.svg".`);
      continue;
    }
    for (const problem of svgProblems(text(p))) add("R11", "error", p, null, `${p} ${problem}.`, "Fix the drawing so every product can draw it (see icons/infographic/README.md).");
    have.add(stem);
  }
  for (const [icon, uses] of [...usedIcons].sort(([a], [x]) => a.localeCompare(x))) {
    if (have.has(icon)) continue;
    for (const u of uses) add("R11", u.sev, u.file, u.book, `icon="${icon}" in ${u.file} has no drawing.`, `Add ${ICONS_DIR}/${icon}.svg, or use the name of a drawing that is there.`);
  }
  for (const icon of [...have].sort()) {
    if (!usedIcons.has(icon)) add("R11", "warning", `${ICONS_DIR}/${icon}.svg`, null, `${ICONS_DIR}/${icon}.svg isn't used by any infographic.`, "Use it, or delete it if it was replaced.");
  }
  if ("search-terms.json" in files) {
    let terms;
    let ok = true;
    try {
      terms = JSON.parse(text("search-terms.json"));
    } catch (e) {
      ok = false;
      add("R13", "error", "search-terms.json", null, `search-terms.json is not valid JSON (${e.message}).`, "Fix the JSON: quotes around every name and text, commas between items, none after the last.");
    }
    if (ok) {
      const folders = [{ path: "bibles" }];
      for (const p of Object.keys(files).sort()) {
        if (!/^(bibles|series)\/.+\/meta\.json$/.test(p)) continue;
        const m = (() => {
          try {
            const v = JSON.parse(files[p] ?? "");
            return { path: p, value: isObject3(v) ? v : null, error: null };
          } catch {
            return { path: p, value: null, error: "bad" };
          }
        })();
        if (!m.value) continue;
        folders.push({ path: p.slice(0, -"/meta.json".length), ...typeof m.value.id === "string" ? { id: m.value.id } : {}, ...typeof m.value.title === "string" ? { title: m.value.title } : {} });
      }
      for (const pr of validateTerms(terms, folders)) {
        if (pr.code === "repeats-ancestor") continue;
        add("R13", pr.level, "search-terms.json", null, `search-terms.json, ${pr.key || "the file"}: ${pr.message}.`, TERMS_FIX[pr.code] ?? "See the Library search terms rules (ARCHITECTURE \xA79d).");
      }
    }
  }
  for (const bible of tree.bibles) {
    const dir = bible.path;
    if (!bible.meta.path) {
      add("R15", "error", dir, null, `The Bible folder ${dir} has no meta.json.`, `Add ${dir}/meta.json with "title", "version" and "language".`);
      continue;
    }
    if (bible.meta.error) {
      add("R2", "error", bible.meta.path, null, `${bible.meta.path} is not valid JSON (${bible.meta.error}).`, "Fix the JSON.");
      continue;
    }
    const v = bible.meta.value;
    for (const f of ["title", "version"]) {
      if (typeof v[f] !== "string" || !v[f].trim()) add("R15", "error", bible.meta.path, null, `${bible.meta.path} has no "${f}".`, `Add "${f}": "\u2026".`);
    }
    if ("language" in v && !LANGUAGES.includes(v.language)) add("R15", "error", bible.meta.path, null, `${bible.meta.path} has "language": ${q(v.language)}.`, `Use ${LANGUAGES.map(q).join(" or ")}, or leave it out.`);
    if (!(`${dir}/references.json` in files)) add("R15", "error", dir, null, `The Bible ${dir} has no references.json (the verse text every product reads).`, `Add ${dir}/references.json.`);
    if (!Object.keys(files).some((p) => p.startsWith(`${dir}/content/`) && /\.(usfm|sfm)$/i.test(p))) add("R15", "error", dir, null, `The Bible ${dir} has no USFM files in ${dir}/content/.`, `Add the translation's .usfm / .SFM book files to ${dir}/content/.`);
    if (!COVER_EXTS.some((e) => e !== "webp" && `${dir}/cover.${e}` in files)) add("R15", "error", dir, null, `The Bible ${dir} has no cover.`, `Add ${dir}/cover.svg (or .png / .jpg).`);
    if ("audiobook" in v) audiobookChecks(v.audiobook, bible.meta.path, null, "error");
  }
  return out;
}
var TERMS_FIX = {
  "bad-shape": `Follow the file's shape: {"version": 1, "nodes": {"<folder>": {"title", "primary": [\u2026], "terms": [\u2026]}}}.`,
  "missing-folder": "Use the path of a folder that has a meta.json, or remove the node.",
  "id-mismatch": `Make the node's "id" the same as the book's meta.json "id".`,
  duplicate: "Remove the repeated term.",
  "duplicate-normalized": "Keep one spelling unless both are wanted on purpose.",
  "repeats-ancestor": "Remove it; the series or shelf above already gives this term.",
  "title-mismatch": "Copy the title from the folder's meta.json.",
  "primary-count": "Give the node 3 to 5 primary terms.",
  "no-terms": "Add a node for the book with a few search terms."
};
var escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function boldMatches(body, target) {
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const texts = body.split("\n").map((l) => (l.match(/^(\s*>\s*)?([\s\S]*?)(\s*)$/) || [])[2] || "");
  const tgt = norm(target);
  for (let s = 0; s < texts.length; s++) {
    if (!texts[s]) continue;
    let joined = "";
    for (let e = s; e < texts.length && texts[e]; e++) {
      joined = joined ? `${joined} ${norm(texts[e])}` : norm(texts[e]);
      if (joined === tgt) return true;
      if (!tgt.startsWith(joined)) break;
    }
  }
  return texts.some((t) => t && t.includes(target));
}
var UNSAFE = [
  [/<script\b/i, "a <script>"],
  [/<style\b/i, "a <style> block (use attributes instead)"],
  [/<foreignObject\b/i, "a <foreignObject>"],
  [/<image\b/i, "an embedded <image> (icons must be drawn shapes)"],
  [/\bhref\s*=/i, "a link (href)"],
  [/\son[a-z]+\s*=/i, "an event handler (on\u2026=)"],
  [/<!DOCTYPE|<!ENTITY/i, "a DOCTYPE/ENTITY"]
];
function svgProblems(svg) {
  const out = [];
  const body = svg.replace(/^﻿/, "").replace(/<\?xml[\s\S]*?\?>/, "").replace(/<!--[\s\S]*?-->/g, "").trim();
  const root = body.match(/^<svg\b[^>]*>/);
  if (!root) out.push("does not start with <svg");
  else if (!/\bviewBox\s*=/.test(root[0])) out.push("has no viewBox on its <svg> (needed to size it)");
  if (root && !/<\/svg>\s*$/.test(body)) out.push("does not end with </svg>");
  for (const [re, what] of UNSAFE) if (re.test(body)) out.push(`contains ${what}`);
  return out;
}

// src/content/cli.ts
var TEXT = /\.(json|md|svg)$/i;
var SKIP_DIRS = /* @__PURE__ */ new Set([".git", ".github", "node_modules"]);
function readContentDir(root) {
  const files = {};
  const walk = (dir) => {
    for (const e of (0, import_node_fs.readdirSync)(dir, { withFileTypes: true })) {
      const abs = (0, import_node_path.join)(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(abs);
        continue;
      }
      const rel = (0, import_node_path.relative)(root, abs).split(import_node_path.sep).join("/");
      const wanted = TEXT.test(e.name) && !/^bibles\/[^/]+\/(content\/|references\.json$|version\.json$)/.test(rel);
      files[rel] = wanted ? (0, import_node_fs.readFileSync)(abs, "utf8") : null;
    }
  };
  walk(root);
  return files;
}
function formatFindings(findings, { warnings = true } = {}) {
  const shown = findings.filter((f) => warnings || f.severity === "error");
  const groups = /* @__PURE__ */ new Map();
  for (const f of shown) {
    const k = f.book ?? "(shared files, icons, search terms, Bibles)";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  }
  const lines = [];
  for (const [k, fs] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`
${k}`);
    for (const f of fs) lines.push(`  ${f.severity === "error" ? "ERROR  " : "warning"} ${f.rule}  ${f.message}
           \u2192 ${f.fix}`);
  }
  const errors = findings.filter((f) => f.severity === "error").length;
  lines.push(`
${errors} error(s), ${findings.length - errors} warning(s).`);
  return lines.join("\n");
}
function main(argv) {
  const i = argv.indexOf("--content");
  const root = i >= 0 ? argv[i + 1] : void 0;
  if (!root) {
    console.error("Usage: nc-content-check --content <content repo folder> [--json] [--no-warnings]");
    process.exit(2);
  }
  const findings = check(readContentDir(root));
  if (argv.includes("--json")) console.log(JSON.stringify(findings, null, 2));
  else console.log(formatFindings(findings, { warnings: !argv.includes("--no-warnings") }));
  process.exit(findings.some((f) => f.severity === "error") ? 1 : 0);
}
main(process.argv.slice(2));
//# sourceMappingURL=cli.cjs.map