# ChatGPT composer compatibility hotfix — 2026-09-29

## Baseline
- Repository: `tuanvayt03-cpu/ghost-in-the-loop`
- Baseline main: `85d7a0866ae05ca53fa51923d5a69016ba28726d`
- Repair branch: `fix/chatgpt-composer-contract-20260929`
- Promoted code head: `1f33a31f40efc736a08e76f61673db46d9cd871b`
- Ghost+ release: `9.0.0-alpha.2+ghostplus.15.16`
- Runtime: `0.15.16`
- Immutable 14-module payload pin: `46b177e7c1eac911ccd07ee6322fb01df5479dc7`

## Root cause
ChatGPT composer discovery/staging had drifted across Ghost+ modules. Web Recovery, Watchdog, Operator Gate and Turn Budget still relied on narrow independent selectors and some paths verified the pre-injection element after React reconciliation. A ChatGPT DOM/editor replacement could therefore make a safely staged status probe appear missing and raise a pre-dispatch `HUMAN_REQUIRED`.

## Changes
- Centralized ChatGPT composer discovery and staged-write verification in the owned runtime.
- Added reviewed current composer shapes (exact id/data-testid, role textbox, ProseMirror/data-placeholder fallbacks).
- Rejects Ghost-owned UI, hidden/disabled candidates, obvious sidebar/dialog decoys and ambiguous equal-confidence candidates.
- Staged writes wait through framework reconciliation, reacquire the current composer, and require two matching observations of the complete normalized payload.
- Web Recovery, Watchdog Recovery and Operator Resume require an empty composer before staging, so a user draft cannot be overwritten during the race.
- Core Play and Turn Budget now consume the same resolver.
- Send authority, uncertain-send hard stop and no-blind-resend behavior were not widened.
- Firefox `extension/content.js` was deliberately left at the pre-existing baseline because regenerating it would have promoted an unrelated 8.8→9.0 artifact migration outside this hotfix scope.

## Verification
Fresh verification was run from a clean temporary clone on Windows after the final code changes:
- Targeted composer contract: **4/4 PASS**.
- `npm run test:ghostplus-runtime`: **PASS** (VM lifecycle, static lifecycle, scroll diagnostic).
- `npm run lint`: **PASS**.
- `git diff 85d7a086..1f33a31f --check`: **PASS**.
- Working tree after verification: clean.

The repository's broad Jest suite contains pre-existing stale 8.8 assertions against the current 9.0 source. Baseline `85d7a086` produced 49 failed / 2 passed suites (498 failed tests). The hotfix branch produced 48 failed / 4 passed suites (496 failed tests) with the new targeted suite passing; the inherited failures were not introduced by this change and were not weakened or deleted.

## Live evidence boundary
A read-only unauthenticated ChatGPT browser probe was blocked by the site's interstitial/403, so this checkpoint does not claim authenticated live-DOM certification. The supplied live screenshot established the exact pre-dispatch failure state that motivated this repair.

## Recovery / next step
`main` contains the promoted hotfix. After Tampermonkey refreshes the loader and the page reloads, the panel should report runtime `v0.15.16`. A HUMAN gate already persisted by v0.15.15 remains intentionally fail-closed; resolve that existing gate once rather than auto-clearing uncertain historical state. New composer staging uses the repaired contract.
