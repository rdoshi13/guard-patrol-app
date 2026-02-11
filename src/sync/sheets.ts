// src/sync/sheets.ts
import {
  getUnsyncedHourRecords,
  patrolRecordToSheetRow,
  markHourRecordsSynced,
  cleanupSyncedOlderThan,
} from "../storage/patrol";

export type SyncResult = {
  ok: boolean;
  attempted: number;
  synced: number;
  skipped: number;
  message?: string;
};

type SyncConfig = {
  url: string; // Apps Script /exec URL
  token?: string; // optional shared secret, sent via query param and body (headers are unreliable)
  timeoutMs?: number;
};

async function postJsonWithTimeout(
  url: string,
  init: Omit<RequestInit, "signal">,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function withToken(url: string, token?: string): string {
  if (!token) return url;

  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postWithSilentRetry(
  url: string,
  init: Omit<RequestInit, "signal">,
  timeoutMs: number,
  attempts: number,
): Promise<Response> {
  let lastErr: unknown = null;

  for (let i = 0; i < attempts; i += 1) {
    try {
      // Exponential backoff with small jitter (silent)
      if (i > 0) {
        const base = 800 * 2 ** (i - 1);
        const jitter = Math.floor(Math.random() * 250);
        await sleep(base + jitter);
      }

      return await postJsonWithTimeout(url, init, timeoutMs);
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr ?? new Error("Request failed");
}

export async function syncPatrolHourRecords(
  cfg: SyncConfig,
): Promise<SyncResult> {
  const timeoutMs = cfg.timeoutMs ?? 12_000;

  try {
    const records = await getUnsyncedHourRecords();

    if (records.length === 0) {
      return { ok: true, attempted: 0, synced: 0, skipped: 0 };
    }

    const rows = records.map(patrolRecordToSheetRow);
    const recordIds = records.map((r) => r.id);

    const url = withToken(cfg.url, cfg.token);

    const body = {
      kind: "patrol_hour_records_v1",
      token: cfg.token, // Apps Script reliably receives body + query params
      recordIds,
      rows,
    };

    const res = await postWithSilentRetry(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      timeoutMs,
      3,
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        attempted: recordIds.length,
        synced: 0,
        skipped: 0,
        message: `HTTP ${res.status} ${text}`.trim(),
      };
    }

    // We accept either JSON or plain text "ok"
    const payloadText = await res.text().catch(() => "");
    let payload: any = null;

    try {
      payload = payloadText ? JSON.parse(payloadText) : null;
    } catch {
      payload = null;
    }

    const remoteOk =
      payload?.ok === true ||
      payload?.success === true ||
      payloadText.toLowerCase().includes("ok");

    if (!remoteOk) {
      return {
        ok: false,
        attempted: recordIds.length,
        synced: 0,
        skipped: 0,
        message: payloadText || "Remote did not confirm success",
      };
    }

    await markHourRecordsSynced(recordIds);
    await cleanupSyncedOlderThan(7);

    const inserted =
      typeof payload?.inserted === "number"
        ? payload.inserted
        : recordIds.length;
    const remoteSkipped =
      typeof payload?.skipped === "number" ? payload.skipped : 0;

    // If the server deduped (skipped), those records are already in the sheet.
    // Either way, they are safe to mark as synced locally.
    const safeSynced = Math.min(recordIds.length, inserted + remoteSkipped);

    return {
      ok: true,
      attempted: recordIds.length,
      synced: safeSynced,
      skipped: remoteSkipped,
      message:
        typeof payload?.message === "string" ? payload.message : undefined,
    };
  } catch (e: any) {
    return {
      ok: false,
      attempted: 0,
      synced: 0,
      skipped: 0,
      message:
        e?.name === "AbortError"
          ? "Sync request timed out"
          : (e?.message ?? String(e)),
    };
  }
}

// Back-compat alias
export const syncPatrolHourRecordsToSheets = syncPatrolHourRecords;
