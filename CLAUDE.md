# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install dependencies (one-time)
- `npm run dev` — start the Vite dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the production build locally

Pure logic is unit-tested with **Vitest** — run `npm test` (or `npm run test:watch`).
Currently covered: `src/pageStore.js`, `src/pageSelection.js`, and `src/i18n.js`. Browser-dependent code
(pdf.js rendering, SortableJS drag, the DOM wiring in `main.js`) is still verified manually:
build must pass, then exercise the app in the browser (upload PDFs, reorder, merge, download).
No linter is configured.

## Architecture

A 100% client-side PDF tool — there is no backend. Every file is read and processed
in the browser via `File.arrayBuffer()`; nothing is uploaded. Preserve this invariant:
do not introduce server uploads or network calls for file data.

Vanilla JS (ES modules), no framework. The app is a single-page tool dashboard: a tool
nav (`.tool-tab` buttons: Merge / Pages / Compress) switches between three panels
(`#panel-merge`, `#panel-pages`, `#panel-compress`), all sharing one upload + file list.
`main.js`'s `showTool(name)` toggles panels and tab styling; everything lives in `index.html`.
Source modules with a deliberate separation:

- `src/fileStore.js` — single source of truth for the file list (array of
  `{ id, file, name, size, pageCount }`), shared by all three tools. Owns add/remove/reorder
  logic and PDF validation. Holds module-level state; never mutate the list from outside it.
- `src/pageStore.js` — single source of truth for the page editor: a flat, ordered list
  of `{ id, fileId, file, name, pageIndex }`, one entry per page. Independent of fileStore
  so users can reorder/delete individual pages without touching the files.
- `src/pdfMerge.js` — `mergePdfs(File[])` (whole files) and `mergePages([{file, pageIndex}])`
  (page-level). Both **pure** functions with no DOM access; `mergePages` caches each parsed
  source doc so interleaved pages don't re-parse.
- `src/pdfCompress.js` — `compressPdf(file, { dpi, quality })` + `PRESETS`. Rasterizes each
  page via pdf.js, re-encodes as JPEG, rebuilds with pdf-lib (`embedJpg` + `drawImage`),
  preserving original page point-dimensions. Renders are serialized on a Promise chain (the
  shared pdf.js worker races otherwise). Lossy: output text is non-selectable.
- `src/pdfjs.js` — shared pdf.js worker. Exports `getWorker()` (one `PDFWorker` for the whole
  app — multiple workers hang on the 2nd document) and `loadDocument(data)`. Owns the
  `?url` worker import. Used by both `thumbnails.js` and `pdfCompress.js`.
- `src/thumbnails.js` — pdf.js thumbnail rendering (via `pdfjs.js`). Caches one parsed
  `PDFDocumentProxy` per File; `renderThumbnail` draws a single page to a canvas (DPR-aware).
- `src/i18n.js` — dependency-free localization layer. One flat keyed dictionary per
  locale (`en`, `id` = Bahasa Indonesia); `t(key, params)` resolves the active locale,
  interpolates `{token}` placeholders, calls function-valued entries (used for English
  plurals), and **falls back to English** for any missing key. Pure logic (no DOM);
  `main.js` owns applying it. The chosen locale persists in `localStorage`.
- `src/main.js` — the only module that touches the DOM. Wires the tool nav, SortableJS,
  lazy thumbnail rendering (IntersectionObserver), compression, downloads, and the
  language switcher. Static copy is marked with `data-i18n="key"` in `index.html` and
  set by `applyStaticTranslations`; dynamically-built strings call `t()` directly, so
  every render path must stay translatable (no hardcoded user-facing English).

Key data-flow rule: the DOM is never the source of truth for order. After a SortableJS
drag, `main.js` calls `fileStore.reorder` / `pageStore.reorder` to keep state
authoritative, then renders from the store's `getOrdered()`.

Two stores, kept loosely coupled: `pageStore.syncFrom(items)` rebuilds the page list
**only** when the file set changed (tracked via a fingerprint of ids + page counts), so
page-level edits survive switching tools; on a rebuild `main.js` clears the thumbnail cache.
This runs when the Pages tab is activated. `pageStore.rebuildFrom` (the "Reset to file
order" button) forces a rebuild.

`pdf-lib` reads page counts on intake (`fileStore`) and assembles output (`pdfMerge`,
`pdfCompress`); `pdf.js` renders (thumbnails + compression rasterization). All `pdf-lib`
loads use `{ ignoreEncryption: true }`; unreadable files are skipped on intake and surfaced
via the error banner. pdf.js's worker is resolved through Vite via the `?url` import in
`pdfjs.js` — keep that import form or the worker won't bundle.

## UI / Tailwind

Tailwind CSS v4 is compiled via the `@tailwindcss/vite` plugin (configured in
`vite.config.js`), not the Play CDN. The single entry is `@import "tailwindcss";` in
`src/style.css`. Markup lives in `index.html`; list items are built as HTML strings in
`main.js` (user-supplied file names go through `escapeHtml`).

The app is bilingual: **US English** (`en`, default) and **Bahasa Indonesia** (`id`),
with a header language switcher. Source comments stay in US English. Never hardcode
user-facing copy: add a key to **both** locales in `src/i18n.js`, then reference it via
`data-i18n="key"` (static markup) or `t('key', params)` (dynamically-built strings).
English is the fallback, so a missing `id` key renders English rather than a blank.
Keep the two dictionaries in sync when adding or changing strings.

## Scope

Built: whole-file merge + reordering, the page-level editor (pdf.js thumbnails, per-page
reorder/delete), compression (raster presets), and bilingual UI (English / Bahasa
Indonesia). Roadmap (not yet built): PDF→image (JPG/PNG), watermarking, and password
protection.
