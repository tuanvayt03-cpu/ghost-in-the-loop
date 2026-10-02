# ChatGPT send-control hotfix — 2026-10-02

## Baseline
- Repository: `tuanvayt03-cpu/ghost-in-the-loop`
- Baseline main: `537196b73f271852a301fb12bc97fd6bba69be05`
- Repair branch: `fix/chatgpt-send-control-20261002`
- Promoted code head: `abd5a486a48160f0b10b109b1241c284ddb0dcd5`
- Ghost+ release: `9.0.0-alpha.2+ghostplus.15.18`
- Runtime: `0.15.18`
- Immutable 14-module payload pin: `9c6646ea81fb130a0a8a2a9db6c1095109dfe91d`

## Live symptom
The supplied live screenshot on v0.15.17 showed:
`PAUSED · PLAY-SEND: Prompt is staged, but the current host Send control did not become available.`

At the same time the staged Ghost control text was visibly present in the composer and the blue ChatGPT Send arrow was visible. Therefore composer staging and turn detection were working; failure was isolated to Send readiness/control discovery.

## Root cause
v0.15.17 still used the old core-local Send path:
- the generic `visible()` helper rejected disabled buttons entirely, so a rendered-but-temporarily-disabled React Send control was indistinguishable from a missing control;
- the readiness window was only 2200 ms;
- Send discovery was not centralized with the composer/turn contracts.

Contemporary ChatGPT automation implementations wait materially longer for Send readiness and distinguish element visibility from enabled state.

## Changes
- Added one shared ChatGPT Send contract in the runtime.
- Separates `found/rendered` from `enabled/ready`.
- Supports:
  - `#composer-submit-button`
  - `button[data-testid="send-button"]`
  - exact Send / Send prompt / Send message / Submit labels
  - localized Vietnamese/Chinese exact labels included in the runtime
  - `button[type="submit"]` only inside the active composer root
- The same `#composer-submit-button` in `data-testid="stop-button"` mode is explicitly rejected as Send.
- Core now waits up to 10 seconds for readiness after a verified staged write.
- Immediately before actuation, Ghost revalidates:
  - exact staged composer content;
  - not currently generating;
  - same Send identity;
  - enabled state.
- ChatGPT actuation is still exactly one `.click()`.
- Turn Budget now uses the same shared Send identity contract.
- Pre-actuation failures remain safe/known failures; post-actuation unconfirmed outcomes still become uncertain and never resend.

## Fresh verification after final change
Clean Windows clone at branch head `abd5a486`:
- targeted ChatGPT DOM suite: **12/12 PASS**
  - existing composer/turn regressions
  - disabled-vs-found Send state
  - delayed React Send enablement
  - stop-mode rejection
  - composer-scoped semantic submit fallback
  - composer-change fail-closed
  - exactly-one click actuation
- `npm run test:ghostplus-runtime`: **PASS**
  - runtime lifecycle VM
  - runtime lifecycle static audit
  - scroll diagnostic static audit
- `npm run lint`: **PASS**
- `git diff 537196b7..abd5a486 --check`: **PASS**
- verification worktree: clean

## Known inherited repository debt
`npm run check:committed` fails on both the v0.15.17 baseline and this hotfix because committed `extension/content.js` intentionally does not match the current userscript lineage. This is pre-existing and unrelated to the Send fix. The Firefox artifact was not regenerated here because doing so would pull a large unrelated 8.8→9.0 artifact migration into this hotfix.

## Operator action
Update Tampermonkey and reload the ChatGPT tab. The panel must show `v0.15.18`.
A staged continuation should now wait for the real ChatGPT Send control to become ready and actuate it once. If ChatGPT accepts it, Ghost confirms via generation/user-turn/composer-clear/assistant-change evidence. If acceptance remains uncertain after actuation, Ghost still stops without replay/resend.
