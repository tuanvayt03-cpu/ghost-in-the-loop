# Research Ops — ChatGPT Web automation alternatives and Ghost stabilization
Date: 2026-10-10
Scope: ChatGPT-only Ghost, stop/send detection, turn completion, at-most-once delivery, recovery, and maintainable alternatives.

## Primary evidence
1. ChatGPT UI changes: https://gist.github.com/alexchexes/d2ff0b9137aa3ac9de8b0448138125ce (2026-09-26 changelog reports extensive markup rewrite).
2. Community login-only UI regressions: https://community.openai.com/t/multiple-chatgpt-web-regressions-after-recent-ui-changes-keyboard-navigation-and-print-to-pdf-broken/1401223 (2026-09-27).
3. Analogous ambiguous Send-action failure: https://github.com/miuuyy/codex-chatgpt-web/issues/302 (2026-09-03, Playwright send was located but .press timed out; deliberately no resend).
4. Current implementation examples: https://github.com/miuuyy/codex-chatgpt-web/blob/main/src/chatgpt-session.ts (modern [data-turn-key], [data-user-message-bubble], [data-conversation-role] and exact completion controls).
5. YOLO reliability contract: https://github.com/kartikkabadi/chatgpt-yolo/blob/main/docs/RELIABILITY_MODEL.md (durable per-conversation queue, exact matching user-message receipt, lease and explicit ambiguous delivery pause).
6. YOLO source / MIT license: https://github.com/kartikkabadi/chatgpt-yolo ; https://github.com/kartikkabadi/chatgpt-yolo/blob/main/LICENSE .
7. Simpler auto-click extension: https://github.com/dizzpy/ChatGPT-Auto-Continue and https://github.com/pedrohusky/chatgpt-continue-autoclicker .
8. Separate continuity/export manager: https://github.com/popvarachat/chatgpt-continuity-manager .

## Candidate decision
- **YOLO for ChatGPT**: closest functional substitute. Includes /goal and /loop, durable outbox, exact user-message receipt, per-conversation leases, guarded recovery and local-first Chrome extension. MIT permits forking with attribution. However latest checked upstream commit in local clone was 2026-07-18, before September DOM rewrite; it lacks Ghost Telegram/Watcher integration, has a different Chrome extension packaging model, and the checked Windows `npm run validate:core` did not fully pass (media asset validation tests). No reliable proof it works with the authenticated current ChatGPT UI. **Do not fork and immediately replace production Ghost.**
- **codex-chatgpt-web**: active source updated 2026-10-09 and relevant for modern ChatGPT DOM selectors/turn identity and Send uncertainty. MIT. It is a Codex bridge, not a drop-in Ghost replacement. Adapt the role-specific turn structure idea, keep no-resend semantics.
- **Auto Continue single-button clickers**: not adequate for multi-round autonomous task execution, approval gates, recovery, durable goals or no-duplicate guarantees.
- **Continuity Manager**: good checkpoint/backup pattern but not a task runner replacement.

## Root-cause findings in Ghost v0.15.27
- Core `confirmSend` used **generation-started**, **composer-cleared**, **user count advanced**, or **assistant-changed** as success. None ties a delivery receipt to the actual Ghost prompt. A concurrent manual send, an old response finishing, or DOM reset could lead to false confirmation and a duplicate continuation.
- Web Recovery accepted any user-count increase or changed-user-text as proof that its own status probe was delivered. Unrelated manual turns could clear the recovery attempt.
- Current ChatGPT Web renderer can group user and assistant messages under one `[data-turn-key]` parent. Ghost's original `article[data-testid*=conversation-turn]` and author-toolbar heuristics can miss or misclassify that pair.
- DOM is not a public API. No static selector-only patch can promise permanent compatibility.

## Implementation selection
Keep the existing Ghost front end, Telegram, Watchdog, and marker protocol. Use an isolated platform adapter under ghost-plus-runtime-manager.js:
- Read modern `[data-turn-key]` groups as ordered, role-specific user and assistant messages, suppressing overlapping legacy ancestors.
- Expose a canonical latest-user snapshot and an **exact normalized matching user-message receipt** predicate.
- Core Send only advances on a new matching user turn. Stop, composer clear, or unrelated assistant activity never count.
- Web Recovery uses the same receipt, never auto-confirms on unrelated chat changes.
- Missing pre-send snapshot remains fail-closed. Uncertain send is never automatically resent.
- Preserve legacy route tests and compatibility with older article/role markup.

## Safety / remaining certification
- Do not copy/redistribute YOLO files: only compare implementation contracts and independently implement ideas, so no upstream code changes are necessary.
- User drafts remain protected, no broker writes, no extra outbound telemetry or new host permissions.
- Live E2E against the user's authenticated ChatGPT tab is **not** covered by the isolated Chromium fixtures. Manual post-update smoke test is required.
- The inherited Firefox generated `extension/content.js` diverges from the current userscript; regeneration would replace ~7.5k legacy lines and can strip unbundled extension functionality. Keep it unchanged rather than taking a destructive, unreviewed compatibility migration. Create a separate packaging migration task.
- If live A/B DOM changes continue after this adapter, build a separate **YOLO-derived Chrome-extension prototype**, not an in-place production replacement, and reimplement Ghost integrations behind a single durable command channel before switching users.

## Acceptance matrix
1. ChatGPT Stop active => Ghost adopts, creates no new user message.
2. Send ready + staged text => one click; a new **matching** user turn confirms.
3. Send clicked, composer cleared, Stop visible but no matching user turn => UNKNOWN; no second Send.
4. Manual user turn with different text => does not acknowledge a Ghost Send or recovery probe.
5. Modern data-turn-key groups => correct assistant and user order; old assistant cannot impersonate a reply to a newer user turn.
6. Recovery and operator gates never infer acceptance from host BUSY alone.
7. Tab title/Telegram alert dedupe, legacy turn rendering, runtime cleanup remain passing.

This is a code-and-fixture decision, not a claim of production live certification.
