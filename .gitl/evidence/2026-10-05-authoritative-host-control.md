# Ghost v0.15.21 — authoritative ChatGPT Stop / Send host control — 2026-10-05

## Baseline
- Repository: `tuanvayt03-cpu/ghost-in-the-loop`
- Baseline main: `3d565defda734bcfb5c065bc232a79abb010dde4`
- Repair branch: `fix/host-control-adopt-20261005`
- Promoted code head: `c3fae71a57b10e706b4f20e57fe7e955ab900252`
- Loader: `9.0.0-alpha.2+ghostplus.15.21`
- Runtime: `0.15.21`
- Immutable 14-module payload pin: `cb595c8df65ab9b9d83bb6a93dddc27ba4eb1479`

## Objective
Make Ghost decide Play / Continue from the real ChatGPT composer action state:
- square Stop = ChatGPT is working;
- Send arrow = ChatGPT is idle/send-capable;
- unresolved control = fail closed.

## Root cause
Earlier releases centralized composer, turn, activity and Send detection, but Play/Continue, Watchdog and recovery consumers still combined those signals independently. In a current ChatGPT UI variant the primary composer action may visually be Stop or Send while historical `data-testid` / aria labels are temporarily missing or replaced during React reconciliation. This could leave Ghost with a staged prompt while the actual host was already working, or produce a false `send-control-missing` pause.

## v0.15.21 contract

### Shared host-control resolver
The runtime now owns one `chatgptHostControlState()` result:
- `stop`: an explicit/visual Stop control is present. `busy=true`.
- `busy`: scoped ChatGPT activity/tool/status evidence says work is still running.
- `send`: the current composer action is Send; readiness is separated from disabled state.
- `uncertain`: composer exists but the primary control cannot be resolved safely.
- `missing`: composer itself is unavailable.

Confidence order:
1. explicit `#composer-submit-button`, `send-button`, `stop-button`, and semantic labels;
2. composer-local Stop glyph / square SVG fallback;
3. composer-local primary action fallback after auxiliary controls are filtered;
4. scoped activity state;
5. unresolved => no Send.

The primary-action fallback is scoped to the active composer and does not select arbitrary page buttons.

### Play / Continue
- Stop / BUSY => Ghost enters RUNNING and adopts the current ChatGPT turn without sending.
- Send => normal at-most-once staging / Send flow.
- Missing / uncertain => bounded reconciliation wait up to 8 seconds. If still unresolved, `PLAY-HOST-CONTROL` blocks; no Send occurs.
- If the control flips Send -> Stop after Ghost stages text but before actuation, Ghost clears only its own exact staged prompt, adopts the active turn, and sends nothing.
- Stream-desync faults remain quarantined unless the host is already actively running.

### Recovery consumers
Smart Watchdog, Web Recovery, Operator Gate, Core Busy Gate and Turn Budget now consume the same shared Stop / Send decision.

Watchdog and Web Recovery re-check host control after staging and immediately before triggering Ghost Play. If Stop/BUSY wins the race, their exact managed prompt is cleared and the recovery Send is cancelled.

Recovery Send acceptance now requires a fresh ChatGPT user turn. Ghost RUNNING, assistant activity or BUSY alone no longer count as proof that the staged recovery request was accepted.

## Current external evidence
Current 2026 ChatGPT automation implementations reviewed during this change use the same core semantics:
- composer-local `#prompt-textarea` / ProseMirror;
- Send via `button[data-testid="send-button"]`, `#composer-submit-button`, or composer-scoped submit;
- active generation via `button[data-testid="stop-button"]` / Stop semantics.

This supports making the composer action state authoritative while retaining scoped activity as a safety layer. It does not imply a stable public OpenAI DOM API.

## Fresh verification after final code change
Fresh Windows clone at `c3fae71a57b10e706b4f20e57fe7e955ab900252`:

- targeted ChatGPT DOM / host-control regression suite: **23/23 PASS**
  - existing composer / turn / stream tests;
  - unlabeled composer-local arrow -> Send;
  - unlabeled square glyph -> Stop;
  - scoped activity overrides Send as BUSY;
  - Send -> Stop race during readiness;
  - exact managed-draft cleanup only.
- `npm run test:ghostplus-runtime`: **PASS**
  - lifecycle VM;
  - lifecycle static audit;
  - scroll diagnostic static audit.
- `npm run lint`: **PASS**.
- `git diff 3d565def..c3fae71a --check`: **PASS**.
- verification working tree: clean.

## Inherited repository debt
`npm run check:committed` fails with the same result on both:
- baseline `3d565def`;
- candidate `c3fae71a`.

Inherited message:
`Committed extension/content.js does not match the committed userscript.`

The Firefox artifact lineage mismatch predates this fix. It was not regenerated because that would mix an unrelated legacy artifact migration into this scoped Ghost+ hotfix.

## Live-certification boundary
The supplied screenshots demonstrate the live failure family, including an older panel showing `v0.15.19` and `PLAY-SEND ... send-control-missing`. This session cannot attach to the user's authenticated ChatGPT tab, so live certification after deployment requires the operator to update Tampermonkey and reload the affected tab.

## Rollout / expected behavior
1. Update Tampermonkey and reload the ChatGPT tab.
2. Panel must show `v0.15.21`.
3. While the ChatGPT composer shows the square Stop control, pressing Ghost Play/Continue must adopt/monitor and must not create a new user message.
4. When the composer shows the Send arrow and is ready, Ghost may send exactly once through the normal verified path.
5. If neither state can be resolved, Ghost must block instead of guessing.
