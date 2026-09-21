# Ghost+ v0.15 runtime lifecycle regression test

Run this after upgrading from v0.14.x. Refresh the tab once before the first v0.15 test.

1. Confirm the panel shows `runtime G<n> · resources <count>`.
2. Leave Ghost running through a long streaming/tool turn. Scroll up/down repeatedly, select/copy text and use ChatGPT's jump-to-bottom control.
3. Change conversations several times and repeat step 2.
4. Exercise Telegram Test, a HUMAN gate, collapse/restore, Turn Budget and one recovery path.
5. In DevTools run `window.__ghostPlusRuntime.diagnostics()`; verify only the expected active module resources exist and there is a single generation.
6. Click **Gỡ khỏi tab**.
7. Verify Ghost panel, mini/collapse/watch UI and sentinel are gone. Wheel, selection/copy and ChatGPT jump-to-bottom must continue working.
8. Run `JSON.parse(document.documentElement.dataset.ghostplusLastDiagnostics)`. It must report `allZero: true` and every total resource count must be `0`.
9. With the userscript still enabled, refresh once. A new generation should boot. Resource counts must return to the normal baseline, not grow relative to the previous boot.
10. Repeat unload + refresh three times. No generation may leave live intervals, listeners, requests, patches or Ghost DOM behind.

Static guard: `node tests/runtime-lifecycle-static.mjs`.
