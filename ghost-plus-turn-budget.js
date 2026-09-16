(() => {
'use strict';
if (window.__GHOST_PLUS_TURN_BUDGET__) return;
window.__GHOST_PLUS_TURN_BUDGET__ = true;
if (!/^(chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname)) return;

const K = Object.freeze({
  minutes: 'ghostplus.turnBudgetMin',
  startedAt: 'ghostplus.turnStartedAt'
});
const CFG = Object.freeze({ defaultMinutes: 20, tickMs: 1000 });
const norm = value => String(value || '').replace(/\s+/g, ' ').trim();
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
const now = () => Date.now();
const q = (s, r = document) => r.querySelector(s);

function budgetMinutes() {
  const raw = Number(GM_getValue(K.minutes, CFG.defaultMinutes));
  if (!Number.isFinite(raw)) return CFG.defaultMinutes;
  return clamp(Math.round(raw), 0, 60);
}
function setBudgetMinutes(value) {
  const n = clamp(Number(value) || 0, 0, 60);
  GM_setValue(K.minutes, n);
  return n;
}
function isGhostManagedPrompt(text) {
  const t = String(text || '');
  return /\[GHOST CORE CONTROL\]|\[WATCHDOG RECOVERY STATUS PROBE\]|\[WEB RECOVERY STATUS PROBE\]|\[\[GITL::|\[\[AOA::|Continue the existing task from the current conversation|Protocol compliance drifted twice|You strayed from the active control protocol/i.test(t);
}
function budgetContract() {
  const minutes = budgetMinutes();
  if (!minutes) return '';
  let deadline = '';
  try {
    deadline = new Date(now() + minutes * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (_) {}
  return [
    '[WEB TURN BUDGET]',
    `Soft target for this ChatGPT Web turn: about ${minutes} minutes${deadline ? `; target handoff/checkpoint by about ${deadline} local browser time` : ''}.`,
    'This is a planning budget, not a hard stop timer.',
    'Complete one bounded unit of work in this turn. Do not open another large branch late in the turn.',
    'Preserve fresh machine evidence and a precise checkpoint while working.',
    'If meaningful work remains when the bounded unit is safely complete, checkpoint the exact current state and return the normal PROCEED control marker so Ghost can continue in a fresh turn.',
    'Do not weaken verification or tests to meet the budget.',
    'Do not replay, resend, or retry any action whose outcome is uncertain.'
  ].join('\n');
}
function composer() {
  return q('#prompt-textarea') || q('textarea[data-id="root"]');
}
function composerText(el = composer()) {
  return norm(el?.innerText ?? el?.textContent ?? el?.value ?? '');
}
function setComposerText(el, text) {
  if (!el) return false;
  try {
    el.focus();
    if (el.isContentEditable) {
      el.textContent = text;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    } else {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(el, text); else el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return norm(composerText(el)).includes('[WEB TURN BUDGET]');
  } catch (_) { return false; }
}
function isChatGptSendButton(el) {
  if (!(el instanceof Element)) return false;
  try {
    return el.matches('#composer-submit-button,button[data-testid="send-button"],button[aria-label="Send prompt"],button[aria-label="Send message"]');
  } catch (_) { return false; }
}
function augmentBeforeProgrammaticSend() {
  const minutes = budgetMinutes();
  if (!minutes) return;
  const el = composer();
  const current = composerText(el);
  if (!current || !isGhostManagedPrompt(current) || current.includes('[WEB TURN BUDGET]')) return;
  const contract = budgetContract();
  if (!contract) return;
  const augmented = `${current}\n\n${contract}`;
  if (setComposerText(el, augmented)) {
    GM_setValue(K.startedAt, now());
  }
}

// Ghost actuates the reviewed ChatGPT Send control via button.click().
// Patch only programmatic clicks on that exact Send control, after Ghost has already
// verified its staged text, so core write-verification semantics remain untouched.
try {
  const originalClick = HTMLButtonElement.prototype.click;
  if (!originalClick.__ghostPlusBudgetWrapped) {
    const wrapped = function(...args) {
      if (isChatGptSendButton(this)) augmentBeforeProgrammaticSend();
      return originalClick.apply(this, args);
    };
    try { Object.defineProperty(wrapped, '__ghostPlusBudgetWrapped', { value: true }); } catch (_) {}
    HTMLButtonElement.prototype.click = wrapped;
  }
} catch (_) {}

function fmtElapsed(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(sec / 60);
  return `${String(min).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}
function ensureUi() {
  const host = q('#ghostplus-watch');
  if (!host) return null;
  let row = q('#ghostplus-turn-budget', host);
  if (row) return row;
  row = document.createElement('div');
  row.id = 'ghostplus-turn-budget';
  row.style.cssText = 'margin-top:5px;padding-top:5px;border-top:1px solid rgba(148,163,184,.25);font-size:10px;line-height:1.35';
  row.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
      <span><span data-budget-dot style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#94a3b8;margin-right:4px"></span><b>Ngân sách turn</b> <span data-budget-state>chờ turn</span></span>
      <span data-budget-elapsed>00:00</span>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:4px">
      <select data-budget-min style="font:10px system-ui;padding:3px 4px;border:1px solid rgba(148,163,184,.42);border-radius:5px;background:#fff;color:#475569">
        <option value="0">Tắt</option>
        <option value="15">15 phút</option>
        <option value="18">18 phút</option>
        <option value="20">20 phút</option>
        <option value="22">22 phút</option>
        <option value="24">24 phút</option>
      </select>
      <span style="color:#64748b">chỉ nhắc, không tự Stop</span>
    </div>`;
  host.appendChild(row);
  const select = q('[data-budget-min]', row);
  select.value = String(budgetMinutes());
  select.onchange = e => {
    setBudgetMinutes(e.target.value);
    GM_setValue(K.startedAt, 0);
  };
  return row;
}
function renderUi() {
  const row = ensureUi();
  if (!row) return;
  const minutes = budgetMinutes();
  const startedAt = Number(GM_getValue(K.startedAt, 0)) || 0;
  const elapsed = startedAt ? Math.max(0, now() - startedAt) : 0;
  const limit = minutes * 60000;
  const state = q('[data-budget-state]', row);
  const elapsedEl = q('[data-budget-elapsed]', row);
  const dot = q('[data-budget-dot]', row);
  elapsedEl.textContent = startedAt ? `${fmtElapsed(elapsed)} / ${minutes || 0}m` : '00:00';
  dot.style.background = '#94a3b8';
  if (!minutes) {
    state.textContent = 'tắt';
  } else if (!startedAt) {
    state.textContent = 'chờ turn';
  } else if (elapsed >= limit) {
    state.textContent = 'vượt soft budget'; dot.style.background = '#ef4444';
  } else if (elapsed >= limit * 0.9) {
    state.textContent = 'nên checkpoint'; dot.style.background = '#f59e0b';
  } else {
    state.textContent = 'ổn'; dot.style.background = '#10b981';
  }
}

setInterval(renderUi, CFG.tickMs);
renderUi();
})();