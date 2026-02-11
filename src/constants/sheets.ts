// src/constants/sheets.ts
export const SHEETS_SYNC_URL =
  "https://script.google.com/macros/s/AKfycbz2Mr5HiY07s-ER9FbWen5rGu14V0UKaMRPIjMNPWEvVR5HhlEoyjVWVjYsB3KjWrpfWw/exec";

// Optional later (leave empty for now)
export const SHEETS_SYNC_TOKEN = "ROSEDALE_GUARD_SYNC_2025";

export const SHEETS_SYNC_CONFIG = {
  url: SHEETS_SYNC_URL,
  token: SHEETS_SYNC_TOKEN,
  timeoutMs: 12000, // optional but good practice
};
