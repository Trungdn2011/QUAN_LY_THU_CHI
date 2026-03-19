/* global gapi, google */
'use strict';

// ============================================================
//  STATE
// ============================================================
const state = {
  isSignedIn: false,
  gapiInited: false,
  gisInited: false,
  tokenClient: null,
  allTransactions: [],
  filteredTransactions: [],
  currentSection: 'dashboard',
  editingId: null,
  // chart instances
  barChart: null,
  pieChart: null,
  categoryChart: null,
  contentChart: null,
};

// ============================================================
//  DOM REFS
// ============================================================
const dom = {
  authBtnLogin: document.getElementById('auth-btn-login'),
  authBtnLogout: document.getElementById('auth-btn-logout'),
  authDot: document.getElementById('auth-dot'),
  authStatus: document.getElementById('auth-status-text'),
  topNav: document.getElementById('top-nav'),
  fabAddBtn: document.getElementById('fab-add-btn'),
  loadingOverlay: document.getElementById('loading-overlay'),
  toastContainer: document.getElementById('toast-container'),

  // Sections
  sections: document.querySelectorAll('.section-panel'),
  navItems: document.querySelectorAll('.nav-item'),

  // Dashboard
  dashDateFrom: document.getElementById('dash-date-from'),
  dashDateTo: document.getElementById('dash-date-to'),
  btnApplyDate: document.getElementById('btn-apply-date'),
  btnResetDate: document.getElementById('btn-reset-date'),
  periodTabs: document.querySelectorAll('.period-tab'),
  totalIncome: document.getElementById('total-income'),
  totalExpense: document.getElementById('total-expense'),
  totalBalance: document.getElementById('total-balance'),
  balanceCard: document.getElementById('balance-card'),
  txnCount: document.getElementById('txn-count'),
  incomeCount: document.getElementById('income-count'),
  expenseCount: document.getElementById('expense-count'),

  // List
  listTableBody: document.getElementById('list-table-body'),
  filterType: document.getElementById('filter-type'),
  filterCategory: document.getElementById('filter-category'),
  filterContent: document.getElementById('filter-content'),

  // Form
  formType: document.getElementById('form-type'),
  formDate: document.getElementById('form-date'),
  formAmount: document.getElementById('form-amount'),
  formContent: document.getElementById('form-content'),
  formCategory: document.getElementById('form-category'),
  formNote: document.getElementById('form-note'),
  btnSubmitForm: document.getElementById('btn-submit-form'),
  formTitle: document.getElementById('form-title'),
  formSubtitle: document.getElementById('form-subtitle'),

  // Mobile
  mobileMenuBtn: document.getElementById('mobile-menu-btn'),
  sidebar: document.querySelector('.sidebar'),
  sidebarBackdrop: document.getElementById('sidebar-backdrop'),
};

// ============================================================
//  GOOGLE API INIT
// ============================================================
function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: CONFIG.API_KEY,
    discoveryDocs: [CONFIG.DISCOVERY_DOC],
  });
  state.gapiInited = true;
  maybeEnableButtons();
}

function gisLoaded() {
  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: CONFIG.SCOPES,
    callback: '',
  });
  state.gisInited = true;
  maybeEnableButtons();
}

function maybeEnableButtons() {
  if (state.gapiInited && state.gisInited) {
    dom.authBtnLogin.disabled = false;
    dom.authBtnLogin.textContent = '🔑 Đăng nhập danh tính Google';
  }
}

// ============================================================
//  AUTH
// ============================================================
function handleAuthLogout() {
  if (state.isSignedIn) {
    google.accounts.oauth2.revoke(gapi.client.getToken().access_token, () => {
      gapi.client.setToken('');
      state.isSignedIn = false;
      updateAuthUI(false);
      state.allTransactions = [];
      renderAll();
      navigateTo('login');
    });
  }
}

function handleAuthLogin() {
  if (!state.isSignedIn) {
    state.tokenClient.callback = async (resp) => {
      if (resp.error !== undefined) { showToast('Đăng nhập thất bại: ' + resp.error, 'error'); return; }
      state.isSignedIn = true;
      updateAuthUI(true);
      navigateTo('dashboard');
      await loadTransactions();
    };

    if (gapi.client.getToken() === null) {
      state.tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      state.tokenClient.requestAccessToken({ prompt: '' });
    }
  }
}

function updateAuthUI(signedIn) {
  if (signedIn) {
    dom.authDot.classList.add('connected');
    dom.authStatus.textContent = 'Đã kết nối';
  } else {
    dom.authDot.classList.remove('connected');
    dom.authStatus.textContent = 'Chưa kết nối';
  }
}

// ============================================================
//  SHEETS CRUD
// ============================================================
async function loadTransactions() {
  showLoading(true);
  try {
    const range = `${CONFIG.SHEET_NAME}!A2:G`;
    const resp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range,
    });
    const rows = resp.result.values || [];
    state.allTransactions = rows.map(r => ({
      id:       r[0] || '',
      date:     r[1] || '',
      type:     r[2] || '',   // Thu / Chi
      content:  r[3] || '',
      category: r[4] || '',
      amount:   parseFloat((r[5] || '0').toString().replace(/,/g, '')),
      note:     r[6] || '',
    })).filter(t => t.id);
    renderAll();
    showToast('✅ Đã tải dữ liệu thành công!', 'success');
  } catch (err) {
    console.error(err);
    showToast('❌ Lỗi tải dữ liệu: ' + (err.result?.error?.message || err.message), 'error');
  } finally {
    showLoading(false);
  }
}

async function addTransaction(txn) {
  showLoading(true);
  try {
    const values = [[txn.id, txn.date, txn.type, txn.content, txn.category, txn.amount, txn.note]];
    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `${CONFIG.SHEET_NAME}!A:G`,
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });
    state.allTransactions.push(txn);
    renderAll();
    showToast('✅ Đã thêm giao dịch!', 'success');
  } catch (err) {
    console.error(err);
    showToast('❌ Lỗi thêm giao dịch: ' + (err.result?.error?.message || err.message), 'error');
  } finally {
    showLoading(false);
  }
}

async function deleteTransaction(id) {
  if (!confirm('Bạn có chắc muốn xóa giao dịch này?')) return;

  // Find the row index in the sheet (1-indexed, +1 for header)
  const idx = state.allTransactions.findIndex(t => t.id === id);
  if (idx === -1) return;

  showLoading(true);
  try {
    // Get all values to find the actual sheet row
    const resp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `${CONFIG.SHEET_NAME}!A:A`,
    });
    const ids = (resp.result.values || []).map(r => r[0]);
    const sheetRowIdx = ids.indexOf(id); // 0-indexed
    if (sheetRowIdx === -1) throw new Error('Không tìm thấy dòng trong Sheet');

    // Get spreadsheet to find sheetId
    const meta = await gapi.client.sheets.spreadsheets.get({ spreadsheetId: CONFIG.SPREADSHEET_ID });
    const sheetId = meta.result.sheets.find(s => s.properties.title === CONFIG.SHEET_NAME)?.properties.sheetId;

    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      resource: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: sheetRowIdx, endIndex: sheetRowIdx + 1 }
          }
        }]
      }
    });

    state.allTransactions.splice(idx, 1);
    renderAll();
    showToast('🗑️ Đã xóa giao dịch!', 'success');
  } catch (err) {
    console.error(err);
    showToast('❌ Lỗi xóa: ' + (err.result?.error?.message || err.message), 'error');
  } finally {
    showLoading(false);
  }
}

// ============================================================
//  FORM  
// ============================================================

function initForm() {
  dom.formDate.value = todayStr();
  dom.btnSubmitForm.addEventListener('click', handleFormSubmit);
}

async function handleFormSubmit() {
  const date     = dom.formDate.value;
  const amount   = parseFloat(dom.formAmount.value);
  const type     = dom.formType.value;
  const content  = dom.formContent.value;
  const category = dom.formCategory.value;
  const note     = dom.formNote.value.trim();

  if (!date || !amount || amount <= 0 || !content || !category) {
    showToast('⚠️ Vui lòng điền đầy đủ thông tin!', 'error');
    return;
  }

  if (!state.isSignedIn) {
    showToast('⚠️ Vui lòng đăng nhập Google trước!', 'error');
    return;
  }

  const txn = {
    id: Date.now().toString(),
    date: formatDateDisplay(date),
    type,
    content,
    category,
    amount,
    note,
  };

  await addTransaction(txn);
  resetForm();
}

function resetForm() {
  dom.formDate.value = todayStr();
  dom.formAmount.value = '';
  dom.formContent.value = '';
  dom.formCategory.value = '';
  dom.formNote.value = '';
  dom.formType.value = 'Chi';
}

// ============================================================
//  DASHBOARD RENDER
// ============================================================
function renderDashboard() {
  const txns = getFilteredByDate();
  const income  = txns.filter(t => t.type === 'Thu').reduce((s, t) => s + t.amount, 0);
  const expense = txns.filter(t => t.type === 'Chi').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  dom.totalIncome.textContent  = formatMoney(income);
  dom.totalExpense.textContent = formatMoney(expense);
  dom.totalBalance.textContent = formatMoney(Math.abs(balance));
  dom.txnCount.textContent = `${txns.length} giao dịch`;
  dom.incomeCount.textContent  = txns.filter(t => t.type === 'Thu').length;
  dom.expenseCount.textContent = txns.filter(t => t.type === 'Chi').length;

  // Balance card color
  dom.balanceCard.classList.toggle('positive', balance >= 0);
  dom.balanceCard.classList.toggle('negative', balance < 0);

  renderBarChart(txns);
  renderPieChart(txns);
  renderCategoryChart(txns);
  renderContentChart(txns);
}

function getFilteredByDate() {
  const from = dom.dashDateFrom.value;
  const to   = dom.dashDateTo.value;
  if (!from && !to) return state.allTransactions;
  return state.allTransactions.filter(t => {
    const d = parseDate(t.date);
    if (!d) return true;
    if (from && d < new Date(from)) return false;
    if (to   && d > new Date(to + 'T23:59:59')) return false;
    return true;
  });
}

function renderBarChart(txns) {
  // Group by date
  const dateMap = {};
  txns.forEach(t => {
    if (!dateMap[t.date]) dateMap[t.date] = { income: 0, expense: 0 };
    if (t.type === 'Thu') dateMap[t.date].income  += t.amount;
    else                  dateMap[t.date].expense += t.amount;
  });

  const labels  = Object.keys(dateMap).sort();
  const incomes  = labels.map(d => dateMap[d].income);
  const expenses = labels.map(d => dateMap[d].expense);

  const ctx = document.getElementById('bar-chart').getContext('2d');

  if (state.barChart) state.barChart.destroy();
  state.barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Thu',
          data: incomes,
          backgroundColor: 'rgba(0, 212, 170, 0.75)',
          borderColor: '#00d4aa',
          borderWidth: 1,
          borderRadius: 6,
        },
        {
          label: 'Chi',
          data: expenses,
          backgroundColor: 'rgba(255, 51, 51, 0.75)',
          borderColor: '#ff3333',
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: '#475569', font: { size: 12, family: 'Inter' } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${formatMoney(ctx.raw)}`
          }
        }
      },
      scales: {
        x: { ticks: { color: '#475569', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y: { ticks: { color: '#475569', font: { size: 11 }, callback: v => formatMoneyShort(v) }, grid: { color: 'rgba(0,0,0,0.05)' } },
      },
    },
  });
}

function renderPieChart(txns) {
  const CONTENTS = ['Ăn uống', 'Cafe', 'Thuốc lá', 'Nhậu', 'Việc gia đình', 'Lặt vặt', 'Công việc'];
  const COLORS   = ['#00d4aa','#0099ff','#f5a623','#ff6b8a','#7b5ea7','#e8b4b8','#56ccb2'];

  const contentMap = {};
  txns.filter(t => t.type === 'Chi').forEach(t => {
    contentMap[t.content] = (contentMap[t.content] || 0) + t.amount;
  });

  const labels = Object.keys(contentMap);
  const data   = labels.map(l => contentMap[l]);
  const colors = labels.map(l => COLORS[CONTENTS.indexOf(l)] || '#888');

  const ctx = document.getElementById('pie-chart').getContext('2d');
  if (state.pieChart) state.pieChart.destroy();
  state.pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor: colors,
        borderWidth: 2,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#475569', font: { size: 11 }, padding: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatMoney(ctx.raw)}`
          }
        }
      },
    },
  });
}

// ============================================================
//  CHART: THU CHI THEO DANH MỤC
// ============================================================
function renderCategoryChart(txns) {
  const categories = ['Tiền mặt', 'Chuyển khoản'];
  const incomes  = categories.map(c => txns.filter(t => t.category === c && t.type === 'Thu').reduce((s, t) => s + t.amount, 0));
  const expenses = categories.map(c => txns.filter(t => t.category === c && t.type === 'Chi').reduce((s, t) => s + t.amount, 0));

  const ctx = document.getElementById('category-chart').getContext('2d');
  if (state.categoryChart) state.categoryChart.destroy();
  state.categoryChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['💵 Tiền mặt', '🏦 Chuyển khoản'],
      datasets: [
        {
          label: 'Thu',
          data: incomes,
          backgroundColor: 'rgba(0, 212, 170, 0.75)',
          borderColor: '#00d4aa',
          borderWidth: 1,
          borderRadius: 8,
        },
        {
          label: 'Chi',
          data: expenses,
          backgroundColor: 'rgba(255, 51, 51, 0.75)',
          borderColor: '#ff3333',
          borderWidth: 1,
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: '#475569', font: { size: 12, family: 'Inter' } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatMoney(ctx.raw)}` } },
      },
      scales: {
        x: { ticks: { color: '#1e293b', font: { size: 12 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y: { ticks: { color: '#475569', callback: v => formatMoneyShort(v) }, grid: { color: 'rgba(0,0,0,0.05)' } },
      },
    },
  });
}

// ============================================================
//  CHART: THU CHI THEO NỘI DUNG
// ============================================================
function renderContentChart(txns) {
  const CONTENTS = ['Ăn uống', 'Cafe', 'Thuốc lá', 'Nhậu', 'Việc gia đình', 'Lặt vặt', 'Công việc'];
  const LABELS   = ['🍜 Ăn uống', '☕ Cafe', '🚬 Thuốc lá', '🍺 Nhậu', '🏠 Gia đình', '🛒 Lặt vặt', '💼 Công việc'];
  const incomes  = CONTENTS.map(c => txns.filter(t => t.content === c && t.type === 'Thu').reduce((s, t) => s + t.amount, 0));
  const expenses = CONTENTS.map(c => txns.filter(t => t.content === c && t.type === 'Chi').reduce((s, t) => s + t.amount, 0));

  const ctx = document.getElementById('content-chart').getContext('2d');
  if (state.contentChart) state.contentChart.destroy();
  state.contentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: LABELS,
      datasets: [
        {
          label: 'Thu',
          data: incomes,
          backgroundColor: 'rgba(0, 212, 170, 0.75)',
          borderColor: '#00d4aa',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Chi',
          data: expenses,
          backgroundColor: 'rgba(255, 51, 51, 0.75)',
          borderColor: '#ff3333',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      indexAxis: 'y',
      plugins: {
        legend: { labels: { color: '#475569', font: { size: 12, family: 'Inter' } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatMoney(ctx.raw)}` } },
      },
      scales: {
        x: { ticks: { color: '#475569', callback: v => formatMoneyShort(v) }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y: { ticks: { color: '#1e293b', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
      },
    },
  });
}


// ============================================================
function renderList() {
  const typeF     = dom.filterType.value;
  const catF      = dom.filterCategory.value;
  const contentF  = dom.filterContent.value;

  let txns = [...state.allTransactions];
  if (typeF) txns = txns.filter(t => t.type === typeF);
  if (catF)  txns = txns.filter(t => t.category === catF);
  if (contentF) txns = txns.filter(t => t.content === contentF);

  // Sort by date desc
  txns.sort((a, b) => {
    const da = parseDate(a.date), db = parseDate(b.date);
    return (db || 0) - (da || 0);
  });

  if (txns.length === 0) {
    dom.listTableBody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>Chưa có giao dịch nào</p>
        </div>
      </td></tr>`;
    return;
  }

  dom.listTableBody.innerHTML = txns.map(t => `
    <tr>
      <td>${t.date}</td>
      <td><span class="badge ${t.type === 'Thu' ? 'thu' : 'chi'}">${t.type === 'Thu' ? '⬆️ Thu' : '⬇️ Chi'}</span></td>
      <td>${t.content}</td>
      <td><span class="badge-cat">${t.category}</span></td>
      <td class="amount-cell ${t.type === 'Thu' ? 'thu' : 'chi'}">${t.type === 'Thu' ? '+' : '-'}${formatMoney(t.amount)}</td>
      <td style="color:var(--text-secondary); font-size:12px">${t.note || '—'}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon delete" onclick="deleteTransaction('${t.id}')" title="Xóa">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ============================================================
//  NAVIGATION
// ============================================================
function initNav() {
  dom.navItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      if (section) navigateTo(section);
    });
  });
}

function navigateTo(section) {
  state.currentSection = section;
  
  // Show/Hide Top Nav
  if (section === 'login') {
    dom.topNav.style.display = 'none';
  } else {
    dom.topNav.style.display = 'flex';
  }

  // Show/Hide FAB
  if (section === 'dashboard' || section === 'list') {
    dom.fabAddBtn.style.display = 'flex';
  } else {
    dom.fabAddBtn.style.display = 'none';
  }

  dom.sections.forEach(s => s.classList.toggle('active', s.id === `section-${section}`));
  dom.navItems.forEach(n => n.classList.toggle('active', n.dataset.section === section));
  closeMobileSidebar();
  
  if (section === 'dashboard') renderDashboard();
  if (section === 'list')      renderList();
}

// ============================================================
//  DATE FILTER
// ============================================================
function initDateFilter() {
  // Set defaults: this month
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  dom.dashDateFrom.value = toInputDate(firstDay);
  dom.dashDateTo.value   = todayStr();

  dom.btnApplyDate.addEventListener('click', renderDashboard);
  dom.btnResetDate.addEventListener('click', () => {
    dom.dashDateFrom.value = '';
    dom.dashDateTo.value   = '';
    dom.periodTabs.forEach(t => t.classList.remove('active'));
    renderDashboard();
  });

  dom.periodTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      dom.periodTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      setPeriod(tab.dataset.period);
    });
  });
}

function setPeriod(period) {
  const now = new Date();
  let from, to = new Date();

  switch (period) {
    case 'today':
      from = new Date(now); break;
    case 'week': {
      const day = now.getDay() || 7;
      from = new Date(now); from.setDate(now.getDate() - day + 1); break;
    }
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3);
      from = new Date(now.getFullYear(), q * 3, 1); break;
    }
    case 'year':
      from = new Date(now.getFullYear(), 0, 1); break;
    default:
      from = new Date(now);
  }

  dom.dashDateFrom.value = toInputDate(from);
  dom.dashDateTo.value   = toInputDate(to);
  renderDashboard();
}

// ============================================================
//  MOBILE
// ============================================================
function initMobile() {
  dom.mobileMenuBtn?.addEventListener('click', () => {
    dom.sidebar.classList.toggle('open');
    dom.sidebarBackdrop.classList.toggle('show');
  });
  dom.sidebarBackdrop?.addEventListener('click', closeMobileSidebar);
}

function closeMobileSidebar() {
  dom.sidebar.classList.remove('open');
  dom.sidebarBackdrop.classList.remove('show');
}

// ============================================================
//  LIST FILTERS
// ============================================================
function initListFilters() {
  [dom.filterType, dom.filterCategory, dom.filterContent].forEach(el => {
    el?.addEventListener('change', renderList);
  });
}

// ============================================================
//  UTILITIES
// ============================================================
function formatMoney(n) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
}

function formatMoneyShort(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n;
}

function todayStr() {
  return toInputDate(new Date());
}

function toInputDate(date) {
  return date.toISOString().split('T')[0];
}

function formatDateDisplay(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function parseDate(str) {
  if (!str) return null;
  // DD/MM/YYYY
  const parts = str.split('/');
  if (parts.length === 3) {
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  }
  // ISO
  return new Date(str);
}

function showLoading(show) {
  dom.loadingOverlay.classList.toggle('show', show);
}

function showToast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  dom.toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function renderAll() {
  renderDashboard();
  renderList();
}

// ============================================================
//  INIT
// ============================================================
function init() {
  dom.authBtnLogin.addEventListener('click', handleAuthLogin);
  dom.authBtnLogout.addEventListener('click', handleAuthLogout);
  dom.fabAddBtn.addEventListener('click', () => navigateTo('add'));
  initNav();
  initDateFilter();
  initForm();
  initListFilters();
  initMobile();
  navigateTo('login');
}

document.addEventListener('DOMContentLoaded', init);

// Expose for google API callbacks
window.gapiLoaded = gapiLoaded;
window.gisLoaded  = gisLoaded;
window.deleteTransaction = deleteTransaction;
