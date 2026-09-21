# Ghost in the Loop +

Personal fork overlay for ChatGPT Web.

## Use exactly one Tampermonkey script

Install `ghost-plus.user.js` and disable/delete the separately-installed upstream `Ghost in the Loop` userscript. The loader pulls the canonical Ghost runtime from this fork and then applies the Ghost+ modules in the same Tampermonkey execution unit.

Current loader version: `9.0.0-alpha.2+ghostplus.15.0`.

## Added behavior

- Light, translucent Ghost panel theme.
- Collapse button that reduces the panel to a 46x46 ghost icon at the same top-right position; click the icon to restore.
- Safe Vietnamese labels without a page-wide translation MutationObserver.
- Chat-aware desktop notifications: Ghost+ popup titles include the active conversation name when it can be resolved safely.
- Soft turn budget, default 20 minutes. It only injects planning/checkpoint guidance; it never stops an active turn.
- Hard `CONTEXT_TOO_LONG` boundary: Ghost controller stops, no retry/recovery/reload is attempted, and the operator must hand off to a new chat manually.
- Web Error Supervisor for `PLAY-SEND-UNCERTAIN`, send timeout, network/generation errors, rate limits and auth failures.
- Busy-aware smart watchdog replaces the legacy silence-only watchdog.
- Core busy gate protects the upstream Ghost loop when ChatGPT is still reasoning/tool-running but the current UI no longer matches the upstream Stop selector.

## Busy-aware smart watchdog

Default idle timeout: 5 minutes. Recovery budget: 2 attempts.

The watchdog classifies ChatGPT as `BUSY_CONFIRMED` when any strong or supporting evidence shows active work, including:

- a visible ChatGPT Stop control;
- a square/Stop composer action replacing Send;
- visible pending states such as `Đang suy nghĩ`, `Đang truy vấn`, `Thinking`, `Searching`, `Processing`, tool execution, etc.;
- visible `aria-busy=true` regions;
- visible progress/spinner state in the chat area.

While `BUSY_CONFIRMED`:

- the idle watchdog is locked;
- `suspectAt` is cleared;
- no recovery prompt is sent;
- ChatGPT Stop is never clicked by the smart watchdog;
- after 10 minutes without meaningful text/tool/status change, Ghost+ only emits a warning notification. It still does not stop/recover the turn.

When BUSY evidence disappears:

1. wait a 5-second post-generation settle window;
2. start the configured idle watchdog only after that settle window;
3. if the page stays genuinely IDLE past the threshold, wait an additional 30-second rescue grace window;
4. re-check BUSY immediately before recovery;
5. only then stage a `WATCHDOG RECOVERY STATUS PROBE` through Ghost's own Play/send-once path.

The recovery probe requires fresh conversation plus machine/tool evidence and internally classifies the state as `RESUMABLE`, `BLOCKED`, `COMPLETE`, or `UNKNOWN_SIDE_EFFECT`. `UNKNOWN_SIDE_EFFECT` explicitly forbids blind replay/resend/retry.

## Core busy gate

The upstream Ghost runtime has its own `generating()` selector set. ChatGPT Web can change its composer/Stop UI before upstream Ghost is updated. If Ghost+ sees a live pending reasoning/tool state but upstream Ghost cannot see a native Stop control, the core busy gate creates a 1px off-screen sentinel matching Ghost's reviewed Stop selector.

- The sentinel is only present while Ghost is `RUNNING`, or `PAUSED + UNCERTAIN`, and a real pending state is visible.
- It is removed immediately when a native Stop control appears or the inferred BUSY state ends.
- It has no click handler, is outside the visible page, and never sends or stops anything.
- Its only purpose is to make upstream Ghost keep treating the current turn as generating, preventing protocol-reground/continuation from firing in the middle of a live tool/reasoning run.

## Web-error recovery

Paused `PLAY-SEND-UNCERTAIN` and explicit ChatGPT web errors are handled separately from liveness monitoring.

- Never auto-click the old `Retry / Thử lại` control for an uncertain request.
- Never replay the previous continuation blindly.
- Recoverable paused web errors use a fresh `WEB RECOVERY STATUS PROBE`.
- `RATE_LIMIT` backs off; `AUTH_ERROR` requires human correction.
- At most one web-recovery attempt is made per continuous fault episode.

## Context-too-long boundary

When ChatGPT reports that the conversation/context is too long or has reached its maximum length:

- Ghost controller is stopped;
- no status probe is sent;
- no reload/retry is attempted;
- the UI and desktop notification say that a new chat + manual handoff is required.

## Safety

Ghost+ does not edit local files, call shell commands, access secrets, or blindly resend prompts. A non-empty operator draft is never overwritten by automatic recovery. Busy state, web errors, and context-limit boundaries are separate state machines so they cannot legally trigger the same recovery path at the same time.

## Tampermonkey install

Open the raw `ghost-plus.user.js` file from this repository and install/update it with Tampermonkey. Keep only this Ghost+ loader enabled to avoid two independent Ghost controllers on the same ChatGPT page.


## v0.14 release

Ghost+ v0.14 separates responsibilities cleanly:

- Ghost handles one active chat/job: core continuation, BUSY/idle recovery, uncertain-send reconciliation, persistent operator gates, local alerts and Telegram push.
- The separate Night Watchdog project is intentionally not part of this repository or runtime.
- HUMAN, MODEL RELAY, AUTH ERROR, RECOVERY EXHAUSTED and CONTEXT BOUNDARY are operator-gated states.
- While a gate is locked, Web Recovery and the Ghost watchdog early-exit and programmatic Play is blocked.
- Recovery exhaustion can be resumed only by a trusted operator action; that action resets only the exhausted recovery episode.
- Telegram is notification-only. It cannot resume Ghost, clear a gate or modify execution state.
- Telegram group binding polls only during the explicit 60-second bind window. Normal runtime is push-only.
- Release loader pins runtime modules to reviewed commit `1c8d72b682ef3a21e6b271d91e191e17c23d958e` and updates from `main`.


## v0.14.1 Telegram topic UI

- Stored Bot Token is shown masked in the panel: first 4 characters + mask + last 4 characters. The full token stays in Tampermonkey storage.
- Telegram actions are four distinct buttons: Save, Check bot, Bind topic/group, Test.
- Forum topics are supported through Telegram `message_thread_id`.
- To bind a topic, start Bind topic/group and send the displayed `/ghost_bind CODE` inside the exact topic that should receive alerts.
- Ghost stores both `chat_id` and `message_thread_id`; Test and runtime alerts reuse both.
- Manual Topic ID entry is also available for advanced setup.


## v0.14.2 click-to-copy bind

- While Telegram bind is active, the exact `/ghost_bind CODE` command is rendered as a clickable code chip.
- Clicking the command copies the complete bind command through Tampermonkey clipboard access and shows a short confirmation.
- The countdown remains visible beside the command.


## v0.14.3 turn budget + selection safety

- Turn Budget stays soft: 80% wrap-up, 90% checkpoint, 100% overdue but never a forced Stop of an in-flight operation.
- Every Ghost-managed Continue/Recovery turn receives the stronger budget contract automatically.
- Programmatic composer writes preserve any non-collapsed text selection outside the composer.
- Operator Gate no longer focuses the composer merely to clear a blocked recovery draft.
- Release-runtime audit found no global mouse/pointer/select-start interception. The only global capture click guard is scoped to the Ghost Play button while an Operator Gate is locked.


## v0.14.4 Telegram gate reconciliation

- Telegram subscribes before Operator Gate initialization so a HUMAN gate created during page startup is not emitted into an empty subscriber set.
- Telegram also reconciles the current persistent Operator Gate after startup and periodically thereafter.
- A missed HUMAN / RELAY / CONTEXT / AUTH / RECOVERY gate is sent using the same episode key as the live event, so successful live delivery and backfill cannot intentionally create a duplicate.
- In-flight event keys are deduplicated so concurrent live emission and reconciliation cannot queue the same Telegram alert twice.
- Failed current-gate delivery can retry after a bounded cooldown without changing or clearing the gate.


## v0.14.5 adversarial Telegram delivery audit

- All Telegram-worthy structured alerts use a persistent local outbox before network delivery.
- Outbox records contain only the alert payload plus destination/topic snapshot; Bot Token is never stored in the outbox.
- Delivery retries use bounded backoff. Exhausted records remain visible in the queue and are re-armed only after a successful Check bot/Test action.
- Pending records are discarded rather than redirected when the configured destination/topic changes.
- Normal core HALT emits structured COMPLETE, so the Complete toggle works for ordinary completion as well as late-uncertain HALT.
- Round-limit exhaustion and repeated protocol drift become persistent HUMAN gates.
- Core pre-actuation/runtime blockers emit CORE_BLOCKED alerts; send-uncertain/send-threw are left to Web Recovery first to avoid noisy premature paging.
- PLAY-SEND-THREW is recognized as an uncertain state.
- If Web Recovery cannot safely stage/actuate/confirm its single reconciliation probe, it escalates to a persistent HUMAN gate instead of silently remaining paused.


### v0.14.5 multi-chat delivery isolation

- Delivery state is scoped per conversation path for sent markers, HUMAN reminders, and the persistent Telegram outbox.
- Different ChatGPT tabs/chats no longer read-modify-write the same delivery maps, preventing one chat from dropping another chat's queued alert.
- The loader initializes Telegram before the core controller, eliminating the remaining startup subscriber window for core-originated structured alerts.
- The delivery model is at-least-once: avoiding missed alerts is preferred over eliminating the rare duplicate possible when the same conversation is open in two tabs.


## v0.14.6 scroll/performance hardening

- Static runtime audit found no Ghost wheel/mousewheel/touchmove/selectstart listener, no programmatic scroll/scrollIntoView call, and no body/html overflow lock.
- The page-wide character-data MutationObservers in Operator Gate and uncertain reconciliation were removed; both paths already have bounded polling.
- Operator Gate skips full assistant-text scans while ChatGPT is visibly BUSY and while a persistent gate is already active.
- Uncertain reconciliation checks the cheap uncertain-state predicate before reading assistant text.
- Ghost-managed composer writes use focus({preventScroll:true}) where supported so prompt staging cannot pull the viewport to the composer.
- Core no longer rebuilds the whole Ghost panel once per second while a continuous BUSY state remains unchanged.


## v0.15 runtime lifecycle

Ghost+ v0.15 introduces a generation-owned Runtime Manager. The manager is the first loader module and owns all long-lived runtime resources created by Ghost+.

- Every module acquires a named runtime scope.
- Intervals, timeouts, sleeps, listeners, abortable Telegram requests, DOM nodes and global patches are registered to that scope.
- A new runtime generation destroys the previous active generation before booting.
- `destroy()` invalidates the generation first, then clears resources, aborts requests, restores global patches, removes Ghost DOM and clears runtime APIs.
- Persistent operator-gate state, Telegram configuration and Telegram outbox data stay in GM storage and are not deleted by unload.
- Turn Budget's `HTMLButtonElement.prototype.click` wrapper is restored on destroy.
- Alert Router restores its `GM_notification` wrapper on destroy.
- Telegram bind/network requests are aborted on destroy and its alert subscription is unsubscribed.
- Core UI uses two delegated listeners instead of attaching a new listener set on every render.
- Async recovery/send paths check the runtime generation after waits before any later side effect.

### Unload from the current tab

Use **Gỡ khỏi tab** in the Ghost panel to destroy the active Ghost runtime immediately without refreshing the page. The panel and Ghost+ UI are removed and runtime-owned callbacks stop.

Tampermonkey disabling cannot notify JavaScript that has already executed in an existing tab. Therefore:
- disabling the userscript prevents future injection;
- to clean an already-running v0.15 instance immediately, use **Gỡ khỏi tab**;
- **OFF + refresh** remains a valid hard reset.

When upgrading from v0.14.6 or older to v0.15, refresh each already-open ChatGPT tab once. Pre-v0.15 instances did not expose their timer/listener handles to the Runtime Manager and cannot be reliably reclaimed in-place.

### Diagnostics

While Ghost is loaded:
- the Play pane shows `runtime G<n> · resources <count>`;
- `window.__ghostPlusRuntime.diagnostics()` returns per-module resource counts;
- after destroy, `window.__ghostPlusRuntimeLastDiagnostics` stores the final snapshot. All resource counters should be zero.

### Viewport invariant

Ghost monitoring does not own ChatGPT viewport state. Runtime modules must not introduce wheel/mousewheel/touchmove/selectstart interception, `scrollIntoView`, `scrollTo`, `scrollBy`, or body/html overflow locking. Programmatic composer focus must use `focus({preventScroll:true})`.
