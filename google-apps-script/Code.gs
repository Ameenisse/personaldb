/**
 * Person Registry — sole backend. Copy this entire file into Apps Script.
 * Sheet: https://docs.google.com/spreadsheets/d/1Gu8HZp0V9cfr3q9DpZiocxVmduYw0YRu8VMprUyv9xg/edit?usp=drivesdk
 * Photos: https://drive.google.com/drive/folders/1F1CHrETiRi8HyvQPV9FMXxZspmZM-CfW
 * Deploy as owner, access Anyone. Authentication is enforced below, not by Google login.
 */
var CONFIG = {
  spreadsheetId: '1Gu8HZp0V9cfr3q9DpZiocxVmduYw0YRu8VMprUyv9xg',
  photoFolderId: '1F1CHrETiRi8HyvQPV9FMXxZspmZM-CfW',
  tab: 'Persons', sessionSeconds: 21600, maxPhotoBytes: 3 * 1024 * 1024
};
var HEADERS = ['RecordID','IDNo','Name','DOB','Sex','Contact','Building','Atoll','Island','AddressFull','PhotoFileID','PhotoURL','CreatedAt','UpdatedAt'];
var FIELDS = ['id','id_no','name','dob','sex','contact','building','atoll','island','address_full','photo_file_id','photo_url','created_at','updated_at'];
var ATOLLS = ['HA.','HDH.','SH.','N.','R.','B.','LH.','K.','AA.','ADH.','V.','M.','F.','DH.','TH.','L.','GA.','GDH.','GN.','S.'];

function setupApp() {
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var book = SpreadsheetApp.openById(CONFIG.spreadsheetId);
    var sheet = book.getSheetByName(CONFIG.tab) || book.insertSheet(CONFIG.tab);
    if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    assertHeaders_(sheet); // Refuse incompatible existing layouts; never overwrite their data.
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#e9eef5');
    sheet.getRange(2, 1, Math.max(1, sheet.getMaxRows() - 1), HEADERS.length).setNumberFormat('@');
    sheet.autoResizeColumns(1, HEADERS.length);
    DriveApp.getFolderById(CONFIG.photoFolderId).getName(); // Verify owner access; no sharing changes.
    var props = PropertiesService.getScriptProperties();
    if (!props.getProperty('APP_PIN')) props.setProperty('APP_PIN', '1388');
    if (!props.getProperty('AUTH_VERSION')) props.setProperty('AUTH_VERSION', Utilities.getUuid());
    return 'Ready. Change APP_PIN in Script Properties before use, then deploy as Web App.';
  } finally { lock.releaseLock(); }
}

// GET is health only: never expose records or accept session/PIN secrets in URLs.
function doGet() { return json_({ ok: true, data: { service: 'Person Registry', version: 1 } }); }
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length > 4400000) fail_('BAD_REQUEST', 'Invalid or oversized request.');
    var req;
    try { req = JSON.parse(e.postData.contents); } catch (_) { fail_('BAD_REQUEST', 'Invalid JSON.'); }
    if (!req || typeof req !== 'object') fail_('BAD_REQUEST', 'Invalid request.');
    var data;
    if (req.action === 'login') data = login_(req.pin);
    else {
      var session = requireSession_(req.token);
      switch (req.action) {
        case 'session': data = { expiresAt: session.expiresAt }; break;
        case 'logout': CacheService.getScriptCache().remove(sessionKey_(req.token)); data = { loggedOut: true }; break;
        case 'listPersons': data = readPersons_(); break;
        case 'getPerson': data = readPersons_().filter(function(p) { return p.id_no === String(req.idNo || '').trim().toUpperCase(); })[0] || null; break;
        case 'savePerson': data = savePerson_(req); break;
        case 'getPhoto': data = getPhoto_(req.recordId); break;
        default: fail_('BAD_REQUEST', 'Unknown API action.');
      }
    }
    return json_({ ok: true, data: data });
  } catch (err) {
    if (!err.apiCode) console.error('Registry request failed: ' + String(err.message));
    return json_({ ok: false, error: { code: err.apiCode || 'SERVER_ERROR', message: err.apiCode ? err.message : 'Google could not complete the request. Check owner permissions, service quotas, and Apps Script execution logs.' } });
  }
}
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function fail_(code, message) { var err = new Error(message); err.apiCode = code; throw err; }
function hash_(value) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value));
}
function sessionKey_(token) { return 'session:' + hash_(token); }
function authVersion_() {
  var props = PropertiesService.getScriptProperties();
  return hash_(props.getProperty('AUTH_VERSION') + ':' + props.getProperty('APP_PIN'));
}
function login_(pin) {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('APP_PIN')) fail_('SETUP_REQUIRED', 'Run setupApp() in Apps Script first.');
  // Apps Script does not expose trustworthy visitor IP addresses. This is a shared,
  // global failed-attempt lockout, not client-supplied identification.
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var now = Date.now();
    var limit = JSON.parse(props.getProperty('LOGIN_FAILURES') || '{"count":0,"until":0}');
    if (limit.count >= 10 && limit.until > now) fail_('RATE_LIMITED', 'Too many incorrect PIN attempts. Try again in 15 minutes.');
    if (limit.until <= now) limit = { count: 0, until: now + 15 * 60 * 1000 };
    if (typeof pin !== 'string' || !/^\d{4,12}$/.test(pin) || hash_(pin) !== hash_(props.getProperty('APP_PIN'))) {
      limit.count++; props.setProperty('LOGIN_FAILURES', JSON.stringify(limit));
      fail_('INVALID_PIN', 'Incorrect PIN. Please try again.');
    }
    props.deleteProperty('LOGIN_FAILURES');
    var token = Utilities.getUuid() + Utilities.getUuid();
    var session = { expiresAt: now + CONFIG.sessionSeconds * 1000, version: authVersion_() };
    CacheService.getScriptCache().put(sessionKey_(token), JSON.stringify(session), CONFIG.sessionSeconds);
    return { token: token, expiresAt: session.expiresAt };
  } finally { lock.releaseLock(); }
}
function requireSession_(token) {
  if (typeof token !== 'string' || token.length !== 72) fail_('UNAUTHORIZED', 'Your session expired. Enter your PIN again.');
  var cached = CacheService.getScriptCache().get(sessionKey_(token));
  var session = cached ? JSON.parse(cached) : null;
  if (!session || session.expiresAt <= Date.now() || session.version !== authVersion_()) fail_('UNAUTHORIZED', 'Your session expired. Enter your PIN again.');
  return session;
}
function assertHeaders_(sheet) {
  var headers = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (headers.join('|') !== HEADERS.join('|')) fail_('SHEET_LAYOUT', 'Persons headers do not match. Back up the tab and arrange the documented columns before continuing.');
}
function sheet_() {
  var sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(CONFIG.tab);
  if (!sheet) fail_('SETUP_REQUIRED', 'Run setupApp() first.');
  assertHeaders_(sheet); return sheet;
}
function rows_(sheet) { return sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues(); }
function person_(row) {
  var p = {};
  FIELDS.forEach(function(key, i) {
    var value = row[i];
    if (value instanceof Date) value = key === 'dob' ? Utilities.formatDate(value, SpreadsheetApp.openById(CONFIG.spreadsheetId).getSpreadsheetTimeZone(), 'yyyy-MM-dd') : value.toISOString();
    p[key] = value == null ? '' : String(value);
  });
  p.id_no = p.id_no.trim().toUpperCase(); p.atoll = p.atoll.trim().toUpperCase();
  return p;
}
function readPersons_() { return rows_(sheet_()).filter(function(row) { return row[1]; }).map(person_); }
function clean_(value, max) {
  if (value == null) return '';
  if (typeof value !== 'string') fail_('VALIDATION', 'Person fields must be text.');
  value = value.trim();
  if (value.length > max) fail_('VALIDATION', 'A person field is too long.');
  return value;
}
function validatePerson_(source) {
  if (!source || typeof source !== 'object') fail_('VALIDATION', 'Person details are required.');
  var p = {};
  ['id_no','name','dob','sex','contact','building','atoll','island','address_full'].forEach(function(k) { p[k] = clean_(source[k], k === 'address_full' ? 2000 : 300); });
  p.id_no = p.id_no.toUpperCase(); p.atoll = p.atoll.toUpperCase();
  if (!/^[A-Z]\d{5,8}$/.test(p.id_no) || !p.name) fail_('VALIDATION', 'Enter a valid ID (one letter and 5–8 digits) and name.');
  if (p.dob) {
    var d = new Date(p.dob + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dob) || isNaN(d.getTime()) || d.toISOString().slice(0,10) !== p.dob || d > new Date()) fail_('VALIDATION', 'Enter a valid date of birth that is not in the future.');
  }
  if (p.sex && ['Male','Female'].indexOf(p.sex) < 0) fail_('VALIDATION', 'Select Male or Female.');
  if (p.atoll && ATOLLS.indexOf(p.atoll) < 0) fail_('VALIDATION', 'Select a valid atoll.');
  p.contact = p.contact.replace(/(\d{3,5})-(\d{3,5})/g, '$1$2');
  if (p.contact && !/^\d{7,10}(\s*\/\s*\d{7,10})*$/.test(p.contact)) fail_('VALIDATION', 'Contact numbers must have 7–10 digits, separated by /.');
  p.contact = p.contact.split('/').map(function(v) { return v.trim(); }).filter(Boolean).join(' / ');
  p.address_full = [p.building, [p.atoll, p.island].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return p;
}
function safeCell_(value) {
  // Sheets treats strings starting = as formulas even through setValues. Literal prefix
  // prevents formula execution; getValues returns the original text without the prefix.
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}
function inPhotoFolder_(file) {
  var parents = file.getParents();
  while (parents.hasNext()) if (parents.next().getId() === CONFIG.photoFolderId) return true;
  return false;
}
function createPhoto_(dataUrl, idNo) {
  if (typeof dataUrl !== 'string' || dataUrl.length > 4200000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) fail_('VALIDATION', 'Expected a compressed JPEG photo.');
  var bytes;
  try { bytes = Utilities.base64Decode(dataUrl.split(',')[1]); } catch (_) { fail_('VALIDATION', 'Invalid photo encoding.'); }
  if (bytes.length > CONFIG.maxPhotoBytes || bytes.length < 4 || (bytes[0] & 255) !== 255 || (bytes[1] & 255) !== 216 || (bytes[2] & 255) !== 255) fail_('VALIDATION', 'Invalid or oversized JPEG photo.');
  var blob = Utilities.newBlob(bytes, 'image/jpeg', idNo + '_' + Date.now() + '.jpg');
  return DriveApp.getFolderById(CONFIG.photoFolderId).createFile(blob);
}
function savePerson_(req) {
  var p = validatePerson_(req.person);
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  var newFile = null, committed = false;
  try {
    // All identity checks and writes occur inside the same lock, including photo replacement.
    var sheet = sheet_(), rows = rows_(sheet), index = -1;
    rows.forEach(function(row, i) { if (String(row[1]).trim().toUpperCase() === p.id_no) { if (index !== -1) fail_('DUPLICATE_DATA', 'Multiple rows have this ID. Resolve duplicate rows in Persons first.'); index = i; } });
    var old = index >= 0 ? person_(rows[index]) : null;
    if (req.recordId && (!old || old.id !== req.recordId)) fail_('CONFLICT', 'The record ID changed. Reload the person before updating.');
    if (req.photo != null && req.photo !== '') newFile = createPhoto_(req.photo, p.id_no);
    var now = new Date().toISOString();
    p.id = old ? old.id : Utilities.getUuid();
    p.created_at = old ? old.created_at : now; p.updated_at = now;
    p.photo_file_id = newFile ? newFile.getId() : old ? old.photo_file_id : '';
    p.photo_url = newFile ? newFile.getUrl() : old ? old.photo_url : '';
    var targetRow = index >= 0 ? index + 2 : sheet.getLastRow() + 1;
    if (targetRow > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
    sheet.getRange(targetRow, 1, 1, HEADERS.length).setNumberFormat('@').setValues([FIELDS.map(function(k) { return safeCell_(p[k]); })]);
    SpreadsheetApp.flush(); committed = true;
    var warning = '';
    if (newFile && old && old.photo_file_id && old.photo_file_id !== newFile.getId()) {
      try { var oldFile = DriveApp.getFileById(old.photo_file_id); if (inPhotoFolder_(oldFile)) oldFile.setTrashed(true); }
      catch (_) { warning = 'Person saved. The previous photo could not be moved to trash.'; }
    }
    return { person: p, created: !old, warning: warning };
  } catch (err) {
    if (newFile && !committed) { try { newFile.setTrashed(true); } catch (_) { /* Owner may clean up orphan later. */ } }
    throw err;
  } finally { lock.releaseLock(); }
}
function getPhoto_(recordId) {
  var p = readPersons_().filter(function(p) { return p.id === recordId; })[0];
  if (!p || !p.photo_file_id) fail_('NOT_FOUND', 'No photo is stored for this person.');
  var file = DriveApp.getFileById(p.photo_file_id);
  if (file.isTrashed() || !inPhotoFolder_(file)) fail_('NOT_FOUND', 'Photo is not in the configured folder.');
  var blob = file.getBlob();
  if (['image/jpeg','image/png','image/webp'].indexOf(blob.getContentType()) < 0 || file.getSize() > 5 * 1024 * 1024) fail_('VALIDATION', 'Stored photo is not a supported image.');
  return { dataUrl: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
}
