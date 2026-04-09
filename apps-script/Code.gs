const CONFIG = {
  SPREADSHEET_ID: '1qOeUB-NCxspsVLvxUXzZuVIt8ffetuezBIydqKiBOxc',
  SHEET_NAME: 'Tasks',
  TIMEZONE: 'Asia/Ho_Chi_Minh',
  HEADERS: [
    'ID',
    'TaskName',
    'Category',
    'Partner',
    'AssignedTo',
    'StartDate',
    'EndDate',
    'Status',
    'Risk',
    'ReferenceLink',
    'Notes',
    'CreatedBy',
    'CreatedAt',
    'UpdatedAt'
  ],
  LEGACY_ASSIGNED_EMAIL_HEADER: 'AssignedEmail'
};

function doGet(e) {
  try {
    const action = getParameter_(e, 'action', 'ping');
    let result;

    if (action === 'getTasks') {
      result = { success: true, tasks: getAllTasks_() };
    } else if (action === 'addTask') {
      result = addTask_(getPayloadFromGet_(e));
    } else if (action === 'updateTask') {
      result = updateTask_(getPayloadFromGet_(e));
    } else if (action === 'deleteTask') {
      const payload = getPayloadFromGet_(e);
      result = deleteTask_(payload.id);
    } else {
      result = {
        success: true,
        message: 'API is running',
        spreadsheetId: CONFIG.SPREADSHEET_ID,
        sheetName: CONFIG.SHEET_NAME
      };
    }

    return outputForRequest_(e, result);
  } catch (error) {
    return outputForRequest_(e, { success: false, message: error.message || String(error) });
  }
}

function doPost(e) {
  try {
    const body = parseRequestBody_(e);
    const action = body.action;
    const data = body.data || {};
    let result;

    if (action === 'addTask') {
      result = addTask_(data);
    } else if (action === 'updateTask') {
      result = updateTask_(data);
    } else if (action === 'deleteTask') {
      result = deleteTask_(data.id);
    } else {
      result = { success: false, message: 'Unsupported action' };
    }

    return outputForRequest_(e, result);
  } catch (error) {
    return outputForRequest_(e, { success: false, message: error.message || String(error) });
  }
}

function outputForRequest_(e, obj) {
  const callback = getParameter_(e, 'callback', '');
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(obj) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getParameter_(e, key, defaultValue) {
  if (!e || !e.parameter || typeof e.parameter[key] === 'undefined') {
    return defaultValue;
  }
  return e.parameter[key];
}

function getPayloadFromGet_(e) {
  const raw = getParameter_(e, 'payload', '{}');
  try {
    return JSON.parse(raw || '{}');
  } catch (error) {
    throw new Error('Invalid payload');
  }
}

function parseRequestBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Missing request body');
  }
  return JSON.parse(e.postData.contents);
}

function getSheet_() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  ensureHeaders_(sheet);
  return sheet;
}

function ensureHeaders_(sheet) {
  ensureMinimumColumns_(sheet, 15);
  const firstRow = sheet.getRange(1, 1, 1, Math.max(15, CONFIG.HEADERS.length)).getValues()[0];

  if (firstRow[5] === CONFIG.LEGACY_ASSIGNED_EMAIL_HEADER) {
    sheet.deleteColumn(6);
  }

  ensureMinimumColumns_(sheet, CONFIG.HEADERS.length);
  const currentRow = sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).getValues()[0];
  const needsHeader = CONFIG.HEADERS.some((header, index) => currentRow[index] !== header);

  if (needsHeader) {
    sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setValues([CONFIG.HEADERS]);
  }

  sheet.getRange(1, 1, 1, CONFIG.HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#00836d')
    .setFontColor('white');
  sheet.setFrozenRows(1);
}

function ensureMinimumColumns_(sheet, minColumns) {
  const currentMaxColumns = sheet.getMaxColumns();
  if (currentMaxColumns < minColumns) {
    sheet.insertColumnsAfter(currentMaxColumns, minColumns - currentMaxColumns);
  }
}

function getAllTasks_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.HEADERS.length).getValues();
  return values
    .filter(row => row[0])
    .map(row => ({
      id: String(row[0] || ''),
      taskName: String(row[1] || ''),
      category: String(row[2] || ''),
      partner: String(row[3] || ''),
      assignedTo: String(row[4] || ''),
      startDate: formatDateForClient_(row[5]),
      endDate: formatDateForClient_(row[6]),
      status: String(row[7] || ''),
      risk: String(row[8] || ''),
      referenceLink: String(row[9] || ''),
      notes: String(row[10] || ''),
      createdBy: String(row[11] || ''),
      createdAt: String(row[12] || ''),
      updatedAt: String(row[13] || '')
    }))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function addTask_(task) {
  validateTask_(task, false);
  const sheet = getSheet_();
  const now = new Date().toISOString();
  const id = 'TASK-' + new Date().getTime();

  sheet.appendRow([
    id,
    task.taskName || '',
    task.category || '',
    task.partner || '',
    task.assignedTo || '',
    task.startDate ? new Date(task.startDate) : '',
    task.endDate ? new Date(task.endDate) : '',
    task.status || 'Not Started',
    task.risk || '',
    task.referenceLink || '',
    task.notes || '',
    task.createdBy || 'admin',
    now,
    now
  ]);

  return { success: true, message: 'Task added successfully', id: id };
}

function updateTask_(task) {
  validateTask_(task, true);
  const sheet = getSheet_();
  const index = findTaskRowIndex_(sheet, task.id);
  if (index === -1) throw new Error('Task not found');

  const row = index + 2;
  const currentCreatedBy = sheet.getRange(row, 12).getValue() || 'admin';
  const currentCreatedAt = sheet.getRange(row, 13).getValue() || new Date().toISOString();

  sheet.getRange(row, 1, 1, CONFIG.HEADERS.length).setValues([[
    task.id,
    task.taskName || '',
    task.category || '',
    task.partner || '',
    task.assignedTo || '',
    task.startDate ? new Date(task.startDate) : '',
    task.endDate ? new Date(task.endDate) : '',
    task.status || 'Not Started',
    task.risk || '',
    task.referenceLink || '',
    task.notes || '',
    currentCreatedBy,
    currentCreatedAt,
    new Date().toISOString()
  ]]);

  return { success: true, message: 'Task updated successfully' };
}

function deleteTask_(taskId) {
  if (!taskId) throw new Error('Task ID is required');

  const sheet = getSheet_();
  const index = findTaskRowIndex_(sheet, taskId);
  if (index === -1) throw new Error('Task not found');

  sheet.deleteRow(index + 2);
  return { success: true, message: 'Task deleted successfully' };
}

function findTaskRowIndex_(sheet, taskId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const idColumnValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  return idColumnValues.findIndex(value => String(value) === String(taskId));
}

function validateTask_(task, requiresId) {
  if (!task || typeof task !== 'object') throw new Error('Invalid task payload');
  if (requiresId && !task.id) throw new Error('Task ID is required');
  if (!task.taskName || !String(task.taskName).trim()) throw new Error('Task name is required');
  if (task.startDate && task.endDate && new Date(task.startDate) > new Date(task.endDate)) {
    throw new Error('End date must be after start date');
  }
}

function formatDateForClient_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }

  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }

  return String(value);
}
