// src/context/SessionContext.tsx
import React, { createContext, useContext, useState } from "react";

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

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<ShiftSession | null>(null);
  const [lastSession, setLastSession] = useState<ShiftSession | null>(null);

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
