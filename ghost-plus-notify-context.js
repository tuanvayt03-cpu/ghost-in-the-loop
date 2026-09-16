(() => {
'use strict';
if (window.__GHOST_PLUS_NOTIFY_CONTEXT_V2__) return;
window.__GHOST_PLUS_NOTIFY_CONTEXT_V2__ = true;

const rawNotify = typeof GM_notification === 'function' ? GM_notification : null;
if (!rawNotify) return;

const norm = value => String(value || '').replace(/\s+/g, ' ').trim();
const now = () => Date.now();
const CACHE_PREFIX = 'ghostplus.chatName.';
const exactSeen = new Map();
let lastAnyAt = 0;
let lastAnyKey = '';

function pathKey() {
  return String(location.pathname || '/').split(/[?#]/)[0];
}

function cleanTitle(value) {
  let t = norm(value);
  t = t.replace(/\s*[-|·]\s*ChatGPT\s*$/i, '')
       .replace(/^ChatGPT\s*[-|·]\s*/i, '')
       .replace(/^ChatGPT$/i, '');
  return t.slice(0, 72);
}

function candidateConversationLinks() {
  const path = pathKey();
  const id = path.match(/\/c\/([^/]+)/i)?.[1] || '';
  const links = [...document.querySelectorAll('a[href]')];
  const exact = [];
  const byId = [];
  for (const a of links) {
    const href = String(a.getAttribute('href') || '').split(/[?#]/)[0];
    if (!href) continue;
    if (href === path || href === `${path}/` || `${href}/` === path) exact.push(a);
    else if (id && href.includes(`/c/${id}`)) byId.push(a);
  }
  return exact.length ? exact : byId;
}

function labelFromLink(a) {
  if (!a) return '';
  const candidates = [
    a.getAttribute('title'),
    a.getAttribute('aria-label'),
    a.innerText,
    a.textContent,
    a.querySelector('[title]')?.getAttribute('title'),
    a.querySelector('span')?.innerText
  ];
  for (const value of candidates) {
    const t = cleanTitle(value);
    if (t && !/^(chatgpt|new chat|đoạn chat mới)$/i.test(t)) return t;
  }
  return '';
}

function currentChatName() {
  const path = pathKey();
  try {
    const links = candidateConversationLinks();
    for (const link of links) {
      const label = labelFromLink(link);
      if (label) {
        try { sessionStorage.setItem(CACHE_PREFIX + path, label); } catch (_) {}
        return label;
      }
    }

    const active = document.querySelector('a[aria-current="page"], nav a[data-active="true"], aside a[aria-selected="true"]');
    const activeLabel = labelFromLink(active);
    if (activeLabel) {
      try { sessionStorage.setItem(CACHE_PREFIX + path, activeLabel); } catch (_) {}
      return activeLabel;
    }

    const pageTitle = cleanTitle(document.title || '');
    if (pageTitle) {
      try { sessionStorage.setItem(CACHE_PREFIX + path, pageTitle); } catch (_) {}
      return pageTitle;
    }

    try {
      const cached = cleanTitle(sessionStorage.getItem(CACHE_PREFIX + path) || '');
      if (cached) return cached;
    } catch (_) {}
  } catch (_) {}

  const id = path.match(/\/c\/([^/]+)/i)?.[1] || '';
  return id ? `chat ${id.slice(0, 8)}` : 'ChatGPT';
}

function isCritical(title, text) {
  const t = `${title} ${text}`.toLowerCase();
  return /context.*too long|đoạn chat quá dài|conversation too long|auth|xác thực|rate limit|429|cần người dùng|human|không được xác nhận|not confirmed|blocked|hết recovery budget/.test(t);
}

function groupFor(title, text) {
  const t = `${title} ${text}`.toLowerCase();
  if (/watchdog|recovery|status probe|web supervisor|khôi phục/.test(t)) return 'recovery';
  if (/context|đoạn chat quá dài|conversation too long/.test(t)) return 'context';
  if (/rate limit|auth|xác thực/.test(t)) return 'hard-error';
  return 'general';
}

const groupLast = new Map();
function shouldSuppress(key, group, critical) {
  const ts = now();
  for (const [k, seenAt] of exactSeen) if (ts - seenAt > 120000) exactSeen.delete(k);

  const exactAt = exactSeen.get(key) || 0;
  if (ts - exactAt < 60000) return true;

  const groupAt = groupLast.get(group) || 0;
  const groupCooldown = group === 'recovery' ? 12000 : group === 'general' ? 8000 : 3000;
  if (!critical && ts - groupAt < groupCooldown) return true;

  if (!critical && ts - lastAnyAt < 5000 && key !== lastAnyKey) return true;
  return false;
}

function normalizeDetails(details) {
  const d = typeof details === 'string'
    ? { title: 'Ghost+', text: details, timeout: 8000 }
    : { ...(details || {}) };
  const baseTitle = norm(d.title || 'Ghost+');
  const text = norm(d.text || d.message || '');
  const chat = currentChatName();
  d.title = baseTitle.includes(`· ${chat}`) ? baseTitle : `${baseTitle} · ${chat}`;
  d.text = text;
  d.timeout = Number(d.timeout) || 8000;
  return d;
}

function broker(details, ondone) {
  const d = normalizeDetails(details);
  const chat = currentChatName();
  const critical = isCritical(d.title, d.text);
  const group = groupFor(d.title, d.text);
  const key = `${pathKey()}|${chat}|${group}|${norm(d.title)}|${norm(d.text)}`.toLowerCase();

  if (shouldSuppress(key, group, critical)) return undefined;

  const ts = now();
  exactSeen.set(key, ts);
  groupLast.set(group, ts);
  lastAnyAt = ts;
  lastAnyKey = key;
  try { return rawNotify.call(this, d, ondone); } catch (_) { return undefined; }
}

window.__ghostPlusNotify = broker;
window.__ghostPlusCurrentChatName = currentChatName;

// Tampermonkey @require files share the userscript sandbox. Prefer replacing the
// granted binding directly so later modules using GM_notification are brokered.
try { GM_notification = broker; } catch (_) {
  try { globalThis.GM_notification = broker; } catch (_) {}
}
})();