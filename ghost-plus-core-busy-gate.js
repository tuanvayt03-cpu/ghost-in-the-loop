(() => {
'use strict';
const RT=window.__ghostPlusRuntime?.module('core-busy-gate');if(!RT)return;
if (window.__GHOST_PLUS_CORE_BUSY_GATE__) return;
window.__GHOST_PLUS_CORE_BUSY_GATE__ = true;
if (!/^(chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname)) return;

const SENTINEL_ID = 'ghostplus-core-busy-sentinel';
const q = (s, r = document) => r.querySelector(s);
const qa = (s, r = document) => [...r.querySelectorAll(s)];
const norm = v => String(v || '').replace(/\s+/g, ' ').trim();
const visible = el => !!el && el.isConnected && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
const PENDING_RE = /(đang\s+(suy nghĩ|truy vấn|tìm|phân tích|xử lý|tải|chạy|gọi|thực thi|duyệt))|\b(thinking|searching|querying|analyzing|processing|working|running|retrieving|calling\s+(a\s+)?tool|using\s+(a\s+)?tool|browsing|fetching)\b/i;

function ghostNeedsGuard() {
  const status = norm(q('#gitl9 .status')?.innerText || '');
  return /^RUNNING\b/i.test(status) || (/^PAUSED\b/i.test(status) && /UNCERTAIN/i.test(status));
}
function nativeCoreStopVisible() {
  const selectors = [
    'button[data-testid="stop-button"]:not([data-ghostplus-sentinel])',
    'button[aria-label="Stop generating"]:not([data-ghostplus-sentinel])',
    'button[aria-label="Stop streaming"]:not([data-ghostplus-sentinel])'
  ];
  for (const sel of selectors) {
    let nodes = [];
    try { nodes = qa(sel); } catch (_) {}
    if (nodes.some(visible)) return true;
  }
  return false;
}
function pendingUiVisible() {
  const selectors = [
    '[role="status"]', '[aria-live="polite"]', '[aria-live="assertive"]',
    '[data-testid*="status" i]', '[data-testid*="thinking" i]', '[data-testid*="loading" i]'
  ];
  for (const sel of selectors) {
    let nodes = [];
    try { nodes = qa(sel); } catch (_) {}
    for (const el of nodes) {
      if (!visible(el)) continue;
      const t = norm(el.innerText || el.textContent || '');
      if (t && t.length <= 260 && PENDING_RE.test(t)) return true;
    }
  }
  const last = qa('[data-message-author-role="assistant"]').filter(el => el.isConnected).pop();
  if (last) {
    let nodes = [];
    try { nodes = qa('[role="status"],[aria-live],[data-testid*="tool" i],[data-testid*="status" i],details', last); } catch (_) {}
    for (const el of nodes) {
      if (!visible(el)) continue;
      const t = norm(el.innerText || el.textContent || '');
      if (t && t.length <= 260 && PENDING_RE.test(t)) return true;
    }
  }
  return false;
}
function ariaBusyVisible() {
  const sels = ['main [aria-busy="true"]','form [aria-busy="true"]','[data-message-author-role="assistant"] [aria-busy="true"]'];
  for (const sel of sels) {
    let nodes = [];
    try { nodes = qa(sel); } catch (_) {}
    if (nodes.some(visible)) return true;
  }
  return false;
}
function progressVisible() {
  const sels = ['main [role="progressbar"]','main [data-testid*="spinner" i]','main [class*="animate-spin" i]'];
  for (const sel of sels) {
    let nodes = [];
    try { nodes = qa(sel); } catch (_) {}
    if (nodes.some(visible)) return true;
  }
  return false;
}
function inferredBusy() {
  return pendingUiVisible() || ariaBusyVisible() || progressVisible();
}
function ensureSentinel() {
  let el = q(`#${SENTINEL_ID}`);
  if (el) return el;
  el = document.createElement('button');
  el.id = SENTINEL_ID;
  el.type = 'button';
  el.setAttribute('data-ghostplus-sentinel', 'true');
  el.setAttribute('aria-label', 'Stop streaming');
  el.setAttribute('aria-hidden', 'true');
  el.tabIndex = -1;
  el.style.cssText = 'position:fixed!important;left:-10000px!important;top:0!important;width:1px!important;height:1px!important;min-width:1px!important;min-height:1px!important;opacity:0!important;pointer-events:none!important;padding:0!important;border:0!important;z-index:-1!important;';
  (document.body || document.documentElement).appendChild(el);
  return el;
}
function removeSentinel() {
  q(`#${SENTINEL_ID}`)?.remove();
}
function tick() {
  if (!ghostNeedsGuard()) { removeSentinel(); return; }
  if (nativeCoreStopVisible()) { removeSentinel(); return; }
  if (inferredBusy()) ensureSentinel();
  else removeSentinel();
}

RT.interval(tick,500);RT.cleanup(removeSentinel);
tick();
})();