# AGENTS.md

Repository-specific guidance for coding agents working on `guard-patrol-app`.

## Scope and Priority
- These rules apply to this repository.
- If a rule conflicts with `~/.codex/AGENTS.md`, this file wins for this repo.
- Keep changes minimal and focused on the user request.

## Project Context
- Stack: Expo + React Native + TypeScript.
- Navigation: React Navigation (stack + bottom tabs).
- State: React Context (`SessionContext`, `SettingsContext`).
- Persistence: AsyncStorage under `src/storage/*`.
- Sync: Google Apps Script via `src/sync/sheets.ts` and `src/sync/autoSync.ts`.

## Core Behavior Guardrails
- Maintain backward compatibility for persisted data in AsyncStorage.
- Preserve `ROSEDALE` handling semantics (society-wide behavior).
- Daily Help is app-managed local data (`daily_help_local_v2`), not sheet-managed.
- Visitor/Patrol sync is idempotent via `recordId`; do not break this.
- Avoid changing Apps Script contract unless explicitly requested.

## Implementation Workflow
1. Read relevant files before editing.
2. State a short approach before substantial edits.
3. Make the smallest complete change.
4. Update related types + call sites together.
5. Run the narrowest useful validation command.
6. Summarize changes, assumptions, and risks.

## Commands
- Install deps: `npm install`
- Start Expo: `npm run start`
- Run Android: `npm run android`
- Run iOS: `npm run ios`
- Type check: `npx tsc --noEmit`
- EAS Android APK (internal): `npx eas build -p android --profile apk`

## File and Code Conventions
- Keep TypeScript types explicit in storage/domain layers.
- When adding fields to stored models, update:
  - type definitions,
  - normalization/migration paths,
  - serialization/sync mapping,
  - screen prefill/edit flows.
- Prefer existing UI patterns/components (`AppButton`, pill selectors, chip rows).
- Keep i18n keys centralized in `src/i18n/strings.ts` and update all supported languages.

## Validation Expectations
- At minimum, run `npx tsc --noEmit` after behavior/type changes.
- If checks cannot run, state why and what remains unverified.

## Non-Goals (Unless Asked)
- No broad refactors.
- No dependency additions unless required for requested behavior.
- No changes to unrelated screens or flows.
