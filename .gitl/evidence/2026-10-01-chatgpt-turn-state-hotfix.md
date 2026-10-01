# ChatGPT turn-state hotfix — 2026-10-01

## Baseline
- Repository: `tuanvayt03-cpu/ghost-in-the-loop`
- Baseline main: `8fd95d5646fa248bba2c8baf6ceab9d17ca23244`
- Repair branch: `fix/chatgpt-turn-detection-20261001`
- Promoted code head: `1abed51f2110dbbaa567581fda88abe0c626bb01`
- Ghost+ release: `9.0.0-alpha.2+ghostplus.15.17`
- Runtime: `0.15.17`
- Immutable 14-module payload pin: `aea3a8e733370f34b61157eb8a45ed69360f8dc5`

## Reproduction / root cause
The live screenshot showed Ghost immediately returning to:
`PAUSED · Type a task into the chat first, then press Play.`

That text is emitted only by the core Play bootstrap path after:
1. the composer is found,
2. Ghost does not see active generation,
3. the composer draft is empty, and
4. `assistantText()` returns empty.

v0.15.16 had centralized the ChatGPT composer contract, but the conversation-turn contract remained split across modules and still relied primarily on `[data-message-author-role="assistant"]` / `user`.
Current ChatGPT DOM implementations also use `article[data-testid*="conversation-turn"]`, accessibility labels/test ids, nested role markers, and a composer submit control whose `data-testid` switches between `send-button` and `stop-button`.
That mismatch could make an existing conversation look empty to Ghost and could also make busy/late-accept logic disagree across modules.

## Changes
- Added a shared runtime ChatGPT turn contract:
  - `article[data-testid*="conversation-turn"]`
  - legacy `data-message-author-role` and `data-author`
  - nested role markers
  - role-bearing test ids / accessibility labels
- Preserves assistant line boundaries so Ghost terminal markers remain parseable.
- Added shared ChatGPT generation-state detection:
  - `#composer-submit-button[data-testid="stop-button"]`
  - exact stop-button/test-id controls
  - semantic stop labels
  - latest-turn-only thinking status fallback
- Core Play, Smart Watchdog, Web Recovery, Operator Gate, Turn Budget, Core Busy Gate, and Uncertain Reconcile now consume the shared state.
- When a real existing chat is present but the assistant cannot be resolved, Play reports a compatibility state instead of falsely saying no task exists.
- No Send authority was widened. No blind resend/replay was added.

## Fresh verification after final code change
From a clean Windows clone at code head `1abed51f`:
- Targeted ChatGPT DOM regression suite: **7/7 PASS**
  - composer decoy rejection
  - ambiguous composer fail-closed
  - React composer replacement
  - user-draft protection
  - current conversation-turn article extraction
  - terminal-marker line preservation
  - current composer stop-button generation state
  - scoped thinking-state handling
- `npm run test:ghostplus-runtime`: **PASS**
  - runtime lifecycle VM
  - runtime lifecycle static audit
  - scroll diagnostic static audit
- `npm run lint`: **PASS**
- `git diff 8fd95d56..1abed51f --check`: **PASS**
- verification working tree: clean

## Scope notes
The legacy Firefox extension artifact and unrelated 8.8 test debt were not modified. This release changes only Ghost+ runtime/production consumers, docs, and focused regression tests.

## Operator action
After Tampermonkey updates the loader and the ChatGPT tab reloads, the panel must show `v0.15.17`.
Pressing Play in an existing conversation should no longer bounce to the false `Type a task into the chat first` pause. If ChatGPT is already generating, Ghost should adopt the active turn without sending a duplicate.
