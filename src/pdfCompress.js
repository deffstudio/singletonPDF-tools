import { PDFDocument } from 'pdf-lib';
import { loadDocument } from './pdfjs.js';

/**
 * Compression presets. Each renders pages at `dpi` and re-encodes them as JPEG at
 * `quality` (0–1). Lower DPI + lower quality = smaller file, softer image.
 */
export const PRESETS = {
  less: { label: 'Less', hint: 'Larger, sharper', dpi: 150, quality: 0.8 },
  recommended: { label: 'Recommended', hint: 'Balanced', dpi: 120, quality: 0.65 },
  strong: { label: 'Strong', hint: 'Smallest file', dpi: 96, quality: 0.5 },
};

/** Encode a canvas to JPEG bytes via the async toBlob API. */
function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not encode page image.'));
          return;
        }
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject);
      },
      'image/jpeg',
      quality
    );
  });
}

// Render one page at a time. Concurrent pdf.js renders race on the shared worker
// and blank out, so page rasterization is queued onto a single chain.
let chain = Promise.resolve();

function rasterizePage(page, dpi, quality) {
  const task = chain.then(async () => {
    const viewport = page.getViewport({ scale: dpi / 72 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    // pdf.js v6 takes the canvas directly; canvasContext is legacy.
    await page.render({ canvas, viewport }).promise;
    return canvasToJpeg(canvas, quality);
  });
  chain = task.catch(() => {}); // keep the queue alive even if one render fails
  return task;
}

/**
 * Compress a PDF by rasterizing each page to a JPEG and rebuilding the document.
 * Big savings on scanned/image-heavy PDFs; note that text becomes non-selectable
 * because every page is replaced by an image. A pure function over its inputs —
 * no DOM state, only a throwaway offscreen canvas per page.
 *
 * @param {File} file
 * @param {{ dpi: number, quality: number }} options
 * @returns {Promise<Uint8Array>} the compressed PDF bytes
 */
export async function compressPdf(file, { dpi, quality }) {
  let doc;
  try {
    const data = await file.arrayBuffer();
    doc = await loadDocument(data);
  } catch {
    throw new Error(`Could not read "${file.name}" — the file may be corrupted.`);
  }

  const out = await PDFDocument.create();

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    // Original page size in PDF points (72 per inch) — preserve physical dimensions.
    const base = page.getViewport({ scale: 1 });
    const jpeg = await rasterizePage(page, dpi, quality);
    const img = await out.embedJpg(jpeg);
    const outPage = out.addPage([base.width, base.height]);
    outPage.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
  }

  doc.destroy?.();
  return out.save();
}
