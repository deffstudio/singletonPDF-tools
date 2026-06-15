import './style.css';
import Sortable from 'sortablejs';
import * as fileStore from './fileStore.js';
import * as pageStore from './pageStore.js';
import { mergePdfs, mergePages } from './pdfMerge.js';
import { renderThumbnail, clearThumbnailCache } from './thumbnails.js';

// --- Element refs ---
const mainView = document.getElementById('main-view');
const editorView = document.getElementById('editor-view');

const dropZone = document.getElementById('drop-zone');
const browseBtn = document.getElementById('browse-btn');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const emptyState = document.getElementById('empty-state');
const fileCount = document.getElementById('file-count');
const mergeBtn = document.getElementById('merge-btn');
const editPagesBtn = document.getElementById('edit-pages-btn');
const outputName = document.getElementById('output-name');
const errorMsg = document.getElementById('error-msg');

const backBtn = document.getElementById('back-btn');
const resetPagesBtn = document.getElementById('reset-pages-btn');
const pageGrid = document.getElementById('page-grid');
const pageEmpty = document.getElementById('page-empty');
const pageCount = document.getElementById('page-count');
const mergePagesBtn = document.getElementById('merge-pages-btn');
const editorOutputName = document.getElementById('editor-output-name');
const editorError = document.getElementById('editor-error');

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
  button.textContent = 'Processing…';
  try {
    await fn();
  } catch (err) {
    setError(errorEl, err.message || 'Something went wrong while building the PDF.');
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
      <span class="drag-handle cursor-grab select-none text-slate-300 hover:text-slate-500" title="Drag to reorder">
        <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path d="M7 4a1 1 0 110 2 1 1 0 010-2zm0 5a1 1 0 110 2 1 1 0 010-2zm0 5a1 1 0 110 2 1 1 0 010-2zm6-10a1 1 0 110 2 1 1 0 010-2zm0 5a1 1 0 110 2 1 1 0 010-2zm0 5a1 1 0 110 2 1 1 0 010-2z"/></svg>
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-slate-700">${escapeHtml(item.name)}</p>
        <p class="text-xs text-slate-400">${item.pageCount} pages · ${formatSize(item.size)}</p>
      </div>
      <button type="button" class="remove-btn rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600" title="Remove">
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
  fileCount.textContent = n > 0 ? `${n} file${n === 1 ? '' : 's'}` : '';
  mergeBtn.disabled = n < 2;
  editPagesBtn.disabled = n < 1;
}

async function handleFiles(files) {
  setError(errorMsg, '');
  const { added, skipped } = await fileStore.add(files);
  renderFileList();
  if (skipped.length > 0) {
    setError(
      errorMsg,
      `Skipped (not a valid PDF): ${skipped.join(', ')}` +
        (added > 0 ? ` · ${added} file${added === 1 ? '' : 's'} added.` : '')
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
          canvas.parentElement.innerHTML =
            '<span class="text-xs text-red-400">preview failed</span>';
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
      <button type="button" class="page-delete absolute right-1.5 top-1.5 z-10 rounded-md bg-white/90 p-1 text-slate-400 opacity-0 shadow transition hover:text-red-600 group-hover:opacity-100" title="Remove page">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
      </button>
      <div class="canvas-wrap flex h-40 cursor-grab items-center justify-center overflow-hidden rounded-lg bg-slate-50">
        <span class="text-xs text-slate-300">loading…</span>
      </div>
      <p class="mt-1.5 truncate text-[11px] text-slate-500" title="${escapeHtml(p.name)} · page ${p.pageIndex + 1}">
        ${escapeHtml(p.name)} · p.${p.pageIndex + 1}
      </p>
    `;

    const wrap = card.querySelector('.canvas-wrap');
    const canvas = document.createElement('canvas');
    canvas.className = 'max-h-full w-auto rounded shadow-sm';
    canvas._page = { file: p.file, pageIndex: p.pageIndex };
    wrap.innerHTML = '';
    wrap.appendChild(canvas);
    observer.observe(canvas);

    card.querySelector('.page-delete').addEventListener('click', () => {
      pageStore.remove(p.id);
      renderPageGrid();
    });

    pageGrid.appendChild(card);
  });

  const n = pageStore.count();
  pageEmpty.classList.toggle('hidden', n > 0);
  pageGrid.classList.toggle('hidden', n === 0);
  pageCount.textContent = n > 0 ? `(${n} page${n === 1 ? '' : 's'})` : '';
  mergePagesBtn.disabled = n < 1;
}

// --- Wiring: page reorder ---
Sortable.create(pageGrid, {
  animation: 150,
  ghostClass: 'opacity-40',
  filter: '.page-delete', // don't start a drag from the delete button
  onEnd: (evt) => {
    if (evt.oldIndex !== evt.newIndex) {
      pageStore.reorder(evt.oldIndex, evt.newIndex);
      renumberBadges();
    }
  },
});

// --- Wiring: view toggle ---
function showEditor() {
  // Rebuild from files only if the file set changed; otherwise keep page edits.
  if (pageStore.syncFrom(fileStore.getOrdered())) clearThumbnailCache();
  setError(editorError, '');
  mainView.classList.add('hidden');
  editorView.classList.remove('hidden');
  renderPageGrid();
}

function showMain() {
  editorView.classList.add('hidden');
  mainView.classList.remove('hidden');
}

editPagesBtn.addEventListener('click', () => {
  if (fileStore.count() >= 1) showEditor();
});
backBtn.addEventListener('click', showMain);

resetPagesBtn.addEventListener('click', () => {
  pageStore.rebuildFrom(fileStore.getOrdered());
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

// --- Init ---
renderFileList();
