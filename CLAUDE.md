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

Vanilla JS (ES modules), no framework. Three source modules with a deliberate separation:

- `src/fileStore.js` — the single source of truth for the file list (array of
  `{ id, file, name, size, pageCount }`). Owns add/remove/reorder/order logic and PDF
  validation. Holds module-level state; never mutate the list from outside it.
- `src/pdfMerge.js` — `mergePdfs(File[]) → Uint8Array`. A **pure** function over files
  with no DOM access, kept separate so the merge logic stays testable and reusable.
- `src/main.js` — the only module that touches the DOM. Wires upload (click + drag-drop),
  re-renders the list, integrates SortableJS, and drives merge + download.

Key data-flow rule: the DOM is never the source of truth for order. After a SortableJS
drag, `main.js` calls `fileStore.reorder(oldIndex, newIndex)` to keep state authoritative,
then renders from `fileStore.getOrdered()`.

`pdf-lib` is used in two places: `fileStore` loads each PDF to read its page count on
intake, and `pdfMerge` copies pages into a new document. Both load with
`{ ignoreEncryption: true }` for tolerance; unreadable files are skipped on intake and
surfaced via the error banner.

## UI / Tailwind

Tailwind CSS v4 is compiled via the `@tailwindcss/vite` plugin (configured in
`vite.config.js`), not the Play CDN. The single entry is `@import "tailwindcss";` in
`src/style.css`. Markup lives in `index.html`; list items are built as HTML strings in
`main.js` (user-supplied file names go through `escapeHtml`).

All user-facing copy and source comments are **US English** — this is intentional for a
potential commercial launch. Keep new strings in US English.

## Scope

Current scope is Phase 1: merge + file reordering only. Roadmap (not yet built):
page-level editor with pdf.js thumbnails and per-page reorder/delete, plus PDF→image,
compression, watermarking, and password protection. The fileStore/pdfMerge split was
designed to extend into the page-level editor.
