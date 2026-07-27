<!--
  commonBook.md — BOOK-LEVEL fixtures for the shared-content editing feature.
  Used only by the hidden Test Book (Session 5). Includes plain and parameterized
  blocks so the editor's segment map, read-only param spans, banner (book level),
  and per-file commit routing can all be exercised by Playwright.
-->

<TestSharedBookNote>
This is shared **book-level** content from `commonBook.md`. It reads the same in every session that includes it, and an edit here should commit to `commonBook.md`, not the session file.
</TestSharedBookNote>

<TestCreedFragment>
I believe in God the Father.
I believe in the Son.
I believe in the Holy Spirit.
</TestCreedFragment>

<TestSharedQuestion>
<Question id={id}>What did this shared, parameterized question teach you? Its id is substituted per session, so this span must be non-editable in place.</Question>
</TestSharedQuestion>
