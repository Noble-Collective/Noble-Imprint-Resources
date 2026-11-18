# Infographic icons

Every icon an infographic names lives here, once: `<Item icon="church" …>` draws `church.svg`.
The app and the website both read these files. Nothing else needs changing.

## Adding an icon

1. Save the drawing here as `<name>.svg`, named with lowercase letters, digits and hyphens
   (`sec-hearing.svg`, `hands-praying.svg`).
2. Use it: `<Item icon="<name>" label="…">`.
3. Commit both together.

Phones get the new icon with the next content update (no app release), and the website shows it
once its content refreshes (a few minutes).

## What a drawing needs

- **One colour.** The app paints the whole drawing white and the website paints it in the marker's
  colour, so the colours in the file don't matter. Shapes must be drawn with fill and/or stroke,
  not with a bitmap.
- **A `viewBox`** on the `<svg>` tag (Affinity and Font Awesome both write one).
- **No** `<style>` blocks, scripts, links or embedded images. Export from Affinity with
  "Use style attributes" (the default) rather than a stylesheet.

## Size

The app fits every drawing into the same square. The website draws an icon one line of text tall,
like a Font Awesome glyph. A fine line drawing that needs more room (the five `sec-*` movement
icons) asks for it with `data-size="large"` on its `<svg>` tag:

```
<svg data-size="large" viewBox="0 0 33 33" …>
```

## Where the icons came from

Most are Font Awesome Free 6.7.2 solid icons (CC BY 4.0; each file keeps its licence comment).
`triquetra` and the five `sec-*` "Five Movements" drawings are our own.

## Checks

A commit that names an icon with no file here, or adds a drawing the app or website can't use,
gets a failed "Check infographic icons" run that names the file and the fix. The app's content
update will not publish until it is fixed.
