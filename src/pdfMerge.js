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
