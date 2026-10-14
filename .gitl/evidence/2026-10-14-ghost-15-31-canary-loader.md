# Ghost+ 0.15.31-canary1 — installable candidate, not a live-certified release

Date: 2026-10-14
Repository: tuanvayt03-cpu/ghost-in-the-loop
Branch: fix/ghost-unprimed-play-20261014

## Why a loader candidate is necessary
Tampermonkey's Ghost+ stable 0.15.30 loader pins fourteen @require modules to 41c41c8463082a093ebdbe480af54054e2db5608. Updating the GitHub main branch alone does not change the code actually executed on Chrome.
The original [GHOST CORE CONTROL] block is a visible control contract from bootstrapPrompt(draft), not itself an install/update failure. It cannot be made a hidden system message by a browser userscript.
Core regression: pressing Play to adopt an existing, already answered ChatGPT conversation lacking a terminal marker could stage an unsolicited reground prompt after the 9s stability/drift threshold. This is fixed by pausing without initiating Send if the runtime has no confirmed Ghost-authored round.

## Pinned canary identity
- Loader version: 9.0.0-alpha.2+ghostplus.15.31-canary1
- Runtime version: 0.15.31-canary1.
- 14/14 modules pinned to the immutable reviewed payload commit 4db2659f1b8a24f57ed31485e62e5ee4a35cd88f, after the core correction and runtime identity update.
- Loader update/download endpoints intentionally point at this dedicated candidate branch, not main.
- ChatGPT hosts only. No other sites are activated.
- Single controller required: Tampermonkey should treat matching @name/@namespace as an update; check that exactly one Ghost+ script is enabled, and disable any upstream Ghost userscript.

## Acceptance / rollback
- This candidate is for **controlled** installation on the user's *existing signed-in Chrome* once the browser can be inspected. No automatic installation into the user's live Chrome profile occurred.
- First run in a disposable conversation without unsent important drafts. Do not blind resend an uncertain action.
- Live gate: verify installed loader version/pins and one Ghost controller, Play -> BUSY -> IDLE/terminal -> at-most-once exact receipt, no unexpected protocol reground in an already answered unprimed chat, and no unrelated user draft changes.
- Any live mismatch remains BLOCKED, not production-certified.
- Rollback: disable canary and re-enable original known stable Ghost+ v0.15.30 in Tampermonkey, then refresh the tab; no changes to existing chats are required.
- Firefox artifact parity and old Jest suites remain separate unresolved baseline debts.

## Verification
- See .gitl/evidence/2026-10-14-ghost-unprimed-drift-guard.md for the red/green root-cause regression.
- Run the final candidate's fresh Chromium, focused Jest, runtime lifecycle, syntax lint, loader pin test and git diff-check after last code/metadata edit before treating candidate as tested.
