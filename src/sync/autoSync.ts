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
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

let activeRun: Promise<{
  patrol: SyncResult;
  visitors: SyncResult;
  dailyHelp: SyncResult;
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
): Promise<{ patrol: SyncResult; visitors: SyncResult; dailyHelp: SyncResult }> {
  const [lastPatrol, lastVisitors, lastDailyHelp] = await Promise.all([
    AsyncStorage.getItem(LAST_SYNC_PATROL_KEY),
    AsyncStorage.getItem(LAST_SYNC_VISITORS_KEY),
    AsyncStorage.getItem(LAST_SYNC_DAILY_HELP_KEY),
  ]);

  let patrol: SyncResult = { ok: true, attempted: 0, synced: 0, skipped: 0 };
  let visitors: SyncResult = { ok: true, attempted: 0, synced: 0, skipped: 0 };
  let dailyHelp: SyncResult = { ok: true, attempted: 0, synced: 0, skipped: 0 };

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

  if (dueBy(lastDailyHelp)) {
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
