# Ghost+ 15.35 lifecycle/controller repair checkpoint

Date: 2026-11-05
Baseline GitHub main before repair: 63e6b251bcb415f41008c0ba5a4ba2c3475c7650
Working branch: fix/ghost-lifecycle-controller-20261105
Source checkpoint: c1ec9ce36fe07ea027541fa45439b68826e4f0cd
Release loader candidate: 9.0.0-alpha.2+ghostplus.15.35
Runtime: 0.15.35

## Scope and boundaries

Current Ghost+ userscript for ChatGPT web, not Firefox legacy migration or a standalone redesign.
One primary writer, CodeLocal repo checkout ghost-repair-20261104.
No unrelated branches, accounts, secrets or user files changed.
No authenticated live ChatGPT action performed by the test runner.

## Implemented

- Missing terminal marker after bounded reground enters PROTOCOL_WAIT rather than fabricated HUMAN_REQUIRED. Manual user turn can resume monitoring without Send.
- Legacy drift gate supports controlled BUSY adoption. New drift gates capture user baseline and cannot infer an older legacy baseline that does not exist.
- Generic Resume no longer clears persisted gate before Core sends. Clear only after Core's matching receipt event. Failure/timeout retains gate, never blind-resends.
- Turn Budget becomes pure pre-send wire prompt decorator plus post-confirm receipt hook. No HTMLButtonElement.click monkeypatch.
- Core owns single on-wire prompt and writes durable ATTEMPTED/UNKNOWN/CONFIRMED/ABORTED fingerprints, scoped to conversation, before actuation.
- Same-tab reload retains unknown receipt and blocks any second Send until exact user-turn evidence reconciles it.
- Watchdog/Web Recovery refuse new probe while Core has unresolved Send journal; Web Recovery matching uses intent ID, not display round.
- Uncertain Reconcile refuses stale assistant PROCEED marker absent matching journal and newer assistant turn.
- Per-tab/per-chat continuity and turn-budget clocks; assistant count distinguishes identical content in consecutive turns.
- Operator status projects controller gate and host BUSY/IDLE independently; Stop label clarified.
- New-chat / to /c/<id> confirmed journal migration.
- Stop during async staging / Send-readiness cancels before click.

## Fresh final loader verification (after all source changes and 15.35 pin)

PASS:
- git diff --check
- node --check on current source modules
- npm run test:ghostplus-runtime: runtime lifecycle VM/static + scroll diagnostic
- npm run lint
- npx jest tests/chatgpt-composer-contract.test.js --runInBand: 48/48 PASS
- Playwright Chromium current Ghost+ stack (lifecycle-controller, recovery-reconcile, host-control-fault-matrix, alert-dedupe, tab-title): 59/59 PASS

## Release wiring

Loader ghost-plus.user.js pins seven changed modules to source SHA c1ec9ce36fe07ea027541fa45439b68826e4f0cd:
runtime manager, Turn Budget v2, Core, Operator Gate, Uncertain Reconcile,
Watchdog Companion v2 and Web Recovery.
Other unchanged modules retain their previously reviewed immutable pins.
Branch release commit and merged main SHA must be recorded after push/PR promotion.

## Not certified and remaining debt

- Authenticated ChatGPT live canary was not available through the approved observation carrier. No LIVE PASS claim.
- Firefox generated legacy v8 content/build migration and package 8.8.5 mismatch are outside this repair.
- Cross-new-tab recovery of an uncertain first Send originating from '/' without retained session state is not certified. Fail-closed handling in a restored tab is tested.
- Browser-level replay/reload and multiple Chrome profiles need real environment canary before broad rollout.

## Next and safety

Review diff ownership, commit/push release wiring, merge only preserving source checkpoint SHA,
resolve fresh main and verify loader bytes/pins. If real-user live behavior differs from fixtures,
halt automation for that chat and inspect journal before attempting any resend.
