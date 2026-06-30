import { describe, it, expect, beforeEach } from 'vitest';
import * as selection from './pageSelection.js';

describe('pageSelection', () => {
  beforeEach(() => selection.clear());

  it('toggle adds then removes an id', () => {
    selection.toggle('p1');
    expect(selection.has('p1')).toBe(true);
    expect(selection.size()).toBe(1);
    selection.toggle('p1');
    expect(selection.has('p1')).toBe(false);
    expect(selection.size()).toBe(0);
  });

  it('ids() returns all currently selected ids', () => {
    selection.toggle('p1');
    selection.toggle('p2');
    expect(selection.ids().sort()).toEqual(['p1', 'p2']);
  });

  it('remove deletes one id without affecting others', () => {
    selection.toggle('p1');
    selection.toggle('p2');
    selection.remove('p1');
    expect(selection.has('p1')).toBe(false);
    expect(selection.has('p2')).toBe(true);
  });

  it('remove of an absent id is a no-op', () => {
    selection.toggle('p1');
    selection.remove('zzz');
    expect(selection.size()).toBe(1);
  });

  it('clear empties the selection', () => {
    selection.toggle('p1');
    selection.toggle('p2');
    selection.clear();
    expect(selection.size()).toBe(0);
    expect(selection.ids()).toEqual([]);
  });
});
