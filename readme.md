# Guard Patrol App

React Native (Expo) app for a shared guard device in a housing society.

Primary use cases:

- start/end guard shifts,
- run QR-based patrol rounds,
- record visitor entries,
- manage Daily Help shortcuts inside the app,
- sync patrol and visitor logs to Google Sheets.

## Tech Stack

- React Native + Expo
- TypeScript
- React Navigation (stack + bottom tabs)
- React Context (`SessionContext`, `SettingsContext`)
- AsyncStorage (offline-first data)
- `expo-camera` (QR scan)
- `expo-image-picker` (camera/gallery photos)
- `expo-file-system` + `expo-sharing` (CSV export)
- Google Apps Script + Google Sheets (remote sync)

## Current Features

### 1. Shift Management

- Only one active shift at a time (`DAY` or `NIGHT`).
- Current and last shift are persisted locally.
- Guards can be added/edited/deleted (Admin flow).

### 2. Patrol

- Patrol requires an active `NIGHT` shift.
- 6 fixed patrol points; each point can be scanned once per patrol record.
- Patrol records are stored locally with idempotent `recordId`.
- Manual sync available from Patrol screen.
- Auto sync slot for patrol is controlled by `src/sync/autoSync.ts` (currently 05:30 and 23:30 local slots).
- Patrol time window gating is controlled in `src/screens/PatrolScreen.tsx` (operational/testing configurable in code).

### 3. Visitors

- Add visitor with:
  - type, name, phone,
  - wing + flat,
  - vehicle,
  - optional photo.
- Visit type supports predefined values plus `Other` custom text.
- Frequent visitors list (Top 10) for quick re-entry.
- Image fallback to initials when photo is missing/broken.
- `ROSEDALE` wing is society-wide and forces flat number to `"000"`.

### 4. Daily Help (In-App Managed)

- Daily Help is now app-owned local data (not sheet-managed).
- CRUD available in `Manage Daily Help` screen:
  - add manually,
  - add from previous visitor profiles,
  - edit,
  - delete,
  - reorder with up/down controls.
- Duplicate phone numbers are blocked.
- Supports custom visit types (via `Other` flow).
- Data is per-device (not cross-device shared).
- Legacy key migration from old sheet cache is handled automatically:
  - old key: `daily_help_templates_v1`
  - active key: `daily_help_local_v2`

### 5. Sync

- Offline-first: all records are written locally first.
- Remote sync currently covers:
  - patrol records,
  - visitor entries.
- Daily Help is not part of remote sync.
- Auto sync schedule (`src/sync/autoSync.ts`):
  - visitors: every hour slot (`HH:00`),
  - patrol: daily slot sync (05:30, 23:30).
- Sync uses retries, timeout, and idempotency (`recordId`).
- Synced local records are periodically cleaned up.

### 6. Export

- Settings provides **Export Readable Data (CSV)**.
- Export generates and shares a real `.csv` file containing:
  - meta,
  - shifts,
  - guards,
  - daily help,
  - visitor profiles,
  - visitor entries,
  - patrol records.
- JSON backup export logic exists in code but is hidden from UI.

### 7. Language Support

- English (`en`)
- Gujarati (`gu`)
- Hindi (`hi`)

## Google Sheets Contract (Current App Usage)

### `PatrolLogs`

`recordId, dateKey, hourWindow, society, guardId, guardName, status, completedCount, pointsScanned, createdAt, finalizedAt`

### `Visitors`

`recordId, society, guardId, guardName, createdAt, visitorId, name, phone, type, vehicle, wing, flatNumber, event`

Notes:

- App currently pushes patrol + visitor records to Apps Script.
- Existing Daily Help Apps Script endpoint may still exist but is not used by the app flow.

## Token/Auth Setup

### App

- Sync config: `src/constants/sheets.ts`
- Token env var: `EXPO_PUBLIC_SHEETS_SYNC_TOKEN`

### Apps Script (`apps-script/Code.gs`)

- Token read from Script Property `SYNC_TOKEN`
- If empty: sync is open
- If set: token accepted via query/body/header

## Run and Build

### Local run

- `npm run start`
- `npm run android`
- `npm run ios`

### Local debug APK

- `cd android && ./gradlew app:assembleDebug`
- Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### EAS builds

- Internal APK: `npx eas build -p android --profile apk`
- Internal preview build: `npx eas build -p android --profile preview`
- Production AAB: `npx eas build -p android --profile production`

## Project Structure

- `src/screens` UI screens
- `src/components` reusable components
- `src/context` app state providers
- `src/storage` AsyncStorage models and persistence
- `src/sync` sync clients + auto-sync scheduler
- `src/navigation` stack/tab navigation
- `src/constants` app config
- `src/i18n` localized strings
- `apps-script/Code.gs` Apps Script endpoint

## Pre-Launch Checklist

See `/Users/maruti/Documents/Projects/guard-patrol-app/Checklist.md`.
