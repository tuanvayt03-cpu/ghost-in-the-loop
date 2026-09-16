# Ghost in the Loop +

Personal fork overlay for ChatGPT Web.

## Use exactly one Tampermonkey script

Install `ghost-plus.user.js` and disable/delete the separately-installed upstream `Ghost in the Loop` userscript. The loader pulls the canonical Ghost runtime from this fork and then applies the Ghost+ companion in the same Tampermonkey execution unit.

Current loader version: `9.0.0-alpha.2+ghostplus.4`.

## Added behavior

- Light, translucent Ghost panel theme.
- Collapse button that reduces the panel to a 46x46 ghost icon at the same top-right position; click the icon to restore.
- Safe Vietnamese labels are visual-only CSS. No translation MutationObserver and no ChatGPT DOM rewrite loop.
- Adaptive liveness watchdog with Off / 3 / 5 / 10 / 15 / 25 minute thresholds. Default: 5 minutes.
- Progress is tracked separately from assistant text, tool/status UI and turn-count/generation-state changes.
- 30-second rescue grace window after the silence threshold. Any fresh progress resets the watchdog.
- Recovery budget defaults to 2 consecutive recoveries and prevents blind retry of the same unchanged state.
- Optional operator correction can be queued and injected into the next watchdog recovery probe.
- Automatic updates are exposed through Tampermonkey `@updateURL` / `@downloadURL` metadata.

## Recovery state machine

1. Ghost must already be `RUNNING` and not `UNCERTAIN`.
2. No real progress is observed for the configured silence threshold.
3. Ghost+ waits another 30 seconds as a rescue grace window.
4. If ChatGPT is already idle, Ghost+ does **not** click Stop and proceeds directly to reconciliation.
5. If ChatGPT still exposes an active generation, a new user prompt cannot be sent concurrently. When `cho phép Stop turn treo` is enabled, Ghost+ requires exactly one reviewed ChatGPT Stop control, clicks it once, and verifies generation actually stopped. If Stop is disabled or ambiguous, recovery fails closed.
6. Ghost+ freezes the normal Ghost loop to avoid two writers/controllers racing.
7. Ghost+ stages a `WATCHDOG RECOVERY STATUS PROBE` and restarts through Ghost's own Play / `sendOnce()` path.
8. The probe requires fresh conversation + machine/tool evidence and internally classifies the state as `RESUMABLE`, `BLOCKED`, `COMPLETE`, or `UNKNOWN_SIDE_EFFECT`.
9. `UNKNOWN_SIDE_EFFECT` explicitly forbids replay/resend/retry until evidence reconciles the outcome. If certainty cannot be restored, Ghost must request human input.

Stop is therefore a transport-recovery action only. It is never treated as task completion.

## Safety

The companion never edits local files, calls shell commands, or accesses secrets. It does not blindly resend prompts. Ambiguous Stop/Send state remains fail-closed. A non-empty user draft is never overwritten by automatic recovery.

## Tampermonkey install

Open the raw `ghost-plus.user.js` file from this repository and install/update it with Tampermonkey. Keep only this Ghost+ loader enabled to avoid two independent Ghost controllers on the same ChatGPT page.
