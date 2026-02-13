import AsyncStorage from "@react-native-async-storage/async-storage";
import { SHEETS_SYNC_CONFIG } from "../constants/sheets";
import {
  SyncConfig,
  SyncResult,
  syncPatrolHourRecords,
  syncVisitorEntries,
} from "./sheets";

const LAST_SYNC_PATROL_KEY = "last_sync_patrol_at_v1";
const LAST_SYNC_VISITORS_KEY = "last_sync_visitors_at_v1";
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

let activeRun: Promise<{
  patrol: SyncResult;
  visitors: SyncResult;
}> | null = null;

function dueBy(lastSyncIso: string | null): boolean {
  if (!lastSyncIso) return true;
  const ts = Date.parse(lastSyncIso);
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts >= TWELVE_HOURS_MS;
}

async function setLastSyncNow(key: string): Promise<void> {
  await AsyncStorage.setItem(key, new Date().toISOString());
}

async function runInternal(
  cfg: SyncConfig,
): Promise<{ patrol: SyncResult; visitors: SyncResult }> {
  const [lastPatrol, lastVisitors] = await Promise.all([
    AsyncStorage.getItem(LAST_SYNC_PATROL_KEY),
    AsyncStorage.getItem(LAST_SYNC_VISITORS_KEY),
  ]);

  let patrol: SyncResult = { ok: true, attempted: 0, synced: 0, skipped: 0 };
  let visitors: SyncResult = { ok: true, attempted: 0, synced: 0, skipped: 0 };

  if (dueBy(lastPatrol)) {
    patrol = await syncPatrolHourRecords(cfg);
    if (patrol.ok) {
      await setLastSyncNow(LAST_SYNC_PATROL_KEY);
    }
  }

  if (dueBy(lastVisitors)) {
    visitors = await syncVisitorEntries(cfg);
    if (visitors.ok) {
      await setLastSyncNow(LAST_SYNC_VISITORS_KEY);
    }
  }

  return { patrol, visitors };
}

export async function runAutoSyncIfDue(
  cfg: SyncConfig = SHEETS_SYNC_CONFIG,
): Promise<{ patrol: SyncResult; visitors: SyncResult }> {
  if (activeRun) return activeRun;

  activeRun = runInternal(cfg).finally(() => {
    activeRun = null;
  });

  return activeRun;
}
