const LOGIN_USERNAME = 'admin';
const LOGIN_PASSWORD = '88888888';
const SESSION_KEY = 'chorogusan_dashboard_session';

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
  editingTaskId: '',
  currentUser: 'admin'
};

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  setupStaticOptions();
  restoreSession();
});

function bindEvents() {
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('addTaskBtn').addEventListener('click', openAddTaskModal);
  document.getElementById('addTaskBtnTop').addEventListener('click', openAddTaskModal);
  document.getElementById('closeTaskModalBtn').addEventListener('click', closeTaskModal);
  document.getElementById('cancelTaskBtn').addEventListener('click', closeTaskModal);
  document.getElementById('taskForm').addEventListener('submit', saveTask);
  document.getElementById('refreshBtn').addEventListener('click', loadTasks);
  document.getElementById('exportBtn').addEventListener('click', exportTasks);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  ['filterSearch', 'filterMonth', 'filterStatus', 'filterCategory'].forEach(id => {
    document.getElementById(id).addEventListener('input', applyFilters);
    document.getElementById(id).addEventListener('change', applyFilters);
  });

  document.getElementById('taskModal').addEventListener('click', (event) => {
    if (event.target.id === 'taskModal') closeTaskModal();
  });
}

function setupStaticOptions() {
  populateSelect(document.getElementById('taskCategory'), CATEGORY_OPTIONS, 'Select category');
  populateSelect(document.getElementById('filterCategory'), CATEGORY_OPTIONS, 'All categories');
  populateSelect(document.getElementById('taskStatus'), STATUS_OPTIONS.filter(Boolean), null, 'Not Started');
  populateSelect(document.getElementById('filterStatus'), STATUS_OPTIONS, 'All status');
  populateSelect(document.getElementById('taskRisk'), RISK_OPTIONS, 'Select risk');

  const monthSelect = document.getElementById('filterMonth');
  monthSelect.innerHTML = '<option value="">All months</option>';
  for (let month = 1; month <= 12; month += 1) {
    const date = new Date(2026, month - 1, 1);
    const option = document.createElement('option');
    option.value = String(month);
    option.textContent = date.toLocaleString('en-US', { month: 'long' });
    monthSelect.appendChild(option);
  }
}

function populateSelect(select, values, placeholder = null, defaultValue = '') {
  select.innerHTML = '';
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

function restoreSession() {
  const saved = localStorage.getItem(SESSION_KEY);
  if (saved === 'admin') {
    showApp();
    loadTasks();
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
    loadTasks();
    showToast('Login successful', 'success');
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

async function loadTasks() {
  if (!isApiConfigured()) {
    showToast('Please update config.js with your Apps Script Web App URL', 'error');
    setSyncStatus('API URL is not configured');
    return;
  }

  showLoading(true);
  setSyncStatus('Loading data from Google Sheets...');

  try {
    const response = await apiGet('getTasks');
    if (!response.success) throw new Error(response.message || 'Unable to load tasks');

    state.tasks = Array.isArray(response.tasks) ? response.tasks : [];
    applyFilters();
    updateLastUpdated();
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
    tbody.innerHTML = emptyRow(7, 'No matching tasks found');
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
    tbody.innerHTML = emptyRow(11, 'No tasks found');
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
    container.innerHTML = '<div class="empty-state">No upcoming deadlines</div>';
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
  state.editingTaskId = '';
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
  const task = state.tasks.find(item => item.id === taskId);
  if (!task) {
    showToast('Task not found', 'error');
    return;
  }

  state.editingTaskId = taskId;
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

  const action = payload.id ? 'updateTask' : 'addTask';
  showLoading(true);
  setSyncStatus('Saving task to Google Sheets...');

  try {
    const response = await apiWrite(action, payload);
    if (!response.success) throw new Error(response.message || 'Save failed');
    closeTaskModal();
    showToast(payload.id ? 'Task updated successfully' : 'Task added successfully', 'success');
    await loadTasks();
  } catch (error) {
    console.error(error);
    setSyncStatus('Save failed');
    showToast(error.message || 'Unable to save task', 'error');
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
  showLoading(true);
  setSyncStatus('Deleting task from Google Sheets...');

  try {
    const response = await apiWrite('deleteTask', { id: taskId });
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

async function apiGet(action) {
  const url = new URL(window.APP_CONFIG.API_BASE_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('_ts', String(Date.now()));

  const response = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow'
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function apiWrite(action, data) {
  const url = new URL(window.APP_CONFIG.API_BASE_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('payload', JSON.stringify(data || {}));
  url.searchParams.set('_ts', String(Date.now()));

  const response = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow'
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function isApiConfigured() {
  return window.APP_CONFIG
    && window.APP_CONFIG.API_BASE_URL
    && !window.APP_CONFIG.API_BASE_URL.includes('PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE');
}

function setSyncStatus(message) {
  document.getElementById('syncStatus').textContent = message;
}

function updateLastUpdated() {
  const now = new Date();
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
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
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
