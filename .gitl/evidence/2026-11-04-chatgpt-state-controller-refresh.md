# Ghost ChatGPT State Controller Refresh — 2026-11-04

## Baseline
- Repository: tuanvayt03-cpu/ghost-in-the-loop
- GitHub baseline main: 322286d2fc74e87c4861e65d6a2c683408bce6bf
- Working branch: fix/chatgpt-state-controller-20261104
- Scope: restore current ChatGPT web state detection/orchestration without weakening at-most-once Send safety.
- No main merge, release publication, Firefox legacy migration, or live ChatGPT Send was performed in this checkpoint.

## Root cause
The current Ghost+ host state machine over-weighted reviewed Stop/Send action-control identity. When ChatGPT portalized, renamed, or temporarily removed the composer action control, Ghost could fall to uncertain or stale state even while assistant output was visibly progressing.

A second safety defect was found during the repair: the primary composer fallback could promote an unknown nearby control to Send merely because the composer contained text.

## Changes
1. Expanded bounded ChatGPT composer candidates for current unified-composer/form shapes while retaining candidate scoring and ambiguity rejection.
2. Added turn-progress observation as an independent BUSY witness:
   - assistant text mutation can establish BUSY without a recognizable Stop control;
   - a terminal protocol marker suppresses the settling BUSY window so HALT/PROCEED/HUMAN can be handled promptly;
   - initial historical assistant content is baseline only and is not falsely marked BUSY.
3. Decoupled observation authority from Send authority:
   - stable conversation + empty composer may resolve monitor-idle even when action control identity changed;
   - staged text still requires independently verified Send authority.
4. Hardened Send fallback:
   - composer text alone is never Send authority;
   - unknown overflow/tool controls remain non-actuatable;
   - retained a narrow unlabeled upward-arrow glyph fallback required by the existing ChatGPT contract.
5. Added adversarial E2E cases for:
   - assistant progress without recognizable Stop;
   - stable monitoring with changed action-button contract;
   - unknown action controls never gaining Send authority.

## Fresh verification after final code change
PASS:
- node --check ghost-plus-runtime-manager.js
- npx jest tests/chatgpt-composer-contract.test.js --runInBand
  - 47/47 passed
- npm run test:ghostplus-runtime
  - lifecycle VM PASS
  - lifecycle static PASS
  - scroll diagnostic static PASS
- npm run lint
- Playwright current Ghost+ stack, Chromium:
  - ghostplus-host-control-fault-matrix
  - ghostplus-recovery-reconcile
  - ghostplus-alert-dedupe
  - ghostplus-tab-title
  - 45/45 passed

## Baseline debt discovered, not bypassed
1. npm test is not green on current main because check:generated reports extension/content.js stale.
2. npm run build intentionally refuses to overwrite the legacy v8 Firefox extension unless an explicitly reviewed --migrate-legacy migration is performed. This checkpoint did not bypass that guard.
3. Legacy 8.8 Playwright suites chatgpt-live-regression.spec.js and sendsafety.spec.js boot ghost-in-the-loop.user.js directly without the current Ghost+ runtime manager, so they are stale relative to the current v9/0.15.30 stack and fail before they can serve as current-stack certification.
4. The repository still has version/release drift (userscript v9 alpha, package 8.8.5, older 8.8 release documentation).

## Live verification boundary
CodeLocal Computer Use can now inspect the Chrome window, but the connected Browser security policy blocks authenticated ChatGPT DOM/tab-context access, and the Windows accessibility tree exposes the page as a WebView without usable ChatGPT DOM descendants.

No policy bypass was attempted. No live Play/Send/Stop and no test message was sent to the user's active ChatGPT conversation.

Therefore:
- CODE/FIXTURE STATUS: PASS for the current Ghost+ state-controller scope.
- AUTHENTICATED LIVE E2E: BLOCKED by the observation carrier, not declared PASS.

## Next critical path
1. Migrate the stale 8.8 live-regression/send-safety harness to the current runtime-manager + v9 core boot contract.
2. Decide and execute the guarded Firefox legacy v8 -> current Ghost+ migration as its own reviewed change.
3. Reconcile version authority/release docs.
4. Once an authenticated read-only DOM carrier is available, run a disposable-chat live canary, then only after fresh PASS consider promotion to main.
