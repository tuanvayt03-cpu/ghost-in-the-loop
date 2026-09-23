(() => {
'use strict';
const RT=window.__ghostPlusRuntime?.module('watchdog');if(!RT)return;
if (window.__GHOST_PLUS_SMART__) return;
window.__GHOST_PLUS_SMART__ = true;
if (!/^(chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname)) return;

const CFG = Object.freeze({
  tickMs: 2000,
  deepScanMs: 5000,
  layoutMs: 5000,
  graceMs: 30000,
  settleMs: 5000,
  staleBusyWarnMs: 10 * 60 * 1000,
  ghostRestartVerifyMs: 12000,
  continuityLeaseMs: 25 * 60 * 1000,
  continuitySettleMs: 30000,
  continuityAttemptCooldownMs: 60000,
  defaultTimeoutSec: 300,
  defaultRecoveryBudget: 2
});

const K = Object.freeze({
  collapsed: 'ghostplus.collapsed',
  timeout: 'ghostplus.smartTimeout',
  auto: 'ghostplus.auto',
  budget: 'ghostplus.recoveryBudget',
  correction: 'ghostplus.pendingCorrection',
  lease: 'ghostplus.continuityLeaseStartedAt'
});

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
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));

function hash(value) {
  const s = String(value || ''); let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${s.length}:${(h >>> 0).toString(16)}`;
}
function visible(el) {
  return !!el && el.isConnected && !el.disabled && el.getAttribute('aria-disabled') !== 'true' &&
    !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}
function fmt(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}
function notice(title, text) {
  try { GM_notification?.({ title, text, timeout: 9000 }); } catch (_) {}
}

const legacyTimeout = Number(GM_getValue('ghostplus.timeout', CFG.defaultTimeoutSec));
const initialTimeout = Number(GM_getValue(K.timeout, Number.isFinite(legacyTimeout) && legacyTimeout > 0 ? legacyTimeout : CFG.defaultTimeoutSec));
const S = {
  collapsed: !!GM_getValue(K.collapsed, false),
  timeout: clamp(Number.isFinite(initialTimeout) ? initialTimeout : CFG.defaultTimeoutSec, 0, 3600),
  auto: GM_getValue(K.auto, true) !== false,
  recoveryBudget: clamp(Number(GM_getValue(K.budget, CFG.defaultRecoveryBudget)) || CFG.defaultRecoveryBudget, 1, 5),
  pendingCorrection: String(GM_getValue(K.correction, '') || ''),
  lastPanelRect: null,
  lastSnapshot: null,
  lastProgressAt: now(),
  lastBusyAt: 0,
  busySince: 0,
  idleSince: now(),
  suspectAt: 0,
  recovering: false,
  recoveryCount: 0,
  lastRecoveryKey: '',
  recoveryBaselineAssistantHash: '',
  staleBusyNotifiedAt: 0,
  lastDeepAt: 0,
  lastLayoutAt: 0,
  lastViewportWidth: 0,
  continuityLastAttemptAt: 0,
  timer: null
};
GM_setValue(K.timeout, S.timeout);

function panel() { return q('#gitl9'); }
function ghostStatus() { return norm(q('#gitl9 .status')?.innerText || ''); }
function ghostRunning() { return /^RUNNING\b/i.test(ghostStatus()); }
function ghostUncertain() { return /UNCERTAIN/i.test(ghostStatus()); }
function operatorLocked() { return !!window.__ghostPlusSupervisor?.isLocked?.(); }
function signal(type, severity, title, text, extra = {}) {
  try { window.__ghostPlusAlerts?.emit?.({ type, severity, title, text, ...extra }); } catch (_) {}
}
function ghostStop() { return q('#gitl9 [data-a="stop"]'); }
function ghostPlay() { return q('#gitl9 [data-a="play"]'); }
function composer() { return q('#prompt-textarea') || q('textarea[data-id="root"]'); }
function composerText() {
  const el = composer();
  return norm(el?.innerText ?? el?.textContent ?? el?.value ?? '');
}
function users() { return qa('[data-message-author-role="user"]').filter(el => el.isConnected); }
function assistants() { return qa('[data-message-author-role="assistant"]').filter(el => el.isConnected); }
function latestAssistant() { const list = assistants(); return list[list.length - 1] || null; }
function latestTerminalType(){
  const text=norm(latestAssistant()?.textContent||'');
  const line=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).pop()||'';
  if(line==='[[GITL::HALT]]'||line==='[[AOA::HALT]]')return'halt';
  if(line==='[[GITL::HUMAN]]'||line==='[[AOA::HUMAN]]')return'human';
  if(/^\[\[AOA::RELAY:/.test(line))return'relay';
  if(line==='[[GITL::PROCEED]]'||line==='[[AOA::CONTINUE]]')return'proceed';
  return'bad';
}
function leaseStartedAt(){return Number(GM_getValue(K.lease,0))||0}
function clearLease(){try{GM_setValue(K.lease,0)}catch(_){}}
function leaseRemaining(){const s=leaseStartedAt();return s?Math.max(0,CFG.continuityLeaseMs-(now()-s)):0}

function semanticStopButtons() {
  // Keep global selectors aligned with Ghost core's ChatGPT profile.
  // Broad "*=stop" selectors can match unrelated/stale controls (audio, media, extension UI)
  // and hold Watchdog in BUSY forever.
  const selectors = [
    'button[data-testid="stop-button"]',
    'button[aria-label="Stop generating"]',
    'button[aria-label="Stop streaming"]'
  ];
  const seen = new Set(), out = [];
  for (const sel of selectors) {
    let nodes = [];
    try { nodes = qa(sel); } catch (_) {}
    for (const el of nodes) {
      if (!visible(el) || el.closest?.('#gitl9,#ghostplus-watch,#ghostplus-mini,#ghostplus-collapse') || seen.has(el)) continue;
      seen.add(el); out.push(el);
    }
  }
  return out;
}

function composerLocalButtons() {
  const el = composer(); if (!el) return [];
  let root = el;
  for (let i = 0; root && i < 7; i++, root = root.parentElement) {
    const buttons = qa('button', root).filter(visible);
    if (buttons.length) return buttons;
  }
  return [];
}

function squareStopCandidate() {
  for (const btn of composerLocalButtons()) {
    if(btn.closest?.('#gitl9,#ghostplus-watch,#ghostplus-mini,#ghostplus-collapse'))continue;
    const meta = norm([
      btn.getAttribute('data-testid'), btn.getAttribute('aria-label'), btn.getAttribute('title')
    ].filter(Boolean).join(' '));
    if (/send|gửi|submit/i.test(meta)) continue;
    if (/stop|dừng|cancel/i.test(meta)) return btn;
    const rect = btn.getBoundingClientRect();
    const hasRect = !!q('svg rect', btn);
    const compactSquare = rect.width >= 24 && rect.width <= 64 && rect.height >= 24 && rect.height <= 64 && Math.abs(rect.width - rect.height) <= 10;
    if (hasRect && compactSquare) return btn;
  }
  return null;
}

const PENDING_RE = /(^|\b)(đang\s+(suy nghĩ|truy vấn|tìm|phân tích|xử lý|tải|chạy|gọi|thực thi|duyệt)|thinking|searching|querying|analyzing|processing|working|running|retrieving|calling\s+(a\s+)?tool|using\s+(a\s+)?tool|browsing|fetching)(\b|…|\.\.\.|$)/i;

function statusNodes() {
  const selectors = [
    '[role="status"]',
    '[aria-live="polite"]',
    '[aria-live="assertive"]',
    '[data-testid*="status" i]',
    '[data-testid*="progress" i]',
    '[data-testid*="thinking" i]',
    '[data-testid*="loading" i]',
    '[class*="thinking" i]',
    '[class*="loading" i]'
  ];
  const seen = new Set(), out = [];
  for (const sel of selectors) {
    let nodes = [];
    try { nodes = qa(sel); } catch (_) {}
    for (const el of nodes) {
      if (!visible(el) || seen.has(el)) continue;
      seen.add(el); out.push(el);
    }
  }
  return out;
}

function pendingTexts() {
  const out = [], seen = new Set();
  const add = value => {
    const t = norm(value);
    if (!t || t.length > 240 || !PENDING_RE.test(t) || seen.has(t)) return;
    seen.add(t); out.push(t);
  };
  for (const el of statusNodes()) add(el.textContent || '');
  const last = latestAssistant();
  if (last) {
    let nodes = [];
    try { nodes = qa('[role="status"],[aria-live],[data-testid*="tool" i],[data-testid*="status" i],details', last); } catch (_) {}
    for (const el of nodes) if (visible(el)) add(el.textContent || '');
  }
  return out.slice(-6);
}

function ariaBusyVisible() {
  const selectors = [
    'main [aria-busy="true"]',
    'form [aria-busy="true"]',
    '[data-message-author-role="assistant"] [aria-busy="true"]'
  ];
  for (const sel of selectors) {
    let nodes = [];
    try { nodes = qa(sel); } catch (_) {}
    if (nodes.some(visible)) return true;
  }
  return false;
}

function progressVisible() {
  const selectors = [
    'main [role="progressbar"]',
    'main [data-testid*="spinner" i]',
    'main [class*="animate-spin" i]'
  ];
  for (const sel of selectors) {
    let nodes = [];
    try { nodes = qa(sel); } catch (_) {}
    if (nodes.some(visible)) return true;
  }
  return false;
}

function detectBusyState() {
  const stops = semanticStopButtons();
  const square = squareStopCandidate();
  const reasons = [];
  if (stops.length) reasons.push(`stop:${stops.length}`);
  if (square) reasons.push('composer-stop');
  if (stops.length || square) {
    return {
      busy:true,strong:true,reasons,pending:[],stopCount:stops.length,
      squareStop:!!square,ariaBusy:false,progress:false
    };
  }
  const pending = pendingTexts();
  const ariaBusy = ariaBusyVisible();
  const progress = progressVisible();
  if (pending.length) reasons.push(`pending:${pending[0].slice(0, 60)}`);
  if (ariaBusy) reasons.push('aria-busy');
  if (progress) reasons.push('progress');
  return {
    busy: pending.length > 0 || ariaBusy || progress,
    strong:false,
    reasons,
    pending,
    stopCount:0,
    squareStop:false,
    ariaBusy,
    progress
  };
}

function toolSignature() {
  const parts = [];
  const last = latestAssistant();
  if (last) {
    let nodes = [];
    try { nodes = qa('[data-testid*="tool" i],[role="status"],[aria-live],details', last); } catch (_) {}
    for (const el of nodes.slice(-20)) {
      const t = norm(el.textContent || '');
      if (t && t.length <= 500) parts.push(t);
    }
  }
  for (const t of pendingTexts()) parts.push(t);
  return hash(parts.join('|'));
}

function captureSnapshot(forceDeep=false) {
  const busy = detectBusyState();
  const deep = forceDeep || !S.lastSnapshot || !busy.busy || now()-S.lastDeepAt >= CFG.deepScanMs;
  let userCount=S.lastSnapshot?.users||0, assistantCount=S.lastSnapshot?.assistants||0;
  let assistantHash=S.lastSnapshot?.assistantHash||hash(''), toolHash=S.lastSnapshot?.toolHash||hash('');
  if (deep) {
    const last = latestAssistant();
    const text = norm(last?.textContent || '');
    userCount = users().length;
    assistantCount = assistants().length;
    assistantHash = hash(text);
    toolHash = toolSignature();
    S.lastDeepAt = now();
  }
  return {
    users:userCount,
    assistants:assistantCount,
    assistantHash,
    toolHash,
    busy,
    busySignature:hash(busy.reasons.join('|'))
  };
}

function updateProgress(snap) {
  const prev = S.lastSnapshot;
  if (!prev) {
    S.lastSnapshot = snap; S.lastProgressAt = now();
    if (snap.busy.busy) { S.busySince = now(); S.lastBusyAt = now(); }
    else S.idleSince = now();
    return;
  }
  let progressed = false;
  if (snap.users !== prev.users || snap.assistants !== prev.assistants || snap.assistantHash !== prev.assistantHash || snap.toolHash !== prev.toolHash || snap.busySignature !== prev.busySignature) {
    progressed = true;
  }
  if (progressed) S.lastProgressAt = now();

  if (snap.busy.busy) {
    if (!prev.busy.busy) S.busySince = now();
    S.lastBusyAt = now();
    S.idleSince = 0;
    S.suspectAt = 0;
  } else {
    if (prev.busy.busy) {
      S.idleSince = now();
      S.lastProgressAt = now();
      S.suspectAt = 0;
    } else if (!S.idleSince) S.idleSince = now();
  }

  if (S.recoveryCount > 0 && S.recoveryBaselineAssistantHash && snap.assistantHash !== S.recoveryBaselineAssistantHash && snap.assistantHash !== hash('')) {
    S.recoveryCount = 0;
    S.lastRecoveryKey = '';
    S.recoveryBaselineAssistantHash = '';
  }
  S.lastSnapshot = snap;
}

function recoveryKey(snap) {
  return `${snap.users}|${snap.assistants}|${snap.assistantHash}|${snap.toolHash}`;
}

function recoveryPrompt() {
  const lines = [
    '[WATCHDOG RECOVERY STATUS PROBE]',
    'The previous ChatGPT Web turn is no longer reporting an active generation/tool state and then remained idle beyond the watchdog threshold.',
    'First reconcile the current state. Do not assume any in-flight tool call, external action, write, send, order, broker action, or other side effect succeeded or failed.',
    'Inspect the current conversation plus fresh machine/tool state and the latest verified checkpoint/evidence.',
    'Classify internally as RESUMABLE, BLOCKED, COMPLETE, or UNKNOWN_SIDE_EFFECT.',
    'If RESUMABLE: continue now from the latest verified checkpoint without repeating completed work.',
    'If BLOCKED: explain the genuine blocker and request human input.',
    'If COMPLETE: preserve the completed result and finish.',
    'If UNKNOWN_SIDE_EFFECT: do NOT replay/resend/retry that side effect. Reconcile evidence first; if certainty cannot be restored, request human input.',
    'Do not weaken tests, do not blind retry, and do not restart completed work.',
    'Keep the active Ghost control protocol in force and end with exactly one valid Ghost terminal control line.'
  ];
  if (S.pendingCorrection.trim()) {
    lines.splice(4, 0, '[OPERATOR CORRECTION QUEUED]', S.pendingCorrection.trim(), 'Apply this correction before deciding the next safe action.');
  }
  return lines.join('\n');
}

async function setComposerText(text) {
  const expected = norm(text), el = composer(); if (!el) return false;
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

function webErrorActive() {
  const row = q('#ghostplus-web-state');
  if (!row) return false;
  const state = norm(q('[data-web-state]', row)?.innerText || '');
  return !!state && !/^không$/i.test(state);
}
function contextBoundaryActive() {
  return !!q('#ghostplus-context-boundary-state');
}

async function recover(snap,{allowStopped=false,source='idle'}={}) {
  if (!RT.alive() || S.recovering || (!ghostRunning()&&!allowStopped) || ghostUncertain() || operatorLocked()) return;
  const fresh = captureSnapshot();
  if (fresh.busy.busy) {
    S.suspectAt = 0;
    notice('Ghost+ watchdog', `ChatGPT vẫn đang thực thi (${fresh.busy.reasons.join(', ') || 'busy'}). Không recovery.`);
    return;
  }
  if (webErrorActive() || contextBoundaryActive()) return;
  const key = recoveryKey(fresh);
  if (key === S.lastRecoveryKey) {
    notice('Ghost+ watchdog', 'Trạng thái idle chưa thay đổi sau lần recovery trước. Không retry cùng outcome.');
    S.suspectAt = now(); return;
  }
  if (S.recoveryCount >= S.recoveryBudget) {
    const msg = `Đã hết recovery budget (${S.recoveryBudget}). Cần kiểm tra thủ công.`;
    if (window.__ghostPlusSupervisor?.lock) window.__ghostPlusSupervisor.lock('RECOVERY_EXHAUSTED', { reason:msg });
    else { signal('RECOVERY_EXHAUSTED', 'critical', 'Ghost+ watchdog', msg, { group:'recovery', reason:msg }); notice('Ghost+ watchdog', msg); }
    S.suspectAt = now(); return;
  }
  if (composerText()) {
    notice('Ghost+ watchdog', 'Ô nhập đang có nội dung của anh. Không ghi đè để recovery tự động.');
    S.suspectAt = now(); return;
  }

  const gs = ghostStop(), gp = ghostPlay();
  if (!visible(gs) || !visible(gp)) {
    notice('Ghost+ watchdog', 'Không tìm thấy nút điều khiển Ghost đáng tin cậy. Dừng recovery.');
    return;
  }

  S.recovering = true;
  try { gs.click(); } catch (e) {
    S.recovering = false;
    notice('Ghost+ watchdog', 'Không chuyển Ghost về trạng thái an toàn: ' + String(e?.message || e));
    return;
  }
  await sleep(120);if(!RT.alive()){S.recovering=false;return}

  if (detectBusyState().busy) {
    S.recovering = false;
    notice('Ghost+ watchdog', 'ChatGPT vừa quay lại trạng thái BUSY. Hủy recovery, không gửi probe.');
    return;
  }

  if (!await setComposerText(recoveryPrompt()) || !RT.alive()) {
    S.recovering = false;
    notice('Ghost+ watchdog', 'Không stage được recovery status probe. Không gửi.');
    return;
  }

  const beforeUsers = users().length;
  const beforeAssistantHash = fresh.assistantHash;
  if(!RT.alive()){S.recovering=false;return}
  try { gp.click(); } catch (e) {
    S.recovering = false;
    notice('Ghost+ watchdog', 'Không khởi động lại Ghost: ' + String(e?.message || e));
    return;
  }

  const restarted = await wait(() => ghostRunning() || detectBusyState().busy || users().length > beforeUsers, CFG.ghostRestartVerifyMs);
  if(!RT.alive()){S.recovering=false;return}
  if (!restarted) {
    S.recovering = false;
    clearLease();
    const msg='Recovery probe đã được stage/actuate nhưng Ghost không xác nhận restart. Outcome gửi không chắc chắn; không tự resend.';
    if(window.__ghostPlusSupervisor?.lock)window.__ghostPlusSupervisor.lock('HUMAN_REQUIRED',{reason:msg});
    else signal('CORE_BLOCKED','critical','Ghost+ watchdog',msg,{group:'operator',reason:msg});
    notice('Ghost+ watchdog',msg);
    return;
  }

  S.lastRecoveryKey = key;
  S.recoveryCount += 1;
  S.recoveryBaselineAssistantHash = beforeAssistantHash;
  if (S.pendingCorrection.trim()) {
    S.pendingCorrection = '';
    GM_setValue(K.correction, '');
    const input = q('#ghostplus-watch [data-correction]'); if (input) input.value = '';
  }
  S.lastProgressAt = now(); S.suspectAt = 0; S.recovering = false;
  notice('Ghost+ watchdog', source==='lease' ? 'Continuity lease đã nối task bằng status probe an toàn.' : 'Đã gửi recovery status probe sau khi xác nhận ChatGPT không còn BUSY.');
}

function continuityEligible(snap){
  if(!S.auto||S.recovering||snap.busy.busy||operatorLocked()||ghostUncertain()||webErrorActive()||contextBoundaryActive())return false;
  const started=leaseStartedAt();
  if(!started||now()-started<CFG.continuityLeaseMs)return false;
  const term=latestTerminalType();
  if(term==='halt'||term==='human'||term==='relay'){clearLease();return false}
  if(S.idleSince&&now()-S.idleSince<CFG.continuitySettleMs)return false;
  if(composerText())return false;
  if(now()-S.continuityLastAttemptAt<CFG.continuityAttemptCooldownMs)return false;
  return true;
}
function runContinuityLease(snap){
  if(!continuityEligible(snap))return false;
  S.continuityLastAttemptAt=now();
  recover(snap,{allowStopped:true,source:'lease'}).catch(e=>{
    S.recovering=false;
    notice('Ghost+ continuity error',String(e?.message||e));
  });
  return true;
}

function addStyle() {
  if (q('#ghostplus-style-v2')) return;
  const st = document.createElement('style'); st.id = 'ghostplus-style-v2';
  st.textContent = `
#gitl9{background:rgba(248,250,252,.90)!important;color:#26343d!important;border:1px solid rgba(148,163,184,.38)!important;box-shadow:0 10px 34px rgba(15,23,42,.16)!important;backdrop-filter:blur(14px) saturate(1.06)!important;-webkit-backdrop-filter:blur(14px) saturate(1.06)!important}
#gitl9 .meta,#gitl9 .tiny{color:#64748b!important;opacity:.92!important}#gitl9 .status{background:rgba(255,255,255,.72)!important;color:#26343d!important;border:1px solid rgba(148,163,184,.22)!important}
#gitl9 button{background:rgba(255,255,255,.78)!important;color:#334155!important;border-color:rgba(148,163,184,.40)!important}#gitl9 button:hover{background:rgba(241,245,249,.98)!important}#gitl9 button.on{background:rgba(209,250,229,.92)!important;border-color:rgba(16,185,129,.48)!important;color:#065f46!important}#gitl9 button.stop{background:rgba(254,226,226,.88)!important;border-color:rgba(239,68,68,.38)!important;color:#991b1b!important}
#gitl9 label{background:rgba(255,255,255,.62)!important;border-color:rgba(148,163,184,.30)!important;color:#334155!important}#gitl9 input{background:rgba(255,255,255,.86)!important;color:#334155!important;border-color:rgba(148,163,184,.42)!important}
#ghostplus-collapse{position:fixed;z-index:2147483647;width:24px;height:24px;border:1px solid rgba(148,163,184,.42);border-radius:7px;background:rgba(255,255,255,.88);color:#475569;box-shadow:0 3px 10px rgba(15,23,42,.10);cursor:pointer;font:700 15px/20px system-ui;padding:0}
#ghostplus-mini{position:fixed;z-index:2147483647;width:46px;height:46px;display:none;place-items:center;border:1px solid rgba(148,163,184,.42);border-radius:12px;background:rgba(248,250,252,.92);color:#334155;box-shadow:0 8px 24px rgba(15,23,42,.16);backdrop-filter:blur(14px);cursor:pointer;font:22px/1 system-ui;padding:0}
#ghostplus-mini.run{box-shadow:0 0 0 2px rgba(16,185,129,.35),0 8px 24px rgba(15,23,42,.16)}#ghostplus-mini.busy{box-shadow:0 0 0 2px rgba(59,130,246,.42),0 8px 24px rgba(15,23,42,.16)}#ghostplus-mini.warn{box-shadow:0 0 0 2px rgba(245,158,11,.48),0 8px 24px rgba(15,23,42,.16)}
#ghostplus-watch{position:fixed;z-index:2147483647;padding:7px;border:1px solid rgba(148,163,184,.34);border-radius:9px;background:rgba(248,250,252,.93);color:#475569;box-shadow:0 6px 18px rgba(15,23,42,.10);backdrop-filter:blur(12px);font:10px/1.3 system-ui}
#ghostplus-watch .r{display:flex;align-items:center;justify-content:space-between;gap:6px}#ghostplus-watch select,#ghostplus-watch input[type="text"]{font:10px system-ui;padding:3px 4px;border:1px solid rgba(148,163,184,.42);border-radius:5px;background:#fff;color:#475569}#ghostplus-watch label{display:flex;align-items:center;gap:3px}.gp-dot{width:7px;height:7px;border-radius:50%;background:#94a3b8;display:inline-block;margin-right:4px}.gp-dot.ok{background:#10b981}.gp-dot.busy{background:#3b82f6}.gp-dot.warn{background:#f59e0b}.gp-dot.bad{background:#ef4444}
#ghostplus-correction{margin-top:5px;display:grid;grid-template-columns:1fr auto;gap:4px}#ghostplus-correction input{min-width:0;width:100%}#ghostplus-correction button{padding:3px 6px;font:10px system-ui;border:1px solid rgba(148,163,184,.42);border-radius:5px;background:#fff;color:#475569;cursor:pointer}
#ghostplus-busy-detail{margin-top:4px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`;
  document.documentElement.appendChild(st);RT.node(st);
}

function controls() {
  let c = q('#ghostplus-collapse');
  if (!c) {
    c = document.createElement('button'); c.id = 'ghostplus-collapse'; c.textContent = '−'; c.title = 'Thu nhỏ Ghost';
    c.onclick = () => collapse(true); document.documentElement.appendChild(c);RT.node(c);
  }
  let m = q('#ghostplus-mini');
  if (!m) {
    m = document.createElement('button'); m.id = 'ghostplus-mini'; m.textContent = '👻'; m.title = 'Mở Ghost';
    m.onclick = () => collapse(false); document.documentElement.appendChild(m);RT.node(m);
  }
  let w = q('#ghostplus-watch');
  if (!w) {
    w = document.createElement('div'); w.id = 'ghostplus-watch';
    w.innerHTML = `
      <div class="r"><span><span class="gp-dot"></span><b>Theo dõi</b> <span data-state>đang nghỉ</span></span><span data-clock>00:00</span></div>
      <div class="r" style="margin-top:4px">
        <select data-time><option value="0">Tắt</option><option value="180">3 phút</option><option value="300">5 phút</option><option value="600">10 phút</option><option value="900">15 phút</option><option value="1500">25 phút</option></select>
        <select data-budget title="Số lần khôi phục liên tiếp"><option value="1">1 lần</option><option value="2">2 lần</option><option value="3">3 lần</option></select>
      </div>
      <div class="r" style="margin-top:4px"><label><input data-auto type="checkbox"> tự khôi phục khi IDLE</label><span style="color:#64748b">BUSY = không can thiệp</span></div>
      <div class="r" style="margin-top:3px;color:#64748b"><span>Continuity lease</span><span data-lease>— / 25m</span></div>
      <div id="ghostplus-busy-detail"></div>
      <div id="ghostplus-correction"><input data-correction type="text" placeholder="Yêu cầu ưu tiên ở lần recovery kế tiếp"><button data-save-correction>Lưu</button></div>`;
    document.documentElement.appendChild(w);RT.node(w);
    const timeout = q('[data-time]', w), budget = q('[data-budget]', w), auto = q('[data-auto]', w);
    timeout.value = String(S.timeout); budget.value = String(S.recoveryBudget); auto.checked = S.auto;
    q('[data-correction]', w).value = S.pendingCorrection;
    timeout.onchange = e => { S.timeout = clamp(Number(e.target.value) || 0, 0, 3600); GM_setValue(K.timeout, S.timeout); S.suspectAt = 0; };
    budget.onchange = e => { S.recoveryBudget = clamp(Number(e.target.value) || 2, 1, 5); GM_setValue(K.budget, S.recoveryBudget); };
    auto.onchange = e => { S.auto = !!e.target.checked; GM_setValue(K.auto, S.auto); };
    q('[data-save-correction]', w).onclick = () => {
      S.pendingCorrection = norm(q('[data-correction]', w).value || '');
      GM_setValue(K.correction, S.pendingCorrection);
      notice('Ghost+','Đã lưu yêu cầu ưu tiên cho lần recovery kế tiếp.');
    };
  }
  return { c, m, w };
}

function layout(force=false) {
  const p = panel(), { c, m, w } = controls();
  if (!p) { c.style.display='none'; m.style.display='none'; w.style.display='none'; return; }
  const widthChanged = S.lastViewportWidth !== innerWidth;
  if (!force && S.lastPanelRect && !widthChanged && now()-S.lastLayoutAt < CFG.layoutMs) return;
  S.lastLayoutAt = now(); S.lastViewportWidth = innerWidth;
  const r = p.getBoundingClientRect();
  if (!S.collapsed && r.width > 0) S.lastPanelRect = { top:r.top, right:innerWidth-r.right, width:r.width, bottom:r.bottom };
  const pr = S.lastPanelRect || { top:70, right:8, width:270, bottom:300 };
  if (S.collapsed) {
    p.style.setProperty('display','none','important'); c.style.display='none'; w.style.display='none'; m.style.display='grid';
    m.style.top=`${pr.top}px`; m.style.right=`${pr.right}px`;
  } else {
    p.style.removeProperty('display'); m.style.display='none'; c.style.display='block'; w.style.display='block';
    c.style.top=`${Math.max(4,r.top+6)}px`; c.style.right=`${Math.max(4,innerWidth-r.right+6)}px`;
    w.style.top=`${Math.max(4,r.bottom+5)}px`; w.style.right=`${Math.max(4,innerWidth-r.right)}px`; w.style.width=`${Math.max(250,r.width)}px`;
  }
}
function collapse(value) {
  if (!value) panel()?.style.removeProperty('display');
  S.collapsed = !!value; GM_setValue(K.collapsed, S.collapsed); layout(true);
}

function render(snap = captureSnapshot()) {
  layout();
  const w=q('#ghostplus-watch'), m=q('#ghostplus-mini'); if(!w) return;
  const state=q('[data-state]',w), clock=q('[data-clock]',w), dot=q('.gp-dot',w), detail=q('#ghostplus-busy-detail',w), leaseEl=q('[data-lease]',w);
  dot.className='gp-dot';
  if(leaseEl){
    const ls=leaseStartedAt(),remaining=leaseRemaining();
    leaseEl.textContent=ls?(remaining?fmt(remaining)+' / 25m':'due · chờ safe IDLE'):'— / 25m';
  }
  const elapsedSinceProgress = Math.max(0, now() - S.lastProgressAt);
  if (snap.busy.busy) {
    state.textContent = 'ĐANG THỰC THI'; dot.classList.add('busy');
    clock.textContent = S.busySince ? fmt(now()-S.busySince) : fmt(elapsedSinceProgress);
    detail.textContent = `Watchdog khóa · ${snap.busy.reasons.join(' · ') || 'busy confirmed'}`;
  } else if (S.recovering) {
    state.textContent='đang khôi phục'; dot.classList.add('bad'); clock.textContent=fmt(elapsedSinceProgress); detail.textContent='Đang gửi status probe sau IDLE xác nhận.';
  } else if (!ghostRunning()) {
    state.textContent='đang nghỉ'; clock.textContent='00:00'; detail.textContent='';
  } else if (S.idleSince && now()-S.idleSince < CFG.settleMs) {
    state.textContent='đang ổn định sau BUSY'; dot.classList.add('ok'); clock.textContent=fmt(now()-S.idleSince); detail.textContent='Chưa bắt đầu watchdog timeout.';
  } else if (S.timeout===0) {
    state.textContent='watchdog tắt'; clock.textContent=fmt(elapsedSinceProgress); detail.textContent='';
  } else {
    const idle = Math.max(0, now() - Math.max(S.lastProgressAt, S.idleSince || 0));
    clock.textContent=fmt(idle);
    if (idle >= S.timeout*1000) { state.textContent='IDLE nghi treo'; dot.classList.add('warn'); detail.textContent=`Không có BUSY evidence trong ${fmt(idle)}.`; }
    else { state.textContent=`ổn định · recovery ${S.recoveryCount}/${S.recoveryBudget}`; dot.classList.add('ok'); detail.textContent=`IDLE watchdog ${fmt(idle)} / ${Math.round(S.timeout/60)}m`; }
  }
  m.className = snap.busy.busy ? 'busy' : ghostRunning() ? 'run' : '';
  m.title = `Ghost · ${ghostStatus()||'waiting'} · ${snap.busy.busy ? 'BUSY' : 'IDLE'}`;
}

function sample() {
  addStyle(); controls(); layout();
  const snap = captureSnapshot(); updateProgress(snap);

  if (snap.busy.busy) {
    S.suspectAt = 0;
    const stale = now() - S.lastProgressAt;
    if (stale >= CFG.staleBusyWarnMs && now() - S.staleBusyNotifiedAt >= CFG.staleBusyWarnMs) {
      S.staleBusyNotifiedAt = now();
      const msg = `ChatGPT vẫn báo BUSY nhưng ${Math.round(stale/60000)} phút chưa có meaningful progress. Chỉ cảnh báo, không Stop/recovery.`;
      signal('STALL_WARNING', 'warning', 'Ghost+ watchdog', msg, { group:'stall', reason:msg });
      notice('Ghost+ watchdog', msg);
    }
    render(snap); return;
  }

  if (runContinuityLease(snap)) { render(snap); return; }

  if (operatorLocked() || !ghostRunning() || S.timeout===0 || S.recovering) {
    S.suspectAt = 0; render(snap); return;
  }

  if (S.idleSince && now()-S.idleSince < CFG.settleMs) {
    S.suspectAt = 0; render(snap); return;
  }

  const idle = Math.max(0, now() - Math.max(S.lastProgressAt, S.idleSince || 0));
  if (idle < S.timeout*1000) {
    S.suspectAt = 0; render(snap); return;
  }

  if (!S.suspectAt) {
    S.suspectAt = now();
    notice('Ghost+ watchdog', `Không còn BUSY evidence và đã IDLE ${Math.round(idle/1000)}s. Bắt đầu grace ${Math.round(CFG.graceMs/1000)}s.`);
    render(snap); return;
  }

  if (now()-S.suspectAt >= CFG.graceMs) {
    if (!S.auto) {
      S.suspectAt = now();
      notice('Ghost+ watchdog', 'ChatGPT có vẻ IDLE/stalled. Tự khôi phục đang tắt.');
    } else {
      recover(snap).catch(e => { S.recovering=false; notice('Ghost+ watchdog error', String(e?.message||e)); });
    }
  }
  render(snap);
}

addStyle(); controls();
S.lastSnapshot = captureSnapshot();
S.lastProgressAt = now();
if (S.lastSnapshot.busy.busy) { S.busySince = now(); S.lastBusyAt = now(); S.idleSince = 0; }
else S.idleSince = now();
function resetRecoveryEpisode() {
  S.recoveryCount = 0;
  S.lastRecoveryKey = '';
  S.recoveryBaselineAssistantHash = '';
  S.suspectAt = 0;
  S.lastProgressAt = now();
  S.idleSince = now();
}
window.__ghostPlusWatchdog = { resetRecoveryEpisode, state: () => ({ recoveryCount:S.recoveryCount, recoveryBudget:S.recoveryBudget, recovering:S.recovering, continuityLeaseStartedAt:leaseStartedAt(), continuityRemainingMs:leaseRemaining() }) };
RT.clearInterval(S.timer); S.timer = RT.interval(sample, CFG.tickMs);RT.cleanup(()=>{S.recovering=false;S.timer=null}); sample();
})();