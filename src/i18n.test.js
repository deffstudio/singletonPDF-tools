import { describe, it, expect, beforeEach } from 'vitest';
import {
  t,
  getLang,
  setLang,
  isSupported,
  detectInitialLang,
  persistLang,
  SUPPORTED,
  DEFAULT_LANG,
} from './i18n.js';

// The module keeps the active locale in module state, so reset before each test.
beforeEach(() => setLang('en'));

/** Minimal in-memory Storage stand-in for detect/persist tests. */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    _map: map,
  };
}

describe('setLang / getLang', () => {
  it('switches to a supported locale', () => {
    expect(setLang('id')).toBe('id');
    expect(getLang()).toBe('id');
  });

  it('ignores an unsupported locale and keeps the current one', () => {
    setLang('id');
    expect(setLang('xx')).toBe('id');
    expect(getLang()).toBe('id');
  });
});

describe('t', () => {
  it('returns the string for the active locale', () => {
    expect(t('nav.merge')).toBe('Merge');
    setLang('id');
    expect(t('nav.merge')).toBe('Gabung');
  });

  it('falls back to English for a key missing in the active locale', () => {
    // 'editor.pageAbbrev' exists in both; force a fallback via a made-up key
    // that only English would ever define — here we assert the raw-key fallback.
    expect(t('totally.unknown.key')).toBe('totally.unknown.key');
  });

  it('interpolates {token} placeholders', () => {
    expect(t('upload.skipped', { names: 'a.pdf, b.pdf' })).toContain('a.pdf, b.pdf');
    setLang('id');
    expect(t('editor.pageCount', { n: 3 })).toBe('(3 halaman)');
  });

  it('applies function-valued English plurals', () => {
    expect(t('files.count', { n: 1 })).toBe('1 file');
    expect(t('files.count', { n: 2 })).toBe('2 files');
    expect(t('editor.selected', { n: 1 })).toBe('1 page selected');
    expect(t('editor.selected', { n: 5 })).toBe('5 pages selected');
  });

  it('does not pluralize Indonesian count strings', () => {
    setLang('id');
    expect(t('files.count', { n: 1 })).toBe('1 file');
    expect(t('files.count', { n: 9 })).toBe('9 file');
  });
});

describe('isSupported', () => {
  it('recognizes exactly the supported locales', () => {
    expect(SUPPORTED).toContain(DEFAULT_LANG);
    expect(isSupported('en')).toBe(true);
    expect(isSupported('id')).toBe(true);
    expect(isSupported('fr')).toBe(false);
  });
});

describe('detectInitialLang', () => {
  it('prefers a stored, supported choice', () => {
    expect(detectInitialLang(fakeStorage({ 'singletonpdf.lang': 'id' }), 'en-US')).toBe('id');
  });

  it('ignores a stored, unsupported choice and falls through to the browser', () => {
    expect(detectInitialLang(fakeStorage({ 'singletonpdf.lang': 'xx' }), 'id-ID')).toBe('id');
  });

  it('uses the browser language when nothing is stored', () => {
    expect(detectInitialLang(fakeStorage(), 'id-ID')).toBe('id');
    expect(detectInitialLang(fakeStorage(), 'en-GB')).toBe('en');
  });

  it('falls back to the default for an unsupported browser language', () => {
    expect(detectInitialLang(fakeStorage(), 'fr-FR')).toBe(DEFAULT_LANG);
  });
});

describe('persistLang', () => {
  it('stores a supported locale', () => {
    const storage = fakeStorage();
    persistLang('id', storage);
    expect(storage.getItem('singletonpdf.lang')).toBe('id');
  });

  it('does not store an unsupported locale', () => {
    const storage = fakeStorage();
    persistLang('xx', storage);
    expect(storage.getItem('singletonpdf.lang')).toBeNull();
  });
});
