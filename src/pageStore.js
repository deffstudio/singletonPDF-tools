/**
 * State for the page-level editor: a flat, ordered list of pages drawn from every
 * file in the fileStore. Each entry references its source file + 0-based page index.
 * Each entry: { id, fileId, file, name, pageIndex }
 *
 * This is a separate source of truth from fileStore: the editor lets the user
 * reorder and delete individual pages without mutating the underlying files.
 */

let pages = [];
let signature = null;

/** A fingerprint of the file set + page counts; changes when files are added/removed/reordered. */
function fingerprint(items) {
  return items.map((it) => `${it.id}:${it.pageCount}`).join('|');
}

/** Build the flat page list from fileStore items (one entry per page). */
export function rebuildFrom(items) {
  pages = [];
  for (const it of items) {
    for (let i = 0; i < it.pageCount; i++) {
      pages.push({
        id: `${it.id}-p${i}`,
        fileId: it.id,
        file: it.file,
        name: it.name,
        pageIndex: i,
      });
    }
  }
  signature = fingerprint(items);
}

/**
 * Rebuild only if the underlying file set changed since the last build, so that
 * page-level edits survive closing and reopening the editor.
 * @returns {boolean} true if a rebuild happened
 */
export function syncFrom(items) {
  if (fingerprint(items) !== signature) {
    rebuildFrom(items);
    return true;
  }
  return false;
}

export function remove(id) {
  pages = pages.filter((p) => p.id !== id);
}

/** Remove every page whose id is in `ids` (array or Set), in one pass. */
export function removeMany(ids) {
  const idSet = ids instanceof Set ? ids : new Set(ids);
  pages = pages.filter((p) => !idSet.has(p.id));
}

/** Move a page from oldIndex to newIndex (kept in sync with drag-and-drop). */
export function reorder(oldIndex, newIndex) {
  if (
    oldIndex < 0 ||
    newIndex < 0 ||
    oldIndex >= pages.length ||
    newIndex >= pages.length
  ) {
    return;
  }
  const [moved] = pages.splice(oldIndex, 1);
  pages.splice(newIndex, 0, moved);
}

export function getOrdered() {
  return [...pages];
}

export function count() {
  return pages.length;
}
