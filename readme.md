# Rosedale Guard Patrol App

React Native (Expo) app for a single shared society device used by guards to:
- manage shifts,
- complete QR-based patrols,
- log visitor entries,
- sync reports to Google Sheets.

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
- Shift session and last session persist across app restarts.

### Patrol tracking
- Guard patrol screen requires active `NIGHT` shift.
- 6 fixed QR patrol checkpoints.
- One checkpoint scan per point per hour.
- Hourly rollups stored as `PatrolHourRecord` with status:
  - `IN_PROGRESS`
  - `COMPLETED`
  - `MISSED`
- Patrol records are synced to Sheets with idempotent `recordId`.

Note: patrol time window logic is currently left in testing mode in code (`isWithinPatrolWindow` returns `true`).

### Visitor logging
- Visitor profiles support autofill by name.
- Visitor entries are stored as operational logs.
- Flat data is normalized as:
  - `wing` (`A`/`B`/`C`/`D`)
  - `flatNumber` (digits)
- Legacy `flat` strings are lazily migrated on read.

### Sync behavior
- Offline-first: all writes go to local storage first.
- App-open/resume sync cadence:
  - Patrol and visitor sync runs when last successful sync is older than 12 hours.
- Manual patrol sync is available from Patrol screen.
- Sync uses retries, timeouts, and idempotent record IDs.
- Synced records older than 7 days are cleaned up locally.

## Environment
Set this before build/run:

- `EXPO_PUBLIC_SHEETS_SYNC_TOKEN` (optional but recommended)

If token is unset, app sends requests without token.

Apps Script side:
- Set Script Property `SYNC_TOKEN` to the same value.
- Leave `SYNC_TOKEN` empty only for controlled local testing.

## Project Structure
- `src/screens` UI screens
- `src/components` reusable UI elements
- `src/context` global state
- `src/storage` AsyncStorage data models and persistence
- `src/sync` Sheets sync and auto-sync orchestration
- `src/navigation` stack/tab navigation
- `src/constants` app constants and sync config
- `src/i18n` localized strings (English/Gujarati)

## Google Sheets Integration
Expected Apps Script kinds:
- `patrol_hour_records_v1`
- `visitor_entries_v1`

Reference Apps Script implementation is in:
- `apps-script/Code.gs`

## Security Notes
- Admin PIN is intentionally fixed for the single managed device workflow.
- Treat PIN as operational control, not strong authentication.
- Sheets token should be configured via environment and Script Properties, not hardcoded in source.

## Roadmap
- Re-enable production patrol time window enforcement.
- Add stronger guard authentication if moving beyond single-device model.
- Add resident approval flow for visitors.
- Add multi-device backend sync if deployment scope expands.
