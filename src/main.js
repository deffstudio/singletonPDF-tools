import './style.css';
import Sortable from 'sortablejs';
import * as fileStore from './fileStore.js';
import { mergePdfs } from './pdfMerge.js';

// --- Element refs ---
const dropZone = document.getElementById('drop-zone');
const browseBtn = document.getElementById('browse-btn');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const emptyState = document.getElementById('empty-state');
const fileCount = document.getElementById('file-count');
const mergeBtn = document.getElementById('merge-btn');
const outputName = document.getElementById('output-name');
const errorMsg = document.getElementById('error-msg');

// --- Helpers ---
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.remove('hidden');
}

function clearError() {
  errorMsg.textContent = '';
  errorMsg.classList.add('hidden');
}

// --- Rendering ---
function renderList() {
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
      renderList();
    });

    fileList.appendChild(li);
  }

  updateUiState();
}

function updateUiState() {
  const n = fileStore.count();
  emptyState.classList.toggle('hidden', n > 0);
  fileCount.textContent = n > 0 ? `${n} file${n === 1 ? '' : 's'}` : '';
  mergeBtn.disabled = n < 2;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- File intake ---
async function handleFiles(fileList) {
  clearError();
  const { added, skipped } = await fileStore.add(fileList);
  renderList();
  if (skipped.length > 0) {
    showError(
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

// --- Wiring: drag-and-drop reorder ---
Sortable.create(fileList, {
  handle: '.drag-handle',
  animation: 150,
  ghostClass: 'opacity-40',
  onEnd: (evt) => {
    if (evt.oldIndex !== evt.newIndex) {
      fileStore.reorder(evt.oldIndex, evt.newIndex);
    }
  },
});

// --- Wiring: merge & download ---
mergeBtn.addEventListener('click', async () => {
  clearError();
  const items = fileStore.getOrdered();
  if (items.length < 2) return;

  const original = mergeBtn.textContent;
  mergeBtn.disabled = true;
  mergeBtn.textContent = 'Processing…';

  try {
    const bytes = await mergePdfs(items.map((it) => it.file));
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    let name = (outputName.value || 'merged').trim() || 'merged';
    if (!name.toLowerCase().endsWith('.pdf')) name += '.pdf';

    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    showError(err.message || 'Something went wrong while merging the PDFs.');
  } finally {
    mergeBtn.textContent = original;
    updateUiState();
  }
});

// --- Init ---
renderList();
