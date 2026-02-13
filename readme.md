# Rosedale Guard Patrol App

React Native (Expo) app for a single shared society device used by guards to:
- manage shifts,
- perform QR patrol rounds,
- log visitor check-ins,
- sync patrol and visitor records to Google Sheets.

## Tech Stack
- React Native + Expo
- TypeScript
- React Navigation (stack + tabs)
- React Context (`SessionContext`, `SettingsContext`)
- AsyncStorage (offline-first persistence)
- `expo-camera` (QR scanning)
- `expo-image-picker` (guard/visitor photos)
- Google Apps Script Web App + Google Sheets

## Core Features
### Shift management
- Single active shift at a time (`DAY` or `NIGHT`).
- Active session and last ended session persist across app restarts.

### Patrol tracking
- Patrol requires an active `NIGHT` shift.
- 6 fixed QR checkpoints; each point can be scanned once per hour.
- Hourly patrol records are stored with `recordId` for idempotent sync.
- Manual sync is available on the Patrol screen.
- Patrol time-window enforcement is currently in test mode (`isWithinPatrolWindow` returns `true`).

### Visitor logging
- Add visitors with name/phone/type/vehicle/wing/flat.
- Frequent visitors list supports quick repeat entry.
- Visitor entries sync with idempotent `recordId`.
- Flat storage is normalized as:
  - `wing` (`A`/`B`/`C`/`D`)
  - `flatNumber` (digits)
- Legacy combined `flat` values are lazily migrated on read.
- Manual sync is available on the Visitors screen.

### Sync behavior
- Offline-first: writes are saved locally first.
- Auto-sync runs on app open/resume when last successful sync is older than 12 hours (separate patrol + visitor timers).
- Sync includes retry, timeout, and dedupe by `recordId`.
- Synced records older than 7 days are cleaned up locally.

## Current Token Setup

### App
- `src/constants/sheets.ts` uses:
  - `EXPO_PUBLIC_SHEETS_SYNC_TOKEN` when provided
  - fallback token: `ROSEDALE_GUARD_SYNC_2025`

### Apps Script
- `apps-script/Code.gs` currently validates against:
  - `CONFIG.TOKEN = "ROSEDALE_GUARD_SYNC_2025"`

For local/dev reliability, both sides must match.

## Google Sheets Schema

### `PatrolLogs`
`recordId, dateKey, hourWindow, society, guardId, guardName, status, completedCount, pointsScanned, createdAt, finalizedAt`

### `Visitors`
`recordId, society, guardId, guardName, createdAt, visitorId, name, phone, type, vehicle, wing, flatNumber, event`

## Project Structure
- `src/screens` UI screens
- `src/components` reusable UI elements
- `src/context` global state providers
- `src/storage` AsyncStorage models + persistence
- `src/sync` Sheets sync + auto-sync orchestration
- `src/navigation` stack/tab navigation
- `src/constants` config values
- `src/i18n` English/Gujarati strings
- `apps-script/Code.gs` Apps Script endpoint

## Roadmap
- Re-enable production patrol time-window enforcement.
- Move token auth to env + Script Properties for non-dev deployments.
- Add stronger guard authentication if moving beyond single shared device.
- Add resident approval flow for visitors.
- Add multi-device backend sync if deployment scope expands.
