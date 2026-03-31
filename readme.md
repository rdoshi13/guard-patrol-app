# Guard Patrol App

Guard Patrol App is a React Native (Expo) mobile app for housing-society security operations on a shared guard device.

It helps teams run daily workflows in one place:
- start and end guard shifts,
- perform night patrol rounds using QR checkpoints,
- add and track visitor entries,
- manage Daily Help shortcuts inside the app,
- sync patrol and visitor records to Google Sheets,
- export readable CSV backups from the device.

## Screenshots

Add screenshots to `docs/screenshots/` and replace these placeholders.

### Home
- `docs/screenshots/home.png`

### Guard Shift
- `docs/screenshots/guard-shift.png`

### Patrol
- `docs/screenshots/patrol.png`

### Visitors
- `docs/screenshots/visitors.png`

### Add Visitor
- `docs/screenshots/add-visitor.png`

### Manage Daily Help
- `docs/screenshots/manage-daily-help.png`

### Settings
- `docs/screenshots/settings.png`

## Core Workflow

1. Guard starts a shift (`DAY` or `NIGHT`).
2. During `NIGHT` shift, guard scans patrol QR points.
3. Guard logs visitors (with optional photo and flat details).
4. Frequent visitors and Daily Help shortcuts speed up repeat entry.
5. App stores everything locally first, then syncs to Google Sheets when due or when user taps sync.

## Features

- Shift management with current and previous shift persistence.
- Night patrol model with 6 checkpoints and hourly patrol records.
- Visitor management with predefined + custom visit types (`Other`).
- Multi-flat visitor support (including society-wide `ROSEDALE`).
- In-app Daily Help management:
  - add manually,
  - add from previous visitors,
  - edit/delete entries,
  - reorder with up/down controls.
- Image fallback to initials when photo URI is missing or invalid.
- Language support:
  - English (`en`)
  - Gujarati (`gu`)
  - Hindi (`hi`)
- CSV export from Settings for readable operational backups.

## Architecture Snapshot

- Frontend: Expo + React Native + TypeScript.
- Navigation: Native stack + bottom tabs.
- Local storage: AsyncStorage (offline-first).
- Sync backend: Google Apps Script Web App.
- Remote data sink: Google Sheets.

## Google Sheets Contract

### `PatrolLogs`
`recordId, dateKey, hourWindow, society, guardId, guardName, status, completedCount, pointsScanned, createdAt, finalizedAt`

### `Visitors`
`recordId, society, guardId, guardName, createdAt, visitorId, name, phone, type, vehicle, wing, flatNumber, event, flats`

Notes:
- App sync currently pushes patrol + visitor records.
- Daily Help is app-managed local data and is not part of active app sync flow.

## Local Setup

### Prerequisites

- Node.js 18+ (recommended LTS)
- npm
- Expo CLI via `npx expo`
- Android Studio (for Android builds/emulator)
- Xcode (for iOS builds on macOS)

### 1) Install dependencies

```bash
npm install
```

### 2) Environment configuration

Create `.env` in project root:

```env
EXPO_PUBLIC_SHEETS_SYNC_TOKEN=your_sync_token_here
```

If backend token auth is disabled, this can be left empty.

### 3) Run locally

```bash
npm run start
```

Then:
- press `a` for Android emulator/device,
- press `i` for iOS simulator (macOS),
- or scan QR in Expo Go.

### 4) Native run commands

```bash
npm run android
npm run ios
```

## Apps Script + Sheets Setup

`apps-script/Code.gs` is the reference backend script.

1. Create/open a Google Sheet.
2. Open Apps Script and paste `apps-script/Code.gs`.
3. Deploy as Web App.
4. Set script property `SYNC_TOKEN` (optional but recommended).
5. Ensure sheet tabs/headers are present (script auto-creates when empty):
   - `PatrolLogs`
   - `Visitors`
   - `DailyHelp` (legacy endpoint support)
6. Update app sync URL in:
   - `src/constants/sheets.ts`

App token source:
- `EXPO_PUBLIC_SHEETS_SYNC_TOKEN` (client env)

Backend token source:
- `SYNC_TOKEN` (Apps Script property)

## Sync Behavior

- Offline-first writes: records save locally first.
- Auto-sync trigger points:
  - on app open,
  - on app resume,
  - periodic foreground checks.
- Current schedule (`src/sync/autoSync.ts`):
  - visitors: hourly slot (`HH:00`)
  - patrol: `05:30` and `23:30` local time
- Manual sync buttons are available in Patrol and Visitors screens.

## Build and Distribution

### EAS builds

- Internal APK:
```bash
npx eas build -p android --profile apk
```

- Internal preview build:
```bash
npx eas build -p android --profile preview
```

- Production AAB:
```bash
npx eas build -p android --profile production
```

### Local debug APK

```bash
cd android
./gradlew app:assembleDebug
```

Output:
- `android/app/build/outputs/apk/debug/app-debug.apk`

## Project Structure

- `src/screens` UI screens
- `src/components` reusable UI components
- `src/context` session/settings providers
- `src/storage` AsyncStorage data models and persistence
- `src/sync` sync client + auto-sync scheduler
- `src/navigation` stack/tab navigation
- `src/constants` config
- `src/i18n` localization strings
- `apps-script/Code.gs` Apps Script endpoint
- `Checklist.md` rollout checklist
