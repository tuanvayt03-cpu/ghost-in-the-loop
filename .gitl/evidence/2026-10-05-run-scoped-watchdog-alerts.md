# Ghost v0.15.20 — run-scoped watchdog alert fix — 2026-10-05

## Baseline
- Repository: `tuanvayt03-cpu/ghost-in-the-loop`
- Baseline main: `440342b4912fcc4ef2fe56f971236b4db090a5c8`
- Repair branch: `fix/watchdog-run-scoped-alerts-20261005`
- Promoted code head: `18fe656d6e4b102c07ec665b4971e83ed807c035`
- Loader: `9.0.0-alpha.2+ghostplus.15.20`
- Runtime: `0.15.20`
- Immutable 14-module payload pin: `67d6c3a0981c74ec1d8c4eb1eeab9eb4583986a3`

## Live symptom
The supplied Telegram screenshot showed multiple simultaneous:
`Ghost+ — STALL WARNING`
messages from several different ChatGPT conversations even though Ghost had not been started in those tabs.

## Root cause
The Smart Watchdog sampled ChatGPT BUSY state before checking the Ghost core RUNNING state.

The old ordering was effectively:
1. capture/update ChatGPT activity;
2. if ChatGPT BUSY for 10 minutes without progress, emit STALL_WARNING;
3. only later check `!ghostRunning()`.

Therefore any open ChatGPT tab that looked BUSY long enough could emit STALL_WARNING even when the operator never pressed Ghost Play. Multiple open tabs produced the burst of Telegram messages visible in the screenshot.

The previous rate limiter also allowed the same continuous stall to warn again after another 10-minute period.

## v0.15.20 behavior

### Watchdog
- STALL_WARNING is legal only when the exact tab's Ghost core is currently `RUNNING`.
- Entering RUNNING creates a fresh run id and resets the stall clock, so BUSY time accumulated before Play cannot trigger an immediate alert.
- A continuous stall episode emits at most one warning.
- Meaningful user/assistant/tool/status progress re-arms one future stall warning.
- Leaving RUNNING clears the run id and stall-notification state.
- Structured STALL_WARNING events carry:
  - `runScoped: true`
  - `runId`
  - `ghostRunning: true`
  - `staleMs`

### Alert Router
- Unscoped STALL_WARNING desktop events are discarded.
- COMPLETE local popup dedupe is extended to six hours on the current page/session runtime, so repeated duplicate COMPLETE emits do not create popup spam.

### Telegram
Defense in depth is independent of Watchdog:
- STALL_WARNING is rejected unless the live structured event proves `runScoped=true`, has a `runId`, and states `ghostRunning=true`.
- Persisted Telegram outbox records retain only safe run metadata.
- Legacy queued STALL_WARNING events without run metadata are deleted on the next outbox prune.
- Even a valid queued stall warning is deleted if Ghost is no longer currently RUNNING before delivery.
- COMPLETE remains Telegram opt-in via the existing `complete` checkbox; local COMPLETE popup remains default behavior.
- HUMAN / RELAY / CONTEXT / AUTH / RECOVERY alerts are unchanged.

## Fresh verification after final code change
Fresh Windows clone at `18fe656d6e4b102c07ec665b4971e83ed807c035`:

- targeted ChatGPT DOM/stream suite: **18/18 PASS**
- `npm run test:ghostplus-runtime`: **PASS**
  - lifecycle VM
  - lifecycle static audit
  - scroll diagnostic static audit
- static audit specifically verifies:
  - Ghost RUNNING captured before stall decisions;
  - STALL_WARNING nested under RUNNING;
  - fresh run resets stale age;
  - one-shot stall episode state;
  - positive run metadata on the structured alert;
  - Telegram live-event RUNNING evidence;
  - legacy/stale queued stall purge;
  - current RUNNING check before outbox delivery;
  - Alert Router rejection of unscoped stall popup;
  - COMPLETE popup long dedupe.
- `npm run lint`: **PASS**
- `git diff 440342b4..18fe656d --check`: **PASS**
- verification working tree: clean

## Inherited repository debt
`npm run check:committed` fails on both:
- baseline `440342b4`
- candidate `18fe656d`

with the same inherited message:
`Committed extension/content.js does not match the committed userscript.`

No Firefox artifact regeneration was included because that unrelated legacy lineage mismatch predates this fix.

## Rollout
1. Update the Tampermonkey userscript.
2. Reload open ChatGPT tabs.
3. Confirm panel shows `v0.15.20`.
4. Tabs where Ghost was never started may still visually detect ChatGPT BUSY, but must not send STALL_WARNING locally or to Telegram.
5. A tab where Ghost is RUNNING may send one stall warning after the configured 10-minute no-progress threshold; the same continuous stall cannot repeat until meaningful progress occurs.
6. Old queued stall messages from previous versions are pruned on startup/drain instead of replayed.
