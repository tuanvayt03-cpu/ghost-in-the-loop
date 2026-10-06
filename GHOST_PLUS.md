# Ghost in the Loop +

Personal fork overlay for ChatGPT Web.

## Use exactly one Tampermonkey script

Install `ghost-plus.user.js` and disable/delete the separately-installed upstream `Ghost in the Loop` userscript. The loader pulls the canonical Ghost runtime from this fork and then applies the Ghost+ modules in the same Tampermonkey execution unit.

Current loader version: `9.0.0-alpha.2+ghostplus.15.22`.

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


## v0.15.1 page-visible diagnostics

Tampermonkey may isolate userscript globals from the page's DevTools `window`. Therefore page-console access to `window.__ghostPlusRuntime` is not a reliable post-unload check.

After `Gỡ khỏi tab`, Ghost now publishes a secret-free cleanup snapshot to:

`document.documentElement.dataset.ghostplusLastDiagnostics`

Read it from Chrome DevTools with:

`JSON.parse(document.documentElement.dataset.ghostplusLastDiagnostics)`

The snapshot contains only runtime version, generation, destroy reason/timestamp and aggregate resource counts. It never contains Bot Token, Telegram destination, prompts, conversation content or other secrets.

A clean unload has `allZero: true` and every value under `totals` equal to `0`. Ghost also logs `[Ghost+] runtime destroyed` with the same safe snapshot to DevTools Console.


## v0.15.2 BUSY scroll-jank hardening

- Smart Watchdog polling is reduced from 1s to 2s; recovery thresholds are unchanged.
- A visible native/composer Stop control now short-circuits BUSY detection before expensive status/tool scans.
- Deep assistant/tool progress hashing runs at most every 5 seconds while BUSY.
- BUSY text hashing uses `textContent` instead of `innerText` to avoid forced layout.
- Watchdog panel geometry is recomputed at most every 5 seconds unless the viewport width changes or the operator explicitly collapses/restores the panel.
- Turn Budget clears a stale persisted timer whenever Ghost is no longer RUNNING and there is no staged Ghost-managed prompt.
- No viewport-control capability is added: Ghost still does not own wheel/touch/scroll APIs.


## v0.15.3 continuity lease

- A confirmed Ghost send arms a 25-minute continuity lease.
- HALT, HUMAN, RELAY, COMPLETE and explicit Stop clear the lease.
- Lease expiry never blindly sends `continue` while ChatGPT is BUSY, generating, gated, uncertain, in a web-error state, at a context boundary, or while the composer contains user text.
- After the lease expires and the task is safely IDLE for 30 seconds, Watchdog may send one normal reconciliation/status probe even if the core was paused by a recoverable non-uncertain condition.
- The existing 5-minute IDLE watchdog remains the faster recovery path while Ghost is RUNNING; the 25-minute lease is a second continuity layer, not a replacement.
- If Watchdog stages/actuates a recovery probe but cannot confirm Ghost restart, it now escalates to a persistent HUMAN gate + Telegram path. It does not retry/resend an uncertain actuation.
- The Watchdog UI shows the lease countdown and `due · chờ safe IDLE` when expiry has occurred but safety conditions are not yet satisfied.


## v0.15.4 UI cleanup

- Play pane no longer shows **Copy report** or **Unload**.
- Diagnostic report remains available under the Export tab as **Sao chép báo cáo lỗi**.
- Runtime unload remains an internal lifecycle capability but is no longer presented as a normal operator control because live A/B testing showed unloading Ghost does not resolve the intermittent ChatGPT scroll stall.


### Isolated scroll diagnostic

The manual diagnostic is `debug/ghost-scroll-diagnostic.user.js`. It is not included by `ghost-plus.user.js` and therefore adds no wheel listener to production Ghost. When temporarily installed, it uses one capture-phase passive wheel listener only. It never calls `preventDefault`, never assigns `scrollTop`, and never calls programmatic scroll APIs. A non-boundary wheel gesture with no movement produces a secret-free snapshot at `document.documentElement.dataset.ghostScrollLastDiagnostic` and a `[Ghost ScrollDiag]` console warning.


## v0.15.5 visible version + debug state

- The main panel header shows the Ghost+ runtime version immediately beside the product name: `GHOST · v0.15.5`.
- The right side of the header now shows only the current platform, e.g. `chatgpt`.
- The standalone Scroll Diagnostic publishes `data-ghost-scroll-diag-active="1"` while it is loaded. Ghost displays `· DBG` beside the version when that separate diagnostic userscript is active.
- Scroll Diagnostic remains a separate Tampermonkey userscript and is still not part of the production Ghost loader.


## v0.15.6 adopt active turn + visible Scroll Debug controls

- Pressing **Play** while ChatGPT is already generating now adopts the in-flight turn instead of requiring a new draft or injecting another message.
- Active-turn adoption performs no Send. Ghost switches to RUNNING, monitors the existing generation, then applies the normal terminal/drift logic after generation ends.
- Any unsent composer draft present during an active generation is left untouched.
- The standalone Scroll Diagnostic is bumped to v0.2.0 and adds a small page widget: **DBG · Copy · Log**.
- **Copy** copies the latest captured stall snapshot. If no stall has been captured yet, it first records a manual current-state snapshot and copies that.
- **Log** records the current state without waiting for a stall.
- Tampermonkey menu commands remain as a fallback, but the page widget is the primary operator path.


## v0.15.7 verified SEND_TIMEOUT classification

- `SEND_TIMEOUT` no longer escalates to `HUMAN_REQUIRED` merely because a recovery probe was not confirmed within the send verification window.
- A failed recovery send is classified as `VERIFIED_FAILED` only when all evidence agrees: explicit SEND_TIMEOUT text, visible Retry/Try again control, ChatGPT is not generating, user/assistant message counts did not advance, and the composer still contains the Ghost-managed WEB RECOVERY STATUS PROBE for the same recovery reason.
- `VERIFIED_FAILED` gets one controlled Ghost recovery retry. Ghost never clicks ChatGPT's old Retry/Try again button.
- If the one retry also has the same explicit failure evidence, the fault remains `SEND_TIMEOUT` and emits a warning; it does **not** create a HUMAN gate and does not resend again during that fault episode.
- HUMAN is reserved for genuinely uncertain/mixed evidence: message counts advanced, generation state changed, the managed recovery draft changed/disappeared, or other evidence no longer proves a failed send.


### Scroll Diagnostic v0.3.0

- Manual Copy no longer reuses a stale manual snapshot as if it were a captured stall.
- Real `wheel-no-movement` captures are stored separately as the last stall snapshot.
- If no stall has been captured, Copy creates a fresh `manual-copy-no-stall-captured` snapshot and marks `stallCaptured:false`.
- Manual diagnostics scan visible internal elements for actual scroll containers (`overflow-y: auto/scroll/overlay` with scroll range) instead of assuming the document `html` element is the ChatGPT scroller.
- Snapshots include `candidateScrollers` so the active ChatGPT internal scroll container can be identified even when the composer is outside it.


## v0.15.8 late-accept reconciliation for transient HUMAN

- HUMAN gates created by an assistant terminal marker remain hard and never auto-clear.
- Web Recovery uncertainty gates are now tagged with provenance `WEB_SEND_UNCERTAIN`, plus user/assistant message-count baselines.
- While such a transient gate is active, Operator Gate checks for late evidence that the send was actually accepted: ChatGPT becomes BUSY/generating, user-turn count advances, or assistant-turn count advances.
- When late evidence appears, the transient HUMAN gate auto-clears and emits `GATE_AUTO_RECONCILED`.
- If ChatGPT is already generating, Ghost automatically presses its own Play control after clearing so v0.15.6 active-turn adoption takes over without sending another message.
- A genuine assistant `[[GITL::HUMAN]]` or model relay marker still overrides this mechanism and remains operator-gated.


## v0.15.9 connection-interrupted recovery

- ChatGPT UI text such as `Kết nối bị gián đoạn. Đang chờ câu trả lời hoàn chỉnh` / `Connection interrupted. Waiting for a complete response` is classified as `CONNECTION_INTERRUPTED`, not generic uncertain/HUMAN.
- Detection includes status/live regions plus a throttled paused-only page-text fallback for the exact interruption banner.
- `CONNECTION_INTERRUPTED` is recoverable. Ghost waits 30 seconds first to give ChatGPT's own reconnect path priority.
- If the interruption persists, ChatGPT is not generating, and no operator gate/user draft blocks recovery, Ghost sends one reconciliation/status probe.
- If that recovery send itself is explicitly proven failed while the same interruption remains, Ghost gets one controlled retry. A second explicit failure stays recoverable and does not create HUMAN.
- A verified failed recovery clears only Ghost's own staged recovery draft so it cannot block later recovery after connectivity returns.
- HUMAN remains reserved for mixed/uncertain evidence, real assistant HUMAN markers, authentication failures, and other genuine operator decisions.


## v0.15.10 explicit web-error activation + BUSY detector alignment

- A visible classified web error is now surfaced independently of Ghost core RUNNING/PAUSED state. This fixes cases where ChatGPT shows a SEND_TIMEOUT banner while Ghost still says RUNNING and the Web Recovery panel incorrectly says no error.
- If a classified error is visible while ChatGPT still has genuine generation evidence, Web Recovery shows the error but does not act. Recovery begins only after generation evidence clears.
- Smart Watchdog global Stop detection is aligned with the core ChatGPT profile: exact `stop-button`, `Stop generating`, and `Stop streaming` controls only.
- Wildcard page-wide selectors such as `data-testid*=stop`, `aria-label*=stop`, and `title*=stop` are removed because they can match unrelated or stale controls and hold Watchdog BUSY indefinitely.
- Localized/generic Stop detection remains available only around the composer through the existing composer-local candidate logic.
- Ghost's own panel/watchdog controls are explicitly excluded from Stop detection.


## v0.15.11 timeout triage report

- Khi gặp timeout/lỗi web có thể khôi phục, Ghost không yêu cầu model tiếp tục công việc ngay.
- Ghost gửi đúng một lượt báo cáo trạng thái với header `[GHOST TIMEOUT TRIAGE REPORT]`.
- Báo cáo phân loại `TRẠNG THÁI` thành `TIẾP_TỤC`, `CẦN_NGƯỜI`, `ĐÃ_XONG`, hoặc `KHÔNG_CHẮC`, đồng thời ghi rõ `SIDE EFFECT CHƯA XÁC MINH: có|không`.
- `TIẾP_TỤC` + không có side effect chưa xác minh mới được map sang PROCEED; sau đó Ghost mới gửi continuation bình thường từ checkpoint.
- `CẦN_NGƯỜI`, `KHÔNG_CHẮC`, hoặc side effect chưa xác minh = có sẽ map sang HUMAN.
- `ĐÃ_XONG` map sang HALT.
- Nếu report và terminal marker mâu thuẫn, Ghost chọn HUMAN thay vì đoán.
- Draft của người dùng trong ô nhập chỉ làm recovery chờ; Ghost không ghi đè và không nâng HUMAN.
- Gate HUMAN cũ sinh bởi lỗi composer-draft trước đây được tự dọn bằng migration khớp đúng reason cũ; assistant HUMAN thật không bị ảnh hưởng.


## v0.15.12 timeout send evidence

- Sửa lỗi xác minh report timeout phụ thuộc vào nội dung còn nằm trong composer.
- Trước khi bấm gửi report, Web Recovery lưu ownership/fingerprint của chính report: source fault, fault key, prompt hash, thời điểm stage, số user/assistant turn và hash assistant hiện tại.
- Khi ChatGPT hiện SEND_TIMEOUT/CONNECTION_INTERRUPTED, report được coi là gửi thất bại rõ nếu: lỗi explicit vẫn hiện, ChatGPT không generating, turn counts không tăng, assistant text không đổi và recovery attempt là report do Ghost vừa stage.
- Composer có thể bị ChatGPT xóa ngay sau khi bấm gửi; việc đó không còn làm evidence mất hiệu lực.
- `Ghost RUNNING` không còn được tính là bằng chứng request đã được ChatGPT nhận. Chỉ generation thật hoặc turn mới của ChatGPT mới xác nhận send accepted.
- Nếu report thất bại rõ và composer đã trống, retry duy nhất sẽ restage đúng report đã lưu rồi gửi lại.
- Nếu người dùng đã nhập draft khác, Ghost chờ ô nhập trống, không ghi đè và không nâng HUMAN.
- Đồng thời sửa mismatch của v0.15.11: prompt hiện dùng `Lý do khôi phục`, còn detector cũ vẫn tìm `Recovery reason`.


## v0.15.13 timeout edge hardening

- Nút `Thử lại` chỉ còn là bằng chứng bổ sung, không còn là điều kiện bắt buộc để xác nhận recovery report gửi thất bại.
- Nếu banner lỗi chuyển giữa `SEND_TIMEOUT` và `CONNECTION_INTERRUPTED` trong cùng recovery attempt, Ghost vẫn dùng turn counts/generation/assistant hash/attempt ownership để xác minh outcome thay vì nhảy HUMAN chỉ vì loại banner đổi.
- Parser báo cáo timeout chấp nhận định dạng Markdown đơn giản như `**TRẠNG THÁI:**` và backtick/underscore.
- Nếu report có header timeout nhưng thiếu trường bắt buộc, core không còn tin riêng terminal marker PROCEED/HALT; trạng thái đó được khóa HUMAN thay vì tự tiếp tục.
- Mục tiêu là giữ nguyên nguyên tắc: network failure rõ ràng không tạo HUMAN giả, nhưng report không đủ thông tin cũng không được phép auto-continue.


## v0.15.14 triage underscore parser

- Sửa regression của v0.15.13: bước “bỏ Markdown” đã xóa toàn bộ dấu `_`, làm `TIẾP_TỤC` thành `TIẾPTỤC` và khiến report hợp lệ bị hiểu thành thiếu trường bắt buộc.
- Parser mới cho phép wrapper Markdown quanh nhãn/giá trị nhưng giữ nguyên underscore bên trong enum `TIẾP_TỤC`, `CẦN_NGƯỜI`, `ĐÃ_XONG`, `KHÔNG_CHẮC`.
- Thêm migration cực hẹp cho false HUMAN gate do chính bug v0.15.13 tạo: chỉ tự clear khi reason đúng lỗi cũ, assistant hash đúng report hiện tại, report là `TIẾP_TỤC`, side effect chưa xác minh = `không`, và terminal cuối là PROCEED.
- Sau khi clear false gate, Ghost tự Play lại nếu không BUSY và composer trống. HUMAN thật không bị ảnh hưởng.


## v0.15.15 false-gate hash hardening

- The v0.15.13 false-HUMAN migration now requires the persisted assistant hash to exist and exactly match the current timeout triage report before it can clear anything.
- A matching reason without a hash is fail-closed and remains HUMAN; this keeps the migration limited to gates actually created by the v0.15.13 parser regression path.
- Safe `TIẾP_TỤC` + `SIDE EFFECT CHƯA XÁC MINH: không` + final `PROCEED` is still required; real HUMAN gates are unaffected.


## v0.15.16 ChatGPT composer compatibility hardening

- Centralized ChatGPT composer discovery in the owned runtime so core Play, Web Recovery, Watchdog, Operator Gate, and Turn Budget no longer drift across independent selector lists.
- Added reviewed support for current role/data-testid/ProseMirror composer shapes while rejecting Ghost-owned UI, hidden/disabled nodes, sidebar/dialog decoys, and ambiguous equal-confidence candidates.
- Recovery and Resume staging now re-acquire the composer after framework reconciliation and require the complete normalized prompt on the same fresh node across two observations before proceeding.
- Web Recovery, Watchdog Recovery, and Operator Resume use an atomic require-empty guard so a user draft that appears during the staging race is never overwritten.
- Send authority is unchanged: this patch only repairs composer discovery/staging. At-most-once Send, uncertain-send hard stop, and no-blind-resend invariants remain intact.


## v0.15.17 ChatGPT turn-state compatibility hardening

- Centralizes ChatGPT conversation-turn discovery and generation-state detection in the owned runtime, alongside the v0.15.16 composer contract.
- Supports current `article[data-testid*="conversation-turn"]` turn containers plus legacy `data-message-author-role` / `data-author` role markers, nested role markers, and role-bearing accessibility/test ids.
- Preserves line boundaries in assistant text so terminal markers such as `[[GITL::PROCEED]]` remain parseable.
- Core Play, Smart Watchdog, Web Recovery, Operator Gate and Turn Budget now use the same shared turn/user/generation state.
- Active generation detection includes the current `#composer-submit-button[data-testid="stop-button"]` mode, semantic stop labels, and a narrowly scoped latest-turn thinking status fallback. It does not scan all page prose.
- When an existing chat is detected but no assistant turn can be resolved safely, Play now reports that compatibility state instead of incorrectly claiming there is no task.
- Send authority and uncertain-send invariants are unchanged: no blind resend/replay was added.


## v0.15.18 ChatGPT send-control readiness hardening

- Centralizes ChatGPT Send discovery/readiness in the owned runtime, completing the composer → turn/busy → send-control compatibility chain.
- Separates **rendered/found** from **enabled/ready** so a temporarily disabled React Send button is no longer misclassified as missing.
- Supports the current `#composer-submit-button` / `data-testid="send-button"` contract, exact Send/Submit labels, and a `button[type="submit"]` fallback scoped strictly to the active composer root.
- Core waits up to 10 seconds for ChatGPT's Send control to become ready after a verified staged write. This is a bounded readiness wait, not a resend/retry loop.
- Immediately before actuation, Ghost rechecks the staged composer text, generation state, Send identity, and enabled state. If any changed, it fails before clicking.
- ChatGPT actuation remains exactly one `.click()`. If that actuation occurs but acceptance cannot be confirmed, the existing uncertain-send hard stop remains in force and Ghost does not resend.
- Turn Budget now recognizes Send through the same shared runtime contract, so delayed/fallback Send controls receive the same budget injection behavior without broad page-wide button matching.


## v0.15.19 OpenAI September regression hardening

This release hardens Ghost against a cluster of recent ChatGPT Web state-sync and stream-resume failures rather than treating each visible symptom as an independent selector bug.

- Centralizes ChatGPT **activity state** alongside composer, turn and Send contracts.
  - Native Stop controls remain strong BUSY evidence.
  - Scoped status/live regions, `aria-busy`, progress indicators and tool/thinking nodes can provide inferred BUSY evidence when the UI loses its Stop control.
  - Ordinary assistant prose is never scanned as BUSY text.
- Adds a shared ChatGPT fault classifier for:
  - `STREAM_RESUME_UNAVAILABLE`
  - `MESSAGE_DELIVERY_TIMEOUT`
  - `CONNECTION_INTERRUPTED`
  - `SEND_TIMEOUT`
  - rate-limit/auth/network/generation faults.
- The exact `Resume stream unavailable` and delivery-timeout banners have a throttled visible-text fallback so unstructured ChatGPT banners are still detected without trusting hidden stale DOM.
- Supports `data-turn="user|assistant"` as an additional turn fallback; legacy `data-message-author-role` remains supported.
- A ready Send button is no longer sufficient if ChatGPT still exposes scoped tool/status activity.
- Core blocks a new send while a known stream-desync banner is active and ChatGPT is not clearly generating; Web Recovery owns the later reconciliation.
- ChatGPT post-click acceptance observation is extended to 45 seconds. This does not retry or resend.
- Web Recovery gives `Resume stream unavailable`, `Message delivery timed out`, and `Connection interrupted` a three-minute minimum quarantine and also requires 90 seconds with no turn/tool progress before issuing any new status probe.
- Fault identity is keyed by fault class rather than mutable banner/user/assistant text. A stale or re-rendered banner therefore stays one recovery episode while backend progress merely extends the quarantine instead of re-arming recovery.
- Only explicit `SEND_TIMEOUT` can qualify as evidence that a Ghost recovery Send definitely failed. Connection interruption, stream-resume failure and message-delivery timeout are no longer treated as proof that a request was not accepted.
- Existing uncertain-send behavior remains fail-closed: once an actuation occurred without acceptance proof, Ghost does not replay it.


## v0.15.20 run-scoped watchdog alerts

This release removes idle-tab Telegram spam from the BUSY watchdog.

- `STALL_WARNING` is legal only while the Ghost core on that exact tab is `RUNNING`.
- BUSY time accumulated before the operator presses Play is discarded for stall timing; entering RUNNING starts a fresh stall clock.
- A continuous stall episode emits at most one warning. New meaningful turn/tool/status progress re-arms one future warning; elapsed time alone cannot repeat the same alert every ten minutes.
- Watchdog stall events carry explicit run-scoped metadata (`runScoped`, `runId`, `ghostRunning`).
- Alert Router refuses unscoped STALL_WARNING desktop notifications.
- Telegram independently refuses STALL_WARNING without positive active-run evidence, purges legacy queued stall events, and drops queued stall alerts as soon as Ghost is no longer RUNNING, preventing an old outbox from replaying spam after upgrade or after a job finishes.
- COMPLETE remains a local desktop popup by default and is deduplicated with a six-hour same-page window. Telegram completion remains opt-in through the existing `complete` checkbox.
- HUMAN / RELAY / CONTEXT / AUTH / RECOVERY alerts are unchanged.


## v0.15.21 authoritative Stop / Send host control

This release makes the ChatGPT composer action control the primary execution-state contract used by Ghost.

- **Stop square = active ChatGPT turn.** Pressing Ghost Play/Continue adopts the running turn and monitors it; Ghost does not send another prompt.
- **Send arrow = idle/send-capable ChatGPT.** Ghost may stage/send only through the normal at-most-once path.
- **Unresolved control = fail closed.** Ghost waits up to 8 seconds for React/UI reconciliation; if the host still cannot be classified as Stop, BUSY, or Send, Play blocks instead of guessing.
- Adds a composer-local primary-action fallback for ChatGPT A/B variants where the arrow/Stop button loses the historical `data-testid` or aria label:
  - explicit `#composer-submit-button`, Send/Stop test ids and semantic labels remain highest confidence;
  - an unlabeled square SVG glyph is recognized as Stop;
  - an unlabeled composer-local arrow/action may be treated as Send only after Ghost has staged text and competing auxiliary controls have been filtered out.
- Inferred tool/status BUSY remains a safety layer. It can hold Send readiness while activity is present, but only an explicit/visual Stop control causes immediate adoption during the send-readiness wait.
- If ChatGPT flips from Send to Stop after Ghost stages text but before actuation, Ghost cancels its own exact staged draft, adopts the active turn, and performs no Send.
- Core Play/Continue, Smart Watchdog, Web Recovery, Operator Gate, Core Busy Gate, and Turn Budget all consume the same host-control resolver.
- Watchdog/Web Recovery re-check host control immediately before recovery actuation. If Stop/BUSY wins the race, their exact managed draft is cleared and no probe is sent.
- Recovery acceptance no longer treats `Ghost RUNNING` or BUSY alone as proof of Send. A fresh ChatGPT user turn is required; uncertain outcomes remain no-resend.

## v0.15.22 stream-fault host-state reconciliation

This release fixes the case where ChatGPT shows a terminal stream fault but stale activity text such as `Resuming...` leaves Ghost stuck at `RUNNING · Model working...`.

- **Explicit Stop remains authoritative.** If the real square Stop control exists, Ghost stays BUSY even when an old fault banner is still visible.
- `Resume stream unavailable` and `Message delivery timed out` suppress only **weak/stale BUSY evidence** when no Stop exists. They resolve as explicit `fault-idle`, not as active generation.
- A RUNNING Ghost that loses Stop and receives `Resume stream unavailable` releases the stale `Model working...` state on the next tick instead of remaining BUSY indefinitely.
- Core Play accepts `fault-idle` only as an idle classification; known stream-desync faults still block a fresh Core Send and remain owned by Web Recovery.
- Web Recovery may stage a new reconciliation probe from `fault-idle`, but must then observe a real READY Send control before actuation. If Send never becomes ready, the exact managed draft is cleared and no Send occurs.
- Smart Watchdog, Core Busy Gate, Operator Gate and Turn Budget all treat explicit `fault-idle` as non-generating, so stale Watchdog BUSY text cannot re-lock the system.
- The page-text fault fallback now excludes user/assistant conversation prose, Markdown/code, and composer text. Merely discussing the phrase `Resume stream unavailable` can no longer create a false stream fault.
- Browser fault-injection coverage includes Stop, ready Send, voice-only unresolved composer, stale `Resuming...`, stream-resume fault, delivery timeout, Send→Stop race, exact draft preservation, and RUNNING→fault transition.
