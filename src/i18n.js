// Lightweight, dependency-free i18n layer for the app.
//
// One flat, keyed dictionary per locale. Values are either strings (optionally
// containing `{placeholder}` tokens) or functions `(params) => string` for copy
// whose wording depends on a value (e.g. English plurals). `t(key, params)`
// resolves the active locale, falling back to English for any missing key so a
// partially-translated locale can never render a blank.
//
// This module is pure logic (no DOM). `main.js` owns applying translations to
// the page; see `applyTranslations` there.

const STORAGE_KEY = 'singletonpdf.lang';
export const SUPPORTED = ['en', 'id'];
export const DEFAULT_LANG = 'en';

const en = {
  'app.documentTitle': 'Singleton PDF — Merge, Edit & Compress PDFs in Your Browser',
  'app.tagline':
    'Merge, edit, and compress PDFs. Processed right in your browser —',
  'app.taglineEmphasis': 'no files are uploaded.',

  'nav.merge': 'Merge',
  'nav.pages': 'Pages',
  'nav.compress': 'Compress',

  'drop.title': 'Drag & drop PDF files here',
  'drop.or': 'or',
  'drop.choose': 'Choose PDFs',

  'files.heading': 'Files',
  'files.empty': 'No files yet. Add one or more PDFs to get started.',
  'files.count': (p) => `${p.n} file${p.n === 1 ? '' : 's'}`,

  'fileItem.dragTitle': 'Drag to reorder',
  'fileItem.removeTitle': 'Remove',
  'fileItem.pages': (p) => `${p.n} page${p.n === 1 ? '' : 's'}`,

  'upload.skipped': 'Skipped (not a valid PDF): {names}',
  'upload.added': (p) => `${p.n} file${p.n === 1 ? '' : 's'} added.`,

  'merge.outputLabel': 'Output file name',
  'merge.button': 'Merge & Download',
  'merge.hint': 'Add at least 2 PDFs to merge them into one.',

  'common.processing': 'Processing…',
  'common.genericError': 'Something went wrong while building the PDF.',
  'common.downloaded': 'Downloaded',

  'editor.title': 'Page Editor',
  'editor.help':
    'Drag to reorder · click a page to select · use the bar to delete several at once · the search icon previews a page.',
  'editor.reset': 'Reset to file order',
  'editor.pageCount': (p) => `(${p.n} page${p.n === 1 ? '' : 's'})`,
  'editor.empty': 'No pages left. Reset to file order, or add files above.',
  'editor.bulkDelete': 'Delete selected',
  'editor.bulkClear': 'Clear selection',
  'editor.selected': (p) => `${p.n} page${p.n === 1 ? '' : 's'} selected`,
  'editor.previewHeading': 'Preview',
  'editor.previewEmpty': 'Click the search icon on a page to preview it here.',
  'editor.previewFailed': 'preview failed',
  'editor.loading': 'loading…',
  'editor.zoomTitle': 'Preview page',
  'editor.deleteTitle': 'Remove page',
  'editor.pageTitle': 'page {n}',
  'editor.pageAbbrev': 'p.{n}',

  'compress.levelLabel': 'Compression level',
  'compress.note':
    'Pages are rendered as images to shrink the file, so text becomes non-selectable in the result.',
  'compress.button': 'Compress & Download',
  'compress.hint': 'Add at least 1 PDF to compress.',
  'compress.preset.less.label': 'Less',
  'compress.preset.less.hint': 'Larger, sharper',
  'compress.preset.recommended.label': 'Recommended',
  'compress.preset.recommended.hint': 'Balanced',
  'compress.preset.strong.label': 'Strong',
  'compress.preset.strong.hint': 'Smallest file',

  'footer.credits': '100% client-side · pdf-lib · pdf.js · SortableJS',

  'lang.label': 'Language',
  'lang.english': 'English',
  'lang.indonesian': 'Indonesian',
};

// Bahasa Indonesia. Indonesian nouns are not pluralized, so count strings use a
// single `{n}` template. Any key omitted here falls back to English via `t`.
const id = {
  'app.documentTitle': 'Singleton PDF — Gabung, Edit & Kompres PDF di Browser',
  'app.tagline':
    'Gabung, edit, dan kompres PDF. Diproses langsung di browser kamu —',
  'app.taglineEmphasis': 'tidak ada file yang diunggah.',

  'nav.merge': 'Gabung',
  'nav.pages': 'Halaman',
  'nav.compress': 'Kompres',

  'drop.title': 'Tarik & letakkan file PDF di sini',
  'drop.or': 'atau',
  'drop.choose': 'Pilih PDF',

  'files.heading': 'File',
  'files.empty': 'Belum ada file. Tambahkan satu atau beberapa PDF untuk mulai.',
  'files.count': '{n} file',

  'fileItem.dragTitle': 'Tarik untuk mengatur urutan',
  'fileItem.removeTitle': 'Hapus',
  'fileItem.pages': '{n} halaman',

  'upload.skipped': 'Dilewati (bukan PDF yang valid): {names}',
  'upload.added': '{n} file ditambahkan.',

  'merge.outputLabel': 'Nama file hasil',
  'merge.button': 'Gabung & Unduh',
  'merge.hint': 'Tambahkan minimal 2 PDF untuk menggabungkannya jadi satu.',

  'common.processing': 'Memproses…',
  'common.genericError': 'Terjadi kesalahan saat membuat PDF.',
  'common.downloaded': 'Terunduh',

  'editor.title': 'Editor Halaman',
  'editor.help':
    'Tarik untuk mengatur urutan · klik halaman untuk memilih · pakai bilah untuk menghapus beberapa sekaligus · ikon cari untuk melihat pratinjau halaman.',
  'editor.reset': 'Kembalikan ke urutan file',
  'editor.pageCount': '({n} halaman)',
  'editor.empty': 'Tidak ada halaman tersisa. Kembalikan ke urutan file, atau tambahkan file di atas.',
  'editor.bulkDelete': 'Hapus yang dipilih',
  'editor.bulkClear': 'Batalkan pilihan',
  'editor.selected': '{n} halaman dipilih',
  'editor.previewHeading': 'Pratinjau',
  'editor.previewEmpty': 'Klik ikon cari pada sebuah halaman untuk melihat pratinjaunya di sini.',
  'editor.previewFailed': 'pratinjau gagal',
  'editor.loading': 'memuat…',
  'editor.zoomTitle': 'Pratinjau halaman',
  'editor.deleteTitle': 'Hapus halaman',
  'editor.pageTitle': 'halaman {n}',
  'editor.pageAbbrev': 'hlm.{n}',

  'compress.levelLabel': 'Tingkat kompresi',
  'compress.note':
    'Halaman dijadikan gambar untuk memperkecil ukuran file, jadi teks pada hasilnya tidak bisa diseleksi.',
  'compress.button': 'Kompres & Unduh',
  'compress.hint': 'Tambahkan minimal 1 PDF untuk dikompres.',
  'compress.preset.less.label': 'Ringan',
  'compress.preset.less.hint': 'Lebih besar, lebih tajam',
  'compress.preset.recommended.label': 'Disarankan',
  'compress.preset.recommended.hint': 'Seimbang',
  'compress.preset.strong.label': 'Kuat',
  'compress.preset.strong.hint': 'File paling kecil',

  'footer.credits': '100% di sisi klien · pdf-lib · pdf.js · SortableJS',

  'lang.label': 'Bahasa',
  'lang.english': 'Inggris',
  'lang.indonesian': 'Bahasa Indonesia',
};

const translations = { en, id };

let currentLang = DEFAULT_LANG;

/** Fill `{token}` placeholders in a template string from `params`. */
function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in params ? String(params[key]) : match
  );
}

/**
 * Translate `key` in the active locale. Missing keys fall back to English, then
 * to the raw key. `params` fills `{token}` placeholders and is passed to any
 * function-valued entry (used for wording that depends on a count).
 */
export function t(key, params) {
  const entry =
    translations[currentLang]?.[key] ?? translations[DEFAULT_LANG][key];
  if (entry === undefined) return key;
  if (typeof entry === 'function') return entry(params ?? {});
  return interpolate(entry, params);
}

/** The active locale code (e.g. 'en' or 'id'). */
export function getLang() {
  return currentLang;
}

/** Whether `lang` is a supported locale. */
export function isSupported(lang) {
  return SUPPORTED.includes(lang);
}

/** Set the active locale (no-op for unsupported codes). Returns the active code. */
export function setLang(lang) {
  if (isSupported(lang)) currentLang = lang;
  return currentLang;
}

/**
 * Resolve the initial locale: a previously stored choice wins, otherwise the
 * browser's preferred language if we support it, otherwise the default.
 * `storage` and `navigatorLang` are injectable for testing.
 */
export function detectInitialLang(
  storage = globalThis.localStorage,
  navigatorLang = globalThis.navigator?.language
) {
  const stored = storage?.getItem(STORAGE_KEY);
  if (stored && isSupported(stored)) return stored;
  const base = (navigatorLang || '').slice(0, 2).toLowerCase();
  return isSupported(base) ? base : DEFAULT_LANG;
}

/** Persist the chosen locale so it survives reloads. */
export function persistLang(lang, storage = globalThis.localStorage) {
  if (isSupported(lang)) storage?.setItem(STORAGE_KEY, lang);
}
