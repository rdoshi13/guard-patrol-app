import AsyncStorage from "@react-native-async-storage/async-storage";
import { SHEETS_SYNC_CONFIG } from "../constants/sheets";
import {
  SyncConfig,
  SyncResult,
  syncPatrolHourRecords,
  syncDailyHelpTemplates,
  syncVisitorEntries,
} from "./sheets";

const LAST_SYNC_PATROL_KEY = "last_sync_patrol_at_v1";
const LAST_SYNC_VISITORS_KEY = "last_sync_visitors_at_v1";
const LAST_SYNC_DAILY_HELP_KEY = "last_sync_daily_help_at_v1";
const DAILY_HELP_INTERVAL_MS = 12 * 60 * 60 * 1000;

let activeRun: Promise<{
  patrol: SyncResult;
  visitors: SyncResult;
  dailyHelp: SyncResult;
}> | null = null;

function parseIsoMs(iso: string | null): number | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  return Number.isNaN(ts) ? null : ts;
}

function dueByInterval(lastSyncIso: string | null, intervalMs: number): boolean {
  const ts = parseIsoMs(lastSyncIso);
  if (ts === null) return true;
  return Date.now() - ts >= intervalMs;
}

function latestVisitorSlot(now: Date): Date {
  // Visitors: every hour at HH:00 local time.
  const slot = new Date(now);
  slot.setMinutes(0, 0, 0);
  return slot;
}

function latestPatrolSlot(now: Date): Date {
  // Patrol: daily at 05:30 and 23:30 local time.
  const slot0530 = new Date(now);
  slot0530.setHours(5, 30, 0, 0);

  const slot2330 = new Date(now);
  slot2330.setHours(23, 30, 0, 0);

  if (now.getTime() >= slot2330.getTime()) {
    return slot2330;
  }

  if (now.getTime() >= slot0530.getTime()) {
    return slot0530;
  }

  const yesterday2330 = new Date(slot2330);
  yesterday2330.setDate(yesterday2330.getDate() - 1);
  return yesterday2330;
}

function dueBySlot(lastSyncIso: string | null, slot: Date): boolean {
  const ts = parseIsoMs(lastSyncIso);
  if (ts === null) return true;
  return ts < slot.getTime();
}

async function setLastSyncNow(key: string): Promise<void> {
  await AsyncStorage.setItem(key, new Date().toISOString());
}

async function runInternal(
  cfg: SyncConfig,
): Promise<{ patrol: SyncResult; visitors: SyncResult; dailyHelp: SyncResult }> {
  const [lastPatrol, lastVisitors, lastDailyHelp] = await Promise.all([
    AsyncStorage.getItem(LAST_SYNC_PATROL_KEY),
    AsyncStorage.getItem(LAST_SYNC_VISITORS_KEY),
    AsyncStorage.getItem(LAST_SYNC_DAILY_HELP_KEY),
  ]);
  const now = new Date();

  let patrol: SyncResult = { ok: true, attempted: 0, synced: 0, skipped: 0 };
  let visitors: SyncResult = { ok: true, attempted: 0, synced: 0, skipped: 0 };
  let dailyHelp: SyncResult = { ok: true, attempted: 0, synced: 0, skipped: 0 };

  if (dueBySlot(lastPatrol, latestPatrolSlot(now))) {
    patrol = await syncPatrolHourRecords(cfg);
    if (patrol.ok) {
      await setLastSyncNow(LAST_SYNC_PATROL_KEY);
    }
  }

  if (dueBySlot(lastVisitors, latestVisitorSlot(now))) {
    visitors = await syncVisitorEntries(cfg);
    if (visitors.ok) {
      await setLastSyncNow(LAST_SYNC_VISITORS_KEY);
    }
  }

  if (dueByInterval(lastDailyHelp, DAILY_HELP_INTERVAL_MS)) {
    dailyHelp = await syncDailyHelpTemplates(cfg);
    if (dailyHelp.ok) {
      await setLastSyncNow(LAST_SYNC_DAILY_HELP_KEY);
    }
  }

  return { patrol, visitors, dailyHelp };
}

export async function runAutoSyncIfDue(
  cfg: SyncConfig = SHEETS_SYNC_CONFIG,
): Promise<{ patrol: SyncResult; visitors: SyncResult; dailyHelp: SyncResult }> {
  if (activeRun) return activeRun;

  activeRun = runInternal(cfg).finally(() => {
    activeRun = null;
  });

  return activeRun;
}
