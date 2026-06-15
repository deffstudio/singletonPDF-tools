import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// pdf.js runs its parser in a Web Worker; Vite resolves the bundled worker URL.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// Cache one parsed document per File so re-rendering pages is cheap.
// Keyed by the File object (stable for the lifetime of a fileStore entry).
const docCache = new Map(); // File -> Promise<PDFDocumentProxy>

function getDoc(file) {
  let doc = docCache.get(file);
  if (!doc) {
    // getDocument detaches the buffer it's given, so hand it a fresh copy.
    doc = file.arrayBuffer().then((data) => pdfjsLib.getDocument({ data }).promise);
    docCache.set(file, doc);
  }
  return doc;
}

/**
 * Render a single page of a PDF into a canvas, sized to fit maxWidth (CSS px)
 * and sharpened for the device pixel ratio.
 *
 * @param {File} file
 * @param {number} pageIndex - 0-based
 * @param {HTMLCanvasElement} canvas
 * @param {number} [maxWidth=200]
 */
export async function renderThumbnail(file, pageIndex, canvas, maxWidth = 200) {
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

  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
}

/** Destroy cached documents and free their workers (call when files change). */
export function clearThumbnailCache() {
  for (const doc of docCache.values()) {
    doc.then((d) => d.destroy()).catch(() => {});
  }
  docCache.clear();
}
