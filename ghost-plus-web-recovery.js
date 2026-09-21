(() => {
'use strict';
const RT=window.__ghostPlusRuntime?.module('web-recovery');if(!RT)return;
if (window.__GHOST_PLUS_WEB_RECOVERY__) return;
window.__GHOST_PLUS_WEB_RECOVERY__ = true;
if (!/^(chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname)) return;

const CFG = Object.freeze({
  tickMs: 1250,
  settleMs: 4000,
  sendVerifyMs: 14000,
  clearStableMs: 5000,
  maxFaultText: 700
});
const K = Object.freeze({
  auto: 'ghostplus.auto',
  correction: 'ghostplus.pendingCorrection',
  lastFaultKey: 'ghostplus.web.lastFaultKey',
  lastFaultAttemptAt: 'ghostplus.web.lastFaultAttemptAt'
});
const S = {
  timer: null,
  recovering: false,
  faultKey: '',
  faultSeenAt: 0,
  clearSince: 0,
  attemptedThisEpisode: false,
  lastFaultKey: String(GM_getValue(K.lastFaultKey, '') || ''),
  lastFaultAttemptAt: Number(GM_getValue(K.lastFaultAttemptAt, 0)) || 0
};

const q = (s, r = document) => r.querySelector(s);
const qa = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => RT.sleep(ms);
const now = () => Date.now();
function captureExternalSelection(el) {
  try {
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const a = sel.anchorNode, f = sel.focusNode;
    if ((a && el?.contains?.(a)) || (f && el?.contains?.(f))) return null;
    const ranges = [];
    for (let i = 0; i < sel.rangeCount; i++) ranges.push(sel.getRangeAt(i).cloneRange());
    return ranges;
  } catch (_) { return null; }
}
function restoreExternalSelection(ranges) {
  if (!ranges?.length) return;
  try {
    const sel = window.getSelection?.();
    if (!sel) return;
    const live = ranges.filter(r => r.startContainer?.isConnected && r.endContainer?.isConnected);
    if (!live.length) return;
    sel.removeAllRanges();
    for (const r of live) sel.addRange(r);
  } catch (_) {}
}
function focusNoScroll(el) {
  try { el?.focus?.({ preventScroll:true }); }
  catch (_) { try { el?.focus?.(); } catch (_) {} }
}

const norm = v => String(v || '').replace(/\s+/g, ' ').trim();
const visible = el => !!el && el.isConnected && !el.disabled && el.getAttribute('aria-disabled') !== 'true' &&
  !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
function hash(value) {
  const s = String(value || ''); let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${s.length}:${(h >>> 0).toString(16)}`;
}
function notice(title, text) {
  try { GM_notification?.({ title, text, timeout: 9000 }); } catch (_) {}
}
function ghostStatus() { return norm(q('#gitl9 .status')?.innerText || ''); }
function ghostPaused() { return /^PAUSED\b/i.test(ghostStatus()); }
function ghostUncertain() { return /PLAY-SEND-(UNCERTAIN|THREW)|UNCERTAIN/i.test(ghostStatus()); }
function ghostStop() { return q('#gitl9 [data-a="stop"]'); }
function ghostPlay() { return q('#gitl9 [data-a="play"]'); }
function operatorLocked() { return !!window.__ghostPlusSupervisor?.isLocked?.(); }
function signal(type, severity, title, text, extra = {}) {
  try { window.__ghostPlusAlerts?.emit?.({ type, severity, title, text, ...extra }); } catch (_) {}
}
function requireHuman(snap, message) {
  const msg=norm(message||'Web recovery cannot continue safely; manual review is required.');
  S.recovering=false;
  S.attemptedThisEpisode=true;
  if(snap?.key){
    S.lastFaultKey=snap.key;S.lastFaultAttemptAt=now();
    try{GM_setValue(K.lastFaultKey,S.lastFaultKey);GM_setValue(K.lastFaultAttemptAt,S.lastFaultAttemptAt)}catch(_){}
  }
  renderWebState(snap,msg);
  try {
    if(window.__ghostPlusSupervisor?.lock){
      window.__ghostPlusSupervisor.lock('HUMAN_REQUIRED',{reason:msg});
      return;
    }
  } catch (_) {}
  signal('CORE_BLOCKED','critical','Ghost+ web supervisor',msg,{group:'operator',reason:msg});
}
function composer() { return q('#prompt-textarea') || q('textarea[data-id="root"]'); }
function composerText() {
  const el = composer();
  return norm(el?.innerText ?? el?.textContent ?? el?.value ?? '');
}
function users() { return qa('[data-message-author-role="user"]').filter(el => el.isConnected); }
function assistants() { return qa('[data-message-author-role="assistant"]').filter(el => el.isConnected); }
function latestText(nodes) {
  const el = nodes[nodes.length - 1];
  return norm(el?.innerText || el?.textContent || '');
}
function stopButtons() {
  const sels = [
    'button[data-testid="stop-button"]',
    'button[aria-label="Stop generating"]',
    'button[aria-label="Stop streaming"]'
  ];
  const out = [], seen = new Set();
  for (const sel of sels) for (const el of qa(sel)) {
    if (visible(el) && !seen.has(el)) { seen.add(el); out.push(el); }
  }
  return out;
}
function generating() { return stopButtons().length > 0; }

function retryButtons() {
  return qa('button').filter(el => {
    if (!visible(el)) return false;
    const t = norm(el.innerText || el.textContent || el.getAttribute('aria-label') || '');
    return /^(retry|try again|thử lại|thử lần nữa)$/i.test(t) || /retry|try again|thử lại/i.test(t);
  });
}
function errorCandidateTexts() {
  const texts = [];
  const seen = new Set();
  const add = value => {
    const t = norm(value);
    if (!t || t.length > CFG.maxFaultText || seen.has(t)) return;
    seen.add(t); texts.push(t);
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

  for (const btn of retryButtons()) {
    add(btn.innerText || btn.textContent || btn.getAttribute('aria-label') || '');
    let node = btn.parentElement;
    for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
      const t = norm(node.innerText || node.textContent || '');
      if (t && t.length <= CFG.maxFaultText) add(t);
    }
  }
  return texts;
}
function classifyErrorText(text) {
  const t = norm(text).toLowerCase();
  if (!t) return '';
  if (/timed out waiting to send|timeout.*send|send.*timed out|hết thời gian chờ gửi|chờ gửi tin nhắn.*quá|đã hết thời gian chờ gửi/.test(t)) return 'SEND_TIMEOUT';
  if (/rate limit|too many requests|quá nhiều yêu cầu|429\b/.test(t)) return 'RATE_LIMIT';
  if (/session expired|authentication|unauthorized|sign in again|đăng nhập lại|phiên.*hết hạn|xác thực/.test(t)) return 'AUTH_ERROR';
  if (/network error|network connection|connection error|lỗi mạng|mất kết nối|kết nối mạng/.test(t)) return 'NETWORK_ERROR';
  if (/something went wrong|error generating|generation error|đã xảy ra lỗi|có lỗi xảy ra|không thể tạo phản hồi/.test(t)) return 'GENERATION_ERROR';
  return '';
}
function scanWebError() {
  const candidates = errorCandidateTexts();
  for (const text of candidates) {
    const type = classifyErrorText(text);
    if (type) return { type, text, retryVisible: retryButtons().length > 0 };
  }
  return { type: '', text: '', retryVisible: retryButtons().length > 0 };
}
function faultSnapshot() {
  const error = scanWebError();
  const status = ghostStatus();
  const pausedUncertain = ghostPaused() && ghostUncertain();
  const recoverableType = ['SEND_TIMEOUT','NETWORK_ERROR','GENERATION_ERROR'].includes(error.type);
  const blockedType = ['RATE_LIMIT','AUTH_ERROR'].includes(error.type);
  const active = pausedUncertain || (ghostPaused() && (recoverableType || blockedType));
  const userText = latestText(users());
  const assistantText = latestText(assistants());
  const key = active ? [error.type || 'PLAY_SEND_UNCERTAIN', hash(error.text || status), hash(userText), hash(assistantText)].join('|') : '';
  return { active, pausedUncertain, recoverableType, blockedType, error, status, key, generating: generating() };
}

function ensureUi() {
  const host = q('#ghostplus-watch');
  if (!host) return;
  let row = q('#ghostplus-web-state', host);
  if (!row) {
    row = document.createElement('div');
    row.id = 'ghostplus-web-state';
    row.style.cssText = 'margin-top:5px;padding-top:5px;border-top:1px solid rgba(148,163,184,.25);font-size:10px;line-height:1.35';
    row.innerHTML = '<div><b>Lỗi web:</b> <span data-web-state>không</span></div><div data-web-detail style="color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>';
    host.appendChild(row);RT.node(row);
  }
}
function renderWebState(snap = faultSnapshot(), text = '') {
  ensureUi();
  const host = q('#ghostplus-web-state'); if (!host) return;
  const stateEl = q('[data-web-state]', host), detailEl = q('[data-web-detail]', host);
  if (!snap.active) {
    stateEl.textContent = 'không'; stateEl.style.color = '#64748b';
    detailEl.textContent = text || '';
    return;
  }
  const type = snap.error.type || 'PLAY_SEND_UNCERTAIN';
  stateEl.textContent = S.recovering ? `đang khôi phục · ${type}` : type;
  stateEl.style.color = snap.blockedType ? '#b45309' : '#b91c1c';
  detailEl.textContent = text || snap.error.text || snap.status;
  detailEl.title = detailEl.textContent;
}

function recoveryPrompt(snap) {
  const source = snap.error.type || 'PLAY_SEND_UNCERTAIN';
  const lines = [
    '[WEB RECOVERY STATUS PROBE]',
    `Recovery reason: ${source}.`,
    'The previous ChatGPT Web send/turn path stopped or failed without a trustworthy terminal result.',
    'Reconcile the current state before taking any new side effect.',
    'Inspect the current conversation plus fresh machine/tool state and the latest verified checkpoint/evidence.',
    'Classify the situation internally as RESUMABLE, BLOCKED, COMPLETE, or UNKNOWN_SIDE_EFFECT.',
    'If RESUMABLE: continue the existing task now from the latest verified checkpoint without repeating completed work.',
    'If BLOCKED: explain the genuine blocker and request human input.',
    'If COMPLETE: preserve the completed result and finish.',
    'If UNKNOWN_SIDE_EFFECT: do NOT replay, resend, or retry that side effect. Reconcile evidence first; if certainty cannot be restored, request human input.',
    'Do not click/retry the previous failed web request conceptually. Treat this as a fresh reconciliation turn.',
    'Do not weaken tests, do not blind retry, and do not restart completed work.',
    'Keep the active Ghost control protocol in force and end with exactly one valid Ghost terminal control line.'
  ];
  const correction = String(GM_getValue(K.correction, '') || '').trim();
  if (correction) lines.splice(4, 0, '[OPERATOR CORRECTION QUEUED]', correction, 'Apply this correction before the next safe action.');
  return lines.join('\n');
}

async function setComposerText(text) {
  const expected = norm(text), el = composer();
  if (!el) return false;
  const preservedSelection = captureExternalSelection(el);
  try {
    focusNoScroll(el);
    if (el.isContentEditable) {
      const range = document.createRange(); range.selectNodeContents(el);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      let inserted = false; try { inserted = document.execCommand('insertText', false, text); } catch (_) {}
      if (!inserted) {
        el.textContent = text;
        el.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertText', data:text }));
      } else el.dispatchEvent(new Event('input', { bubbles:true }));
    } else {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(el, text); else el.value = text;
      el.dispatchEvent(new Event('input', { bubbles:true }));
      el.dispatchEvent(new Event('change', { bubbles:true }));
    }
  } catch (_) { return false; }
  finally { restoreExternalSelection(preservedSelection); }
  await sleep(150);if(!RT.alive())return false;
  return norm(composerText()) === expected;
}
async function wait(pred, ms) {
  const started = now();
  while (now() - started < ms) {
    try { if (pred()) return true; } catch (_) {}
    await sleep(250);if(!RT.alive())return false;
  }
  return false;
}

async function sendRecoveryProbe(snap) {
  if (!RT.alive() || S.recovering || !snap.active) return;
  if (operatorLocked()) {
    renderWebState(snap, 'Operator Gate đang LOCKED; bỏ qua web recovery.');
    return;
  }
  if (GM_getValue(K.auto, true) === false) {
    requireHuman(snap,'Web recovery is disabled while a recoverable fault is active.');
    return;
  }
  if (snap.blockedType) {
    const msg = snap.error.type === 'RATE_LIMIT'
      ? 'Phát hiện rate limit. Ghost+ không tự gửi thêm request; cần chờ/backoff.'
      : 'Phát hiện lỗi xác thực. Ghost+ không tự recovery; cần người dùng xử lý đăng nhập/quyền.';
    if (snap.error.type === 'AUTH_ERROR' && window.__ghostPlusSupervisor?.lock) {
      window.__ghostPlusSupervisor.lock('AUTH_ERROR', { reason:snap.error.text || msg });
    } else {
      signal(snap.error.type, 'warning', 'Ghost+ web supervisor', msg, { group:'hard-error', reason:snap.error.text || msg });
      notice('Ghost+ web supervisor', msg);
    }
    renderWebState(snap, msg);
    S.attemptedThisEpisode = true;
    return;
  }
  if (snap.generating) {
    renderWebState(snap, 'ChatGPT vẫn đang generating; web-error recovery không can thiệp. Watchdog stall xử lý riêng.');
    return;
  }
  if (composerText()) {
    requireHuman(snap,'Ô nhập đang có nội dung. Ghost+ không ghi đè recovery probe; cần kiểm tra thủ công.');
    return;
  }
  if (S.attemptedThisEpisode) return;

  S.recovering = true; renderWebState(snap, 'Đang chuẩn bị status probe mới; không retry request cũ.');

  // Clear Ghost's internal UNCERTAIN latch only. This does NOT click ChatGPT's Stop-generating control.
  const gs = ghostStop(), gp = ghostPlay();
  if (!visible(gs) || !visible(gp)) {
    requireHuman(snap,'Không tìm thấy nút điều khiển Ghost đáng tin cậy để reconcile uncertain state.');
    return;
  }
  try { gs.click(); } catch (e) {
    requireHuman(snap,'Không reset được Ghost controller: '+String(e?.message||e));
    return;
  }
  await sleep(120);if(!RT.alive()){S.recovering=false;return}

  const prompt = recoveryPrompt(snap);
  if (!await setComposerText(prompt) || !RT.alive()) {
    if(!RT.alive()){S.recovering=false;return}
    requireHuman(snap,'Không stage được status probe an toàn. Không gửi; cần kiểm tra thủ công.');
    return;
  }

  const beforeUsers = users().length;
  const beforeAssistants = assistants().length;
  if(!RT.alive()){S.recovering=false;return}
  try { gp.click(); } catch (e) {
    requireHuman(snap,'Không khởi động được Ghost recovery: '+String(e?.message||e));
    return;
  }

  const accepted = await wait(
    () => generating() || users().length > beforeUsers || assistants().length > beforeAssistants || /^RUNNING\b/i.test(ghostStatus()),
    CFG.sendVerifyMs
  );
  if(!RT.alive()){S.recovering=false;return}

  S.attemptedThisEpisode = true;
  S.lastFaultKey = snap.key;
  S.lastFaultAttemptAt = now();
  GM_setValue(K.lastFaultKey, S.lastFaultKey);
  GM_setValue(K.lastFaultAttemptAt, S.lastFaultAttemptAt);

  if (!accepted) {
    requireHuman(snap,'Status probe chưa được xác nhận. Ghost+ sẽ không resend; cần kiểm tra thủ công.');
    return;
  }

  const correction = String(GM_getValue(K.correction, '') || '').trim();
  if (correction) GM_setValue(K.correction, '');
  renderWebState(snap, 'Đã gửi status probe mới. Không click nút Thử lại của request cũ.');
  notice('Ghost+ web supervisor', 'Đã gửi status probe để reconcile trạng thái hiện tại.');
  S.recovering = false;
}

function sample() {
  ensureUi();
  const snap = faultSnapshot();
  renderWebState(snap);
  if (operatorLocked()) {
    S.recovering = false;
    S.faultSeenAt = 0;
    renderWebState(snap, 'Operator Gate đang LOCKED; Web Recovery ngủ.');
    return;
  }

  if (!snap.active) {
    if (!S.clearSince) S.clearSince = now();
    if (now() - S.clearSince >= CFG.clearStableMs) {
      S.faultKey = ''; S.faultSeenAt = 0; S.attemptedThisEpisode = false;
    }
    return;
  }
  S.clearSince = 0;

  if (snap.key !== S.faultKey) {
    S.faultKey = snap.key;
    S.faultSeenAt = now();
    S.attemptedThisEpisode = false;
  }

  if (snap.blockedType) {
    if (!S.attemptedThisEpisode) sendRecoveryProbe(snap).catch(() => {});
    return;
  }

  if (now() - S.faultSeenAt < CFG.settleMs) {
    renderWebState(snap, 'Đang xác minh lỗi trước khi recovery.');
    return;
  }

  sendRecoveryProbe(snap).catch(error => {
    requireHuman(snap,'Recovery exception: '+String(error?.message||error));
  });
}

RT.clearInterval(S.timer);
S.timer = RT.interval(sample, CFG.tickMs);RT.cleanup(()=>{S.recovering=false;S.timer=null});
sample();
})();
