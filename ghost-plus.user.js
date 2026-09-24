// ==UserScript==
// @name         Ghost in the Loop +
// @namespace    https://github.com/tuanvayt03-cpu/ghost-in-the-loop
// @version      9.0.0-alpha.2+ghostplus.15.14
// @description  Ghost in the Loop with owned runtime lifecycle, persistent operator gate, Telegram alerts, busy-aware recovery and safe unload.
// @author       Michael S (CTRL-AI) + tuanvayt03-cpu
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @match        https://www.perplexity.ai/*
// @match        https://gemini.google.com/*
// @match        https://claude.ai/*
// @match        https://grok.com/*
// @match        https://chat.deepseek.com/*
// @match        https://copilot.microsoft.com/*
// @match        https://chat.mistral.ai/*
// @match        https://kimi.com/*
// @match        https://www.kimi.com/*
// @match        https://chat.qwen.ai/*
// @match        https://poe.com/*
// @match        https://duck.ai/*
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/354bd8516690a521aec6823d8f588f6e7b39f46d/ghost-plus-runtime-manager.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/354bd8516690a521aec6823d8f588f6e7b39f46d/ghost-plus-alert-router.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/354bd8516690a521aec6823d8f588f6e7b39f46d/ghost-plus-telegram.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/354bd8516690a521aec6823d8f588f6e7b39f46d/ghost-plus-turn-budget-v2.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/354bd8516690a521aec6823d8f588f6e7b39f46d/ghost-in-the-loop.user.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/354bd8516690a521aec6823d8f588f6e7b39f46d/ghost-plus-operator-gate.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/354bd8516690a521aec6823d8f588f6e7b39f46d/ghost-plus-uncertain-reconcile.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/354bd8516690a521aec6823d8f588f6e7b39f46d/ghost-plus-companion-v2.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/354bd8516690a521aec6823d8f588f6e7b39f46d/ghost-plus-core-busy-gate.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/354bd8516690a521aec6823d8f588f6e7b39f46d/ghost-plus-context-boundary.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/354bd8516690a521aec6823d8f588f6e7b39f46d/ghost-plus-web-recovery.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/354bd8516690a521aec6823d8f588f6e7b39f46d/ghost-plus-ui-vi-safe.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/354bd8516690a521aec6823d8f588f6e7b39f46d/ghost-plus-help.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/354bd8516690a521aec6823d8f588f6e7b39f46d/ghost-plus-layout-fix.js
// @updateURL    https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/main/ghost-plus.user.js
// @downloadURL  https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/main/ghost-plus.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @connect      api.telegram.org
// @run-at       document-idle
// @noframes
// @license      AGPL-3.0
// ==/UserScript==

// Runtime is supplied by the immutable project files above.
