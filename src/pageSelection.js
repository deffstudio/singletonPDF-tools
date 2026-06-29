/**
 * Transient selection state for the Page Editor: the set of selected page ids.
 * Module-level singleton, mirroring fileStore/pageStore. Pure — no DOM, no imports —
 * so it is unit-testable in isolation. main.js drives all rendering from this state.
 */
let selected = new Set();

/** Add the id if absent, remove it if present. */
export function toggle(id) {
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
}

export function has(id) {
  return selected.has(id);
}

/** Remove a single id (no-op if it isn't selected). */
export function remove(id) {
  selected.delete(id);
}

export function clear() {
  selected.clear();
}

/** All selected ids, as a new array. */
export function ids() {
  return [...selected];
}

export function size() {
  return selected.size;
}
