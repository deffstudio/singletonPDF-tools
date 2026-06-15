import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// pdf.js runs its parser in a Web Worker; Vite resolves the bundled worker URL.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// Cache one parsed document per File so re-rendering pages is cheap.
// Keyed by the File object (stable for the lifetime of a fileStore entry).
const docCache = new Map(); // File -> Promise<PDFDocumentProxy>

// Share a single worker across all documents. Letting each getDocument() spin up
// its own worker hangs on the second document, so reuse one (pdf.js multiplexes).
let sharedWorker = null;
function getWorker() {
  if (!sharedWorker) sharedWorker = new pdfjsLib.PDFWorker();
  return sharedWorker;
}

function getDoc(file) {
  let doc = docCache.get(file);
  if (!doc) {
    doc = file
      .arrayBuffer()
      .then((data) => pdfjsLib.getDocument({ data, worker: getWorker() }).promise);
    docCache.set(file, doc);
  }
  return doc;
}

async function draw(file, pageIndex, canvas, maxWidth) {
  const doc = await getDoc(file);
  const page = await doc.getPage(pageIndex + 1); // pdf.js pages are 1-based
  const dpr = window.devicePixelRatio || 1;

  const base = page.getViewport({ scale: 1 });
  const scale = (maxWidth / base.width) * dpr;
  const viewport = page.getViewport({ scale });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
  canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

  // pdf.js v6 takes the canvas directly; canvasContext is legacy.
  await page.render({ canvas, viewport }).promise;
}

// Render one page at a time. Concurrent pdf.js renders race on the shared worker
// and leave canvases blank, so callers are queued onto a single chain.
let chain = Promise.resolve();

/**
 * Render a single PDF page into a canvas, sized to fit maxWidth (CSS px) and
 * sharpened for the device pixel ratio. Calls are serialized internally.
 *
 * @param {File} file
 * @param {number} pageIndex - 0-based
 * @param {HTMLCanvasElement} canvas
 * @param {number} [maxWidth=200]
 */
export function renderThumbnail(file, pageIndex, canvas, maxWidth = 200) {
  const result = chain.then(() => draw(file, pageIndex, canvas, maxWidth));
  chain = result.catch(() => {}); // keep the queue alive even if one render fails
  return result;
}

/** Destroy cached documents and free their workers (call when files change). */
export function clearThumbnailCache() {
  for (const doc of docCache.values()) {
    doc.then((d) => d.destroy()).catch(() => {});
  }
  docCache.clear();
}
