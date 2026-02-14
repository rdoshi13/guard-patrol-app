# Pre-Launch Checklist

## 1. Release build sanity
- [ ] Use release APK/AAB from EAS (not debug build).
- [ ] Confirm final package ID and signing key strategy (same key for updates).
- [ ] Keep dev/testing app separate with a different package ID if needed.

## 2. Core user flows (must pass)
- [ ] Guard shift start and end.
- [ ] Patrol scanning across all 6 points including offline then sync.
- [ ] Add Visitor for normal flow and Daily Help prefill flow.
- [ ] `ROSEDALE` wing stores `flatNumber="000"`.
- [ ] Frequent Visitors and Daily Help cards render correctly on Android and iOS.

## 3. Sync and data validation
- [ ] Visitor sync shows correct pending/no-pending states.
- [ ] Daily Help sync shows no-updates state when sheet equals local data.
- [ ] 12-hour auto-sync runs after app resume/relaunch.
- [ ] Invalid token/network error is surfaced without local data loss.

## 4. Photo behavior
- [ ] Visitor photo capture works on target devices.
- [ ] If no photo exists, initials/avatar fallback always appears.
- [ ] Older visitor records with missing photos still render correctly.

## 5. Permissions and device checks
- [ ] Camera permission allow/deny flows are verified.
- [ ] App tested on at least 2 Android OS versions and 1 iPhone.
- [ ] Small-screen Android layout has no clipping/hidden text issues.

## 6. Operational readiness
- [ ] Google Sheet tabs and headers are correct (`PatrolLogs`, `Visitors`, `DailyHelp`).
- [ ] Admin understands how to maintain `DailyHelp` (`active`, `displayOrder`, etc.).
- [ ] Sync failure/network downtime playbook is documented for guards/admin.

## 7. Pre-rollout hygiene
- [ ] App name, icon, splash, and permissions are final.
- [ ] Debug-only logs/toasts are removed or minimized.
- [ ] Release is tagged in git and version is frozen.
- [ ] Final smoke test is done on a clean install before distribution.
