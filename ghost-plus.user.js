// ==UserScript==
// @name         Ghost in the Loop +
// @namespace    https://github.com/tuanvayt03-cpu/ghost-in-the-loop
// @version      9.0.0-alpha.2+ghostplus.15.24
// @description  Ghost in the Loop with owned runtime lifecycle, persistent operator gate, Telegram alerts, busy-aware recovery and safe unload.
// @author       Michael S (CTRL-AI) + tuanvayt03-cpu
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/5dd22d72945372f12c756dbdb7a9d994b613c858/ghost-plus-runtime-manager.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/5dd22d72945372f12c756dbdb7a9d994b613c858/ghost-plus-alert-router.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/5dd22d72945372f12c756dbdb7a9d994b613c858/ghost-plus-telegram.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/5dd22d72945372f12c756dbdb7a9d994b613c858/ghost-plus-turn-budget-v2.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/5dd22d72945372f12c756dbdb7a9d994b613c858/ghost-in-the-loop.user.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/5dd22d72945372f12c756dbdb7a9d994b613c858/ghost-plus-operator-gate.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/5dd22d72945372f12c756dbdb7a9d994b613c858/ghost-plus-uncertain-reconcile.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/5dd22d72945372f12c756dbdb7a9d994b613c858/ghost-plus-companion-v2.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/5dd22d72945372f12c756dbdb7a9d994b613c858/ghost-plus-core-busy-gate.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/5dd22d72945372f12c756dbdb7a9d994b613c858/ghost-plus-context-boundary.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/5dd22d72945372f12c756dbdb7a9d994b613c858/ghost-plus-web-recovery.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/5dd22d72945372f12c756dbdb7a9d994b613c858/ghost-plus-ui-vi-safe.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/5dd22d72945372f12c756dbdb7a9d994b613c858/ghost-plus-help.js
// @require      https://raw.githubusercontent.com/tuanvayt03-cpu/ghost-in-the-loop/5dd22d72945372f12c756dbdb7a9d994b613c858/ghost-plus-layout-fix.js
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