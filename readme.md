# Rosedale Guard Patrol App

React Native (Expo) app for a single shared society device used by guards to:
- manage guard shifts,
- run QR patrol rounds,
- log visitor check-ins,
- use Daily Help quick-add templates,
- sync data with Google Sheets.

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
- Add visitors with name, phone, type, vehicle, wing, and flat.
- Visitor entries sync with idempotent `recordId`.
- Frequent visitors list supports quick repeat entry.
- Visitor and suggestion avatars use image when available and initials fallback when image is missing/broken.
- Wing supports `A`, `B`, `C`, `D`, and `ROSEDALE`.
- For `ROSEDALE`, flat is fixed and stored as `"000"` (society-wide entry).
- Legacy combined `flat` values are lazily migrated on read.

### Daily Help templates (Sheet-managed)
- Source of truth is Google Sheet tab `DailyHelp`.
- App pulls templates from Apps Script `doGet` (`kind=daily_help_templates_v1`).
- Templates are normalized, deduped by phone, sorted by `displayOrder`, and capped to top 10.
- Manual Daily Help pull is available in Settings (`Sync Daily Help Now`) and Visitors (`Sync` button).
- Visitors `Sync` does two actions: push visitor records and pull Daily Help templates.
- If pulled templates are unchanged vs local cache, sync result returns no updates.

### Sync behavior
- Offline-first: writes are saved locally first.
- Auto-sync runs on app open/resume when last successful sync is older than 12 hours.
- Patrol, visitors, and Daily Help have separate last-sync timers.
- Sync includes retry, timeout, and dedupe by `recordId`.
- Synced patrol/visitor records older than 7 days are cleaned up locally.

## Google Sheets Contract

### `PatrolLogs`
`recordId, dateKey, hourWindow, society, guardId, guardName, status, completedCount, pointsScanned, createdAt, finalizedAt`

### `Visitors`
`recordId, society, guardId, guardName, createdAt, visitorId, name, phone, type, vehicle, wing, flatNumber, event`

### `DailyHelp`
`active, displayOrder, name, phone, type, vehicle, wing, flatNumber, photoUrl`

Daily Help parsing rules in app:
- `active` accepts truthy values like `TRUE`, `1`, `yes`.
- `wing=ROSEDALE` forces `flatNumber="000"` regardless of sheet value.
- Invalid rows are skipped.
- Duplicate phone rows are deduped by lowest `displayOrder`, then row order.
- Final rendered list is capped to 10 items.

## Token/Auth Setup

### App
- Sync URL/token config is in `src/constants/sheets.ts`.
- Token is read from env var `EXPO_PUBLIC_SHEETS_SYNC_TOKEN`.

### Apps Script
- Token is read from Script Property `SYNC_TOKEN` in `apps-script/Code.gs`.
- If `SYNC_TOKEN` is empty/missing, endpoint accepts requests without token.
- If set, token can be provided by query (`?token=`), request body (`token`), or `X-Token` header.

## Run and Build

### Run locally
- `npm run start`
- `npm run android`
- `npm run ios`

### Local debug APK
- Build command: `cd android && ./gradlew app:assembleDebug`
- APK path: `android/app/build/outputs/apk/debug/app-debug.apk`

### EAS APK (shareable build)
- `npx eas login`
- `npx eas build -p android --profile apk`

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

## Pre-Launch Checklist

See `/Users/maruti/Documents/Projects/guard-patrol-app/Checklist.md`.
