import { describe, it, expect, beforeEach } from 'vitest';
import * as pageStore from './pageStore.js';

// 2 files → page ids: a-p0, a-p1, b-p0
function buildFixture() {
  pageStore.rebuildFrom([
    { id: 'a', pageCount: 2, file: {}, name: 'a.pdf' },
    { id: 'b', pageCount: 1, file: {}, name: 'b.pdf' },
  ]);
}

describe('pageStore.removeMany', () => {
  beforeEach(buildFixture);

  it('removes every page whose id is in the array', () => {
    pageStore.removeMany(['a-p0', 'b-p0']);
    expect(pageStore.getOrdered().map((p) => p.id)).toEqual(['a-p1']);
  });

  it('accepts a Set', () => {
    pageStore.removeMany(new Set(['a-p1']));
    expect(pageStore.getOrdered().map((p) => p.id)).toEqual(['a-p0', 'b-p0']);
  });

  it('ignores ids that are not present', () => {
    pageStore.removeMany(['nope']);
    expect(pageStore.count()).toBe(3);
  });

  it('treats an empty list as a no-op', () => {
    pageStore.removeMany([]);
    expect(pageStore.count()).toBe(3);
  });
});
