# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install dependencies (one-time)
- `npm run dev` — start the Vite dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the production build locally

No test runner or linter is configured yet. Verification is manual: build must pass, then exercise the app in the browser (upload PDFs, reorder, merge, download).

## Architecture

A 100% client-side PDF tool — there is no backend. Every file is read and processed
in the browser via `File.arrayBuffer()`; nothing is uploaded. Preserve this invariant:
do not introduce server uploads or network calls for file data.

Vanilla JS (ES modules), no framework. The app has two views toggled in `main.js`
(`#main-view` = file list/merge, `#editor-view` = page editor); both live in `index.html`.
Source modules with a deliberate separation:

- `src/fileStore.js` — single source of truth for the file list (array of
  `{ id, file, name, size, pageCount }`). Owns add/remove/reorder logic and PDF
  validation. Holds module-level state; never mutate the list from outside it.
- `src/pageStore.js` — single source of truth for the page editor: a flat, ordered list
  of `{ id, fileId, file, name, pageIndex }`, one entry per page. Independent of fileStore
  so users can reorder/delete individual pages without touching the files.
- `src/pdfMerge.js` — `mergePdfs(File[])` (whole files) and `mergePages([{file, pageIndex}])`
  (page-level). Both **pure** functions with no DOM access; `mergePages` caches each parsed
  source doc so interleaved pages don't re-parse.
- `src/thumbnails.js` — pdf.js thumbnail rendering. Caches one parsed `PDFDocumentProxy`
  per File; `renderThumbnail` draws a single page to a canvas (DPR-aware).
- `src/main.js` — the only module that touches the DOM. Wires both views, SortableJS,
  lazy thumbnail rendering (IntersectionObserver), and downloads.

Key data-flow rule: the DOM is never the source of truth for order. After a SortableJS
drag, `main.js` calls `fileStore.reorder` / `pageStore.reorder` to keep state
authoritative, then renders from the store's `getOrdered()`.

Two stores, kept loosely coupled: `pageStore.syncFrom(items)` rebuilds the page list
**only** when the file set changed (tracked via a fingerprint of ids + page counts), so
page-level edits survive closing/reopening the editor; on a rebuild `main.js` clears the
thumbnail cache. `pageStore.rebuildFrom` (the "Reset to file order" button) forces a rebuild.

`pdf-lib` is used to read page counts on intake (`fileStore`) and to assemble output
(`pdfMerge`); `pdf.js` is used only for thumbnails. All `pdf-lib` loads use
`{ ignoreEncryption: true }`; unreadable files are skipped on intake and surfaced via the
error banner. pdf.js's worker is resolved through Vite via the `?url` import in
`thumbnails.js` — keep that import form or the worker won't bundle.

## UI / Tailwind

Tailwind CSS v4 is compiled via the `@tailwindcss/vite` plugin (configured in
`vite.config.js`), not the Play CDN. The single entry is `@import "tailwindcss";` in
`src/style.css`. Markup lives in `index.html`; list items are built as HTML strings in
`main.js` (user-supplied file names go through `escapeHtml`).

All user-facing copy and source comments are **US English** — this is intentional for a
potential commercial launch. Keep new strings in US English.

## Scope

Built: whole-file merge + reordering, and the page-level editor (pdf.js thumbnails,
per-page reorder/delete). Roadmap (not yet built): PDF→image (JPG/PNG), compression,
watermarking, and password protection.
