# OpenAI September regression audit + Ghost v0.15.19 hardening — 2026-10-02

## Baseline
- Repository: `tuanvayt03-cpu/ghost-in-the-loop`
- Baseline main: `173fb18284c155bdf147c66a01ec6caff8c7d1f2`
- Repair branch: `fix/openai-sept-regression-hardening-20261002`
- Promoted code head: `a2bb180e0c563f61ebf0f4d5b7d0318ffadbe591`
- Ghost+ release: `9.0.0-alpha.2+ghostplus.15.19`
- Runtime: `0.15.19`
- Immutable 14-module payload pin: `6379d7f034f399886224c2029f71a83cbfb51ceb`

## External evidence reviewed

This audit does not claim that one specific undocumented OpenAI UI release is proven to be the single root cause. It does establish that the Ghost failures overlap a documented period of ChatGPT conversation/service instability and independently reported client/backend state divergence.

Official OpenAI status evidence:
- 2026-09-29: elevated errors across ChatGPT, Codex and API; some tasks did not complete. The incident was mitigated/resolved later that day and OpenAI said a detailed RCA would follow.
- 2026-09-30: elevated error rates for ChatGPT Plus/Pro conversations.
- September history contains several additional ChatGPT conversation/Work error incidents.

Open-source/community evidence reviewed:
- Reports of `Resume stream unavailable` after reconnect/stream recovery.
- Reports where UI/client state is stale or times out while backend/plugin/MCP work has already succeeded or continues.
- A ChatGPT Web secure-MCP report where the browser workflow stopped issuing commands while the local tunnel/MCP remained healthy.
- Current automation implementations wait materially longer for Send readiness and treat UI element existence, enabled state, generation state and acceptance as separate phases.

OpenAI public release notes contain multiple September product rollouts, but do not publish a DOM/composer contract changelog that would prove a specific selector rollout caused these failures.

## Audit findings

### A. DOM compatibility
Already addressed in v0.15.16-v0.15.18:
- composer discovery
- conversation-turn discovery
- generation detection
- Send readiness/actuation

Additional v0.15.19 compatibility:
- `data-turn="user|assistant"` is now an additional turn fallback.

### B. Activity-state split brain
v0.15.18 could still classify ChatGPT as idle from Send/Stop controls even when status/tool/progress UI showed ongoing work.

v0.15.19 adds one shared ChatGPT activity-state contract:
- native Stop controls are strong BUSY evidence;
- scoped status/live regions, aria-busy, progress indicators and tool/thinking nodes provide inferred BUSY evidence;
- exact short Thinking leaves in the latest assistant turn are supported;
- ordinary assistant prose is not scanned as BUSY text.

Send readiness and final pre-actuation checks now also refuse to send while this shared activity state is BUSY.

### C. Missing stream fault classes
The prior Web Recovery did not classify:
- `Resume stream unavailable`
- `Message delivery timed out`

v0.15.19 adds these explicit fault classes to the shared runtime and Web Recovery.

### D. Unsafe fault-episode identity
The old recovery key included changing user/assistant text. A persistent/stale error banner plus background assistant progress could therefore look like a fresh fault episode and re-arm recovery.

v0.15.19 keys explicit fault episodes by fault class instead of mutable turn/banner text. Progress is tracked separately and extends quarantine rather than creating a new episode.

### E. Hidden/stale banner risk
The old Connection Interrupted fallback could scan the full page text and therefore potentially see stale hidden text.

v0.15.19 uses the shared visible fault contract and a throttled visible-text TreeWalker fallback for exact unstructured stream banners. Web Recovery no longer performs its own hidden full-body interruption scan.

### F. Stream/backend ambiguity
`Resume stream unavailable`, `Message delivery timed out`, and `Connection interrupted` do not prove that the original request was never accepted. Backend/tool work may still be active after the UI enters a degraded state.

Safety policy in v0.15.19:
- all three are treated as stream-desync faults;
- minimum quarantine: 180 seconds;
- additionally require 90 seconds with no observed turn/tool/activity progress;
- no new status probe while shared activity remains BUSY;
- fault progress does not re-arm a new episode;
- operator gates do not erase the quarantine clock;
- only explicit `SEND_TIMEOUT` may qualify as evidence that a Ghost recovery Send definitely failed;
- uncertain outcomes remain no-resend.

### G. Send acknowledgement latency
ChatGPT send acceptance observation is extended from 16 seconds to 45 seconds. This is observation only; it does not add another actuation.

## Fresh verification after final change

Fresh Windows verification at branch head `a2bb180e0c563f61ebf0f4d5b7d0318ffadbe591`:

- targeted ChatGPT DOM/stream regression suite: **18/18 PASS**
  - composer decoy rejection
  - ambiguous composer fail-closed
  - React composer replacement
  - user-draft protection
  - conversation-turn extraction
  - terminal-marker line preservation
  - native Stop mode
  - exact thinking-leaf detection without prose scanning
  - disabled-vs-ready Send state
  - delayed React Send enablement
  - stop-mode rejection
  - composer-scoped submit fallback
  - exactly-one Send actuation
  - data-turn fallback
  - scoped tool/status BUSY without native Stop
  - ordinary prose is not BUSY
  - recent stream-fault classification + visible fallback
  - Send readiness blocked while inferred activity remains BUSY
- `npm run test:ghostplus-runtime`: **PASS**
  - runtime lifecycle VM
  - runtime lifecycle static audit
  - scroll diagnostic static audit
- `npm run lint`: **PASS**
- `git diff 173fb182..a2bb180e --check`: **PASS**
- verification working tree: clean

## Inherited repository debt
`npm run check:committed` fails on both baseline `173fb182` and v0.15.19 candidate with:
`Committed extension/content.js does not match the committed userscript.`

This is inherited Firefox artifact lineage debt and was not introduced by v0.15.19. Regenerating that artifact would pull a large unrelated legacy 8.8 → current-core migration into this hotfix, so it remains deliberately outside scope.

## Live-certification boundary
The supplied live screenshots were used to identify the real failure states. The CodeLocal browser available to this session cannot attach to the user's authenticated ChatGPT tab, so this checkpoint does not claim authenticated live-DOM certification after deployment.

## Operator rollout
1. Update the Tampermonkey userscript.
2. Reload the affected ChatGPT tab.
3. Confirm the panel shows `v0.15.19`.
4. During `Resume stream unavailable`, `Message delivery timed out`, or `Connection interrupted`, Ghost should show the classified web fault and quarantine rather than immediately sending a continuation.
5. If activity/turn progress continues, the quarantine clock remains blocked by the 90-second quiet requirement.
6. After the fault is safely quiet and minimum quarantine has elapsed, Web Recovery may issue one new read-only status probe through the normal Ghost send path.
