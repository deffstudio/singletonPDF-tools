import { PDFDocument } from 'pdf-lib';

/**
 * Merge multiple PDF files into one, preserving the input order.
 * A pure function over File[] — it never touches the DOM, so it's easy to test.
 *
 * @param {File[]} files - the PDF files, ordered as the result should appear
 * @returns {Promise<Uint8Array>} the merged PDF bytes
 */
export async function mergePdfs(files) {
  if (!files || files.length === 0) {
    throw new Error('No files to merge.');
  }

  const merged = await PDFDocument.create();

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    let src;
    try {
      src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    } catch {
      throw new Error(`Could not read "${file.name}" — the file may be corrupted.`);
    }
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }

  return merged.save();
}

/**
 * Build a PDF from an explicitly ordered list of individual pages, allowing pages
 * from different files to interleave and pages to be dropped. Used by the
 * page-level editor. Also a pure function over its inputs.
 *
 * @param {{ file: File, pageIndex: number }[]} pages - ordered, 0-based page indices
 * @returns {Promise<Uint8Array>} the resulting PDF bytes
 */
export async function mergePages(pages) {
  if (!pages || pages.length === 0) {
    throw new Error('No pages to merge.');
  }

  const out = await PDFDocument.create();
  const srcCache = new Map(); // File -> PDFDocument (parse each source once)

  for (const { file, pageIndex } of pages) {
    let src = srcCache.get(file);
    if (!src) {
      const bytes = await file.arrayBuffer();
      try {
        src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      } catch {
        throw new Error(`Could not read "${file.name}" — the file may be corrupted.`);
      }
      srcCache.set(file, src);
    }
    const [copied] = await out.copyPages(src, [pageIndex]);
    out.addPage(copied);
  }

  return out.save();
}
