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
    'AssignedEmail',
    'StartDate',
    'EndDate',
    'Status',
    'Risk',
    'ReferenceLink',
    'Notes',
    'CreatedBy',
    'CreatedAt',
    'UpdatedAt'
  ]
};

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'ping';

    if (action === 'getTasks') {
      return jsonOutput({ success: true, tasks: getAllTasks_() });
    }

    return jsonOutput({
      success: true,
      message: 'API is running',
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      sheetName: CONFIG.SHEET_NAME
    });
  } catch (error) {
    return jsonOutput({ success: false, message: error.message || String(error) });
  }
}

function doPost(e) {
  try {
    const body = parseRequestBody_(e);
    const action = body.action;
    const data = body.data || {};

    if (action === 'addTask') {
      return jsonOutput(addTask_(data));
    }

    if (action === 'updateTask') {
      return jsonOutput(updateTask_(data));
    }

    if (action === 'deleteTask') {
      return jsonOutput(deleteTask_(data.id));
    }

    return jsonOutput({ success: false, message: 'Unsupported action' });
  } catch (error) {
    return jsonOutput({ success: false, message: error.message || String(error) });
  }
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
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
  const firstRow = sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).getValues()[0];
  const needsHeader = CONFIG.HEADERS.some((header, index) => firstRow[index] !== header);

  if (needsHeader) {
    sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setValues([CONFIG.HEADERS]);
    sheet.getRange(1, 1, 1, CONFIG.HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#00836d')
      .setFontColor('white');
    sheet.setFrozenRows(1);
  }
}

function getAllTasks_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, CONFIG.HEADERS.length).getValues();
  const tasks = values
    .filter(row => row[0])
    .map(row => ({
      id: String(row[0] || ''),
      taskName: String(row[1] || ''),
      category: String(row[2] || ''),
      partner: String(row[3] || ''),
      assignedTo: String(row[4] || ''),
      assignedEmail: String(row[5] || ''),
      startDate: formatDateForClient_(row[6]),
      endDate: formatDateForClient_(row[7]),
      status: String(row[8] || ''),
      risk: String(row[9] || ''),
      referenceLink: String(row[10] || ''),
      notes: String(row[11] || ''),
      createdBy: String(row[12] || ''),
      createdAt: String(row[13] || ''),
      updatedAt: String(row[14] || '')
    }))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

  return tasks;
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
    task.assignedEmail || '',
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
  const idColumnValues = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 1).getValues().flat();
  const index = idColumnValues.findIndex(value => String(value) === String(task.id));

  if (index === -1) {
    throw new Error('Task not found');
  }

  const row = index + 2;
  const currentCreatedBy = sheet.getRange(row, 13).getValue() || 'admin';
  const currentCreatedAt = sheet.getRange(row, 14).getValue() || new Date().toISOString();

  sheet.getRange(row, 1, 1, CONFIG.HEADERS.length).setValues([[
    task.id,
    task.taskName || '',
    task.category || '',
    task.partner || '',
    task.assignedTo || '',
    task.assignedEmail || '',
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
  const idColumnValues = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 1).getValues().flat();
  const index = idColumnValues.findIndex(value => String(value) === String(taskId));

  if (index === -1) {
    throw new Error('Task not found');
  }

  sheet.deleteRow(index + 2);
  return { success: true, message: 'Task deleted successfully' };
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
