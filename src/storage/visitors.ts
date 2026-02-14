import AsyncStorage from "@react-native-async-storage/async-storage";

export type VisitType =
  | "Courier/Delivery"
  | "Maid"
  | "Sweeper"
  | "Guest"
  | "Electrician/Plumber/Gardener"
  | "Milkman"
  | "Paperboy";

export type VehicleType = "None" | "Car" | "Bike" | "Cycle";

export type VisitorWing = "A" | "B" | "C" | "D" | "ROSEDALE";

export type VisitorProfile = {
  id: string;
  name: string;
  phone: string;
  type: VisitType;
  vehicle: VehicleType;
  photoUri?: string;
  wing?: VisitorWing;
  flatNumber?: string;
  flat?: string; // Legacy field kept for migration/backward compatibility
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
  wing?: VisitorWing;
  flatNumber?: string;
  flat?: string; // Legacy field kept for migration/backward compatibility

  event: VisitorEntryEvent;
  notes?: string;

  syncedAt?: string; // ISO when pushed to Sheets
};

export type VisitorSheetRow = {
  recordId: string;
  society: string;
  guardId: string;
  guardName: string;
  createdAt: string;
  visitorId: string;
  name: string;
  phone: string;
  type: VisitType;
  vehicle: VehicleType;
  wing: string;
  flatNumber: string;
  event: VisitorEntryEvent;
};

const VISITOR_PROFILES_KEY = "visitor_profiles_v1";
const VISITOR_ENTRIES_KEY = "visitor_entries_v1";

const VISIT_TYPES: VisitType[] = [
  "Courier/Delivery",
  "Maid",
  "Sweeper",
  "Guest",
  "Electrician/Plumber/Gardener",
  "Milkman",
  "Paperboy",
];

const VEHICLE_TYPES: VehicleType[] = ["None", "Car", "Bike", "Cycle"];
const WINGS: VisitorWing[] = ["A", "B", "C", "D", "ROSEDALE"];

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

function createRecordId(prefix: string): string {
  // Stable enough for one-device usage; includes time + randomness
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeVisitType(v: unknown): VisitType {
  if (typeof v !== "string") return "Guest";
  const raw = v.trim();
  if (VISIT_TYPES.includes(raw as VisitType)) {
    return raw as VisitType;
  }

  const key = raw.toLowerCase();
  const aliases: Record<string, VisitType> = {
    courier: "Courier/Delivery",
    delivery: "Courier/Delivery",
    maid: "Maid",
    sweeper: "Sweeper",
    guest: "Guest",
    gardener: "Electrician/Plumber/Gardener",
    gardner: "Electrician/Plumber/Gardener",
    electrician: "Electrician/Plumber/Gardener",
    plumber: "Electrician/Plumber/Gardener",
    milkman: "Milkman",
    paperboy: "Paperboy",
    "paper boy": "Paperboy",
  };

  return aliases[key] ?? "Guest";
}

function normalizeVehicleType(v: unknown): VehicleType {
  if (typeof v !== "string") return "None";
  return VEHICLE_TYPES.includes(v as VehicleType) ? (v as VehicleType) : "None";
}

function normalizeWing(v: unknown): VisitorWing | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().toUpperCase();
  return WINGS.includes(s as VisitorWing) ? (s as VisitorWing) : undefined;
}

function normalizeFlatNumber(v: unknown): string | undefined {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const digits = String(v).replace(/\D/g, "");
  return digits || undefined;
}

function enforceSocietyWideFlat(wing?: VisitorWing, flatNumber?: string): {
  wing?: VisitorWing;
  flatNumber?: string;
  forced: boolean;
} {
  if (wing !== "ROSEDALE") {
    return { wing, flatNumber, forced: false };
  }

  const fixed = "000";
  return {
    wing,
    flatNumber: fixed,
    forced: flatNumber !== fixed,
  };
}

export function parseLegacyFlat(v: unknown): {
  wing?: VisitorWing;
  flatNumber?: string;
} {
  if (typeof v !== "string") return {};
  const s = v.trim();
  if (!s) return {};

  const m = s.match(/^\s*(ROSEDALE|[A-D])\s*[-–—]?\s*(\d{1,5})?\s*$/i);
  if (!m) return {};

  const wing = normalizeWing(m[1]);
  if (!wing) return {};

  const parsedFlat = normalizeFlatNumber(m[2]);
  const resolved = enforceSocietyWideFlat(wing, parsedFlat);

  return {
    wing: resolved.wing,
    flatNumber: resolved.flatNumber,
  };
}

function normalizeProfile(raw: any): {
  value: VisitorProfile | null;
  changed: boolean;
} {
  if (!raw || typeof raw !== "object") return { value: null, changed: true };

  const id = String(raw.id ?? "").trim();
  const name = String(raw.name ?? "").trim();
  if (!id || !name) return { value: null, changed: true };

  const wingRaw = normalizeWing(raw.wing);
  const flatNumberRaw = normalizeFlatNumber(raw.flatNumber);
  const legacyFlat = typeof raw.flat === "string" ? raw.flat.trim() : "";
  const parsedLegacy = parseLegacyFlat(legacyFlat);

  const wing = wingRaw ?? parsedLegacy.wing;
  const flatNumber = flatNumberRaw ?? parsedLegacy.flatNumber;
  const resolved = enforceSocietyWideFlat(wing, flatNumber);

  const value: VisitorProfile = {
    id,
    name,
    phone: digitsOnly(String(raw.phone ?? "")),
    type: normalizeVisitType(raw.type),
    vehicle: normalizeVehicleType(raw.vehicle),
    photoUri: typeof raw.photoUri === "string" ? raw.photoUri : undefined,
    wing: resolved.wing,
    flatNumber: resolved.flatNumber,
    flat: legacyFlat || undefined,
    visitCount: Number.isFinite(Number(raw.visitCount))
      ? Math.max(0, Number(raw.visitCount))
      : 0,
    lastSeenAt: typeof raw.lastSeenAt === "string" ? raw.lastSeenAt : undefined,
  };

  const changed =
    (!wingRaw && !!wing) ||
    (!flatNumberRaw && !!resolved.flatNumber) ||
    resolved.forced ||
    value.phone !== String(raw.phone ?? "");

  return { value, changed };
}

function normalizeEntry(raw: any): { value: VisitorEntry | null; changed: boolean } {
  if (!raw || typeof raw !== "object") return { value: null, changed: true };

  const id = String(raw.id ?? "").trim();
  const society = String(raw.society ?? "").trim();
  const guardId = String(raw.guardId ?? "").trim();
  const guardName = String(raw.guardName ?? "").trim();
  const createdAt = String(raw.createdAt ?? "").trim();
  const name = String(raw.name ?? "").trim();

  if (!id || !society || !guardId || !guardName || !createdAt || !name) {
    return { value: null, changed: true };
  }

  const wingRaw = normalizeWing(raw.wing);
  const flatNumberRaw = normalizeFlatNumber(raw.flatNumber);
  const legacyFlat = typeof raw.flat === "string" ? raw.flat.trim() : "";
  const parsedLegacy = parseLegacyFlat(legacyFlat);

  const wing = wingRaw ?? parsedLegacy.wing;
  const flatNumber = flatNumberRaw ?? parsedLegacy.flatNumber;
  const resolved = enforceSocietyWideFlat(wing, flatNumber);

  const value: VisitorEntry = {
    id,
    society,
    guardId,
    guardName,
    createdAt,
    visitorId:
      typeof raw.visitorId === "string" && raw.visitorId.trim()
        ? raw.visitorId.trim()
        : undefined,
    name,
    phone: digitsOnly(String(raw.phone ?? "")),
    type: normalizeVisitType(raw.type),
    vehicle: normalizeVehicleType(raw.vehicle),
    wing: resolved.wing,
    flatNumber: resolved.flatNumber,
    flat: legacyFlat || undefined,
    event: raw.event === "CHECKIN" ? "CHECKIN" : "CHECKIN",
    notes:
      typeof raw.notes === "string" && raw.notes.trim()
        ? raw.notes.trim()
        : undefined,
    syncedAt:
      typeof raw.syncedAt === "string" && raw.syncedAt.trim()
        ? raw.syncedAt.trim()
        : undefined,
  };

  const changed =
    (!wingRaw && !!wing) ||
    (!flatNumberRaw && !!resolved.flatNumber) ||
    resolved.forced ||
    value.phone !== String(raw.phone ?? "");

  return { value, changed };
}

export async function loadVisitorProfiles(): Promise<VisitorProfile[]> {
  const raw = await AsyncStorage.getItem(VISITOR_PROFILES_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    let changed = false;
    const normalized: VisitorProfile[] = [];
    for (const item of parsed) {
      const n = normalizeProfile(item);
      if (n.value) normalized.push(n.value);
      if (n.changed || !n.value) changed = true;
    }

    if (changed) {
      await saveVisitorProfiles(normalized);
    }

    return normalized;
  } catch {
    return [];
  }
}

export async function saveVisitorProfiles(
  profiles: VisitorProfile[],
): Promise<void> {
  await AsyncStorage.setItem(VISITOR_PROFILES_KEY, JSON.stringify(profiles));
}

export function createVisitorId(phone: string): string {
  // stable-ish id so same phone maps to same "person"
  return `v_${digitsOnly(phone)}`;
}

export async function upsertVisitorProfile(input: {
  name: string;
  phone: string;
  type: VisitType;
  wing?: VisitorWing;
  flatNumber?: string;
  flat?: string;
  vehicle: VehicleType;
  photoUri?: string;
  seenAtIso?: string;
}): Promise<VisitorProfile> {
  const profiles = await loadVisitorProfiles();

  const phoneKey = digitsOnly(input.phone);
  const id = createVisitorId(phoneKey);
  const nowIso = input.seenAtIso ?? new Date().toISOString();
  const parsedLegacy = parseLegacyFlat(input.flat);
  const wing = normalizeWing(input.wing) ?? parsedLegacy.wing;
  const flatNumber =
    normalizeFlatNumber(input.flatNumber) ?? parsedLegacy.flatNumber;
  const resolved = enforceSocietyWideFlat(wing, flatNumber);

  const existing = profiles.find((p) => p.id === id);

  let updated: VisitorProfile;

  if (existing) {
    updated = {
      ...existing,
      name: input.name.trim() || existing.name,
      vehicle: input.vehicle,
      photoUri: input.photoUri ?? existing.photoUri,
      wing: resolved.wing ?? existing.wing,
      flatNumber: resolved.flatNumber ?? existing.flatNumber,
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
      wing: resolved.wing,
      flatNumber: resolved.flatNumber,
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
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    let changed = false;
    const normalized: VisitorEntry[] = [];
    for (const item of parsed) {
      const n = normalizeEntry(item);
      if (n.value) normalized.push(n.value);
      if (n.changed || !n.value) changed = true;
    }

    if (changed) {
      await saveVisitorEntries(normalized);
    }

    return normalized;
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
  wing?: VisitorWing;
  flatNumber?: string;
  flat?: string;
  event?: VisitorEntryEvent;
  notes?: string;
  createdAtIso?: string;
}): Promise<VisitorEntry> {
  const entries = await loadVisitorEntries();

  const nowIso = input.createdAtIso ?? new Date().toISOString();
  const phoneDigits = digitsOnly(input.phone);
  const parsedLegacy = parseLegacyFlat(input.flat);
  const wing = normalizeWing(input.wing) ?? parsedLegacy.wing;
  const flatNumber =
    normalizeFlatNumber(input.flatNumber) ?? parsedLegacy.flatNumber;
  const resolved = enforceSocietyWideFlat(wing, flatNumber);

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
    wing: resolved.wing,
    flatNumber: resolved.flatNumber,

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

export function visitorEntryToSheetRow(entry: VisitorEntry): VisitorSheetRow {
  return {
    recordId: entry.id,
    society: entry.society,
    guardId: entry.guardId,
    guardName: entry.guardName,
    createdAt: entry.createdAt,
    visitorId: entry.visitorId ?? "",
    name: entry.name,
    phone: entry.phone,
    type: entry.type,
    vehicle: entry.vehicle,
    wing: entry.wing ?? "",
    flatNumber: entry.flatNumber ?? "",
    event: entry.event,
  };
}

export async function getVisitorSyncPayload(limit: number = 300): Promise<{
  recordIds: string[];
  rows: VisitorSheetRow[];
}> {
  const entries = await loadUnsyncedVisitorEntries(limit);
  return {
    recordIds: entries.map((e) => e.id),
    rows: entries.map(visitorEntryToSheetRow),
  };
}
