# Ghost+ v0.14 canary — Operator Gate + Telegram

Canary branch only; main remains unchanged.

Safety invariants:
- HUMAN and MODEL RELAY are persistent per-chat operator gates.
- Gate blocks every Ghost Play click, including programmatic recovery clicks.
- Auto-staged WEB/WATCHDOG recovery probes are cleared while a gate is active.
- Only trusted user clicks on Resume/Stop resolve the gate.
- Late PROCEED/HALT after PLAY-SEND-UNCERTAIN is reconciled before a redundant recovery probe.
- Telegram is notification-only: failures never clear a gate or resume Ghost.
- Runtime Telegram traffic is sendMessage only. getUpdates is used only during an explicit 60-second Bind group flow.
- Existing Telegram webhooks are never deleted.
- Bot token is stored in Tampermonkey values only; no token is committed or placed in prompts.

Telegram setup:
1. Expand Telegram in the Ghost+ watchdog panel.
2. Paste BotFather token, Save, then Check bot.
3. Prefer Bind group; send the displayed /ghost_bind CODE in the target group.
4. Or enter numeric chat_id / @username manually. Invite links are rejected.
5. Test sends one Ghost+ test message.

Push defaults: HUMAN, Relay, context boundary, auth error, recovery exhausted and rate limit. Stall is optional/on; COMPLETE optional/off; reason text optional/off. HUMAN reminders are bounded to +15m and +60m while the page is open.

Canary checks: normal PROCEED once; HUMAN hard pause; reload persistence; trusted Resume once; uncertain→late HUMAN no probe; uncertain→late PROCEED no duplicate probe; network error while HUMAN locked sends nothing; invalid Telegram token cannot affect Ghost state; webhook bind refuses safely.

No GitHub-hosted Actions are used.


Final runtime hardening:
- AUTH_ERROR is a persistent Operator Gate, not an auto-recovery path.
- Recovery-budget exhaustion is a persistent Operator Gate; trusted Resume resets only that recovery episode before continuing.
- Context boundary locks the gate directly; it no longer relies only on the gate polling the UI marker.
- Telegram ignores legacy notification echoes, preventing duplicate remote pushes when a structured event already exists.
- HUMAN reminder delivery is recorded only after Telegram confirms send success.
