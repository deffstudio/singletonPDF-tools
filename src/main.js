import './style.css';
import Sortable from 'sortablejs';
import * as fileStore from './fileStore.js';
import * as pageStore from './pageStore.js';
import * as selection from './pageSelection.js';
import { mergePdfs, mergePages } from './pdfMerge.js';
import { compressPdf, PRESETS } from './pdfCompress.js';
import { renderThumbnail, clearThumbnailCache } from './thumbnails.js';
import {
  t,
  getLang,
  setLang,
  persistLang,
  detectInitialLang,
} from './i18n.js';

// --- Element refs ---
const toolTabs = [...document.querySelectorAll('.tool-tab')];
const panels = {
  merge: document.getElementById('panel-merge'),
  pages: document.getElementById('panel-pages'),
  compress: document.getElementById('panel-compress'),
};

const dropZone = document.getElementById('drop-zone');
const browseBtn = document.getElementById('browse-btn');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const emptyState = document.getElementById('empty-state');
const fileCount = document.getElementById('file-count');
const mergeBtn = document.getElementById('merge-btn');
const outputName = document.getElementById('output-name');
const errorMsg = document.getElementById('error-msg');

const resetPagesBtn = document.getElementById('reset-pages-btn');
const pageGrid = document.getElementById('page-grid');
const pageEmpty = document.getElementById('page-empty');
const pageCount = document.getElementById('page-count');
const mergePagesBtn = document.getElementById('merge-pages-btn');
const editorOutputName = document.getElementById('editor-output-name');
const editorError = document.getElementById('editor-error');
const pageBulkBar = document.getElementById('page-bulk-bar');
const bulkCount = document.getElementById('bulk-count');
const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
const bulkClearBtn = document.getElementById('bulk-clear-btn');
const pagePreview = document.getElementById('page-preview');

const compressLevels = document.getElementById('compress-levels');
const compressBtn = document.getElementById('compress-btn');
const compressError = document.getElementById('compress-error');
const compressResults = document.getElementById('compress-results');

const langSelect = document.getElementById('lang-select');

// --- Helpers ---
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function setError(el, message) {
  if (message) {
    el.textContent = message;
    el.classList.remove('hidden');
  } else {
    el.textContent = '';
    el.classList.add('hidden');
  }
}

/** Wrap merged bytes in a Blob and trigger a download with a .pdf-suffixed name. */
function downloadPdf(bytes, rawName) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  let name = (rawName || 'merged').trim() || 'merged';
  if (!name.toLowerCase().endsWith('.pdf')) name += '.pdf';

  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Run an async merge with button loading state + error reporting. */
async function withMerge(button, errorEl, fn) {
  setError(errorEl, '');
  const original = button.textContent;
  button.disabled = true;
  button.textContent = t('common.processing');
  try {
    await fn();
  } catch (err) {
    setError(errorEl, err.message || t('common.genericError'));
  } finally {
    button.textContent = original;
    button.disabled = false;
  }
}

// ======================= Main view: file list =======================
function renderFileList() {
  const items = fileStore.getOrdered();
  fileList.innerHTML = '';

  for (const item of items) {
    const li = document.createElement('li');
    li.dataset.id = item.id;
    li.className =
      'flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm';

    li.innerHTML = `
      <span class="drag-handle cursor-grab select-none text-slate-300 hover:text-slate-500" title="${escapeHtml(t('fileItem.dragTitle'))}">
        <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path d="M7 4a1 1 0 110 2 1 1 0 010-2zm0 5a1 1 0 110 2 1 1 0 010-2zm0 5a1 1 0 110 2 1 1 0 010-2zm6-10a1 1 0 110 2 1 1 0 010-2zm0 5a1 1 0 110 2 1 1 0 010-2zm0 5a1 1 0 110 2 1 1 0 010-2z"/></svg>
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-slate-700">${escapeHtml(item.name)}</p>
        <p class="text-xs text-slate-400">${escapeHtml(t('fileItem.pages', { n: item.pageCount }))} · ${formatSize(item.size)}</p>
      </div>
      <button type="button" class="remove-btn rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600" title="${escapeHtml(t('fileItem.removeTitle'))}">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
      </button>
    `;

    li.querySelector('.remove-btn').addEventListener('click', () => {
      fileStore.remove(item.id);
      renderFileList();
    });

    fileList.appendChild(li);
  }

  const n = fileStore.count();
  emptyState.classList.toggle('hidden', n > 0);
  fileCount.textContent = n > 0 ? t('files.count', { n }) : '';
  mergeBtn.disabled = n < 2;
  compressBtn.disabled = n < 1;
}

async function handleFiles(files) {
  setError(errorMsg, '');
  const { added, skipped } = await fileStore.add(files);
  renderFileList();
  if (skipped.length > 0) {
    setError(
      errorMsg,
      t('upload.skipped', { names: skipped.join(', ') }) +
        (added > 0 ? ` · ${t('upload.added', { n: added })}` : '')
    );
  }
}

// --- Wiring: upload ---
browseBtn.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', (e) => {
  if (e.target === browseBtn) return;
  fileInput.click();
});
fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
  fileInput.value = ''; // allow selecting the same file again
});
['dragenter', 'dragover'].forEach((evt) =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add('border-blue-500', 'bg-blue-50');
  })
);
['dragleave', 'drop'].forEach((evt) =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-500', 'bg-blue-50');
  })
);
dropZone.addEventListener('drop', (e) => {
  if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
});

// --- Wiring: file reorder ---
Sortable.create(fileList, {
  handle: '.drag-handle',
  animation: 150,
  ghostClass: 'opacity-40',
  onEnd: (evt) => {
    if (evt.oldIndex !== evt.newIndex) fileStore.reorder(evt.oldIndex, evt.newIndex);
  },
});

// --- Wiring: whole-file merge ---
mergeBtn.addEventListener('click', () => {
  const items = fileStore.getOrdered();
  if (items.length < 2) return;
  withMerge(mergeBtn, errorMsg, async () => {
    const bytes = await mergePdfs(items.map((it) => it.file));
    downloadPdf(bytes, outputName.value);
  });
});

// ======================= Editor view: page grid =======================
// Lazily render thumbnails only as their cards scroll into view.
let thumbObserver = null;

function ensureObserver() {
  if (thumbObserver) return thumbObserver;
  thumbObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const canvas = entry.target;
        thumbObserver.unobserve(canvas);
        const { file, pageIndex } = canvas._page;
        renderThumbnail(file, pageIndex, canvas, 180).catch(() => {
          canvas.parentElement.innerHTML = `<span class="text-xs text-red-400">${escapeHtml(t('editor.previewFailed'))}</span>`;
        });
      }
    },
    { root: null, rootMargin: '300px' }
  );
  return thumbObserver;
}

/** Renumber the position badges to match current DOM order (after a drag). */
function renumberBadges() {
  pageGrid.querySelectorAll('.page-card .pos-badge').forEach((badge, i) => {
    badge.textContent = i + 1;
  });
}

// Transient editor view state: which page is shown large in the preview pane.
// Selection itself lives in the pageSelection module.
let focusedId = null;

function clearPreview() {
  focusedId = null;
  pagePreview.innerHTML = `<span id="preview-empty" class="px-4 text-center text-xs text-slate-400">${escapeHtml(t('editor.previewEmpty'))}</span>`;
}

function focusPage(id) {
  const page = pageStore.getOrdered().find((p) => p.id === id);
  if (!page) {
    clearPreview();
    return;
  }
  focusedId = id;
  pagePreview.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.className = 'max-h-[70vh] w-auto rounded shadow-sm';
  pagePreview.appendChild(canvas);
  renderThumbnail(page.file, page.pageIndex, canvas, 600).catch(() => {
    pagePreview.innerHTML = `<span class="px-4 text-center text-xs text-red-400">${escapeHtml(t('editor.previewFailed'))}</span>`;
  });
}

function applySelectionStyles() {
  pageGrid.querySelectorAll('.page-card').forEach((card) => {
    const sel = selection.has(card.dataset.id);
    card.classList.toggle('ring-2', sel);
    card.classList.toggle('ring-blue-500', sel);
    const badge = card.querySelector('.select-badge');
    if (badge) badge.classList.toggle('hidden', !sel);
  });
  const n = selection.size();
  pageBulkBar.classList.toggle('hidden', n === 0);
  pageBulkBar.classList.toggle('flex', n > 0);
  bulkCount.textContent = n > 0 ? t('editor.selected', { n }) : '';
}

function toggleSelect(id) {
  selection.toggle(id);
  applySelectionStyles();
}

// Forget the focused page when it is removed.
function resetPreviewIfFocusedRemoved() {
  clearPreview();
}

// Clear all transient editor state.
function resetEditorViewState() {
  selection.clear();
  clearPreview();
  applySelectionStyles();
}

function renderPageGrid() {
  const observer = ensureObserver();
  pageGrid.innerHTML = '';
  const pages = pageStore.getOrdered();

  pages.forEach((p, i) => {
    const card = document.createElement('div');
    card.className =
      'page-card group relative rounded-xl border border-slate-200 bg-white p-2 shadow-sm';
    card.dataset.id = p.id;

    card.innerHTML = `
      <span class="pos-badge absolute left-1.5 top-1.5 z-10 rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">${i + 1}</span>
      <span class="select-badge absolute bottom-9 left-1.5 z-10 hidden rounded-full bg-blue-600 p-0.5 text-white shadow">
        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="m5 13 4 4L19 7"/></svg>
      </span>
      <button type="button" class="page-zoom absolute right-1.5 top-1.5 z-10 rounded-md bg-white/90 p-1 text-slate-400 opacity-0 shadow transition hover:text-blue-600 group-hover:opacity-100" title="${escapeHtml(t('editor.zoomTitle'))}">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14zM8 11h6"/></svg>
      </button>
      <button type="button" class="page-delete absolute right-1.5 top-9 z-10 rounded-md bg-white/90 p-1 text-slate-400 opacity-0 shadow transition hover:text-red-600 group-hover:opacity-100" title="${escapeHtml(t('editor.deleteTitle'))}">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
      </button>
      <div class="canvas-wrap flex h-40 cursor-grab items-center justify-center overflow-hidden rounded-lg bg-slate-50">
        <span class="text-xs text-slate-300">${escapeHtml(t('editor.loading'))}</span>
      </div>
      <p class="mt-1.5 truncate text-[11px] text-slate-500" title="${escapeHtml(p.name)} · ${escapeHtml(t('editor.pageTitle', { n: p.pageIndex + 1 }))}">
        ${escapeHtml(p.name)} · ${escapeHtml(t('editor.pageAbbrev', { n: p.pageIndex + 1 }))}
      </p>
    `;

    const wrap = card.querySelector('.canvas-wrap');
    const canvas = document.createElement('canvas');
    canvas.className = 'max-h-full w-auto rounded shadow-sm';
    canvas._page = { file: p.file, pageIndex: p.pageIndex };
    wrap.innerHTML = '';
    wrap.appendChild(canvas);
    observer.observe(canvas);

    card.addEventListener('click', (e) => {
      // Buttons handle their own clicks; don't toggle selection for them.
      if (e.target.closest('.page-delete') || e.target.closest('.page-zoom')) return;
      toggleSelect(p.id);
    });

    card.querySelector('.page-zoom').addEventListener('click', (e) => {
      e.stopPropagation();
      focusPage(p.id);
    });

    card.querySelector('.page-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      selection.remove(p.id);
      if (focusedId === p.id) resetPreviewIfFocusedRemoved();
      pageStore.remove(p.id);
      renderPageGrid();
    });

    pageGrid.appendChild(card);
  });

  const n = pageStore.count();
  pageEmpty.classList.toggle('hidden', n > 0);
  pageGrid.classList.toggle('hidden', n === 0);
  pageCount.textContent = n > 0 ? t('editor.pageCount', { n }) : '';
  mergePagesBtn.disabled = n < 1;
  applySelectionStyles();
}

// --- Wiring: page reorder ---
Sortable.create(pageGrid, {
  animation: 150,
  ghostClass: 'opacity-40',
  filter: '.page-delete, .page-zoom', // don't start a drag from the per-card buttons
  onEnd: (evt) => {
    if (evt.oldIndex !== evt.newIndex) {
      pageStore.reorder(evt.oldIndex, evt.newIndex);
      renumberBadges();
    }
  },
});

// --- Wiring: bulk selection actions ---
bulkDeleteBtn.addEventListener('click', () => {
  if (selection.size() === 0) return;
  const ids = selection.ids();
  if (focusedId && selection.has(focusedId)) resetPreviewIfFocusedRemoved();
  pageStore.removeMany(ids);
  selection.clear();
  renderPageGrid();
});

bulkClearBtn.addEventListener('click', () => {
  selection.clear();
  applySelectionStyles();
});

// --- Wiring: tool nav ---
const ACTIVE_TAB = ['bg-blue-600', 'text-white', 'shadow-sm'];
const INACTIVE_TAB = ['text-slate-600', 'hover:bg-slate-50', 'hover:text-slate-900'];

function showTool(name) {
  for (const tab of toolTabs) {
    const active = tab.dataset.tool === name;
    ACTIVE_TAB.forEach((c) => tab.classList.toggle(c, active));
    INACTIVE_TAB.forEach((c) => tab.classList.toggle(c, !active));
  }
  for (const [key, panel] of Object.entries(panels)) {
    panel.classList.toggle('hidden', key !== name);
  }

  if (name === 'pages') {
    // Rebuild from files only if the file set changed; otherwise keep page edits.
    if (pageStore.syncFrom(fileStore.getOrdered())) {
      clearThumbnailCache();
      resetEditorViewState();
    }
    setError(editorError, '');
    renderPageGrid();
  }
}

toolTabs.forEach((tab) =>
  tab.addEventListener('click', () => showTool(tab.dataset.tool))
);

resetPagesBtn.addEventListener('click', () => {
  pageStore.rebuildFrom(fileStore.getOrdered());
  resetEditorViewState();
  setError(editorError, '');
  renderPageGrid();
});

// --- Wiring: page-level merge ---
mergePagesBtn.addEventListener('click', () => {
  const pages = pageStore.getOrdered();
  if (pages.length < 1) return;
  withMerge(mergePagesBtn, editorError, async () => {
    const bytes = await mergePages(
      pages.map((p) => ({ file: p.file, pageIndex: p.pageIndex }))
    );
    downloadPdf(bytes, editorOutputName.value);
  });
});

// ======================= Compress tool =======================
let compressLevel = 'recommended';

function renderCompressLevels() {
  compressLevels.innerHTML = '';
  for (const [key, preset] of Object.entries(PRESETS)) {
    const selected = key === compressLevel;
    const card = document.createElement('button');
    card.type = 'button';
    card.dataset.level = key;
    card.className =
      'rounded-xl border px-3 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-400 ' +
      (selected
        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
        : 'border-slate-200 bg-white hover:border-blue-300');
    card.innerHTML = `
      <span class="block text-sm font-semibold ${selected ? 'text-blue-700' : 'text-slate-700'}">${escapeHtml(t(`compress.preset.${key}.label`))}</span>
      <span class="mt-0.5 block text-xs text-slate-400">${escapeHtml(t(`compress.preset.${key}.hint`))}</span>
    `;
    card.addEventListener('click', () => {
      compressLevel = key;
      renderCompressLevels();
    });
    compressLevels.appendChild(card);
  }
}

/** Strip a trailing .pdf (any case) so we can append a suffix cleanly. */
function baseName(name) {
  return name.replace(/\.pdf$/i, '');
}

compressBtn.addEventListener('click', () => {
  const items = fileStore.getOrdered();
  if (items.length < 1) return;

  compressResults.innerHTML = '';
  const preset = PRESETS[compressLevel];

  withMerge(compressBtn, compressError, async () => {
    for (const item of items) {
      const bytes = await compressPdf(item.file, preset);
      const before = item.size;
      const after = bytes.byteLength;
      const pct = before > 0 ? Math.round((1 - after / before) * 100) : 0;
      const smaller = after < before;

      const li = document.createElement('li');
      li.className =
        'flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm';
      li.innerHTML = `
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium text-slate-700">${escapeHtml(item.name)}</p>
          <p class="text-xs text-slate-400">
            ${formatSize(before)} → ${formatSize(after)}
            <span class="font-semibold ${smaller ? 'text-green-600' : 'text-amber-600'}">
              ${smaller ? `−${pct}%` : `+${Math.abs(pct)}%`}
            </span>
          </p>
        </div>
        <span class="shrink-0 text-xs font-medium text-green-600">${escapeHtml(t('common.downloaded'))}</span>
      `;
      compressResults.appendChild(li);

      downloadPdf(bytes, `${baseName(item.name)}-compressed`);
    }
  });
});

// ======================= Localization =======================
/** Translate every static `[data-i18n]` element, plus the title and <html lang>. */
function applyStaticTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.title = t('app.documentTitle');
  document.documentElement.lang = getLang();
}

/** Re-render all copy after the locale changes (static + dynamically-built). */
function refreshLanguage() {
  applyStaticTranslations();
  renderFileList();
  renderCompressLevels();
  renderPageGrid(); // keeps editor copy in sync; harmless while the panel is hidden
  if (!focusedId) clearPreview();
}

langSelect.addEventListener('change', () => {
  const lang = setLang(langSelect.value);
  langSelect.value = lang; // reflect any normalization
  persistLang(lang);
  refreshLanguage();
});

// --- Init ---
const initialLang = detectInitialLang();
setLang(initialLang);
langSelect.value = initialLang;

applyStaticTranslations();
renderFileList();
renderCompressLevels();
showTool('merge');
