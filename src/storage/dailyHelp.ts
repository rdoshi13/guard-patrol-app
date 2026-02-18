import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  VisitType,
  VehicleType,
  VisitorProfile,
  VisitorWing,
  loadVisitorProfiles,
  parseLegacyFlat,
} from "./visitors";

const DAILY_HELP_LOCAL_KEY = "daily_help_local_v2";
const DAILY_HELP_LEGACY_KEY = "daily_help_templates_v1";

export const DAILY_HELP_DUPLICATE_PHONE_ERROR = "DAILY_HELP_DUPLICATE_PHONE";
export const DAILY_HELP_NOT_FOUND_ERROR = "DAILY_HELP_NOT_FOUND";

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

export type DailyHelpTemplate = {
  id: string;
  name: string;
  phone: string;
  type: VisitType;
  vehicle: VehicleType;
  wing: VisitorWing;
  flatNumber: string;
  photoUrl?: string;
  displayOrder: number;
};

export type DailyHelpTemplateInput = {
  name: string;
  phone: string;
  type: VisitType;
  vehicle: VehicleType;
  wing: VisitorWing;
  flatNumber: string;
  photoUrl?: string;
  displayOrder?: number;
};

export type DailyHelpTemplatePatch = Partial<DailyHelpTemplateInput>;

let initialized = false;
let initPromise: Promise<void> | null = null;

function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

function normalizePhotoUrl(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return undefined;

  const lowered = s.toLowerCase();
  if (lowered === "null" || lowered === "undefined" || lowered === "nan") {
    return undefined;
  }

  return s;
}

function normalizeVisitType(v: unknown): VisitType | null {
  if (typeof v !== "string") return null;
  const raw = v.trim();
  if (!raw) return null;

  if (VISIT_TYPES.includes(raw as VisitType)) {
    return raw as VisitType;
  }

  const key = raw.toLowerCase();
  const aliases: Record<string, VisitType> = {
    courier: "Courier/Delivery",
    "courier/delivery": "Courier/Delivery",
    delivery: "Courier/Delivery",
    maid: "Maid",
    sweeper: "Sweeper",
    guest: "Guest",
    "electrician/plumber/gardener": "Electrician/Plumber/Gardener",
    electrician: "Electrician/Plumber/Gardener",
    plumber: "Electrician/Plumber/Gardener",
    gardener: "Electrician/Plumber/Gardener",
    gardner: "Electrician/Plumber/Gardener",
    milkman: "Milkman",
    paperboy: "Paperboy",
    "paper boy": "Paperboy",
  };

  return aliases[key] ?? null;
}

function normalizeVehicleType(v: unknown): VehicleType {
  if (typeof v !== "string") return "None";
  const s = v.trim();
  return VEHICLE_TYPES.includes(s as VehicleType) ? (s as VehicleType) : "None";
}

function normalizeWing(v: unknown): VisitorWing | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toUpperCase();
  return WINGS.includes(s as VisitorWing) ? (s as VisitorWing) : null;
}

function normalizeFlatNumber(v: unknown): string {
  if (typeof v !== "string" && typeof v !== "number") return "";
  return String(v).replace(/\D/g, "");
}

function parseDisplayOrder(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Number(v.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function createDailyHelpId(): string {
  return `dh_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeTemplateFromRaw(
  raw: unknown,
  fallbackDisplayOrder: number,
): DailyHelpTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const name = String(obj.name ?? "").trim();
  const phone = digitsOnly(String(obj.phone ?? ""));
  const type = normalizeVisitType(obj.type);
  const wing = normalizeWing(obj.wing);

  if (!name || phone.length < 8 || !type || !wing) return null;

  const flatNumberRaw = normalizeFlatNumber(obj.flatNumber);
  const flatNumber = wing === "ROSEDALE" ? "000" : flatNumberRaw;
  if (wing !== "ROSEDALE" && !flatNumber) return null;

  return {
    id:
      typeof obj.id === "string" && obj.id.trim()
        ? obj.id.trim()
        : createDailyHelpId(),
    name,
    phone,
    type,
    vehicle: normalizeVehicleType(obj.vehicle),
    wing,
    flatNumber,
    photoUrl: normalizePhotoUrl(obj.photoUrl),
    displayOrder: parseDisplayOrder(obj.displayOrder, fallbackDisplayOrder),
  };
}

function normalizeAndDedupe(templates: DailyHelpTemplate[]): DailyHelpTemplate[] {
  const withIndex = templates.map((item, index) => ({ item, index }));

  withIndex.sort((a, b) => {
    if (a.item.displayOrder !== b.item.displayOrder) {
      return a.item.displayOrder - b.item.displayOrder;
    }
    return a.index - b.index;
  });

  const seenPhone = new Set<string>();
  const seenId = new Set<string>();
  const out: DailyHelpTemplate[] = [];

  for (const wrapped of withIndex) {
    const item = wrapped.item;
    if (seenPhone.has(item.phone)) continue;
    seenPhone.add(item.phone);

    let id = item.id;
    while (seenId.has(id)) {
      id = createDailyHelpId();
    }
    seenId.add(id);

    out.push({
      ...item,
      id,
      displayOrder: out.length + 1,
    });
  }

  return out;
}

function normalizeListFromUnknown(raw: unknown): DailyHelpTemplate[] {
  if (!Array.isArray(raw)) return [];

  const normalized: DailyHelpTemplate[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const entry = normalizeTemplateFromRaw(raw[i], i + 1);
    if (entry) normalized.push(entry);
  }

  return normalizeAndDedupe(normalized);
}

async function writeTemplates(templates: DailyHelpTemplate[]): Promise<void> {
  await AsyncStorage.setItem(DAILY_HELP_LOCAL_KEY, JSON.stringify(templates));
}

async function readTemplates(): Promise<DailyHelpTemplate[]> {
  const raw = await AsyncStorage.getItem(DAILY_HELP_LOCAL_KEY);
  if (!raw) return [];

  try {
    return normalizeListFromUnknown(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function initializeStorage(): Promise<void> {
  const currentRaw = await AsyncStorage.getItem(DAILY_HELP_LOCAL_KEY);

  if (currentRaw !== null) {
    let normalized: DailyHelpTemplate[] = [];
    try {
      normalized = normalizeListFromUnknown(JSON.parse(currentRaw));
    } catch {
      normalized = [];
    }
    await writeTemplates(normalized);
    return;
  }

  const legacyRaw = await AsyncStorage.getItem(DAILY_HELP_LEGACY_KEY);
  if (!legacyRaw) {
    await writeTemplates([]);
    return;
  }

  try {
    const parsed = JSON.parse(legacyRaw);
    const migrated = normalizeListFromUnknown(parsed);
    await writeTemplates(migrated);
  } catch {
    await writeTemplates([]);
  }
}

async function ensureInitialized(): Promise<void> {
  if (initialized) return;

  if (!initPromise) {
    initPromise = initializeStorage().finally(() => {
      initialized = true;
      initPromise = null;
    });
  }

  await initPromise;
}

function normalizeInput(input: DailyHelpTemplateInput): Omit<DailyHelpTemplate, "id"> {
  const name = String(input.name ?? "").trim();
  const phone = digitsOnly(String(input.phone ?? ""));
  const type = normalizeVisitType(input.type);
  const wing = normalizeWing(input.wing);

  if (!name) {
    throw new Error("DAILY_HELP_NAME_REQUIRED");
  }
  if (phone.length < 8) {
    throw new Error("DAILY_HELP_PHONE_INVALID");
  }
  if (!type) {
    throw new Error("DAILY_HELP_TYPE_INVALID");
  }
  if (!wing) {
    throw new Error("DAILY_HELP_WING_INVALID");
  }

  const flatRaw = normalizeFlatNumber(input.flatNumber);
  const flatNumber = wing === "ROSEDALE" ? "000" : flatRaw;
  if (wing !== "ROSEDALE" && !flatNumber) {
    throw new Error("DAILY_HELP_FLAT_REQUIRED");
  }

  return {
    name,
    phone,
    type,
    vehicle: normalizeVehicleType(input.vehicle),
    wing,
    flatNumber,
    photoUrl: normalizePhotoUrl(input.photoUrl),
    displayOrder: parseDisplayOrder(input.displayOrder, Number.MAX_SAFE_INTEGER),
  };
}

function assertNoDuplicatePhone(
  templates: DailyHelpTemplate[],
  phone: string,
  excludingId?: string,
): void {
  const conflict = templates.find(
    (item) => item.phone === phone && item.id !== excludingId,
  );
  if (conflict) {
    throw new Error(DAILY_HELP_DUPLICATE_PHONE_ERROR);
  }
}

export async function loadDailyHelpTemplates(): Promise<DailyHelpTemplate[]> {
  await ensureInitialized();
  const templates = await readTemplates();
  return normalizeAndDedupe(templates);
}

export async function createDailyHelpTemplate(
  input: DailyHelpTemplateInput,
): Promise<DailyHelpTemplate> {
  await ensureInitialized();
  const templates = await readTemplates();
  const normalized = normalizeInput(input);
  const createdId = createDailyHelpId();

  assertNoDuplicatePhone(templates, normalized.phone);

  const next = normalizeAndDedupe([
    ...templates,
    {
      id: createdId,
      ...normalized,
      displayOrder:
        normalized.displayOrder === Number.MAX_SAFE_INTEGER
          ? templates.length + 1
          : normalized.displayOrder,
    },
  ]);

  await writeTemplates(next);
  const created = next.find((item) => item.id === createdId);
  if (!created) {
    throw new Error(DAILY_HELP_NOT_FOUND_ERROR);
  }
  return created;
}

export async function updateDailyHelpTemplate(
  id: string,
  patch: DailyHelpTemplatePatch,
): Promise<DailyHelpTemplate> {
  await ensureInitialized();
  const templates = await readTemplates();
  const existing = templates.find((item) => item.id === id);

  if (!existing) {
    throw new Error(DAILY_HELP_NOT_FOUND_ERROR);
  }

  const merged: DailyHelpTemplateInput = {
    name: patch.name ?? existing.name,
    phone: patch.phone ?? existing.phone,
    type: patch.type ?? existing.type,
    vehicle: patch.vehicle ?? existing.vehicle,
    wing: patch.wing ?? existing.wing,
    flatNumber: patch.flatNumber ?? existing.flatNumber,
    photoUrl: patch.photoUrl ?? existing.photoUrl,
    displayOrder: patch.displayOrder ?? existing.displayOrder,
  };

  const normalized = normalizeInput(merged);
  assertNoDuplicatePhone(templates, normalized.phone, existing.id);

  const next = normalizeAndDedupe(
    templates.map((item) =>
      item.id === id
        ? {
            ...item,
            ...normalized,
            displayOrder:
              normalized.displayOrder === Number.MAX_SAFE_INTEGER
                ? item.displayOrder
                : normalized.displayOrder,
          }
        : item,
    ),
  );

  await writeTemplates(next);
  const updated = next.find((item) => item.id === id);
  if (!updated) {
    throw new Error(DAILY_HELP_NOT_FOUND_ERROR);
  }

  return updated;
}

export async function deleteDailyHelpTemplate(id: string): Promise<void> {
  await ensureInitialized();
  const templates = await readTemplates();
  const next = normalizeAndDedupe(templates.filter((item) => item.id !== id));
  await writeTemplates(next);
}

export async function reorderDailyHelpTemplates(
  idsInOrder: string[],
): Promise<DailyHelpTemplate[]> {
  await ensureInitialized();
  const templates = await readTemplates();
  const byId = new Map(templates.map((item) => [item.id, item]));

  const ordered: DailyHelpTemplate[] = [];
  for (const id of idsInOrder) {
    const item = byId.get(id);
    if (!item) continue;
    ordered.push(item);
    byId.delete(id);
  }

  for (const item of templates) {
    if (byId.has(item.id)) {
      ordered.push(item);
      byId.delete(item.id);
    }
  }

  const next = normalizeAndDedupe(ordered);
  await writeTemplates(next);
  return next;
}

export function dailyHelpInputFromProfile(
  profile: VisitorProfile,
): DailyHelpTemplateInput | null {
  if (!profile || !profile.name || !profile.phone) return null;

  const parsedLegacy = parseLegacyFlat(profile.flat);
  const wing = profile.wing ?? parsedLegacy.wing;
  const flatNumber = profile.flatNumber ?? parsedLegacy.flatNumber;
  if (!wing) return null;

  return {
    name: profile.name,
    phone: profile.phone,
    type: profile.type,
    vehicle: profile.vehicle,
    wing,
    flatNumber: wing === "ROSEDALE" ? "000" : flatNumber ?? "",
    photoUrl: normalizePhotoUrl(profile.photoUri),
  };
}

export async function addDailyHelpFromVisitorProfile(
  profileId: string,
): Promise<DailyHelpTemplate> {
  const profiles = await loadVisitorProfiles();
  const profile = profiles.find((item) => item.id === profileId);
  if (!profile) {
    throw new Error("DAILY_HELP_PROFILE_NOT_FOUND");
  }

  const input = dailyHelpInputFromProfile(profile);
  if (!input) {
    throw new Error("DAILY_HELP_PROFILE_INVALID");
  }

  return createDailyHelpTemplate(input);
}
