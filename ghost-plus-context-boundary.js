(() => {
'use strict';
if (window.__GHOST_PLUS_CONTEXT_BOUNDARY__) return;
window.__GHOST_PLUS_CONTEXT_BOUNDARY__ = true;
if (!/^(chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname)) return;

const q = (s, r = document) => r.querySelector(s);
const qa = (s, r = document) => [...r.querySelectorAll(s)];
const norm = value => String(value || '').replace(/\s+/g, ' ').trim();
const visible = el => !!el && el.isConnected && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
let lastEpisode = '';

function hash(value) {
  const s = String(value || ''); let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${s.length}:${(h >>> 0).toString(16)}`;
}
function candidateTexts() {
  const out = [], seen = new Set();
  const add = value => {
    const t = norm(value);
    if (!t || t.length > 1000 || seen.has(t)) return;
    seen.add(t); out.push(t);
  };
  const selectors = [
    '[role="alert"]',
    '[aria-live="assertive"]',
    '[data-testid*="error" i]',
    '[data-testid*="toast" i]',
    '[class*="error" i]'
  ];
  for (const sel of selectors) {
    let nodes = [];
    try { nodes = qa(sel); } catch (_) {}
    for (const el of nodes) if (visible(el)) add(el.innerText || el.textContent || '');
  }
  return out;
}
function isContextTooLong(text) {
  const t = norm(text).toLowerCase();
  if (!t) return false;
  return /conversation (is|has become|has gotten) too long|conversation has reached (its|the) maximum length|reached the maximum length for this conversation|maximum conversation length|start a new chat to continue|start a new conversation to continue|context length exceeded|maximum context length/.test(t)
    || /cuộc trò chuyện.{0,40}(quá dài|độ dài tối đa|giới hạn độ dài)|đoạn chat.{0,40}(quá dài|độ dài tối đa|giới hạn độ dài)|đã đạt.{0,30}độ dài tối đa|hãy bắt đầu.{0,30}(đoạn chat|cuộc trò chuyện) mới|bắt đầu.{0,30}(đoạn chat|cuộc trò chuyện) mới.{0,30}tiếp tục/.test(t);
}
function findBoundary() {
  for (const text of candidateTexts()) if (isContextTooLong(text)) return text;
  return '';
}
function ensureUi(text = '') {
  const host = q('#ghostplus-watch');
  if (!host) return;
  let row = q('#ghostplus-context-boundary-state', host);
  if (!row) {
    row = document.createElement('div');
    row.id = 'ghostplus-context-boundary-state';
    row.style.cssText = 'margin-top:5px;padding-top:5px;border-top:1px solid rgba(239,68,68,.25);font-size:10px;line-height:1.35;color:#991b1b';
    host.appendChild(row);
  }
  row.innerHTML = text
    ? '<b>Giới hạn context:</b> ĐÃ CHẠM · Ghost đã dừng. Cần chuyển sang chat mới thủ công.'
    : '';
  row.title = text || '';
}
function stopGhostForBoundary(text) {
  const key = `${location.pathname}|${hash(text)}`;
  if (key === lastEpisode) return;
  lastEpisode = key;

  const ghostStop = q('#gitl9 [data-a="stop"]');
  try { if (visible(ghostStop)) ghostStop.click(); } catch (_) {}

  try {
    GM_setValue('ghostplus.contextBoundaryAt', Date.now());
    GM_setValue('ghostplus.contextBoundaryPath', location.pathname);
  } catch (_) {}

  ensureUi(text);
  try {
    GM_notification?.({
      title: 'Ghost+ · đoạn chat quá dài',
      text: 'Ghost đã STOP. Không retry/recovery trong chat này. Cần mở chat mới và handoff thủ công.',
      timeout: 12000
    });
  } catch (_) {}
}
function sample() {
  const text = findBoundary();
  if (text) stopGhostForBoundary(text);
  else if (lastEpisode && !candidateTexts().some(isContextTooLong)) {
    // Keep the hard-boundary UI sticky for this page; only a new conversation/path clears the episode.
    const storedPath = String(GM_getValue('ghostplus.contextBoundaryPath', '') || '');
    if (storedPath && storedPath !== location.pathname) {
      lastEpisode = '';
      const row = q('#ghostplus-context-boundary-state');
      if (row) row.remove();
    }
  }
}

setInterval(sample, 500);
sample();
})();