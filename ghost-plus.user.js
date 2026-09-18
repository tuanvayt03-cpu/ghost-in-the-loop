// ==UserScript==
// @name         Ghost in the Loop +
// @namespace    https://github.com/tuanvayt03-cpu/ghost-in-the-loop
// @version      9.0.0-alpha.2+ghostplus.14.1
// @description  Ghost in the Loop with persistent operator gate, Telegram critical alerts, uncertain-send reconciliation, busy-aware watchdog and context hard-stop.
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
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/3b6bbb8bae816434abe2d77acbe7bf4d3371259c/ghost-plus-alert-router.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/3b6bbb8bae816434abe2d77acbe7bf4d3371259c/ghost-plus-turn-budget-v2.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/3b6bbb8bae816434abe2d77acbe7bf4d3371259c/ghost-in-the-loop.user.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/3b6bbb8bae816434abe2d77acbe7bf4d3371259c/ghost-plus-operator-gate.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/3b6bbb8bae816434abe2d77acbe7bf4d3371259c/ghost-plus-uncertain-reconcile.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/3b6bbb8bae816434abe2d77acbe7bf4d3371259c/ghost-plus-telegram.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/3b6bbb8bae816434abe2d77acbe7bf4d3371259c/ghost-plus-companion-v2.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/3b6bbb8bae816434abe2d77acbe7bf4d3371259c/ghost-plus-core-busy-gate.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/3b6bbb8bae816434abe2d77acbe7bf4d3371259c/ghost-plus-context-boundary.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/3b6bbb8bae816434abe2d77acbe7bf4d3371259c/ghost-plus-web-recovery.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/3b6bbb8bae816434abe2d77acbe7bf4d3371259c/ghost-plus-ui-vi-safe.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/3b6bbb8bae816434abe2d77acbe7bf4d3371259c/ghost-plus-help.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/3b6bbb8bae816434abe2d77acbe7bf4d3371259c/ghost-plus-layout-fix.js
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
