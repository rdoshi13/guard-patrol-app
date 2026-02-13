// src/context/SessionContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ShiftType = "DAY" | "NIGHT";

export type ShiftSession = {
  guardId: string;
  guardName: string;
  shift: ShiftType;
  startedAt: string;
  endedAt?: string;
};

type SessionContextValue = {
  session: ShiftSession | null; // current shift
  lastSession: ShiftSession | null; // previous ended shift
  startSession: (session: Omit<ShiftSession, "endedAt">) => void;
  endSession: () => void;
};

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

const SESSION_KEY = "shift_session_v1";
const LAST_SESSION_KEY = "shift_last_session_v1";

function isShiftType(v: unknown): v is ShiftType {
  return v === "DAY" || v === "NIGHT";
}

function parseShiftSession(raw: unknown): ShiftSession | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const guardId = String(obj.guardId ?? "").trim();
  const guardName = String(obj.guardName ?? "").trim();
  const shift = obj.shift;
  const startedAt = String(obj.startedAt ?? "").trim();
  const endedAt =
    typeof obj.endedAt === "string" && obj.endedAt.trim()
      ? obj.endedAt.trim()
      : undefined;

  if (!guardId || !guardName || !isShiftType(shift) || !startedAt) {
    return null;
  }

  return {
    guardId,
    guardName,
    shift,
    startedAt,
    endedAt,
  };
}

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<ShiftSession | null>(null);
  const [lastSession, setLastSession] = useState<ShiftSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [storedSession, storedLastSession] = await Promise.all([
          AsyncStorage.getItem(SESSION_KEY),
          AsyncStorage.getItem(LAST_SESSION_KEY),
        ]);

        if (storedSession) {
          setSession(parseShiftSession(JSON.parse(storedSession)));
        }
        if (storedLastSession) {
          setLastSession(parseShiftSession(JSON.parse(storedLastSession)));
        }
      } catch {
        // ignore hydration errors
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!session) {
      AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
      return;
    }

    AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session)).catch(() => {});
  }, [session, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (!lastSession) {
      AsyncStorage.removeItem(LAST_SESSION_KEY).catch(() => {});
      return;
    }

    AsyncStorage.setItem(LAST_SESSION_KEY, JSON.stringify(lastSession)).catch(
      () => {},
    );
  }, [lastSession, hydrated]);

  // start a new shift (clears endedAt)
  const startSession = (newSession: Omit<ShiftSession, "endedAt">) => {
    setSession({ ...newSession, endedAt: undefined });
  };

  // end current shift, move it to lastSession
  const endSession = () => {
    if (session) {
      const ended: ShiftSession = {
        ...session,
        endedAt: new Date().toISOString(),
      };
      setLastSession(ended);
      setSession(null);
    }
  };

  return (
    <SessionContext.Provider
      value={{ session, lastSession, startSession, endSession }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
};
