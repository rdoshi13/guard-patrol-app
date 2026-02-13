// src/constants/sheets.ts
export const SHEETS_SYNC_URL =
  "https://script.google.com/macros/s/AKfycbzULhi3g6VZ1TfBIa2MFvtvykm3iORXGRpF4Jh4b-foqBZYS2Lq1l74Qxdg88dKssSIIw/exec";

// Optional. Set in app env as EXPO_PUBLIC_SHEETS_SYNC_TOKEN
// Temporary fallback keeps legacy flow working even if env is not loaded.
export const SHEETS_SYNC_TOKEN =
  process.env.EXPO_PUBLIC_SHEETS_SYNC_TOKEN || "ROSEDALE_GUARD_SYNC_2025";

export const SHEETS_SYNC_CONFIG = {
  url: SHEETS_SYNC_URL,
  token: SHEETS_SYNC_TOKEN || undefined,
  timeoutMs: 12000, // optional but good practice
};
