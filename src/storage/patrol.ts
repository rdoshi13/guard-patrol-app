// src/storage/patrol.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type PatrolPoint = 1 | 2 | 3 | 4 | 5 | 6;

export type PatrolStatus = "IN_PROGRESS" | "COMPLETED" | "MISSED";

export type PatrolScan = {
  point: PatrolPoint;
  qrData: string;
  scannedAt: string; // ISO
};

export type PatrolHourRecord = {
  id: string;

  society: string; // "Rosedale"

  guardId: string;
  guardName: string;

  // Local date key (phone time): YYYY-MM-DD
  dateKey: string;

  // Hour window start (0..4 for 12–5 AM)
  hourStart: number;

  // One scan per point
  scans: Record<PatrolPoint, PatrolScan | null>;

  completedCount: number; // 0..6
  status: PatrolStatus;

  createdAt: string; // ISO
  finalizedAt?: string; // ISO

  // Sync queue
  syncedAt?: string; // ISO if successfully synced to Sheets
};

export type PatrolSheetRow = {
  dateKey: string;
  hourWindow: string;
  society: string;
  guardId: string;
  guardName: string;
  status: "COMPLETED" | "MISSED" | "IN_PROGRESS";
  recordId: string;
  completedCount: number;
  pointsScanned: string; // e.g. "1,2,4"
  createdAt: string;
  finalizedAt: string;
};

const KEY = "patrol_hour_records_v1";

function nowIso(): string {
  return new Date().toISOString();
}

export function makeId(prefix: string = "phr"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function emptyScans(): Record<PatrolPoint, PatrolScan | null> {
  return {
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
  };
}

export function countCompleted(
  scans: Record<PatrolPoint, PatrolScan | null>,
): number {
  let c = 0;
  (Object.keys(scans) as unknown as PatrolPoint[]).forEach((k) => {
    if (scans[k]) c += 1;
  });
  return c;
}

export async function loadPatrolHourRecords(): Promise<PatrolHourRecord[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PatrolHourRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePatrolHourRecords(
  records: PatrolHourRecord[],
): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(records));
}

export async function upsertHourRecord(input: {
  society: string;
  guardId: string;
  guardName: string;
  dateKey: string;
  hourStart: number;
}): Promise<PatrolHourRecord> {
  const all = await loadPatrolHourRecords();

  const existing = all.find(
    (r) =>
      r.dateKey === input.dateKey &&
      r.hourStart === input.hourStart &&
      r.guardId === input.guardId,
  );

  if (existing) return existing;

  const created: PatrolHourRecord = {
    id: makeId(),
    society: input.society,
    guardId: input.guardId,
    guardName: input.guardName,
    dateKey: input.dateKey,
    hourStart: input.hourStart,
    scans: emptyScans(),
    completedCount: 0,
    status: "IN_PROGRESS",
    createdAt: nowIso(),
    syncedAt: undefined,
  };

  const updated = [created, ...all];
  await savePatrolHourRecords(updated);
  return created;
}

export async function applyScan(args: {
  recordId: string;
  point: PatrolPoint;
  qrData: string;
}): Promise<PatrolHourRecord | null> {
  const all = await loadPatrolHourRecords();
  const idx = all.findIndex((r) => r.id === args.recordId);
  if (idx === -1) return null;

  const r = all[idx];
  if (r.finalizedAt || r.status !== "IN_PROGRESS") {
    // finalized already, no changes allowed
    return r;
  }

  // one scan per point
  if (r.scans[args.point]) return r;

  const nextScans = {
    ...r.scans,
    [args.point]: {
      point: args.point,
      qrData: args.qrData,
      scannedAt: nowIso(),
    },
  } as PatrolHourRecord["scans"];

  const completedCount = countCompleted(nextScans);

  const next: PatrolHourRecord = {
    ...r,
    scans: nextScans,
    completedCount,
  };

  all[idx] = next;
  await savePatrolHourRecords(all);
  return next;
}

export async function finalizeHourRecord(args: {
  recordId: string;
  status: "COMPLETED" | "MISSED";
}): Promise<PatrolHourRecord | null> {
  const all = await loadPatrolHourRecords();
  const idx = all.findIndex((r) => r.id === args.recordId);
  if (idx === -1) return null;

  const r = all[idx];

  const next: PatrolHourRecord = {
    ...r,
    status: args.status,
    finalizedAt: nowIso(),
    syncedAt: r.syncedAt ?? undefined,
  };

  all[idx] = next;
  await savePatrolHourRecords(all);
  return next;
}

export async function getUnsyncedHourRecords(): Promise<PatrolHourRecord[]> {
  const all = await loadPatrolHourRecords();
  return all.filter(
    (r) =>
      !r.syncedAt &&
      !!r.finalizedAt &&
      (r.status === "COMPLETED" || r.status === "MISSED"),
  );
}

export async function markHourRecordsSynced(
  recordIds: string[],
): Promise<void> {
  if (recordIds.length === 0) return;

  const all = await loadPatrolHourRecords();
  const set = new Set(recordIds);
  const now = nowIso();

  const next = all.map((r) => (set.has(r.id) ? { ...r, syncedAt: now } : r));
  await savePatrolHourRecords(next);
}

export async function cleanupSyncedOlderThan(days: number = 7): Promise<void> {
  const all = await loadPatrolHourRecords();

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const next = all.filter((r) => {
    // If not synced, keep forever
    if (!r.syncedAt) return true;

    const t = Date.parse(r.syncedAt);
    if (Number.isNaN(t)) return true;

    return t >= cutoff;
  });

  if (next.length !== all.length) {
    await savePatrolHourRecords(next);
  }
}

function hourWindowLabel(hourStart: number): string {
  // hourStart 0..4 => 00:00-01:00 .. 04:00-05:00 (for Sheets)
  // Keep this stable and machine-readable for filtering/sorting.
  const startHour = hourStart; // 0..4
  const endHour = hourStart + 1; // 1..5

  const start = `${String(startHour).padStart(2, "0")}:00`;
  const end = `${String(endHour).padStart(2, "0")}:00`;

  return `${start}-${end}`;
}

function pointsScannedList(scans: PatrolHourRecord["scans"]): string {
  const points: number[] = [];
  (Object.keys(scans) as unknown as PatrolPoint[]).forEach((k) => {
    if (scans[k]) points.push(Number(k));
  });

  points.sort((a, b) => a - b);
  return points.join(",");
}

export function patrolRecordToSheetRow(r: PatrolHourRecord): PatrolSheetRow {
  return {
    dateKey: r.dateKey,
    hourWindow: hourWindowLabel(r.hourStart),
    society: r.society,
    guardId: r.guardId,
    guardName: r.guardName,
    status: r.status,
    recordId: r.id,
    completedCount: r.completedCount,
    pointsScanned: pointsScannedList(r.scans),
    createdAt: r.createdAt,
    finalizedAt: r.finalizedAt ?? "",
  };
}

export async function dryRunSyncPatrolHourRecords(): Promise<{
  toSyncCount: number;
  rows: PatrolSheetRow[];
}> {
  const toSync = await getUnsyncedHourRecords();
  const finalized = toSync.filter((r) => !!r.finalizedAt);

  const rows = finalized.map(patrolRecordToSheetRow);

  console.log("[Sheets Sync][Dry Run] Patrol rows to sync:", rows);

  return { toSyncCount: finalized.length, rows };
}

export async function getPatrolSyncPayload(): Promise<{
  recordIds: string[];
  rows: PatrolSheetRow[];
}> {
  const records = await getUnsyncedHourRecords();

  // Only finalized COMPLETED/MISSED should be returned by getUnsyncedHourRecords already
  const rows = records.map(patrolRecordToSheetRow);
  const recordIds = records.map((r) => r.id);

  return { recordIds, rows };
}
