# Ghost in the Loop +

Personal fork overlay for ChatGPT Web.

## Use exactly one Tampermonkey script

Install `ghost-plus.user.js` and disable/delete the separately-installed upstream `Ghost in the Loop` userscript. The loader pulls the canonical Ghost runtime from this fork and then applies the Ghost+ modules in the same Tampermonkey execution unit.

Current loader version: `9.0.0-alpha.2+ghostplus.14.2`.

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
