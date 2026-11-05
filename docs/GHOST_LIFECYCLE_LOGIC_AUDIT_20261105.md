# GHOST+ | Tổng audit logic và sổ nợ sửa chữa

Ngày: 2026-11-05
Trạng thái: **AUDIT COMPLETE, REPAIR NOT STARTED, LIVE E2E NOT CERTIFIED**
Baseline GitHub `main`: `63e6b251bcb415f41008c0ba5a4ba2c3475c7650`
Loader `ghost-plus.user.js`: `9.0.0-alpha.2+ghostplus.15.34`; Runtime: `0.15.34`
Branch lưu audit: `audit/ghost-lifecycle-logic-20261105`

## 1. Phạm vi, evidence, hạn chế

Phạm vi: loader/runtime, Core protocol + Play/Stop/Send, ChatGPT host control, Operator Gate, Web Recovery, Watchdog/continuity lease, Turn Budget, Uncertain Reconcile, Context Boundary, trạng thái đa tab và release/tests.

- Ảnh người dùng **đang chạy 15.33**, hiện `PAUSED · HUMAN_REQUIRED` với lý do `Protocol drift repeated 2 times`, đồng thời ChatGPT đang suy nghĩ và Watchdog báo BUSY. Vì thế ảnh **không chứng minh 15.34 chạy live đã lỗi**, nhưng đường Core drift + generic gate này vẫn có trong baseline 15.34.
- Read-only code audit trên checkout sạch + `origin/main`; không thay đổi production logic.
- Máy đã chạy `npm run test:ghostplus-runtime` PASS (VM/static/scroll) và 36/36 Playwright Chromium case host-control + recovery PASS. Đây là fixture evidence, **không phải authenticated ChatGPT live certification**.
- `AGENTS.md` cấm dùng GitHub-hosted Actions khi có đường kiểm tra local tương đương. Không dispatch CI Actions.
- Tài liệu architecture `docs/CORE_PLUS_ACTIVATORS_ARCHITECTURE.md` cố ý quy định missing terminal -> reground -> human. Đây là **design-contract mismatch** với mục tiêu vận hành mới, không đơn thuần là code chạy sai đặc tả cũ.
- Repo có state và evidence lịch sử 8.8; không dùng `.gitl/autopilot-state.json` cũ làm baseline sản phẩm hiện hành. Không tìm thấy một chỉ mục RAG v2 hiện hành đáng tin cậy cho vòng sửa này; audit dùng source + tests + evidence hiện có.

Mức bằng chứng: **C** = đường code và symptom đã khớp; **R** = rủi ro tích hợp có đường code rõ, cần regression để xác nhận; **U** = chưa thể chứng nhận trên authenticated live DOM.

## 2. Sổ nợ bắt buộc

| ID | Ưu tiên | Bằng chứng | Vấn đề và kết quả cần đạt |
|---|---|---|---|
| G-01 | P0 · C | `ghost-in-the-loop.user.js:28,538-569` | `DRIFT_QUIET_MS=9000`; lần drift 1 reground, drift 2 + Cleanerz OFF chuyển `HUMAN_REQUIRED`. Thiếu marker không chứng minh cần người. Thay thành `SOFT_PROTOCOL_RECOVERY` bounded; chỉ escalates khi có blocker thật, không tự coi progress/waiting là human. |
| G-02 | P0 · C | `ghost-in-the-loop.user.js:274-284`; `ghost-plus-operator-gate.js:131,166-193,219` | Generic `humanBlock` không ghi provenance, baseline user/assistant, parent transaction; auto reconcile chỉ dành cho `WEB_SEND_UNCERTAIN`. User tự gửi `tiếp đi` rồi ChatGPT BUSY vẫn bị khóa. Thêm gate provenance + verified manual intervention/adopt, **không** tự clear AUTH, explicit HUMAN, context, unknown side effect. |
| G-03 | P0 · C | `ghost-plus-operator-gate.js:204-219` | `resume()` dọn persisted gate trước Send và coi status `RUNNING` hoặc user count tăng là đủ để báo Resume thành công. RUNNING được bật ngay khi Play bắt đầu, không phải Send receipt. Chuyển thành prepare → verified adopt/dispatch → commit gate; không phát thêm prompt khi user đã tiếp tục thủ công. |
| G-04 | P0 · R | `ghost-plus-turn-budget-v2.js:148-175`; `ghost-plus-runtime-manager.js:1038-1064`; `ghost-in-the-loop.user.js:423-492` | Turn Budget patch `HTMLButtonElement.prototype.click` và nối `[WEB TURN BUDGET]` vào composer ngay trước click, trong khi Core xác nhận theo `expectedText` chưa augment. Có đường dẫn đến Send thật nhưng receipt mismatch/UNCERTAIN. Cần một canonical wire-prompt được freeze **trước** Send và dùng chung cho actuation/receipt/cleanup. |
| G-05 | P0 · R | `ghost-plus-uncertain-reconcile.js:11-13` | Late-uncertain reconcile dùng terminal của latest assistant (PROCEED/HALT) rồi Stop/Play mà không ràng buộc assistant-turn id với uncertain Send transaction. Một marker cũ có thể bị nhận nhầm thành late acknowledgement. Bắt buộc receipt/turn identity + transaction provenance; không tự bấm Play từ marker lịch sử. |
| G-06 | P0 · R | `ghost-in-the-loop.user.js:91-99,423-492,638-645` | `S.sending/S.uncertain` chỉ là in-memory trong Core; reload có thể mất trạng thái `Send attempted / outcome unknown`. Kiểm toán durable one-shot transaction journal theo chat+turn, restore fail-closed và reconcile trước mọi gửi mới. Không replay/resend khi unknown. |
| G-07 | P1 · C | `ghost-plus-operator-gate.js:131,195-219`; `ghost-plus-companion-v2.js:695-733` | Core `stop()` bị gọi khi gate khóa và reset round/drift/continuity context, trong khi gate được lưu riêng. UI hiển thị PAUSED HUMAN đồng thời Host BUSY; hai trục có thể cùng đúng, nhưng hiện thiếu state bridge/adopt. Render độc lập `HOST={BUSY,IDLE,FAULT}` và `CONTROLLER={RUNNING,SOFT_RECOVERY,HARD_GATE,COMPLETE}`. |
| G-08 | P1 · C | `ghost-plus-companion-v2.js:15-30,150-154,596-620`; `ghost-in-the-loop.user.js:35,114-116`; `ghost-plus-turn-budget-v2.js:10-13` | Continuity lease `ghostplus.continuityLeaseStartedAt` và Turn Budget `ghostplus.turnStartedAt` là GM keys không scope theo chat. Nhiều tab có thể reset/đụng timer nhau. Namespace per chat/session, migration có kiểm soát. |
| G-09 | P1 · R | `ghost-in-the-loop.user.js:490,550-557` | `awaitingFrom` dùng hash **nội dung** assistant để phát hiện turn mới. Hai câu trả lời kế tiếp trùng nội dung có thể đứng `Waiting for the next answer` dù turn-id/count tăng. So identity/count + fingerprint của turn; hash text chỉ là witness phụ. |
| G-10 | P1 · R | `ghost-plus-web-recovery.js:86-92,268-308` | 15.34 dùng `coreRound()` parse từ chữ `#gitl9 .status` làm acceptance cho Web Recovery. Round tăng có thể là giao dịch Core khác, không nhất thiết đúng probe đang chờ; còn status UI có thể bị gate ghi đè. Dùng explicit confirmed send receipt `txnId`/origin thay vì parse text hiển thị. |
| G-11 | P1 · C | Core `sendOnce`; Watchdog `recover`; Web Recovery `sendRecoveryProbe`; Operator `resume`; Uncertain Reconcile `run`; Turn Budget click patch | Nhiều module có quyền stage/click/Stop/restart và tự giữ receipt. Thiếu một owner transaction/send duy nhất cho toàn lifecycle. Cần **one dispatch controller**, các sidecar chỉ gửi intent; không đại tu toàn bộ UI. |
| G-12 | P1 · C | `ghost-in-the-loop.user.js:222-258,543-570`; `docs/CORE_PLUS_ACTIVATORS_ARCHITECTURE.md:50-62` | Terminal parser chỉ hiểu exact final line. Assistant có thể trả progress/waiting hoàn chỉnh mà thiếu marker. Đừng semantic-guess side effect; phân biệt `host still generating`, `assistant completed/no marker`, `external work pending only by corroborated evidence`, `explicit HUMAN`. Soft recovery bounded, sau đó trạng thái `PROTOCOL_BLOCKED` chuyên biệt thay vì giả `HUMAN`. |
| G-13 | P2 · C | `ghost-plus-operator-gate.js:204-219`; `ghost-plus-companion-v2.js:679-733` | UI dùng từ `Stop` cho Ghost controller trong khi ChatGPT có nút Stop native; `PAUSED`, `BUSY`, `HUMAN_REQUIRED` trộn state và lý do. Đổi nhãn `Dừng Ghost` / `ChatGPT đang thực thi` và thêm provenance + action `Adopt turn` khi đủ evidence. |
| G-14 | P2 · C/U | `tests/e2e/ghostplus-recovery-reconcile.spec.js`, `tests/e2e/ghostplus-host-control-fault-matrix.spec.js`, `tests/runtime-lifecycle-static.mjs`; `package.json`; `ghost-plus.user.js` | Fixture suites hiện xanh nhưng không có tổ hợp repeated drift → generic HUMAN → manual user-turn → BUSY → adopt, không có full Core+TurnBudget interposer receipt, cross-tab lease và reload-during-uncertain. Package vẫn 8.8.5 trong khi userscript v9 alpha + runtime 15.34; Firefox legacy migration riêng. Cần compatibility/certification suite + version authority/release gates. |

### Các hành vi **đúng, không được làm hỏng**

1. BUSY thật của ChatGPT không bị Stop/Send tự động. Watchdog chỉ cảnh báo stale BUSY, không cắt tool call.
2. 25 phút continuity lease là upper-bound/trigger phụ, **không phải** bắt buộc đợi 25 phút. Watchdog 5 phút và Turn Budget 20 phút là các timer có mục đích khác nhau.
3. Chỉ user-turn receipt phù hợp mới commit Send; Stop, BUSY, composer cleared, assistant changed **không** tự xác nhận Send.
4. Genuine explicit HUMAN / AUTH / CONTEXT_BOUNDARY / unknown side effect phải tiếp tục fail-closed.
5. Một human manual `tiếp đi` không tự chứng minh một Send uncertain trước đó thành công. Chỉ gate thuộc provenance `CORE_PROTOCOL_DRIFT` đã được phân loại soft và manual intervention được xác thực mới có thể adopt mà không Send.

## 3. Thiết kế sửa tối ưu, giữ lean

**Quyết định kiến trúc:** Không thay toàn bộ Ghost. Dùng `ghost-plus-runtime-manager.js` làm host observer + Send/receipt primitive duy nhất. Core giữ quyền parse terminal + route next intent. Operator Gate giữ policy và persisted hard gate, nhưng **không trực tiếp actuation**. Watchdog/Web Recovery/Turn Budget/Uncertain Reconcile trở thành intent producers, không tự sở hữu Send truth.

- Dữ liệu tối thiểu per chat/turn: `hostState`, `controllerState`, `intentId`, `origin`, `sendTxnId`, `expectedWirePromptHash`, `beforeUserTurnId`, `attemptedAt`, `confirmedReceipt`, `gateProvenance`. Không ghi prompt/secret đầy đủ vào log.
- Lifecycle: `OBSERVE → DECIDE_INTENT → PREPARE_WIRE_PROMPT → VALIDATE_SEND_AUTHORITY → SINGLE_ACTUATION → VERIFY_TURN_RECEIPT → COMMIT`. `UNKNOWN` là trạng thái khóa không replay.
- Protocol missing marker: tối đa một soft reground theo turn identity, sau đó một `PROTOCOL_BLOCKED` không tự xưng cần người; nếu backend đang BUSY thì chỉ quan sát. Khi hết vòng chờ mà không có evidence, cần trạng thái lỗi rõ ràng và lựa chọn manual, không loop vô hạn.
- Manual intervention: user-turn mới phải được chứng thực là sau gate + đúng chat. Nếu `CORE_PROTOCOL_DRIFT` và host BUSY, **adopt without Send**. Với hard/unknown gate, chỉ cho manual review tương ứng.
- UI render từ projection của hai trục trạng thái, không viết `innerHTML` trạng thái giả rồi dùng lại chính chữ trên UI làm authoritative state.

## 4. DAG triển khai và acceptance gates

| Node | Phụ thuộc | Công việc | Gate bắt buộc |
|---|---|---|---|
| A0 | baseline | Snapshot/pin và source-of-truth tests, thêm failing fixtures cho G-01…G-06 | Test phải RED trên baseline ở các bug được xác nhận |
| A1 | A0 | Transaction ledger + single Send authority + wire prompt freeze | No duplicate; no premature ACK; reload preserves UNCERTAIN |
| A2 | A1 | Fix Core drift policy/turn identity + soft protocol state | Missing marker không tự thành HUMAN; explicit HUMAN vẫn hard |
| A3 | A1,A2 | Gate provenance, manual adopt, transactionally safe Resume | Manual `tiếp đi` adopt 0 Send; AUTH/UNKNOWN không unlock |
| A4 | A1 | Migrate Turn Budget click interposer + Web Recovery/Watchdog/Uncertain intents | One writer/single actuation, exact receipt, no replay |
| A5 | A2,A3,A4 | Per-chat timers + UI 2-axis projection | Multi-tab isolation, BUSY/gate labels accurate |
| A6 | A5 | Full matrix CI local: protocol, send/receipt, reload, multi-tab, fault, visual | Fresh PASS after final changes; never weaken tests |
| A7 | A6 | Authenticated disposable-chat canary + Tampermonkey metadata/version pins | Live evidence, explicit human check if DOM carrier unavailable |
| A8 | A7 | PR review, controlled promotion, fresh main baseline, handoff | Only promote if gates PASS |

Critical path: **A0 → A1 → A2/A3 → A5 → A6 → A7 → A8**. A4 triển khai song song với A2/A3 nếu branch/worktree không cùng mutable state; **một primary integrator**.

Các case test ưu tiên:
- ChatGPT đang suy nghĩ, no native Stop nhưng có turn mutation → BUSY; không Stop.
- Output kết thúc thiếu marker hai lần → không generic HUMAN.
- USER gửi `tiếp đi` sau soft gate → adopt current BUSY, không tạo prompt mới.
- USER gửi bất kỳ text nào sau AUTH/UNKNOWN → gate không tự clear.
- Core Send + Turn Budget active → expected wire prompt và receipt khớp thật.
- Reload/tab crash ở pre-actuation, post-attempt-unknown, post-receipt → at-most-once.
- Two tabs khác chat → lease, budget, gate không ảnh hưởng nhau.
- Old assistant marker `PROCEED` trước uncertain Send → không được coi là late receipt.
- Web Recovery round do source khác tăng → không nhận nhầm probe.
- Original Firefox extension/legacy suite không được tuyên bố green bằng việc bỏ qua guard.

## 5. Release / vận hành

- Ảnh người dùng hiện `v0.15.33`; GitHub `main` là `15.34`. Bản 15.34 chỉ sửa Web Recovery false-HUMAN, **không** sửa Core drift/manual-gate backlog này.
- Không tự clear gate persisted hiện tại bằng script; vì chưa phân biệt chắc chắn source/uncertain side effect. Khi ChatGPT còn BUSY, không gửi Resume prompt.
- Không sửa `main`, không release, không kích GitHub-hosted Actions trong vòng audit. Branch audit chỉ là tài liệu.
- Do authenticated ChatGPT DOM chưa có carrier hợp lệ trong phiên này, verdict hiện tại: **SOURCE AUDIT COMPLETE / PRODUCT LIFECYCLE NOT CERTIFIED**.

## 6. Handoff

Baseline: `main@63e6b251`. Chủ sở hữu sửa sau này: một primary CodeLocal integrator. Những việc có thể chạy ngay: A0 fixtures + A1 canonical receipt/intent thiết kế. Không cần hỏi lại plan cho từng node nếu người dùng đã phê duyệt thực thi. Không tự merge khi thiếu live evidence. Giữ `BROKER_UNKNOWN`/unknown side-effect fail-closed.

## 7. Implementation checkpoint — Ghost+ 15.35 (2026-11-05)

This section updates the *audit baseline* above; earlier "OPEN" entries document the state at audit time. The implementation was performed on `fix/ghost-lifecycle-controller-20261105`, not on `main` until separately promoted.

| Debt | Source/fixture outcome on branch |
|---|---|
| G-01, G-12 | Repeated missing terminal enters `PROTOCOL_WAIT` rather than fabricated `HUMAN_REQUIRED`; no blind replay. A later manual user turn can be adopted without Send. |
| G-02, G-03 | Legacy drift gate can be explicitly adopted when host BUSY. New drift gates capture a user baseline. Resume keeps the persisted gate until Core confirms matching Send receipt. |
| G-04, G-11 | Turn Budget no longer monkeypatches Send click. Core freezes a single wire prompt before actuation and owns acknowledgement. Web Recovery/Watchdog submit intent via Core Play. |
| G-05, G-06 | Uncertain reconcile requires matching durable Core transaction plus a new assistant turn; ATTEMPTED/UNKNOWN journal survives same-tab reload and suppresses replay. |
| G-07, G-13 | Gate panel shows Controller and Host states independently, with explicit "Dừng Ghost" label. |
| G-08 | Continuity lease and Turn Budget start times use scoped per-tab/per-chat session storage. |
| G-09 | Assistant turn count is paired with response hash to distinguish identical consecutive outputs. |
| G-10 | Web Recovery receipt must match a unique `GHOST-RECOVERY-ID` from the confirmed Core journal, not the UI round label. |
| G-14 | New integration tests cover the above cases; current Ghost+ fixture gate passes. Legacy 8.8 Firefox migration and authenticated live certification **remain separate OPEN debt**. |

### Evidence and remaining limitations

- Source checkpoint: `c1ec9ce36fe07ea027541fa45439b68826e4f0cd`.
- Loader: `9.0.0-alpha.2+ghostplus.15.35`, runtime `0.15.35`, seven modified modules pinned to the source checkpoint.
- Fresh final loader QA: Composer contract **48/48 PASS**; current Ghost+ Chromium **59/59 PASS**; runtime VM/static/scroll **PASS**; lint **PASS**.
- Explicitly **not** certified: authenticated real ChatGPT DOM/Send canary, fresh-tab recovery of a new-chat `/` uncertain Send when the browser discards session state, Firefox v8 extension migration and older non-current-stack harnesses.
- No `BROKER_UNKNOWN`, AUTH, explicit HUMAN or unknown side-effect gate was bypassed. No production ChatGPT message was sent in automated testing.
- This is **code/fixture complete**, not live-certified. Merge/promotion decisions and fresh post-merge baseline belong in the release checkpoint.
