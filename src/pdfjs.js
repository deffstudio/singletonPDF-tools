import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// pdf.js runs its parser in a Web Worker; Vite resolves the bundled worker URL.
// Keep this `?url` import form or the worker won't bundle (see CLAUDE.md).
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// Share a single worker across every document. Letting each getDocument() spin up
// its own worker hangs on the second document, so reuse one (pdf.js multiplexes).
// Both the thumbnail renderer and the compressor go through here.
let sharedWorker = null;

export function getWorker() {
  if (!sharedWorker) sharedWorker = new pdfjsLib.PDFWorker();
  return sharedWorker;
}

/** Parse PDF bytes into a PDFDocumentProxy on the shared worker. */
export function loadDocument(data) {
  return pdfjsLib.getDocument({ data, worker: getWorker() }).promise;
}
