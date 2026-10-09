// ==UserScript==
// @name         Ghost in the Loop +
// @namespace    https://github.com/tuanvayt03-cpu/ghost-in-the-loop
// @version      9.0.0-alpha.2+ghostplus.15.26
// @description  Ghost in the Loop with owned runtime lifecycle, persistent operator gate, Telegram alerts, busy-aware recovery and safe unload.
// @author       Michael S (CTRL-AI) + tuanvayt03-cpu
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/4a9d03e3abd777e5a0742974839457bc5f0707fb/ghost-plus-runtime-manager.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/4a9d03e3abd777e5a0742974839457bc5f0707fb/ghost-plus-alert-router.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/4a9d03e3abd777e5a0742974839457bc5f0707fb/ghost-plus-telegram.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/4a9d03e3abd777e5a0742974839457bc5f0707fb/ghost-plus-turn-budget-v2.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/4a9d03e3abd777e5a0742974839457bc5f0707fb/ghost-in-the-loop.user.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/4a9d03e3abd777e5a0742974839457bc5f0707fb/ghost-plus-operator-gate.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/4a9d03e3abd777e5a0742974839457bc5f0707fb/ghost-plus-uncertain-reconcile.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/4a9d03e3abd777e5a0742974839457bc5f0707fb/ghost-plus-companion-v2.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/4a9d03e3abd777e5a0742974839457bc5f0707fb/ghost-plus-core-busy-gate.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/4a9d03e3abd777e5a0742974839457bc5f0707fb/ghost-plus-context-boundary.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/4a9d03e3abd777e5a0742974839457bc5f0707fb/ghost-plus-web-recovery.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/4a9d03e3abd777e5a0742974839457bc5f0707fb/ghost-plus-ui-vi-safe.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/4a9d03e3abd777e5a0742974839457bc5f0707fb/ghost-plus-help.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/4a9d03e3abd777e5a0742974839457bc5f0707fb/ghost-plus-layout-fix.js
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