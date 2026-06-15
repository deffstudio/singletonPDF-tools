import { PDFDocument } from 'pdf-lib';

/**
 * State for the list of PDF files. Source of truth for the list's order and contents.
 * Each entry: { id, file, name, size, pageCount }
 */

let items = [];
let counter = 0;

function isPdf(file) {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}

/** Read the page count; return null if the file can't be read. */
async function readPageCount(file) {
  try {
    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return doc.getPageCount();
  } catch {
    return null;
  }
}

/**
 * Add files (FileList or array). Skip non-PDFs and files that fail to read.
 * @returns {Promise<{ added: number, skipped: string[] }>}
 */
export async function add(fileList) {
  const files = Array.from(fileList);
  const skipped = [];
  let added = 0;

  for (const file of files) {
    if (!isPdf(file)) {
      skipped.push(file.name);
      continue;
    }
    const pageCount = await readPageCount(file);
    if (pageCount === null) {
      skipped.push(file.name);
      continue;
    }
    items.push({
      id: `f${++counter}`,
      file,
      name: file.name,
      size: file.size,
      pageCount,
    });
    added++;
  }

  return { added, skipped };
}

export function remove(id) {
  items = items.filter((it) => it.id !== id);
}

/** Move an item from oldIndex to newIndex (kept in sync with drag-and-drop). */
export function reorder(oldIndex, newIndex) {
  if (
    oldIndex < 0 ||
    newIndex < 0 ||
    oldIndex >= items.length ||
    newIndex >= items.length
  ) {
    return;
  }
  const [moved] = items.splice(oldIndex, 1);
  items.splice(newIndex, 0, moved);
}

/** The items in their current order (shallow copy). */
export function getOrdered() {
  return [...items];
}

export function count() {
  return items.length;
}
