const storageKey = 'slipstream.expenses.v1';
const sampleExpenses = [
  { id: 'sample-1', vendor: 'Fieldwork Coffee', date: '2026-10-12', amount: 18.5, tax: 1.48, currency: 'USD', category: 'Meals', payment: 'Business card', sample: true },
  { id: 'sample-2', vendor: 'Adobe', date: '2026-10-10', amount: 22.99, tax: 0, currency: 'USD', category: 'Software', payment: 'Visa · 2048', sample: true },
  { id: 'sample-3', vendor: 'Metro Transit', date: '2026-10-08', amount: 5.5, tax: null, currency: 'USD', category: 'Travel', payment: 'Contactless', sample: true },
  { id: 'sample-4', vendor: 'Paper & Press', date: '2026-10-04', amount: 34.2, tax: 2.74, currency: 'USD', category: 'Office', payment: 'Business card', sample: true },
];

const elements = {
  rows: document.querySelector('#receipt-rows'),
  empty: document.querySelector('#empty-state'),
  count: document.querySelector('#table-count'),
  total: document.querySelector('#total-value'),
  receiptCount: document.querySelector('#receipt-count'),
  reviewCount: document.querySelector('#review-count'),
  filterReviewCount: document.querySelector('#filter-review-count'),
  search: document.querySelector('#search-input'),
  dialog: document.querySelector('#expense-dialog'),
  form: document.querySelector('#expense-form'),
  fileInput: document.querySelector('#file-input'),
  toast: document.querySelector('#toast'),
  model: document.querySelector('#model-select'),
  notice: document.querySelector('#model-notice'),
  badge: document.querySelector('#connection-badge'),
};

let expenses = loadExpenses();
let activeFilter = 'All';
let toastTimer;

function loadExpenses() {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : sampleExpenses;
  } catch {
    return sampleExpenses;
  }
}

function saveExpenses() {
  expenses = expenses.filter((expense) => !expense.sample);
  localStorage.setItem(storageKey, JSON.stringify(expenses));
  render();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function formatCurrency(amount, currency = 'USD') {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function formatDate(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '—';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
}

function needsReview(expense) {
  return !expense.date || expense.amount === null || expense.amount === undefined || expense.amount === '' || !Number.isFinite(Number(expense.amount));
}

function merchantInitials(name) {
  return String(name || '?').split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
}

function visibleExpenses() {
  const query = elements.search.value.trim().toLowerCase();
  return expenses.filter((expense) => {
    const matchesFilter = activeFilter === 'All'
      || (activeFilter === 'Needs review' ? needsReview(expense) : expense.category === activeFilter);
    const matchesQuery = !query || `${expense.vendor} ${expense.category} ${expense.date}`.toLowerCase().includes(query);
    return matchesFilter && matchesQuery;
  }).sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')));
}

function render() {
  const filtered = visibleExpenses();
  const reviewItems = expenses.filter(needsReview).length;
  const month = new Date().toISOString().slice(0, 7);
  const monthTotal = expenses.filter((expense) => expense.date?.startsWith(month))
    .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  elements.rows.innerHTML = filtered.map((expense, index) => `
    <tr data-id="${escapeHtml(expense.id)}" tabindex="0" aria-label="Edit ${escapeHtml(expense.vendor)}">
      <td><div class="merchant-cell"><span class="merchant-icon tone-${index % 4}">${escapeHtml(merchantInitials(expense.vendor))}</span><span><span class="merchant-name">${escapeHtml(expense.vendor || 'Unknown merchant')}${needsReview(expense) ? '<span class="row-review">Review</span>' : ''}</span><span class="merchant-note">${escapeHtml(expense.payment || 'Receipt filed')}</span></span></div></td>
      <td>${escapeHtml(formatDate(expense.date))}</td>
      <td><span class="category-pill" data-category="${escapeHtml(expense.category || 'Other')}">${escapeHtml(expense.category || 'Other')}</span></td>
      <td class="amount-cell">${escapeHtml(formatCurrency(expense.amount, expense.currency))}</td>
      <td><button class="row-action" type="button" aria-label="Edit ${escapeHtml(expense.vendor)}">···</button></td>
    </tr>`).join('');

  elements.empty.hidden = filtered.length > 0;
  elements.rows.closest('table').hidden = filtered.length === 0;
  elements.count.textContent = String(expenses.length);
  elements.receiptCount.textContent = String(expenses.length);
  elements.reviewCount.textContent = String(reviewItems);
  elements.filterReviewCount.textContent = String(reviewItems);
  elements.total.textContent = formatCurrency(monthTotal);
  document.querySelector('#month-label').textContent = new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' }).format(new Date()).toUpperCase();
  document.querySelector('#table-footer-copy').textContent = expenses.some((expense) => expense.sample) ? 'Example records shown · data stays in this browser' : 'Saved on this device only';
  document.querySelector('#clear-button').hidden = expenses.length === 0;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove('is-visible'), 3200);
}

function openExpense(expense = null) {
  elements.form.reset();
  document.querySelector('#dialog-title').textContent = expense ? 'Edit expense' : 'Add an expense';
  document.querySelector('#expense-id').value = expense?.id || '';
  elements.form.elements.vendor.value = expense?.vendor || '';
  elements.form.elements.date.value = expense?.date || new Date().toISOString().slice(0, 10);
  elements.form.elements.amount.value = expense?.amount ?? '';
  elements.form.elements.tax.value = expense?.tax ?? '';
  elements.form.elements.category.value = expense?.category || 'Meals';
  elements.form.elements.payment.value = expense?.payment || '';
  document.querySelector('#delete-expense-button').hidden = !expense;
  elements.dialog.showModal();
}

function addExtractedExpense(result, fileName) {
  const amount = Number(result.amount);
  const tax = Number(result.tax);
  const hasAmount = result.amount !== null && result.amount !== '' && Number.isFinite(amount);
  expenses.unshift({
    id: crypto.randomUUID(),
    vendor: result.vendor || fileName.replace(/\.[^.]+$/, ''),
    date: /^\d{4}-\d{2}-\d{2}$/.test(result.date) ? result.date : '',
    amount: hasAmount ? amount : null,
    tax: result.tax !== null && result.tax !== '' && Number.isFinite(tax) ? tax : null,
    currency: result.currency || 'USD',
    category: ['Meals', 'Transport', 'Office', 'Software', 'Travel', 'Other'].includes(result.category) ? result.category : 'Other',
    payment: result.payment || '',
  });
  saveExpenses();
}

async function extractFile(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error(`${file.name}: use a JPG, PNG, or WebP image.`);
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: image must be under 10 MB.`);
  if (!elements.model.value) throw new Error('Start Ollama and select an installed vision model before scanning.');

  const image = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
  const response = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image, type: file.type, model: elements.model.value }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The receipt could not be read.');
  addExtractedExpense(data.result || {}, file.name);
}

async function processFiles(files) {
  const queue = Array.from(files);
  if (!queue.length) return;
  let processed = 0;
  for (const file of queue) {
    showToast(`Reading ${file.name} with your local model…`);
    try {
      await extractFile(file);
      processed += 1;
    } catch (error) {
      showToast(error.message);
      if (!elements.model.value) break;
    }
  }
  if (processed) showToast(`${processed} receipt${processed === 1 ? '' : 's'} added to your inbox.`);
}

async function checkOllama() {
  try {
    const response = await fetch('/api/status');
    const status = await response.json();
    elements.badge.classList.toggle('is-online', status.online);
    elements.badge.innerHTML = `<i></i>${status.online ? 'Ollama ready' : 'Ollama offline'}`;
    elements.model.disabled = !status.online || status.models.length === 0;
    if (status.models.length) {
      const previous = elements.model.value;
      elements.model.innerHTML = status.models.map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`).join('');
      if (status.models.includes(previous)) elements.model.value = previous;
      elements.notice.classList.add('is-ready');
      elements.notice.innerHTML = '<span class="notice-mark" aria-hidden="true">✓</span><span>Local model ready. Choose a vision model to scan receipt photos.</span>';
    } else {
      elements.model.innerHTML = '<option value="">No local models found</option>';
      elements.notice.classList.remove('is-ready');
      elements.notice.innerHTML = '<span class="notice-mark" aria-hidden="true">!</span><span>No vision model found. Pull gemma3:4b to scan; manual entries work anytime.</span>';
    }
  } catch {
    elements.badge.classList.remove('is-online');
    elements.badge.innerHTML = '<i></i>Ollama offline';
  }
}

function exportCsv() {
  if (!expenses.length) return showToast('There are no receipts to export yet.');
  const columns = ['vendor', 'date', 'amount', 'tax', 'currency', 'category', 'payment'];
  const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [columns.join(','), ...expenses.map((expense) => columns.map((column) => escapeCell(expense[column])).join(','))].join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `slipstream-receipts-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Your receipt CSV is ready.');
}

document.querySelectorAll('#upload-button, #drop-upload-button, #empty-upload-button').forEach((button) => button.addEventListener('click', () => elements.fileInput.click()));
elements.fileInput.addEventListener('change', (event) => {
  processFiles(event.target.files);
  event.target.value = '';
});
document.querySelector('#new-expense-button').addEventListener('click', () => openExpense());
document.querySelector('#export-button').addEventListener('click', exportCsv);
document.querySelector('#copy-command').addEventListener('click', async (event) => {
  try {
    await navigator.clipboard.writeText('ollama pull gemma3:4b');
    event.currentTarget.querySelector('.copy-label').textContent = 'COPIED';
    setTimeout(() => { event.currentTarget.querySelector('.copy-label').textContent = 'COPY'; }, 1500);
  } catch {
    showToast('Run: ollama pull gemma3:4b');
  }
});
document.querySelectorAll('.close-dialog').forEach((button) => button.addEventListener('click', () => elements.dialog.close()));
elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const id = document.querySelector('#expense-id').value;
  const existing = expenses.find((expense) => expense.id === id);
  const formData = new FormData(elements.form);
  const updated = {
    id: id || crypto.randomUUID(),
    vendor: String(formData.get('vendor')).trim(),
    date: formData.get('date'),
    amount: Number(formData.get('amount')),
    tax: formData.get('tax') ? Number(formData.get('tax')) : null,
    currency: existing?.currency || 'USD',
    category: formData.get('category'),
    payment: String(formData.get('payment')).trim(),
  };
  expenses = existing ? expenses.map((expense) => expense.id === id ? updated : expense) : [updated, ...expenses];
  saveExpenses();
  elements.dialog.close();
  showToast(existing ? 'Expense updated.' : 'Expense added.');
});
document.querySelector('#delete-expense-button').addEventListener('click', () => {
  const id = document.querySelector('#expense-id').value;
  expenses = expenses.filter((expense) => expense.id !== id);
  saveExpenses();
  elements.dialog.close();
  showToast('Expense deleted.');
});
elements.rows.addEventListener('click', (event) => {
  const row = event.target.closest('tr[data-id]');
  const expense = expenses.find((item) => item.id === row?.dataset.id);
  if (expense) openExpense(expense);
});
elements.rows.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    const row = event.target.closest('tr[data-id]');
    const expense = expenses.find((item) => item.id === row?.dataset.id);
    if (expense) openExpense(expense);
  }
});
elements.search.addEventListener('input', render);
document.querySelectorAll('.filter-button').forEach((button) => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll('.filter-button').forEach((item) => item.classList.toggle('is-active', item === button));
  render();
}));
document.querySelector('#clear-button').addEventListener('click', () => {
  if (!window.confirm('Delete all locally saved receipts?')) return;
  expenses = [];
  saveExpenses();
});
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    elements.search.focus();
  }
});
const dropStrip = document.querySelector('#drop-strip');
for (const eventName of ['dragenter', 'dragover']) dropStrip.addEventListener(eventName, (event) => { event.preventDefault(); dropStrip.classList.add('is-dragging'); });
for (const eventName of ['dragleave', 'drop']) dropStrip.addEventListener(eventName, (event) => { event.preventDefault(); dropStrip.classList.remove('is-dragging'); });
dropStrip.addEventListener('drop', (event) => processFiles(event.dataTransfer.files));

render();
checkOllama();