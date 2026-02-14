// src/constants/sheets.ts
export const SHEETS_SYNC_URL =
  "https://script.google.com/macros/s/AKfycbzsAGFhYh8pp3D4m2sca3veWPclSNlLfS_sr2VRZxJaFNqCUBysaH9t2l3_BoiQyMFTYQ/exec";

// Optional. Set in app env as EXPO_PUBLIC_SHEETS_SYNC_TOKEN
export const SHEETS_SYNC_TOKEN = process.env.EXPO_PUBLIC_SHEETS_SYNC_TOKEN;

export const SHEETS_SYNC_CONFIG = {
  url: SHEETS_SYNC_URL,
  token: SHEETS_SYNC_TOKEN || undefined,
  timeoutMs: 12000, // optional but good practice
};
