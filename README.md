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

When pushed, the `notify-audiobook.yml` workflow triggers audiobook generation in the [audiobooks repo](https://github.com/Noble-Collective/Noble-Imprint-Audiobook). Generated audio and timestamp files are stored in the GCS bucket `noble-imprint-audiobooks`, where the website reads them for playback.

## Related Repos

- [Noble-Imprint-Resource-Website](https://github.com/Noble-Collective/Noble-Imprint-Resource-Website) -- Web application that renders and serves this content
- [Noble-Imprint-Audiobook](https://github.com/Noble-Collective/Noble-Imprint-Audiobook) -- Audiobook generation pipeline (ElevenLabs TTS)
