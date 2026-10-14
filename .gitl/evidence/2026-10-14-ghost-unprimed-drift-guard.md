# Ghost+ — unprimed ChatGPT protocol drift guard (2026-10-14)

## Baseline / ownership
- Repository: `tuanvayt03-cpu/ghost-in-the-loop`
- Separate single-writer checkout: `C:\Users\Vu Tuan\Desktop\Project\.ghost-play-safety-20261014`
- Branch: `fix/ghost-unprimed-play-20261014` based on GitHub `main` before this change.
- Other Ghost checkouts/dirty work were preserved; current user ChatGPT tabs, drafts, and Tampermonkey state were not changed.

## What the user observed
- On the installed v0.15.30 loader, Ghost visibly sends a `[GHOST CORE CONTROL]` block when Play starts from an unsent draft. This is the existing `bootstrapPrompt(draft)` mechanism, not proof of a stale Tampermonkey installation. Web userscripts cannot supply a hidden system prompt.
- Separately, when Play adopts a previously submitted or answered conversation without a terminal `[[GITL::...]]` marker, core can trigger a protocol reground after 9 seconds. This creates an unsolicited new Send attempt, even though Ghost did not own the original message.

## Root cause and narrow correction
- `ghost-in-the-loop.user.js`: `handleDrift()` always called `sendOnce(regroundPrompt())` on first terminal miss, without checking whether this runtime had confirmed any Ghost-authored Send transaction.
- Add fail-closed branch for ChatGPT when `S.round === 0`: pause with a clear missing-terminal message, never stage/send reground. Existing user-visible output stays intact; users may deliberately begin a new Ghost-controlled task with a draft.
- Keep normal reground for already Ghost-owned turns, plus all existing exact Send receipt, uncertainty, BUSY, route and duplicate-send guards. No weakening of safety tests.
- This is a scope-limited reliability fix, **not** an authenticated-live cure for all ChatGPT UI variants.

## Fresh machine evidence
- Before source fix, new Chromium regression `adopting an unprimed answered chat does not auto-send the Ghost protocol on terminal drift` **FAILED**: unexpected attempted Send and `PLAY-SEND-UNCERTAIN`.
- After source fix, same regression **PASS**: `PAUSED` state and zero Send click.
- `npx playwright test tests/e2e/ghostplus-host-control-fault-matrix.spec.js tests/e2e/ghostplus-recovery-reconcile.spec.js tests/e2e/ghostplus-alert-dedupe.spec.js tests/e2e/ghostplus-tab-title.spec.js --project=chromium --retries=0`: **43/43 PASS**.
- `npx jest tests/chatgpt-composer-contract.test.js tests/extension-build-guard.test.js --runInBand --silent`: **50/50 PASS**, 2/2 suites.
- `npm run test:ghostplus-runtime`: PASS (VM lifecycle, static lifecycle, scroll).
- `npm run lint`: PASS.
- `git diff --check`: PASS.

## Live Chrome and release boundary
- CodeLocal browser currently reports an isolated Chromium profile (`elevatedAttach=false`) and cannot attach to existing signed-in Chrome. The Windows UIA carrier previously exposed only an empty ChatGPT accessibility document; desktop screenshot was blocked by endpoint antivirus. Do not bypass security tools or change unrelated browser profiles.
- Thus **no signed-in live Ghost E2E or Tampermonkey installation** has been validated in this checkout. An immutable `@require` pin of the installed 0.15.30 loader still points at its older payload, not this branch.
- This branch is a tested patch/checkpoint, **not a published release or Chrome hotfix** until the current-profile canary is possible and the loader/version/pins are reviewed.
- Historical Firefox generated artifact parity and legacy Jest failures remain out of scope and unresolved.

## Next actions
1. Obtain read-only authenticated Chrome DOM/DevTools access through a supported carrier without breaking existing tabs.
2. Check installed Tampermonkey script identity, versions, loader vs payload pins, and duplicate controller instances.
3. Canary in a disposable ChatGPT chat: Play, BUSY, terminal, continuation and exact outbound receipt, with explicit no-replay for unknown Send.
4. Only after proof, prepare a loader/payload pin version bump and scoped release, re-run fresh suite and verify installation.
