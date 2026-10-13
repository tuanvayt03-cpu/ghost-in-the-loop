# Ghost+ checkpoint — 2026-10-13 (fresh local verification)

## Scope and identity
- Repository: tuanvayt03-cpu/ghost-in-the-loop
- Baseline verified from GitHub and fast-forwarded in an existing authorized CodeLocal checkout: `main@2be1c575b59510600c6bf3d056e72128b1a77f64`.
- Current ChatGPT-only Ghost+ loader/runtime remains `9.0.0-alpha.2+ghostplus.15.30` / `0.15.30`; no runtime code, loader, module pins, browser state, or user messages were intentionally changed in this checkpoint.
- Existing untracked `baseline-jest.json` was preserved. The old local checkout was updated strictly with `git fetch origin main` and `git merge --ff-only origin/main`. No reset, deletion, force push, or browser send was performed.
- A separate CodeLocal worktree attempt was blocked by workspace path policy, so no alternative checkout was forced.

## Fresh machine evidence (2026-10-13)
Executed against local `main@2be1c575`, with zero authored source changes:
- `npm run lint`: PASS (exit 0).
- `npm run test:ghostplus-runtime`: PASS (exit 0); runtime lifecycle VM/static and scroll checks.
- `npx jest tests/chatgpt-composer-contract.test.js tests/extension-build-guard.test.js --runInBand --silent`: **50/50 PASS**, 2/2 suites, exit 0.
- `npx playwright test tests/e2e/ghostplus-host-control-fault-matrix.spec.js tests/e2e/ghostplus-recovery-reconcile.spec.js tests/e2e/ghostplus-alert-dedupe.spec.js tests/e2e/ghostplus-tab-title.spec.js --project=chromium`: **42/42 PASS**, exit 0, 18.8 seconds.
- `npm run check:generated`: **FAIL** (exit 1), because the Firefox extension artifact does not match generated current userscript.
- `node scripts/build-extension.js --check-overwrite`: intentionally **REFUSED** (exit 2): legacy v8 Firefox engine would be overwritten. Guard is working as designed; **do not bypass with `--migrate-legacy`** without separately reviewed migration/parity.
- `git status --short --branch`: `main...origin/main` plus only pre-existing `?? baseline-jest.json`.

## Real ChatGPT authentication / Tampermonkey canary
- On the desktop Chrome window, UI Automation observed a ChatGPT conversation tab and Tampermonkey toolbar action.
- The UI item labelled “Ghost +” is a **Chrome bookmark**, not evidence of an active Ghost controller. No logged-in Ghost runtime state was authenticated or certified.
- CodeLocal physical desktop keyboard shortcut for creating a disposable tab returned `approval_required` because it can interfere with the user's active cursor/keyboard.
- Attempting to invoke Tampermonkey using UI Automation returned “element has no InvokePattern; use approved coordinates”. Screenshots were also blocked by endpoint antivirus on this carrier.
- No Play/Send/Stop/recovery was actuated, no draft was overwritten, and no authenticated live ChatGPT smoke was performed.

## Decision and remaining gates
- **Deterministic ChatGPT/Chromium scope: PASS.**
- **Production/live ChatGPT E2E certification: BLOCKED** on explicitly approved desktop control or another safe authenticated carrier.
- Historical legacy Jest failures and Firefox userscript/extension parity remain separate unresolved debt; this session did not claim to repair or retest the full legacy Jest suite.
- Do not conflate fixture passes with production live proof; do not force Firefox generation and do not replay uncertain sends.

## Safe continuation / exact next executable action
1. Acquire approved, isolated, logged-in ChatGPT + Tampermonkey browser control, with a disposable conversation and no unrelated drafts.
2. Read the active userscript version and current state before changing controls.
3. Run bounded Play -> BUSY -> IDLE/terminal -> single continuation canary, verify exact outbound receipt/no duplicate, and test uncertain-send fail-closed reconciliation. Treat `BROKER_UNKNOWN`/unknown side effects as no-replay.
4. If any live defect is reproduced, write a focused regression, fix in the active checkout, rerun all affected checks and independently review; do not alter unrelated apps.
5. Only after signed-in live evidence is green consider production-certified completion; separately plan Firefox migration and legacy Jest modernization.

## Session closure
- Primary writer: current Ghost session; no code changes in this checkpoint.
- GitHub main was `2be1c575` before this evidence-only documentation commit.
- Build/test verification recorded above is fresh and specific; current source remains at the same runtime version.

## Follow-up: explicit desktop authorization and carrier diagnosis (2026-10-13)
- User explicitly authorized Ghost live checking and reported **no desktop approval popup was presented**.
- Verified CodeLocal Project workspace access was **smart** (Vietnamese “Phê duyệt giúp tôi”), where physical `computer.key` action returned an `approval_required` tool response. This is an in-tool action gate; a visible OS popup was not observed.
- Temporarily switched that workspace to **full** to test the carrier, then **restored smart** afterward. No permanent broad privilege elevation remains.
- Windows UI Automation successfully invoked Chrome's **New tab** control, then the ChatGPT bookmark in the newly opened tab. A fresh document titled `🔴 ChatGPT` appeared in the native accessibility tree, with Tampermonkey extension present in the Chrome toolbar. Neither fact alone proves that Ghost's main runtime panel has actually mounted.
- The Chrome page's accessibility `Document` exposed **zero DOM descendants**, so Ghost panel, version, Play button, model state and outbound receipts could not be inspected. Bookmark `Ghost +` is merely a Chrome bookmark.
- Desktop input `computer.type` returned `unsupported Windows Computer Use operation` even in full workspace mode. `computer.key` with `CTRL+T` returned `unsupported Windows key`. Do not infer missing ChatGPT permissions from these carrier errors.
- Desktop screenshot returned endpoint AV/PowerShell `Add-Type -AssemblyName System.Windows.Forms` malicious-content block; no attempt was made to bypass this security control. Chrome executable launch from outside the authorized workspace was blocked by the CodeLocal path policy, also respected.
- Isolated CodeLocal Browser cannot attach to the signed-in Chrome profile (`attachExisting=false`); local MCP extension search found no attached Chrome DevTools provider.
- **No live Play/Send/Stop action and no test messages** were sent. One disposable ChatGPT tab and one blank test tab were opened. All unrelated user conversations/drafts remained untouched.
- **Outcome: Live E2E remains BLOCKED by authenticated-browser observation and input capabilities**, not by a reproduced Ghost runtime failure. Scope remains ChatGPT desktop; deterministic checks listed above are still the only machine-green evidence. No source edits or new tests were claimed.
- The precise remediation is a supported CodeLocal desktop browser carrier that exposes authenticated ChatGPT DOM/accessibility and safe input/screenshot capability without weakening AV/host policy. Then run the disposable-chat canary described above. Do not call any release/live PASS before that.
