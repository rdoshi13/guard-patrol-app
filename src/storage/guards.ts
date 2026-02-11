// src/storage/guards.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Guard = {
  id: string;
  name: string;
  phone: string;
  photoUri?: string; // optional for now
};

const GUARDS_KEY = "guards";

// default guards for your society – you can change these later
const DEFAULT_GUARDS: Guard[] = [
  { id: "g_ramesh", name: "Ramesh", phone: "9000000001" },
  { id: "g_suresh", name: "Suresh", phone: "9000000002" },
  { id: "g_mahesh", name: "Mahesh", phone: "9000000003" },
];

// helper to ensure a raw object matches our Guard shape
function normalizeGuard(raw: any): Guard | null {
  if (!raw || typeof raw !== "object") return null;

  const id = String(raw.id ?? "");
  const name = String(raw.name ?? "").trim();

  if (!id || !name) return null;

  const phoneRaw = raw.phone ?? "";
  const phone = String(phoneRaw || "").trim() || "0000000000";

  const photoUri =
    raw.photoUri && typeof raw.photoUri === "string" ? raw.photoUri : undefined;

  return { id, name, phone, photoUri };
}

export async function loadGuards(): Promise<Guard[]> {
  try {
    const stored = await AsyncStorage.getItem(GUARDS_KEY);
    if (!stored) {
      await AsyncStorage.setItem(GUARDS_KEY, JSON.stringify(DEFAULT_GUARDS));
      return DEFAULT_GUARDS;
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      await AsyncStorage.setItem(GUARDS_KEY, JSON.stringify(DEFAULT_GUARDS));
      return DEFAULT_GUARDS;
    }

    // migrate any older objects that only had id/name
    const normalized: Guard[] = [];
    for (const item of parsed) {
      const g = normalizeGuard(item);
      if (g) normalized.push(g);
    }

    if (normalized.length === 0) {
      await AsyncStorage.setItem(GUARDS_KEY, JSON.stringify(DEFAULT_GUARDS));
      return DEFAULT_GUARDS;
    }

    // write back the normalized version so future loads are clean
    await AsyncStorage.setItem(GUARDS_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return DEFAULT_GUARDS;
  }
}

export async function saveGuards(guards: Guard[]): Promise<void> {
  try {
    await AsyncStorage.setItem(GUARDS_KEY, JSON.stringify(guards));
  } catch {
    // ignore for now
  }
}

export function createGuard(
  name: string,
  phone: string,
  photoUri?: string
): Guard {
  const id = `g_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  return { id, name, phone, photoUri };
}
