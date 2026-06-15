# Singleton PDF Tools

A web app for merging multiple PDF files into one — **everything runs in the
browser**, no files are ever uploaded to a server.

**Live demo: [singleton-pdf.vercel.app](https://singleton-pdf.vercel.app)**

## Features

**File merging**
- Upload multiple PDFs at once (click or drag-and-drop).
- File list shows name, page count, and size.
- Reorder files with drag-and-drop (SortableJS).
- Remove files from the list.
- Merge & download with a custom output file name.

**Page editor**
- Visual thumbnail grid of every page across all files (pdf.js, rendered lazily).
- Drag individual pages to reorder them — pages from different files can interleave.
- Drop unwanted pages from the output.
- "Reset to file order" to start over; page edits survive leaving and reopening the editor.

## Tech Stack

- [Vite](https://vitejs.dev/) — dev server & bundler
- [Tailwind CSS v4](https://tailwindcss.com/) — UI
- [pdf-lib](https://pdf-lib.js.org/) — client-side PDF merging
- [pdf.js](https://mozilla.github.io/pdf.js/) — page thumbnail rendering
- [SortableJS](https://sortablejs.github.io/Sortable/) — drag-and-drop

## Getting Started

```bash
npm install      # one-time setup
npm run dev      # start the dev server, then open the URL it prints
```

Build for production (static output in `dist/`):

```bash
npm run build
npm run preview  # preview the production build
```

## Roadmap

- PDF → image (JPG/PNG), compression, watermarking, password protection.

## Project Structure

```
index.html          # dashboard (main view) + page editor view
src/
  main.js           # UI wiring: views, upload, lists, reorder, merge, download
  pdfMerge.js       # merge logic (pdf-lib): mergePdfs(files) + mergePages(pages)
  fileStore.js      # file list state
  pageStore.js      # page editor state (flat, ordered page list)
  thumbnails.js     # pdf.js thumbnail rendering + document cache
  style.css         # Tailwind entry
```

## Releasing

Versioning follows [SemVer](https://semver.org/). Pick the bump that matches the change:

- `npm version patch` — bug fixes only (e.g. `0.2.0` → `0.2.1`)
- `npm version minor` — a new feature, backwards-compatible (e.g. `0.2.0` → `0.3.0`)
- `npm version major` — stable / breaking milestone (e.g. `0.2.0` → `1.0.0`)

Each command bumps `package.json`, creates a commit, and tags it (`vX.Y.Z`). Then push
and publish the GitHub release:

```bash
npm version minor              # bump + commit + tag
git push --follow-tags         # push the commit and the new tag
gh release create vX.Y.Z --title "vX.Y.Z - Title" --notes-file notes.md
```

The repo is connected to Vercel, so pushing to `main` auto-deploys to
[singleton-pdf.vercel.app](https://singleton-pdf.vercel.app). Tag and release are for
tracking history — they don't affect deployment.
