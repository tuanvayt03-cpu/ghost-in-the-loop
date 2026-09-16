(() => {
'use strict';
if (window.__GHOST_PLUS_NOTIFY_CONTEXT__) return;
window.__GHOST_PLUS_NOTIFY_CONTEXT__ = true;

const original = typeof GM_notification === 'function' ? GM_notification : null;
if (!original) return;

const norm = value => String(value || '').replace(/\s+/g, ' ').trim();

function currentChatName() {
  try {
    const path = location.pathname;
    if (/^(\/c\/|\/g\/[^/]+\/c\/)/i.test(path)) {
      const links = [...document.querySelectorAll('a[href]')];
      let active = links.find(a => {
        const href = String(a.getAttribute('href') || '').split(/[?#]/)[0];
        return href === path || href === `${path}/` || `${href}/` === path;
      });
      if (!active) active = links.find(a => a.getAttribute('aria-current') === 'page');
      const label = norm(active?.innerText || active?.textContent || '');
      if (label) return label.slice(0, 64);
    }

    let title = norm(document.title || '');
    title = title
      .replace(/\s*[-|·]\s*ChatGPT\s*$/i, '')
      .replace(/^ChatGPT\s*[-|·]\s*/i, '')
      .replace(/^ChatGPT$/i, '');
    if (title) return title.slice(0, 64);
  } catch (_) {}
  return 'ChatGPT';
}

function enhance(details) {
  if (typeof details === 'string') {
    return { title: `Ghost+ · ${currentChatName()}`, text: details, timeout: 9000 };
  }
  const d = { ...(details || {}) };
  const title = norm(d.title || 'Ghost+');
  const chat = currentChatName();
  if (chat && !title.includes(`· ${chat}`)) d.title = `${title} · ${chat}`;
  return d;
}

try {
  globalThis.GM_notification = function(details, ondone) {
    return original.call(this, enhance(details), ondone);
  };
} catch (_) {
  // If the userscript manager exposes a non-writable binding, leave notifications unchanged.
}
})();