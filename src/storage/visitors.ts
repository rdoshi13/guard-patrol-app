import AsyncStorage from "@react-native-async-storage/async-storage";

export type VisitType =
  | "Courier/Delivery"
  | "Maid"
  | "Guest"
  | "Electrician/Plumber/Gardener"
  | "Milkman"
  | "Paperboy";

export type VehicleType = "None" | "Car" | "Bike" | "Cycle";

export type VisitorProfile = {
  id: string;
  name: string;
  phone: string;
  type: VisitType;
  vehicle: VehicleType;
  photoUri?: string;
  flat?: string; // e.g. "B-402"
  visitCount: number;
  lastSeenAt?: string;
};

export type VisitorEntryEvent = "CHECKIN";

export type VisitorEntry = {
  id: string; // recordId for Sheets (idempotency key)
  society: string;
  guardId: string;
  guardName: string;
  createdAt: string; // ISO

  visitorId?: string; // profile id (v_<digits>)
  name: string;
  phone: string; // digits only
  type: VisitType;
  vehicle: VehicleType;
  flat?: string; // e.g. "B-402" or blank

  event: VisitorEntryEvent;
  notes?: string;

  syncedAt?: string; // ISO when pushed to Sheets
};

const VISITOR_PROFILES_KEY = "visitor_profiles_v1";
const VISITOR_ENTRIES_KEY = "visitor_entries_v1";

export async function loadVisitorProfiles(): Promise<VisitorProfile[]> {
  const raw = await AsyncStorage.getItem(VISITOR_PROFILES_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as VisitorProfile[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export async function saveVisitorProfiles(
  profiles: VisitorProfile[],
): Promise<void> {
  await AsyncStorage.setItem(VISITOR_PROFILES_KEY, JSON.stringify(profiles));
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

function createRecordId(prefix: string): string {
  // Stable enough for one-device usage; includes time + randomness
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createVisitorId(phone: string): string {
  // stable-ish id so same phone maps to same “person”
  return `v_${digitsOnly(phone)}`;
}

export async function upsertVisitorProfile(input: {
  name: string;
  phone: string;
  type: VisitType;
  flat?: string;
  vehicle: VehicleType;
  photoUri?: string;
  seenAtIso?: string;
}): Promise<VisitorProfile> {
  const profiles = await loadVisitorProfiles();

  const phoneKey = digitsOnly(input.phone);
  const id = createVisitorId(phoneKey);
  const nowIso = input.seenAtIso ?? new Date().toISOString();
  const flat = typeof input.flat === "string" ? input.flat.trim() : "";

  const existing = profiles.find((p) => p.id === id);

  let updated: VisitorProfile;

  if (existing) {
    updated = {
      ...existing,
      name: input.name.trim() || existing.name,
      vehicle: input.vehicle,
      photoUri: input.photoUri ?? existing.photoUri,
      flat: flat ? flat : existing.flat,
      visitCount: existing.visitCount + 1,
      lastSeenAt: nowIso,
    };
  } else {
    updated = {
      id,
      name: input.name.trim(),
      phone: phoneKey,
      type: input.type,
      vehicle: input.vehicle,
      photoUri: input.photoUri,
      flat: flat || undefined,
      visitCount: 1,
      lastSeenAt: nowIso,
    };
    profiles.push(updated);
  }

  const next = profiles.map((p) => (p.id === updated.id ? updated : p));
  await saveVisitorProfiles(next);

  return updated;
}

export async function getTopVisitorsByFrequency(
  limit: number,
): Promise<VisitorProfile[]> {
  const profiles = await loadVisitorProfiles();

  return profiles
    .slice()
    .sort((a, b) => {
      if (b.visitCount !== a.visitCount) return b.visitCount - a.visitCount;

      const ta = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
      const tb = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;

      return tb - ta;
    })
    .slice(0, limit);
}

export async function searchVisitorsByName(
  query: string,
  limit: number,
): Promise<VisitorProfile[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const profiles = await loadVisitorProfiles();

  const starts = profiles.filter((p) => p.name.toLowerCase().startsWith(q));
  const includes = profiles.filter(
    (p) =>
      !p.name.toLowerCase().startsWith(q) && p.name.toLowerCase().includes(q),
  );

  return [...starts, ...includes].slice(0, limit);
}

export async function loadVisitorEntries(): Promise<VisitorEntry[]> {
  const raw = await AsyncStorage.getItem(VISITOR_ENTRIES_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as VisitorEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export async function saveVisitorEntries(
  entries: VisitorEntry[],
): Promise<void> {
  await AsyncStorage.setItem(VISITOR_ENTRIES_KEY, JSON.stringify(entries));
}

export async function addVisitorEntry(input: {
  society: string;
  guardId: string;
  guardName: string;
  visitorId?: string;
  name: string;
  phone: string;
  type: VisitType;
  vehicle: VehicleType;
  flat?: string;
  event?: VisitorEntryEvent;
  notes?: string;
  createdAtIso?: string;
}): Promise<VisitorEntry> {
  const entries = await loadVisitorEntries();

  const nowIso = input.createdAtIso ?? new Date().toISOString();
  const phoneDigits = digitsOnly(input.phone);

  const entry: VisitorEntry = {
    id: createRecordId("ve"),
    society: input.society,
    guardId: input.guardId,
    guardName: input.guardName,
    createdAt: nowIso,

    visitorId: input.visitorId,
    name: input.name.trim(),
    phone: phoneDigits,
    type: input.type,
    vehicle: input.vehicle,
    flat: input.flat?.trim() || undefined,

    event: input.event ?? "CHECKIN",
    notes: input.notes?.trim() || undefined,

    syncedAt: undefined,
  };

  const next = [entry, ...entries];
  await saveVisitorEntries(next);
  return entry;
}

export async function loadUnsyncedVisitorEntries(
  limit: number,
): Promise<VisitorEntry[]> {
  const entries = await loadVisitorEntries();
  return entries.filter((e) => !e.syncedAt).slice(0, limit);
}

export async function markVisitorEntriesSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const nowIso = new Date().toISOString();
  const entries = await loadVisitorEntries();
  const idSet = new Set(ids);

  const next = entries.map((e) => {
    if (idSet.has(e.id)) {
      return { ...e, syncedAt: nowIso };
    }
    return e;
  });

  await saveVisitorEntries(next);
}

export async function cleanupSyncedVisitorEntries(
  olderThanDays: number,
): Promise<void> {
  const entries = await loadVisitorEntries();
  if (entries.length === 0) return;

  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

  const next = entries.filter((e) => {
    if (!e.syncedAt) return true; // keep unsynced forever
    const t = new Date(e.syncedAt).getTime();
    if (!t) return true;
    return t >= cutoff;
  });

  if (next.length !== entries.length) {
    await saveVisitorEntries(next);
  }
}
