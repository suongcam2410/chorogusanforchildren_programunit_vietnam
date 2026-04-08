const LOGIN_USERNAME = 'admin';
const LOGIN_PASSWORD = '88888888';
const SESSION_KEY = 'chorogusan_dashboard_session';
const API_URL_KEY = 'chorogusan_dashboard_api_url';

const CATEGORY_OPTIONS = [
  '',
  'Finance',
  'Planning',
  'Partnership',
  'Capacity Building',
  'Field Activities',
  'M&E',
  'Reporting',
  'Administration',
  'Other'
];

const STATUS_OPTIONS = ['', 'Not Started', 'In Progress', 'Completed', 'On Hold', 'Cancelled'];
const RISK_OPTIONS = ['', 'Low', 'Medium', 'High'];

const state = {
  tasks: [],
  filteredTasks: [],
  currentUser: 'admin'
};

document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
  safeRun(bootstrapApiUrlFromQuery, 'bootstrapApiUrlFromQuery');
  safeRun(bindEvents, 'bindEvents');
  safeRun(setupStaticOptions, 'setupStaticOptions');
  safeRun(hydrateSettingsField, 'hydrateSettingsField');
  safeRun(restoreSession, 'restoreSession');
  safeRun(refreshConnectionUi, 'refreshConnectionUi');
}

function safeRun(fn, label) {
  try {
    fn();
  } catch (error) {
    console.error(`Initialization error in ${label}:`, error);
  }
}

function bindEvents() {
  addListener('loginForm', 'submit', handleLogin);
  addListener('logoutBtn', 'click', logout);
  addListener('addTaskBtn', 'click', openAddTaskModal);
  addListener('addTaskBtnTop', 'click', openAddTaskModal);
  addListener('closeTaskModalBtn', 'click', closeTaskModal);
  addListener('cancelTaskBtn', 'click', closeTaskModal);
  addListener('taskForm', 'submit', saveTask);
  addListener('refreshBtn', 'click', loadTasks);
  addListener('exportBtn', 'click', exportTasks);

  addListener('openSettingsBtn', 'click', openSettingsModal);
  addListener('openSettingsFromLogin', 'click', openSettingsModal);
  addListener('openSettingsBtnInline', 'click', openSettingsModal);
  addListener('testApiBtn', 'click', testConnection);
  addListener('closeSettingsModalBtn', 'click', closeSettingsModal);
  addListener('settingsForm', 'submit', saveSettings);
  addListener('clearSettingsBtn', 'click', clearSettings);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  ['filterSearch', 'filterMonth', 'filterStatus', 'filterCategory'].forEach(id => {
    addListener(id, 'input', applyFilters);
    addListener(id, 'change', applyFilters);
  });

  ['taskModal', 'settingsModal'].forEach(modalId => {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.addEventListener('click', event => {
      if (event.target.id === modalId) {
        if (modalId === 'taskModal') closeTaskModal();
        if (modalId === 'settingsModal') closeSettingsModal();
      }
    });
  });
}

function addListener(id, eventName, handler) {
  const element = document.getElementById(id);
  if (!element) return;
  element.addEventListener(eventName, handler);
}

function setupStaticOptions() {
  ensureSelectOptions(document.getElementById('taskCategory'), CATEGORY_OPTIONS, 'Select category');
  ensureSelectOptions(document.getElementById('filterCategory'), CATEGORY_OPTIONS, 'All categories');
  ensureSelectOptions(document.getElementById('taskStatus'), STATUS_OPTIONS.filter(Boolean), null, 'Not Started');
  ensureSelectOptions(document.getElementById('filterStatus'), STATUS_OPTIONS, 'All status');
  ensureSelectOptions(document.getElementById('taskRisk'), RISK_OPTIONS, 'Select risk');

  const monthSelect = document.getElementById('filterMonth');
  if (monthSelect && !monthSelect.options.length) {
    monthSelect.innerHTML = '<option value="">All months</option>';
    for (let month = 1; month <= 12; month += 1) {
      const date = new Date(2026, month - 1, 1);
      const option = document.createElement('option');
      option.value = String(month);
      option.textContent = date.toLocaleString('en-US', { month: 'long' });
      monthSelect.appendChild(option);
    }
  }
}

function ensureSelectOptions(select, values, placeholder = null, defaultValue = '') {
  if (!select) return;
  if (select.options.length > 0) {
    if (defaultValue && !select.value) select.value = defaultValue;
    return;
  }

  if (placeholder !== null) {
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    select.appendChild(placeholderOption);
  }

  values.forEach(value => {
    if (value === '' && placeholder !== null) return;
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value || placeholder || '';
    select.appendChild(option);
  });

  if (defaultValue) select.value = defaultValue;
}

function bootstrapApiUrlFromQuery() {
  try {
    const url = new URL(window.location.href);
    const api = (url.searchParams.get('api') || '').trim();
    if (api && isValidExecUrl(api)) {
      localStorage.setItem(API_URL_KEY, api);
      url.searchParams.delete('api');
      window.history.replaceState({}, '', url.toString());
    }
  } catch (error) {
    console.warn('Unable to parse page URL', error);
  }
}

function restoreSession() {
  const saved = localStorage.getItem(SESSION_KEY);
  if (saved === LOGIN_USERNAME) {
    state.currentUser = saved;
    showApp();
    if (isApiConfigured()) {
      loadTasks();
    } else {
      setSyncStatus('Setup required: save your Apps Script /exec URL');
      updateLastUpdated(null);
    }
  }
}

function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (username === LOGIN_USERNAME && password === LOGIN_PASSWORD) {
    localStorage.setItem(SESSION_KEY, username);
    state.currentUser = username;
    showApp();
    refreshConnectionUi();
    if (isApiConfigured()) {
      loadTasks();
    } else {
      openSettingsModal();
      setSyncStatus('Setup required: save your Apps Script /exec URL');
      updateLastUpdated(null);
      showToast('Please save your Apps Script /exec URL first', 'warning');
    }
    return;
  }

  showToast('Invalid username or password', 'error');
}

function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('currentUserLabel').textContent = state.currentUser;
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginForm').reset();
}

function normalizeExecUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function getApiBaseUrl() {
  const localValue = normalizeExecUrl(localStorage.getItem(API_URL_KEY) || '');
  const configValue = normalizeExecUrl(window.APP_CONFIG?.API_BASE_URL || '');

  if (isValidExecUrl(localValue)) return localValue;
  if (isValidExecUrl(configValue)) return configValue;
  return localValue || configValue;
}

function hydrateSettingsField() {
  const value = getApiBaseUrl();
  document.getElementById('apiBaseUrlInput').value = value;

  const localValue = normalizeExecUrl(localStorage.getItem(API_URL_KEY) || '');
  if (!isValidExecUrl(localValue) && isValidExecUrl(value)) {
    localStorage.setItem(API_URL_KEY, value);
  }
}

function isValidExecUrl(value) {
  const normalized = normalizeExecUrl(value);
  if (!normalized || !/^https:\/\//i.test(normalized)) return false;
  return /\/exec(?:$|[?#])/i.test(normalized);
}

function isApiConfigured() {
  return isValidExecUrl(getApiBaseUrl());
}

function refreshConnectionUi() {
  updateApiWarning();
  updateSetupPanel();
  updateActionAvailability();
}

function updateApiWarning() {
  const warning = document.getElementById('apiWarning');
  if (isApiConfigured()) {
    warning.classList.add('hidden');
    warning.innerHTML = '';
    return;
  }

  warning.classList.remove('hidden');
  warning.innerHTML = `
    <div>
      <strong>API URL is not configured.</strong>
      This page cannot read or write Google Sheets until you save your Apps Script <strong>/exec</strong> URL.
    </div>
    <button type="button" class="btn btn-outline btn-sm" onclick="openSettingsModal()">
      <span class="material-icons">settings</span>
      Open API Settings
    </button>
  `;
}

function updateSetupPanel() {
  const setupPanel = document.getElementById('setupPanel');
  setupPanel.classList.toggle('hidden', isApiConfigured());
}

function updateActionAvailability() {
  const disabled = !isApiConfigured();
  ['addTaskBtn', 'addTaskBtnTop', 'refreshBtn', 'testApiBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled && id !== 'testApiBtn';
  });
}

function openSettingsModal() {
  hydrateSettingsField();
  document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.add('hidden');
}

function saveSettings(event) {
  event.preventDefault();
  const value = normalizeExecUrl(document.getElementById('apiBaseUrlInput').value);
  if (!value) {
    showToast('Please paste your Apps Script Web App /exec URL', 'error');
    return;
  }
  if (!isValidExecUrl(value)) {
    showToast('Please enter a valid Apps Script /exec URL', 'error');
    return;
  }

  localStorage.setItem(API_URL_KEY, value);
  refreshConnectionUi();
  closeSettingsModal();
  setSyncStatus('API URL saved');
  showToast('API URL saved', 'success');

  if (!document.getElementById('appShell').classList.contains('hidden')) {
    loadTasks();
  }
}

function clearSettings() {
  localStorage.removeItem(API_URL_KEY);
  hydrateSettingsField();
  refreshConnectionUi();
  setSyncStatus(isApiConfigured() ? 'Using API URL from config.js' : 'API URL cleared');
  updateLastUpdated(null);
  showToast(isApiConfigured() ? 'Saved API URL cleared. Falling back to config.js' : 'Saved API URL cleared', 'warning');
}

async function testConnection() {
  const apiUrl = getApiBaseUrl();
  if (!isValidExecUrl(apiUrl)) {
    openSettingsModal();
    showToast('Please save a valid Apps Script /exec URL first', 'warning');
    return;
  }

  showLoading(true);
  setSyncStatus('Testing Apps Script connection...');

  try {
    const response = await apiRequest('ping');
    if (!response.success) throw new Error(response.message || 'Connection failed');
    setSyncStatus('Apps Script connection is working');
    updateLastUpdated(new Date());
    showToast('Connection successful', 'success');
  } catch (error) {
    console.error(error);
    setSyncStatus('Connection test failed');
    showToast(error.message || 'Cannot connect to Apps Script', 'error');
  } finally {
    showLoading(false);
  }
}

async function loadTasks() {
  refreshConnectionUi();
  if (!isApiConfigured()) {
    setSyncStatus('Setup required: save your Apps Script /exec URL');
    updateLastUpdated(null);
    return;
  }

  showLoading(true);
  setSyncStatus('Loading data from Google Sheets...');

  try {
    const response = await apiRequest('getTasks');
    if (!response.success) throw new Error(response.message || 'Unable to load tasks');

    state.tasks = Array.isArray(response.tasks) ? response.tasks : [];
    applyFilters();
    updateLastUpdated(new Date());
    setSyncStatus(`Synced with Google Sheets (${state.tasks.length} tasks)`);
  } catch (error) {
    console.error(error);
    setSyncStatus('Sync failed');
    showToast(error.message || 'Failed to load data', 'error');
  } finally {
    showLoading(false);
  }
}

function applyFilters() {
  const search = document.getElementById('filterSearch').value.trim().toLowerCase();
  const month = document.getElementById('filterMonth').value;
  const status = document.getElementById('filterStatus').value;
  const category = document.getElementById('filterCategory').value;

  state.filteredTasks = state.tasks.filter(task => {
    const text = [task.taskName, task.partner, task.assignedTo, task.notes, task.category]
      .join(' ')
      .toLowerCase();

    const matchesSearch = !search || text.includes(search);
    const matchesStatus = !status || task.status === status;
    const matchesCategory = !category || task.category === category;

    let matchesMonth = true;
    if (month) {
      const startMonth = getMonthFromDate(task.startDate);
      const endMonth = getMonthFromDate(task.endDate);
      matchesMonth = startMonth === Number(month) || endMonth === Number(month);
    }

    return matchesSearch && matchesStatus && matchesCategory && matchesMonth;
  });

  renderDashboardTable();
  renderAllTasksTable();
  renderUpcoming();
  renderStats();
}

function renderStats() {
  const tasks = state.filteredTasks;
  const total = tasks.length;
  const inProgress = tasks.filter(t => t.status === 'In Progress').length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const overdue = tasks.filter(checkOverdue).length;
  const completedPercent = total ? Math.round((completed / total) * 100) : 0;
  const overduePercent = total ? Math.round((overdue / total) * 100) : 0;

  document.getElementById('kpiTotal').textContent = total;
  document.getElementById('kpiInProgress').textContent = inProgress;
  document.getElementById('kpiCompleted').textContent = `${completedPercent}%`;
  document.getElementById('kpiOverdue').textContent = `${overduePercent}%`;
  document.getElementById('dashboardCount').textContent = `${total} task${total === 1 ? '' : 's'}`;
}

function renderDashboardTable() {
  const tbody = document.getElementById('dashboardTableBody');
  const tasks = [...state.filteredTasks].sort(sortByClosestDeadline).slice(0, 10);

  if (!tasks.length) {
    tbody.innerHTML = emptyRow(7, isApiConfigured() ? 'No matching tasks found' : 'Configure API URL to load tasks');
    return;
  }

  tbody.innerHTML = tasks.map(task => `
    <tr class="${checkOverdue(task) ? 'overdue-row' : ''}">
      <td>
        <div class="task-title">${escapeHtml(task.taskName)}</div>
        <div class="task-subtitle">${escapeHtml(task.category || '—')}</div>
      </td>
      <td>${escapeHtml(task.partner || '—')}</td>
      <td>${renderAssignee(task.assignedTo)}</td>
      <td class="${checkOverdue(task) ? 'timeline-overdue' : ''}">${escapeHtml(formatDateRange(task.startDate, task.endDate))}</td>
      <td>${renderStatusBadge(task.status)}</td>
      <td>${renderRiskBadge(task.risk)}</td>
      <td>
        <div class="action-group">
          <button class="action-link" onclick="editTask('${escapeAttribute(task.id)}')" title="Edit">
            <span class="material-icons">edit</span>
          </button>
          ${task.referenceLink ? `<a class="action-link" href="${escapeAttribute(task.referenceLink)}" target="_blank" rel="noopener noreferrer" title="Open link"><span class="material-icons">link</span></a>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderAllTasksTable() {
  const tbody = document.getElementById('tasksTableBody');
  const tasks = [...state.filteredTasks].sort(sortByClosestDeadline);

  if (!tasks.length) {
    tbody.innerHTML = emptyRow(11, isApiConfigured() ? 'No tasks found' : 'Configure API URL to load tasks');
    return;
  }

  tbody.innerHTML = tasks.map(task => `
    <tr class="${checkOverdue(task) ? 'overdue-row' : ''}">
      <td>
        <div class="task-title">${escapeHtml(task.taskName)}</div>
        <div class="task-subtitle">${escapeHtml(task.notes || '')}</div>
      </td>
      <td>${escapeHtml(task.category || '—')}</td>
      <td>${escapeHtml(task.partner || '—')}</td>
      <td>${renderAssignee(task.assignedTo)}</td>
      <td>${escapeHtml(task.assignedEmail || '—')}</td>
      <td>${escapeHtml(formatDate(task.startDate))}</td>
      <td class="${checkOverdue(task) ? 'timeline-overdue' : ''}">${escapeHtml(formatDate(task.endDate))}</td>
      <td>${renderStatusBadge(task.status)}</td>
      <td>${renderRiskBadge(task.risk)}</td>
      <td>${task.referenceLink ? `<a href="${escapeAttribute(task.referenceLink)}" target="_blank" rel="noopener noreferrer">Open</a>` : '—'}</td>
      <td>
        <div class="action-group">
          <button class="action-link" onclick="editTask('${escapeAttribute(task.id)}')" title="Edit">
            <span class="material-icons">edit</span>
          </button>
          <button class="action-link delete" onclick="confirmDeleteTask('${escapeAttribute(task.id)}')" title="Delete">
            <span class="material-icons">delete</span>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderUpcoming() {
  const container = document.getElementById('upcomingList');
  const upcoming = [...state.filteredTasks]
    .filter(task => task.endDate && task.status !== 'Completed' && task.status !== 'Cancelled')
    .sort(sortByClosestDeadline)
    .slice(0, 6);

  if (!upcoming.length) {
    container.innerHTML = `<div class="empty-state">${isApiConfigured() ? 'No upcoming deadlines' : 'Configure API URL to load tasks'}</div>`;
    return;
  }

  container.innerHTML = upcoming.map(task => {
    const overdue = checkOverdue(task);
    return `
      <article class="upcoming-item ${overdue ? 'overdue' : ''}">
        <h4>${escapeHtml(task.taskName)}</h4>
        <div class="upcoming-meta">
          <span>${escapeHtml(task.category || 'No category')}</span>
          <span>Due: ${escapeHtml(formatDate(task.endDate))}</span>
          <span>${escapeHtml(task.assignedTo || 'Unassigned')}</span>
        </div>
      </article>
    `;
  }).join('');
}

function openAddTaskModal() {
  setupStaticOptions();
  if (!isApiConfigured()) {
    openSettingsModal();
    showToast('Please save your Apps Script /exec URL first', 'warning');
    return;
  }

  document.getElementById('taskModalTitle').textContent = 'Add New Task';
  document.getElementById('taskForm').reset();
  document.getElementById('taskId').value = '';
  document.getElementById('taskStatus').value = 'Not Started';
  document.getElementById('taskModal').classList.remove('hidden');
}

function closeTaskModal() {
  document.getElementById('taskModal').classList.add('hidden');
}

function editTask(taskId) {
  setupStaticOptions();
  const task = state.tasks.find(item => item.id === taskId);
  if (!task) {
    showToast('Task not found', 'error');
    return;
  }

  document.getElementById('taskModalTitle').textContent = 'Edit Task';
  document.getElementById('taskId').value = task.id || '';
  document.getElementById('taskName').value = task.taskName || '';
  document.getElementById('taskCategory').value = task.category || '';
  document.getElementById('taskPartner').value = task.partner || '';
  document.getElementById('taskAssignedTo').value = task.assignedTo || '';
  document.getElementById('taskAssignedEmail').value = task.assignedEmail || '';
  document.getElementById('taskStartDate').value = task.startDate || '';
  document.getElementById('taskEndDate').value = task.endDate || '';
  document.getElementById('taskStatus').value = task.status || 'Not Started';
  document.getElementById('taskRisk').value = task.risk || '';
  document.getElementById('taskReferenceLink').value = task.referenceLink || '';
  document.getElementById('taskNotes').value = task.notes || '';
  document.getElementById('taskModal').classList.remove('hidden');
}

async function saveTask(event) {
  event.preventDefault();
  refreshConnectionUi();

  if (!isApiConfigured()) {
    showToast('Please save your Apps Script /exec URL in API Settings first', 'error');
    openSettingsModal();
    return;
  }

  const payload = {
    id: document.getElementById('taskId').value.trim(),
    taskName: document.getElementById('taskName').value.trim(),
    category: document.getElementById('taskCategory').value,
    partner: document.getElementById('taskPartner').value.trim(),
    assignedTo: document.getElementById('taskAssignedTo').value.trim(),
    assignedEmail: document.getElementById('taskAssignedEmail').value.trim(),
    startDate: document.getElementById('taskStartDate').value,
    endDate: document.getElementById('taskEndDate').value,
    status: document.getElementById('taskStatus').value,
    risk: document.getElementById('taskRisk').value,
    referenceLink: document.getElementById('taskReferenceLink').value.trim(),
    notes: document.getElementById('taskNotes').value.trim(),
    createdBy: state.currentUser
  };

  if (!payload.taskName) {
    showToast('Task name is required', 'error');
    return;
  }

  if (payload.startDate && payload.endDate && payload.startDate > payload.endDate) {
    showToast('End date must be after start date', 'error');
    return;
  }

  showLoading(true);
  setSyncStatus('Saving task to Google Sheets...');

  try {
    const action = payload.id ? 'updateTask' : 'addTask';
    const response = await apiRequest(action, payload);
    if (!response.success) throw new Error(response.message || 'Save failed');
    closeTaskModal();
    showToast(payload.id ? 'Task updated successfully' : 'Task added successfully', 'success');
    await loadTasks();
  } catch (error) {
    console.error(error);
    setSyncStatus('Save failed');
    showToast(error.message || 'Unable to save task. Also check that your Apps Script Web App access is set to Anyone.', 'error');
  } finally {
    showLoading(false);
  }
}

function confirmDeleteTask(taskId) {
  const task = state.tasks.find(item => item.id === taskId);
  const ok = window.confirm(`Delete task${task?.taskName ? `: ${task.taskName}` : ''}?`);
  if (ok) deleteTask(taskId);
}

async function deleteTask(taskId) {
  refreshConnectionUi();
  if (!isApiConfigured()) {
    showToast('Please save your Apps Script /exec URL in API Settings first', 'error');
    openSettingsModal();
    return;
  }

  showLoading(true);
  setSyncStatus('Deleting task from Google Sheets...');

  try {
    const response = await apiRequest('deleteTask', { id: taskId });
    if (!response.success) throw new Error(response.message || 'Delete failed');
    showToast('Task deleted successfully', 'success');
    await loadTasks();
  } catch (error) {
    console.error(error);
    setSyncStatus('Delete failed');
    showToast(error.message || 'Unable to delete task', 'error');
  } finally {
    showLoading(false);
  }
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === tabId));
}

function exportTasks() {
  const headers = ['Task Name', 'Category', 'Partner', 'Assigned To', 'Assigned Email', 'Start Date', 'End Date', 'Status', 'Risk', 'Reference Link', 'Notes'];
  const rows = state.filteredTasks.map(task => [
    task.taskName,
    task.category,
    task.partner,
    task.assignedTo,
    task.assignedEmail,
    task.startDate,
    task.endDate,
    task.status,
    task.risk,
    task.referenceLink,
    task.notes
  ]);

  let csv = `${headers.join(',')}\n`;
  rows.forEach(row => {
    csv += row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `working_plan_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported', 'success');
}

function apiRequest(action, payload = null) {
  return new Promise((resolve, reject) => {
    const apiUrl = getApiBaseUrl();
    if (!isValidExecUrl(apiUrl)) {
      reject(new Error('Apps Script /exec URL is missing or invalid'));
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(apiUrl);
    } catch (error) {
      reject(new Error('Apps Script /exec URL is invalid'));
      return;
    }

    const callbackName = `jsonpCallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    parsedUrl.searchParams.set('action', action);
    parsedUrl.searchParams.set('_ts', String(Date.now()));
    parsedUrl.searchParams.set('callback', callbackName);
    if (payload) parsedUrl.searchParams.set('payload', JSON.stringify(payload));

    const script = document.createElement('script');
    let settled = false;
    const cleanup = () => {
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
      clearTimeout(timer);
    };

    const fail = message => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };

    const timer = setTimeout(() => {
      fail('Connection timeout. Please check the Apps Script /exec URL and redeploy the web app with access set to Anyone.');
    }, 20000);

    window[callbackName] = response => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(response || {});
    };

    script.onerror = () => {
      fail('Cannot connect to Apps Script. The current web app URL is redirecting to Google sign-in or is not public. Redeploy Apps Script as: Execute as Me, Who has access: Anyone.');
    };

    script.src = parsedUrl.toString();
    document.body.appendChild(script);
  });
}

function setSyncStatus(message) {
  document.getElementById('syncStatus').textContent = message;
}

function updateLastUpdated(dateValue = new Date()) {
  if (!dateValue) {
    document.getElementById('lastUpdated').textContent = 'Last updated: -';
    return;
  }

  const now = new Date(dateValue);
  document.getElementById('lastUpdated').textContent = `Last updated: ${now.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`;
}

function showLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('hidden', !show);
}

let toastTimeout;
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 3500);
}

function emptyRow(colspan, text) {
  return `<tr><td colspan="${colspan}"><div class="empty-state">${escapeHtml(text)}</div></td></tr>`;
}

function renderAssignee(name) {
  if (!name) return '—';
  return `<div class="assignee"><span class="avatar">${escapeHtml(getInitials(name))}</span><span>${escapeHtml(name)}</span></div>`;
}

function renderStatusBadge(status) {
  if (!status) return '—';
  const cls = `status-${status.toLowerCase().replace(/\s+/g, '-')}`;
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

function renderRiskBadge(risk) {
  if (!risk) return '—';
  const cls = `risk-${risk.toLowerCase()}`;
  return `<span class="badge ${cls}">${escapeHtml(risk)}</span>`;
}

function sortByClosestDeadline(a, b) {
  const aTime = sortDateValue(a.endDate || a.startDate);
  const bTime = sortDateValue(b.endDate || b.startDate);
  return aTime - bTime;
}

function sortDateValue(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function checkOverdue(task) {
  if (!task.endDate) return false;
  if (task.status === 'Completed' || task.status === 'Cancelled') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(task.endDate);
  return end < today;
}

function getMonthFromDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getMonth() + 1;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateRange(start, end) {
  const startText = formatDate(start);
  const endText = formatDate(end);
  if (startText === '—' && endText === '—') return '—';
  if (startText === '—') return endText;
  if (endText === '—') return startText;
  return `${startText} → ${endText}`;
}

function getInitials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('') || 'U';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
