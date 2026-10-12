# Ghost+ 0.15.30 — QA & Firefox non-destructive build checkpoint

Date: 2026-10-12

## Scope and baseline
- Repo: tuanvayt03-cpu/ghost-in-the-loop
- Baseline main before patch: 7438093f73d8b99a1bc663f8becf4d54c9400789
- Branch: fix/ghost-firefox-build-guard-20261012
- Workspace: _ghost-recovery-safe-20261009
- Chrome/Tampermonkey runtime remains Ghost+ 0.15.30; this checkpoint does **not** change loader/pins or submit behavior.
- Single primary writer; do not touch other project trees, draft messages or accounts.

## What was verified
- Chrome Ghost+ targeted baseline: 47/47 Jest DOM PASS, 42/42 Chromium Playwright PASS, runtime lifecycle/static/scroll PASS, lint PASS.
- Full historical Jest audit: 49 failed suites / 3 passed (52 suites), 498 failed tests / 82 passed / 3 todo (583 tests).
- Representative legacy failures: missing Workshop, SelectorMemory, SEND_VETO, GITL_NET symbols; historical build identity package=8.8.5 vs userscript header=9.0.0-alpha.2; old literal selector expectations.
- Firefox artifact parity gate `npm run check:committed` and generated-file gate `npm run check:generated` remain FAIL at baseline; they are not silently skipped.
- Current Firefox extension/content.js still contains original `__GITL_V8__` engine, unlike the new userscript. Blind generation would overwrite extensive legacy functionality without parity verification.

## Safe build hardening
- scripts/build-extension.js now rejects routine overwrite of a mismatched legacy v8 artifact (exit code 2), with a meaningful explanation and migration-only explicit flag.
- `--check-overwrite` provides non-writing preflight.
- 3 targeted Jest safety tests verify the legacy fixture and byte-for-byte artifact preservation on default and preflight invocations.
- No `--migrate-legacy` invocation, no overwriting Firefox artifact, no weakening existing tests.

## Alternatives / architectural decision
- Retain Ghost as primary; do not fork chatgpt-yolo wholesale. YOLO's durable sender lease, exact matching receipt, route identity, and unknown-side-effect contract are the strongest reusable design ideas.
- Evidence: https://github.com/kartikkabadi/chatgpt-yolo/blob/main/docs/RELIABILITY_MODEL.md
- Modern selectors cross-check: https://github.com/miuuyy/codex-chatgpt-web/blob/main/src/chatgpt-session.ts
- See docs/GHOST_AUTOMATION_RESEARCH_2026-10-10.md for source comparison.

## Live acceptance boundary
- Logged-in ChatGPT smoke remains unverified. The desktop Computer tool required separate approval to focus a new Chrome tab; this session did not obtain that approval.
- No live Stop/Send actuation or user-message send was attempted. Isolated Chromium fixtures are not equivalent to the signed-in application UI.
- Do not certify full product until a controlled authenticated acceptance test confirms Play->BUSY/IDLE->terminal->continuation, including uncertain send/recovery and no duplicate sends.
- Avoid attaching to unrelated active user tabs or overwriting a draft.

## Fresh release state
- Final commit SHA, tests and origin/main should be appended to the handoff only after running QA on the last commit.
- Runtime remains 0.15.30 pending an actual Ghost runtime change.
- Known open debt: Firefox functional migration and legacy Jest architecture; no workaround to force PASS.
