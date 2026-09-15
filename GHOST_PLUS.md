# Ghost in the Loop +

Personal fork overlay for ChatGPT Web.

## Use exactly one Tampermonkey script

Install `ghost-plus.user.js` and disable/delete the separately-installed upstream `Ghost in the Loop` userscript. The loader pulls the canonical Ghost runtime from this fork and then applies the Ghost+ companion in the same Tampermonkey execution unit.

## Added behavior

- Light, translucent Ghost panel theme.
- Collapse button that reduces the panel to a 46x46 ghost icon at the same top-right position; click the icon to restore.
- Liveness watchdog with Off / 3 / 5 / 10 / 15 / 25 minute thresholds. Default: 5 minutes.
- 30-second grace window after the silence threshold.
- Fail-closed recovery: auto-stop only when Ghost is RUNNING, the turn is silent past the threshold, Ghost is not UNCERTAIN, and exactly one reviewed ChatGPT Stop control is visible.
- After verified Stop, the companion does not send a continuation itself. Canonical Ghost handles protocol drift/re-grounding through its existing `sendOnce()` path, preserving at-most-once semantics.

## Safety

The companion never edits local files, calls shell commands, or accesses secrets. It does not blindly resend prompts. Ambiguous Stop/Send state remains fail-closed.

## Tampermonkey install

Open the raw `ghost-plus.user.js` file from this repository and install it with Tampermonkey. Keep only this Ghost+ loader enabled to avoid two independent Ghost controllers on the same ChatGPT page.
