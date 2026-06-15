# Singleton PDF Tools

A web app for merging multiple PDF files into one — **everything runs in the
browser**, no files are ever uploaded to a server.

## Features (Phase 1)

- Upload multiple PDFs at once (click or drag-and-drop).
- File list shows name, page count, and size.
- Reorder files with drag-and-drop (SortableJS).
- Remove files from the list.
- Merge & download with a custom output file name.

## Tech Stack

- [Vite](https://vitejs.dev/) — dev server & bundler
- [Tailwind CSS v4](https://tailwindcss.com/) — UI
- [pdf-lib](https://pdf-lib.js.org/) — client-side PDF merging
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

- Page-level editor: thumbnails (pdf.js), reorder & delete pages across files.
- PDF → image (JPG/PNG), compression, watermarking, password protection.

## Project Structure

```
index.html          # dashboard
src/
  main.js           # UI wiring: upload, list, reorder, merge, download
  pdfMerge.js       # merge logic (pdf-lib), pure & testable
  fileStore.js      # file list state
  style.css         # Tailwind entry
```
