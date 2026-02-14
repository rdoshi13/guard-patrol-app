import AsyncStorage from "@react-native-async-storage/async-storage";
import { VisitType, VehicleType, VisitorWing } from "./visitors";

const DAILY_HELP_KEY = "daily_help_templates_v1";
const MAX_DAILY_HELP_ITEMS = 10;

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

type DailyHelpCandidate = {
  name: string;
  phone: string;
  type: VisitType;
  vehicle: VehicleType;
  wing: VisitorWing;
  flatNumber: string;
  photoUrl?: string;
  active: boolean;
  displayOrder: number;
  rowIndex: number;
};

export type DailyHelpTemplate = {
  id: string;
  name: string;
  phone: string;
  type: VisitType;
  vehicle: VehicleType;
  wing: VisitorWing;
  flatNumber: string;
  photoUrl?: string;
  active: boolean;
  displayOrder: number;
};

type DailyHelpComparable = {
  name: string;
  phone: string;
  type: VisitType;
  vehicle: VehicleType;
  wing: VisitorWing;
  flatNumber: string;
  photoUrl?: string;
  displayOrder: number;
};

function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
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

function parseActive(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v !== "string") return false;

  const s = v.trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
}

function parseDisplayOrder(v: unknown, rowIndex: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Number(v.trim());
    if (Number.isFinite(parsed)) return parsed;
  }

  return 100000 + rowIndex;
}

function candidateFromRaw(raw: unknown, rowIndex: number): DailyHelpCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const active = parseActive(obj.active);
  if (!active) return null;

  const name = String(obj.name ?? "").trim();
  if (!name) return null;

  const phone = digitsOnly(String(obj.phone ?? ""));
  if (phone.length < 8) return null;

  const type = normalizeVisitType(obj.type);
  if (!type) return null;

  const wing = normalizeWing(obj.wing);
  if (!wing) return null;

  const flatNumber =
    wing === "ROSEDALE" ? "000" : normalizeFlatNumber(obj.flatNumber);
  if (wing !== "ROSEDALE" && !flatNumber) return null;

  const photoUrl =
    typeof obj.photoUrl === "string" && obj.photoUrl.trim()
      ? obj.photoUrl.trim()
      : undefined;

  return {
    name,
    phone,
    type,
    vehicle: normalizeVehicleType(obj.vehicle),
    wing,
    flatNumber,
    photoUrl,
    active,
    displayOrder: parseDisplayOrder(obj.displayOrder, rowIndex),
    rowIndex,
  };
}

function normalizeAndRankTemplates(rows: unknown[]): {
  templates: DailyHelpTemplate[];
  skipped: number;
} {
  const candidates: DailyHelpCandidate[] = [];
  let skipped = 0;

  rows.forEach((raw, idx) => {
    const c = candidateFromRaw(raw, idx);
    if (!c) {
      skipped += 1;
      return;
    }
    candidates.push(c);
  });

  candidates.sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    return a.rowIndex - b.rowIndex;
  });

  const seenPhones = new Set<string>();
  const deduped: DailyHelpTemplate[] = [];

  for (const c of candidates) {
    if (seenPhones.has(c.phone)) {
      skipped += 1;
      continue;
    }

    seenPhones.add(c.phone);
    deduped.push({
      id: `dh_${c.phone}`,
      name: c.name,
      phone: c.phone,
      type: c.type,
      vehicle: c.vehicle,
      wing: c.wing,
      flatNumber: c.flatNumber,
      photoUrl: c.photoUrl,
      active: c.active,
      displayOrder: c.displayOrder,
    });
  }

  if (deduped.length > MAX_DAILY_HELP_ITEMS) {
    skipped += deduped.length - MAX_DAILY_HELP_ITEMS;
  }

  return {
    templates: deduped.slice(0, MAX_DAILY_HELP_ITEMS),
    skipped,
  };
}

function toComparableTemplate(t: DailyHelpTemplate): DailyHelpComparable {
  return {
    name: t.name,
    phone: t.phone,
    type: t.type,
    vehicle: t.vehicle,
    wing: t.wing,
    flatNumber: t.flatNumber,
    photoUrl: t.photoUrl,
    displayOrder: t.displayOrder,
  };
}

function templatesEqual(
  left: DailyHelpTemplate[],
  right: DailyHelpTemplate[],
): boolean {
  if (left.length !== right.length) return false;

  for (let i = 0; i < left.length; i += 1) {
    const a = toComparableTemplate(left[i]);
    const b = toComparableTemplate(right[i]);

    if (
      a.name !== b.name ||
      a.phone !== b.phone ||
      a.type !== b.type ||
      a.vehicle !== b.vehicle ||
      a.wing !== b.wing ||
      a.flatNumber !== b.flatNumber ||
      a.photoUrl !== b.photoUrl ||
      a.displayOrder !== b.displayOrder
    ) {
      return false;
    }
  }

  return true;
}

function normalizeStoredTemplate(raw: unknown): DailyHelpTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const name = String(obj.name ?? "").trim();
  const phone = digitsOnly(String(obj.phone ?? ""));
  const type = normalizeVisitType(obj.type);
  const wing = normalizeWing(obj.wing);

  if (!name || phone.length < 8 || !type || !wing) return null;

  const flatNumber =
    wing === "ROSEDALE" ? "000" : normalizeFlatNumber(obj.flatNumber);
  if (wing !== "ROSEDALE" && !flatNumber) return null;

  const photoUrl =
    typeof obj.photoUrl === "string" && obj.photoUrl.trim()
      ? obj.photoUrl.trim()
      : undefined;

  const displayOrder = parseDisplayOrder(obj.displayOrder, 0);

  return {
    id:
      typeof obj.id === "string" && obj.id.trim()
        ? obj.id.trim()
        : `dh_${phone}`,
    name,
    phone,
    type,
    vehicle: normalizeVehicleType(obj.vehicle),
    wing,
    flatNumber,
    photoUrl,
    active: true,
    displayOrder,
  };
}

export async function loadDailyHelpTemplates(): Promise<DailyHelpTemplate[]> {
  const raw = await AsyncStorage.getItem(DAILY_HELP_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const templates: DailyHelpTemplate[] = [];
    for (const item of parsed) {
      const normalized = normalizeStoredTemplate(item);
      if (normalized) templates.push(normalized);
    }

    templates.sort((a, b) => a.displayOrder - b.displayOrder);
    return templates.slice(0, MAX_DAILY_HELP_ITEMS);
  } catch {
    return [];
  }
}

export async function saveDailyHelpTemplates(
  templates: DailyHelpTemplate[],
): Promise<void> {
  const next = templates
    .map((t) => normalizeStoredTemplate(t))
    .filter((t): t is DailyHelpTemplate => !!t)
    .slice(0, MAX_DAILY_HELP_ITEMS);
  await AsyncStorage.setItem(DAILY_HELP_KEY, JSON.stringify(next));
}

export async function replaceDailyHelpTemplatesFromSheet(
  rows: unknown[],
): Promise<{ saved: number; skipped: number; unchanged: boolean }> {
  const { templates, skipped } = normalizeAndRankTemplates(rows);
  const existing = await loadDailyHelpTemplates();
  const unchanged = templatesEqual(existing, templates);

  if (!unchanged) {
    await saveDailyHelpTemplates(templates);
  }

  return {
    saved: unchanged ? 0 : templates.length,
    skipped,
    unchanged,
  };
}
