# Noble Imprint Resources

Content repository for all Noble Imprint discipleship and formation resources. This is the single source of truth for book content -- the [website](https://github.com/Noble-Collective/Noble-Imprint-Resource-Website) reads from this repo via the GitHub API.

## Structure

```
series/
  <Series Name>/
    meta.json                  {title, subtitle, order}
    commonSeries.md            Optional shared content
    <Sub-Series Name>/         Optional grouping level
      meta.json                {title, subtitle, order}
      <Book Name>/
        meta.json              {title, subtitle, order, status, color, banner, language, audiobook}
        cover.svg|png          Book cover image
        commonBook.md          Optional shared content
        sessions/
          01-FrontMatter.md
          02-ChapterOne.md
          ...
```

Each level has a `meta.json` that controls ordering, display metadata, and feature flags. Books are identified by having a `sessions/` directory.

## Summaries (`summary.md`)

A series, a sub-series (collection) or a book can have a short "About" text: a `summary.md` file beside its `meta.json`.

```
series/<Series>/summary.md                       the series' summary
series/<Series>/<Sub-Series>/summary.md          the collection's summary
series/<Series>/[<Sub-Series>/]<Book>/summary.md the book's summary
```

- **Plain Markdown, no front matter.** Paragraphs, `_italic_`, `**bold**`; scripture references are fine (they link like in a session). No headings, images, custom tags or `@include`s.
- **About 80–200 words.** It's read on a phone page, under the cover and title — title and subtitle come from `meta.json`, so don't repeat them.
- A book's summary may open with a one-line italic lead (e.g. its line from the series list), then the body.
- **File present = summary shown; absent = nothing changes.** Once the app supports it (in progress, 2026-10), anything with a summary gets a small navy "i" on its cover and the reader's ⋮ menu gets "About this book". Until then the file is ignored by the app and the website.
- Adapt the wording from the book's own text (preface, introduction, executive summary) — don't invent claims.

## Content Update Flow

1. Push changes to this repo
2. The `notify-website.yml` GitHub Action fires a `repository_dispatch` to the website repo
3. The website rebuilds and redeploys on Cloud Run, picking up the new content

No manual deployment step is needed -- push and the live site updates within a few minutes.

## Audiobook Configuration

To enable audiobook generation for a book, add an `audiobook` key to the book's `meta.json`:

```json
{
  "title": "Book Title",
  "subtitle": "...",
  "order": 1,
  "language": "en",
  "audiobook": {
    "voice_id": "ElevenLabs voice ID",
    "model_id": "eleven_multilingual_v2",
    "language_normalization": false,
    "sessions": ["02-ChapterOne.md", "03-ChapterTwo.md"]
  }
}
```

| Field | Purpose |
|-------|---------|
| `language` | Top-level book language code, `en` (default) or `fr`. Selects the locale used by the language-normalization layer (below). Set `fr` for French books. |
| `voice_id` | ElevenLabs voice to use for generation |
| `model_id` | ElevenLabs TTS model |
| `language_normalization` | Per-book switch, default `false`. When `true`, scripture references and numeric ranges are spoken naturally per `language` (e.g. "Proverbs 1-9" → "Proverbs, chapters 1 through 9"); when `false` they are spoken literally. **Toggling this changes the spoken text, so the affected sessions regenerate on the next push.** Roll it out one book at a time. |
| `sessions` | List of session filenames to generate audio for (omit front matter, etc.) |

When pushed, the `notify-audiobook.yml` workflow triggers audiobook generation in the [audiobooks repo](https://github.com/Noble-Collective/Noble-Imprint-Audiobooks). Generated audio and timestamp files are stored in the GCS bucket `noble-imprint-audiobooks`, where the website reads them for playback.

## Related Repos

- [Noble-Imprint-Resource-Website](https://github.com/Noble-Collective/Noble-Imprint-Resource-Website) -- Web application that renders and serves this content
- [Noble-Imprint-Audiobooks](https://github.com/Noble-Collective/Noble-Imprint-Audiobooks) -- Audiobook generation pipeline (ElevenLabs TTS)
