# Ghost in the Loop +

Personal fork overlay for ChatGPT Web.

## Use exactly one Tampermonkey script

Install `ghost-plus.user.js` and disable/delete the separately-installed upstream `Ghost in the Loop` userscript. The loader pulls the canonical Ghost runtime from this fork and then applies the Ghost+ modules in the same Tampermonkey execution unit.

Current loader version: `9.0.0-alpha.2+ghostplus.7`.

## Added behavior

- Light, translucent Ghost panel theme.
- Collapse button that reduces the panel to a 46x46 ghost icon at the same top-right position; click the icon to restore.
- Safe Vietnamese labels are visual-only CSS. No translation MutationObserver and no ChatGPT DOM rewrite loop.
- Watchdog controls themselves are rendered directly in Vietnamese by the companion, avoiding label-rewrite conflicts.
- Adaptive liveness watchdog with Off / 3 / 5 / 10 / 15 / 25 minute thresholds. Default: 5 minutes.
- Progress is tracked separately from assistant text, tool/status UI and turn-count/generation-state changes.
- 30-second rescue grace window after the silence threshold. Any fresh progress resets the watchdog.
- Recovery budget defaults to 2 consecutive recoveries and prevents blind retry of the same unchanged state.
- Optional operator correction can be queued and injected into the next watchdog recovery probe.
- Web Error Supervisor detects paused `PLAY-SEND-UNCERTAIN` plus known ChatGPT send/network/generation errors even when the normal running watchdog is no longer active.
- Web Error Supervisor never auto-clicks the ChatGPT `Retry / Thử lại` control for an uncertain request.
- Recoverable paused web errors are reconciled through a fresh `WEB RECOVERY STATUS PROBE`, not by replaying the previous continuation.
- `RATE_LIMIT` and `AUTH_ERROR` remain fail-closed instead of creating more requests.
- Automatic updates are exposed through Tampermonkey `@updateURL` / `@downloadURL` metadata.

## Running-turn recovery state machine

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

## Paused web-error recovery state machine

This path handles cases such as ChatGPT showing `Đã hết thời gian chờ gửi tin nhắn. Vui lòng thử lại.` while Ghost has already paused with `PLAY-SEND-UNCERTAIN`.

1. Scan visible ChatGPT error/alert/toast/retry UI and normalize it to `SEND_TIMEOUT`, `NETWORK_ERROR`, `GENERATION_ERROR`, `RATE_LIMIT`, or `AUTH_ERROR`.
2. `PLAY-SEND-UNCERTAIN` is itself a recoverable supervisor condition even when no recognizable error banner is present.
3. Wait a short settle window so transient UI changes can resolve naturally.
4. Do **not** click the old ChatGPT `Retry / Thử lại` button and do **not** resend the previous continuation.
5. If ChatGPT is still generating, leave the event to the normal running-turn watchdog; the paused web-error supervisor does not click ChatGPT Stop.
6. If the composer contains an operator draft, fail closed and do not overwrite it.
7. Reset only Ghost's internal uncertain latch through Ghost's own `Dừng` control. This does not click ChatGPT's Stop-generating button.
8. Stage a fresh `WEB RECOVERY STATUS PROBE` and start it through Ghost's own Play/send-once path.
9. The status probe requires fresh conversation plus fresh machine/tool evidence and classifies the state as `RESUMABLE`, `BLOCKED`, `COMPLETE`, or `UNKNOWN_SIDE_EFFECT` before safe continuation.
10. A recovery probe is attempted at most once per continuous fault episode. If its delivery cannot be confirmed, Ghost+ does not automatically resend it.
11. `RATE_LIMIT` causes backoff/pause and `AUTH_ERROR` requires human correction; neither is auto-probed repeatedly.

## Safety

The companion and web supervisor never edit local files, call shell commands, or access secrets. They do not blindly resend prompts. Ambiguous Stop/Send state remains fail-closed. A non-empty user draft is never overwritten by automatic recovery.

## Tampermonkey install

Open the raw `ghost-plus.user.js` file from this repository and install/update it with Tampermonkey. Keep only this Ghost+ loader enabled to avoid two independent Ghost controllers on the same ChatGPT page.
