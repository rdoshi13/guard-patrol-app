// Code.gs

const CONFIG = {
  PATROL_SHEET: "PatrolLogs",
  VISITORS_SHEET: "Visitors",
};

// ---- Entry points ----
function doGet() {
  return json_({ ok: true, message: "Rosedale sync service is running" });
}

function doPost(e) {
  try {
    const body = parseJson_(e);
    if (!body || !body.kind) {
      return json_({ ok: false, error: "Missing kind" });
    }

    // Optional auth via Script Properties.
    const expectedToken = getSyncToken_();
    if (expectedToken) {
      const queryToken = (e && e.parameter && e.parameter.token) || "";
      const headerToken = getHeader_(e, "X-Token") || "";
      const bodyToken = (body && body.token) || "";
      const provided = headerToken || queryToken || bodyToken;

      if (provided !== expectedToken) {
        return json_({ ok: false, error: "Unauthorized" });
      }
    }

    if (body.kind === "patrol_hour_records_v1") {
      return handlePatrol_(body);
    }

    if (body.kind === "visitor_entries_v1") {
      return handleVisitors_(body);
    }

    return json_({ ok: false, error: "Unknown kind" });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ---- Handlers ----
function handlePatrol_(body) {
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const recordIds = Array.isArray(body.recordIds) ? body.recordIds : [];

  if (rows.length === 0) {
    return json_({ ok: true, inserted: 0, skipped: 0 });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureSheet_(ss, CONFIG.PATROL_SHEET);

  // Column 1 is recordId (idempotency key)
  ensureHeaders_(sh, [
    "recordId",
    "dateKey",
    "hourWindow",
    "society",
    "guardId",
    "guardName",
    "status",
    "completedCount",
    "pointsScanned",
    "createdAt",
    "finalizedAt",
  ]);

  // Guard against older sheet headers (pre-recordId).
  const header = sh
    .getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1))
    .getValues()[0]
    .map(String);

  if (header[0] !== "recordId") {
    return json_({
      ok: false,
      error:
        'Patrol sheet header mismatch: Column A must be "recordId".',
    });
  }

  const existingIds = loadExistingRecordIds_(sh);

  const values = [];
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const rid = String(recordIds[i] || r.recordId || "").trim();

    // If we don't have a recordId, we can't dedupe safely.
    // Skip rather than risk duplicates.
    if (!rid) {
      skipped += 1;
      continue;
    }

    if (existingIds.has(rid)) {
      skipped += 1;
      continue;
    }

    values.push([
      rid,
      r.dateKey || "",
      r.hourWindow || "",
      r.society || "",
      r.guardId || "",
      r.guardName || "",
      r.status || "",
      Number(r.completedCount || 0),
      r.pointsScanned || "",
      toDateTimeText_(r.createdAt),
      toDateTimeText_(r.finalizedAt),
    ]);

    existingIds.add(rid);
  }

  if (values.length > 0) {
    const startRow = sh.getLastRow() + 1;
    // Keep timestamp text stable as DD/MM/YYYY HH:MM:SS (no Sheets auto-date coercion).
    sh.getRange(startRow, 10, values.length, 2).setNumberFormat("@");
    sh.getRange(startRow, 1, values.length, values[0].length).setValues(values);
  }

  return json_({ ok: true, inserted: values.length, skipped: skipped });
}

function handleVisitors_(body) {
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const recordIds = Array.isArray(body.recordIds) ? body.recordIds : [];

  if (rows.length === 0) {
    return json_({ ok: true, inserted: 0, skipped: 0 });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureSheet_(ss, CONFIG.VISITORS_SHEET);

  ensureHeaders_(sh, [
    "recordId",
    "society",
    "guardId",
    "guardName",
    "createdAt",
    "visitorId",
    "name",
    "phone",
    "type",
    "vehicle",
    "wing",
    "flatNumber",
    "event",
  ]);

  const header = sh
    .getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1))
    .getValues()[0]
    .map(String);

  if (header[0] !== "recordId") {
    return json_({
      ok: false,
      error:
        'Visitors sheet header mismatch: Column A must be "recordId".',
    });
  }

  const existingIds = loadExistingRecordIds_(sh);

  const values = [];
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const rid = String(recordIds[i] || r.recordId || "").trim();

    if (!rid) {
      skipped += 1;
      continue;
    }

    if (existingIds.has(rid)) {
      skipped += 1;
      continue;
    }

    values.push([
      rid,
      r.society || "",
      r.guardId || "",
      r.guardName || "",
      toDateTimeText_(r.createdAt),
      r.visitorId || "",
      r.name || "",
      r.phone || "",
      r.type || "",
      r.vehicle || "",
      r.wing || "",
      r.flatNumber || "",
      r.event || "",
    ]);

    existingIds.add(rid);
  }

  if (values.length > 0) {
    const startRow = sh.getLastRow() + 1;
    // Keep timestamp text stable as DD/MM/YYYY HH:MM:SS (no Sheets auto-date coercion).
    sh.getRange(startRow, 5, values.length, 1).setNumberFormat("@");
    sh.getRange(startRow, 1, values.length, values[0].length).setValues(values);
  }

  return json_({ ok: true, inserted: values.length, skipped: skipped });
}

// ---- Utilities ----
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function parseJson_(e) {
  if (!e || !e.postData || !e.postData.contents) return null;
  return JSON.parse(e.postData.contents);
}

function ensureSheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function ensureHeaders_(sh, headers) {
  const firstRow = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  const empty = firstRow.every((c) => !String(c || "").trim());

  if (empty) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return;
  }

  // If headers exist but differ, we don't auto-migrate here.
}

function loadExistingRecordIds_(sh) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return new Set();

  // recordId is col 1
  const ids = sh.getRange(2, 1, lastRow - 1, 1).getValues();
  const set = new Set();

  for (let i = 0; i < ids.length; i++) {
    const v = String(ids[i][0] || "").trim();
    if (v) set.add(v);
  }

  return set;
}

function toDateTimeText_(v) {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  if (isNaN(d.getTime())) return "";
  return Utilities.formatDate(
    d,
    Session.getScriptTimeZone(),
    "dd/MM/yyyy HH:mm:ss",
  );
}

function getHeader_(e, name) {
  // NOTE: Web Apps don't reliably pass custom headers.
  // We still try it, but support query/body token too.
  try {
    const headers = (e && e.headers) || {};
    return headers[name] || headers[String(name).toLowerCase()] || "";
  } catch {
    return "";
  }
}

function getSyncToken_() {
  try {
    return String(
      PropertiesService.getScriptProperties().getProperty("SYNC_TOKEN") || "",
    ).trim();
  } catch {
    return "";
  }
}
