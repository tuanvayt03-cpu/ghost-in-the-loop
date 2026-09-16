(() => {
'use strict';
if (window.__GHOST_PLUS__) return;
window.__GHOST_PLUS__ = true;
if (!/^(chatgpt\.com|chat\.openai\.com)$/i.test(location.hostname)) return;

const CFG = Object.freeze({
  tickMs: 1000,
  graceMs: 30000,
  stopVerifyMs: 20000,
  ghostRestartVerifyMs: 12000,
  defaultTimeoutSec: 300,
  defaultRecoveryBudget: 2
});
const K = Object.freeze({
  collapsed: 'ghostplus.collapsed',
  timeout: 'ghostplus.timeout',
  auto: 'ghostplus.auto',
  allowStop: 'ghostplus.allowStop',
  budget: 'ghostplus.recoveryBudget',
  correction: 'ghostplus.pendingCorrection'
});
const S = {
  collapsed: !!GM_getValue(K.collapsed, false),
  timeout: clamp(Number(GM_getValue(K.timeout, CFG.defaultTimeoutSec)) || CFG.defaultTimeoutSec, 0, 3600),
  auto: GM_getValue(K.auto, true) !== false,
  allowStop: GM_getValue(K.allowStop, true) !== false,
  recoveryBudget: clamp(Number(GM_getValue(K.budget, CFG.defaultRecoveryBudget)) || CFG.defaultRecoveryBudget, 1, 5),
  pendingCorrection: String(GM_getValue(K.correction, '') || ''),
  lastPanelRect: null,
  timer: null,
  recovering: false,
  suspectAt: 0,
  lastRecoveryKey: '',
  recoveryCount: 0,
  recoveryBaselineAssistantHash: '',
  lastSnapshot: null,
  lastAnyActivityAt: Date.now(),
  lastTextActivityAt: Date.now(),
  lastToolActivityAt: Date.now()
};

const q = (s, r = document) => r.querySelector(s);
const qa = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => Date.now();
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo)); }
function visible(el) {
  return !!el && el.isConnected && !el.disabled && el.getAttribute('aria-disabled') !== 'true' &&
    !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}
function hash(value) {
  const s = String(value || ''); let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${s.length}:${(h >>> 0).toString(16)}`;
}
function fmt(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}
function notice(title, text) {
  try { GM_notification?.({ title, text, timeout: 9000 }); } catch (_) {}
}

function panel() { return q('#gitl9'); }
function ghostStatus() { return (q('#gitl9 .status')?.innerText || '').trim(); }
function ghostRunning() { return /^RUNNING\b/i.test(ghostStatus()); }
function ghostUncertain() { return /UNCERTAIN/i.test(ghostStatus()); }
function ghostStop() { return q('#gitl9 [data-a="stop"]'); }
function ghostPlay() { return q('#gitl9 [data-a="play"]'); }
function composer() { return q('#prompt-textarea') || q('textarea[data-id="root"]'); }
function composerText() {
  const e = composer();
  return String(e?.innerText ?? e?.textContent ?? e?.value ?? '').trim();
}
function assistants() { return qa('[data-message-author-role="assistant"]').filter(e => e.isConnected); }
function users() { return qa('[data-message-author-role="user"]').filter(e => e.isConnected); }
function latestAssistant() { const a = assistants(); return a[a.length - 1] || null; }
function stopButtons() {
  const selectors = [
    'button[data-testid="stop-button"]',
    'button[aria-label="Stop generating"]',
    'button[aria-label="Stop streaming"]'
  ];
  const seen = new Set(), out = [];
  for (const sel of selectors) for (const el of qa(sel)) {
    if (visible(el) && !seen.has(el)) { seen.add(el); out.push(el); }
  }
  return out;
}
function generating() { return stopButtons().length > 0; }

function captureSnapshot() {
  const last = latestAssistant();
  const text = last ? (last.innerText || last.textContent || '') : '';
  const toolText = last ? qa(
    '[data-testid*="tool" i],[class*="tool" i],details,[role="status"],[aria-live]', last
  ).map(x => (x.innerText || x.textContent || '').trim()).join('|') : '';
  return {
    generating: generating(),
    users: users().length,
    assistants: assistants().length,
    assistantHash: hash(text),
    toolHash: hash(toolText)
  };
}
function recoveryKey(snap = captureSnapshot()) {
  return `${snap.users}|${snap.assistants}|${snap.assistantHash}|${snap.toolHash}`;
}
function markAnyActivity() { S.lastAnyActivityAt = now(); S.suspectAt = 0; }
function updateActivity(snap) {
  const prev = S.lastSnapshot;
  if (!prev) {
    S.lastSnapshot = snap;
    S.lastAnyActivityAt = S.lastTextActivityAt = S.lastToolActivityAt = now();
    return;
  }
  let progressed = false;
  if (snap.assistantHash !== prev.assistantHash || snap.assistants !== prev.assistants || snap.users !== prev.users) {
    S.lastTextActivityAt = now(); progressed = true;
  }
  if (snap.toolHash !== prev.toolHash) {
    S.lastToolActivityAt = now(); progressed = true;
  }
  if (snap.generating !== prev.generating) progressed = true;
  if (progressed) markAnyActivity();

  if (S.recoveryCount > 0 && S.recoveryBaselineAssistantHash &&
      snap.assistantHash !== S.recoveryBaselineAssistantHash && snap.assistantHash !== hash('')) {
    S.recoveryCount = 0;
    S.lastRecoveryKey = '';
    S.recoveryBaselineAssistantHash = '';
  }
  S.lastSnapshot = snap;
}
function lastProgressAt() {
  return Math.max(S.lastAnyActivityAt, S.lastTextActivityAt, S.lastToolActivityAt);
}
function silenceMs() { return Math.max(0, now() - lastProgressAt()); }

function recoveryPrompt() {
  const lines = [
    '[WATCHDOG RECOVERY STATUS PROBE]',
    'The previous ChatGPT web turn became inactive or was interrupted before a trustworthy terminal outcome was observed.',
    'First reconcile the current state. Do not assume any in-flight tool call, external action, write, send, order, broker action, or other side effect succeeded or failed.',
    'Inspect the current conversation plus fresh machine/tool state and the latest verified checkpoint/evidence.',
    'Classify the situation internally as RESUMABLE, BLOCKED, COMPLETE, or UNKNOWN_SIDE_EFFECT.',
    'If RESUMABLE: continue the existing task now from the latest verified checkpoint without repeating completed work.',
    'If BLOCKED: explain the genuine blocker and request human input.',
    'If COMPLETE: preserve the completed result and finish.',
    'If UNKNOWN_SIDE_EFFECT: do NOT replay/resend/retry that side effect. Reconcile evidence first; if certainty cannot be restored, request human input.',
    'Do not weaken tests, do not blind retry, and do not restart completed work.',
    'Do not merely report the classification when safe progress is possible. Continue the existing goal.',
    'Keep the active Ghost control protocol in force and end with exactly one valid Ghost terminal control line.'
  ];
  if (S.pendingCorrection.trim()) {
    lines.splice(3, 0,
      '[OPERATOR CORRECTION QUEUED]',
      S.pendingCorrection.trim(),
      'Apply this correction before deciding the next safe action.'
    );
  }
  return lines.join('\n');
}

async function setComposerText(text) {
  const expected = String(text).replace(/\s+/g, ' ').trim();
  const el = composer(); if (!el) return false;
  try {
    el.focus();
    if (el.isContentEditable) {
      const range = document.createRange(); range.selectNodeContents(el);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      let inserted = false;
      try { inserted = document.execCommand('insertText', false, text); } catch (_) {}
      if (!inserted) {
        el.textContent = text;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      } else el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(el, text); else el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } catch (_) { return false; }
  await sleep(140);
  return composerText().replace(/\s+/g, ' ').trim() === expected;
}

function addStyle() {
  if (q('#ghostplus-style')) return;
  const st = document.createElement('style'); st.id = 'ghostplus-style';
  st.textContent = `
#gitl9{background:rgba(248,250,252,.90)!important;color:#26343d!important;border:1px solid rgba(148,163,184,.38)!important;box-shadow:0 10px 34px rgba(15,23,42,.16)!important;backdrop-filter:blur(14px) saturate(1.06)!important;-webkit-backdrop-filter:blur(14px) saturate(1.06)!important}
#gitl9 .meta,#gitl9 .tiny{color:#64748b!important;opacity:.92!important}#gitl9 .status{background:rgba(255,255,255,.72)!important;color:#26343d!important;border:1px solid rgba(148,163,184,.22)!important}
#gitl9 button{background:rgba(255,255,255,.78)!important;color:#334155!important;border-color:rgba(148,163,184,.40)!important}#gitl9 button:hover{background:rgba(241,245,249,.98)!important}#gitl9 button.on{background:rgba(209,250,229,.92)!important;border-color:rgba(16,185,129,.48)!important;color:#065f46!important}#gitl9 button.stop{background:rgba(254,226,226,.88)!important;border-color:rgba(239,68,68,.38)!important;color:#991b1b!important}
#gitl9 label{background:rgba(255,255,255,.62)!important;border-color:rgba(148,163,184,.30)!important;color:#334155!important}#gitl9 input{background:rgba(255,255,255,.86)!important;color:#334155!important;border-color:rgba(148,163,184,.42)!important}
#ghostplus-collapse{position:fixed;z-index:2147483647;width:24px;height:24px;border:1px solid rgba(148,163,184,.42);border-radius:7px;background:rgba(255,255,255,.88);color:#475569;box-shadow:0 3px 10px rgba(15,23,42,.10);cursor:pointer;font:700 15px/20px system-ui;padding:0}
#ghostplus-mini{position:fixed;z-index:2147483647;width:46px;height:46px;display:none;place-items:center;border:1px solid rgba(148,163,184,.42);border-radius:12px;background:rgba(248,250,252,.92);color:#334155;box-shadow:0 8px 24px rgba(15,23,42,.16);backdrop-filter:blur(14px);cursor:pointer;font:22px/1 system-ui;padding:0}
#ghostplus-mini.run{box-shadow:0 0 0 2px rgba(16,185,129,.35),0 8px 24px rgba(15,23,42,.16)}#ghostplus-mini.warn{box-shadow:0 0 0 2px rgba(245,158,11,.48),0 8px 24px rgba(15,23,42,.16)}
#ghostplus-watch{position:fixed;z-index:2147483647;padding:7px;border:1px solid rgba(148,163,184,.34);border-radius:9px;background:rgba(248,250,252,.93);color:#475569;box-shadow:0 6px 18px rgba(15,23,42,.10);backdrop-filter:blur(12px);font:10px/1.3 system-ui}
#ghostplus-watch .r{display:flex;align-items:center;justify-content:space-between;gap:6px}#ghostplus-watch select,#ghostplus-watch input[type="text"]{font:10px system-ui;padding:3px 4px;border:1px solid rgba(148,163,184,.42);border-radius:5px;background:#fff;color:#475569}#ghostplus-watch label{display:flex;align-items:center;gap:3px}.gp-dot{width:7px;height:7px;border-radius:50%;background:#94a3b8;display:inline-block;margin-right:4px}.gp-dot.ok{background:#10b981}.gp-dot.warn{background:#f59e0b}.gp-dot.bad{background:#ef4444}
#ghostplus-correction{margin-top:5px;display:grid;grid-template-columns:1fr auto;gap:4px}#ghostplus-correction input{min-width:0;width:100%}#ghostplus-correction button{padding:3px 6px;font:10px system-ui;border:1px solid rgba(148,163,184,.42);border-radius:5px;background:#fff;color:#475569;cursor:pointer}
`;
  document.documentElement.appendChild(st);
}

function controls() {
  let c = q('#ghostplus-collapse');
  if (!c) {
    c = document.createElement('button'); c.id = 'ghostplus-collapse'; c.textContent = '−'; c.title = 'Thu nhỏ Ghost';
    c.onclick = () => collapse(true); document.documentElement.appendChild(c);
  }
  let m = q('#ghostplus-mini');
  if (!m) {
    m = document.createElement('button'); m.id = 'ghostplus-mini'; m.textContent = '👻'; m.title = 'Mở Ghost';
    m.onclick = () => collapse(false); document.documentElement.appendChild(m);
  }
  let w = q('#ghostplus-watch');
  if (!w) {
    w = document.createElement('div'); w.id = 'ghostplus-watch';
    w.innerHTML = `
      <div class="r"><span><span class="gp-dot"></span><b>Theo dõi</b> <span data-state>đang nghỉ</span></span><span data-silent>00:00</span></div>
      <div class="r" style="margin-top:4px">
        <select data-time><option value="0">Tắt</option><option value="180">3 phút</option><option value="300">5 phút</option><option value="600">10 phút</option><option value="900">15 phút</option><option value="1500">25 phút</option></select>
        <select data-budget title="Số lần khôi phục liên tiếp"><option value="1">1 lần</option><option value="2">2 lần</option><option value="3">3 lần</option></select>
      </div>
      <div class="r" style="margin-top:4px"><label><input data-auto type="checkbox"> tự khôi phục</label><label><input data-stop type="checkbox"> cho phép Stop turn treo</label></div>
      <div id="ghostplus-correction"><input data-correction type="text" placeholder="Yêu cầu ưu tiên ở lần recovery kế tiếp"><button data-save-correction>Lưu</button></div>`;
    document.documentElement.appendChild(w);
    const timeout = q('[data-time]', w), budget = q('[data-budget]', w), auto = q('[data-auto]', w), allowStop = q('[data-stop]', w);
    timeout.value = String(S.timeout); budget.value = String(S.recoveryBudget); auto.checked = S.auto; allowStop.checked = S.allowStop;
    q('[data-correction]', w).value = S.pendingCorrection;
    timeout.onchange = e => { S.timeout = clamp(Number(e.target.value) || 0, 0, 3600); GM_setValue(K.timeout, S.timeout); markAnyActivity(); };
    budget.onchange = e => { S.recoveryBudget = clamp(Number(e.target.value) || 2, 1, 5); GM_setValue(K.budget, S.recoveryBudget); };
    auto.onchange = e => { S.auto = !!e.target.checked; GM_setValue(K.auto, S.auto); };
    allowStop.onchange = e => { S.allowStop = !!e.target.checked; GM_setValue(K.allowStop, S.allowStop); };
    q('[data-save-correction]', w).onclick = () => {
      S.pendingCorrection = String(q('[data-correction]', w).value || '').trim();
      GM_setValue(K.correction, S.pendingCorrection);
      notice('Ghost+','Đã lưu yêu cầu ưu tiên cho lần recovery kế tiếp.');
    };
  }
  return { c, m, w };
}
function layout() {
  const p = panel(), { c, m, w } = controls();
  if (!p) { c.style.display = 'none'; w.style.display = 'none'; m.style.display = 'none'; return; }
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
function collapse(v) {
  if (!v) panel()?.style.removeProperty('display');
  S.collapsed = !!v; GM_setValue(K.collapsed, S.collapsed); layout();
}
function ui() {
  layout(); const w=q('#ghostplus-watch'), m=q('#ghostplus-mini'); if(!w) return;
  const silent = silenceMs(), st=q('[data-state]',w), sl=q('[data-silent]',w), d=q('.gp-dot',w);
  sl.textContent = fmt(silent); d.className = 'gp-dot';
  if (!ghostRunning()) st.textContent='đang nghỉ';
  else if (S.recovering) { st.textContent='đang khôi phục'; d.classList.add('bad'); }
  else if (S.timeout===0) st.textContent='tắt';
  else if (silent>=S.timeout*1000) { st.textContent='nghi treo'; d.classList.add('warn'); }
  else { st.textContent=`ổn định · recovery ${S.recoveryCount}/${S.recoveryBudget}`; d.classList.add('ok'); }
  m.className = ghostRunning() ? 'run' : '';
  if (S.timeout>0 && silent>=S.timeout*1000) m.className='warn';
  m.title=`Ghost · ${ghostStatus()||'waiting'} · im ${fmt(silent)}`;
}
async function wait(pred, ms) {
  const started=now(); while(now()-started<ms) { try { if(pred()) return true; } catch(_){} await sleep(250); } return false;
}

async function recover() {
  if (S.recovering || !ghostRunning() || ghostUncertain()) return;
  const snap = captureSnapshot(), key = recoveryKey(snap);
  if (key === S.lastRecoveryKey) {
    notice('Ghost+ watchdog','Trạng thái treo chưa thay đổi sau lần recovery trước. Không retry cùng outcome.');
    S.suspectAt = now(); return;
  }
  if (S.recoveryCount >= S.recoveryBudget) {
    notice('Ghost+ watchdog',`Đã hết recovery budget (${S.recoveryBudget}). Cần kiểm tra thủ công.`);
    S.suspectAt = now(); return;
  }
  if (composerText()) {
    notice('Ghost+ watchdog','Ô nhập đang có nội dung của anh. Không ghi đè để recovery tự động.');
    S.suspectAt = now(); return;
  }

  S.recovering = true; ui();

  // A new prompt cannot be sent while ChatGPT is actively generating.
  // Stop is therefore only used as a verified transport recovery step, never as task completion.
  if (snap.generating) {
    if (!S.allowStop) {
      notice('Ghost+ watchdog','Turn đang treo nhưng tùy chọn cho phép Stop đang tắt. Không thể gửi status probe khi ChatGPT còn generating.');
      S.recovering=false; S.suspectAt=now(); ui(); return;
    }
    const stops = stopButtons();
    if (stops.length !== 1) {
      notice('Ghost+ watchdog',`Phát hiện treo nhưng thấy ${stops.length} nút Stop. Fail-closed, không click.`);
      S.recovering=false; S.suspectAt=now(); ui(); return;
    }
    try { stops[0].click(); } catch (e) {
      notice('Ghost+ watchdog','Không click được Stop: '+String(e?.message||e)); S.recovering=false; ui(); return;
    }
    if (!await wait(() => !generating(), CFG.stopVerifyMs)) {
      notice('Ghost+ watchdog','Đã click Stop nhưng không xác nhận được generation dừng. Không retry.'); S.recovering=false; ui(); return;
    }
  }

  const gs=ghostStop(), gp=ghostPlay();
  if (!visible(gs) || !visible(gp)) {
    notice('Ghost+ watchdog','Không tìm thấy nút điều khiển Ghost đáng tin cậy. Dừng recovery.'); S.recovering=false; ui(); return;
  }

  // Freeze the normal Ghost tick so only one controller can stage/send during reconciliation.
  try { gs.click(); } catch (e) {
    notice('Ghost+ watchdog','Không chuyển Ghost về trạng thái an toàn: '+String(e?.message||e)); S.recovering=false; ui(); return;
  }
  await sleep(120);

  const prompt = recoveryPrompt();
  if (!await setComposerText(prompt)) {
    notice('Ghost+ watchdog','Không stage được recovery status probe. Không gửi.'); S.recovering=false; ui(); return;
  }

  const beforeUsers = users().length;
  const beforeAssistantHash = captureSnapshot().assistantHash;
  try { gp.click(); } catch (e) {
    notice('Ghost+ watchdog','Không khởi động lại Ghost: '+String(e?.message||e)); S.recovering=false; ui(); return;
  }

  const restarted = await wait(
    () => ghostRunning() || generating() || users().length > beforeUsers,
    CFG.ghostRestartVerifyMs
  );
  if (!restarted) {
    notice('Ghost+ watchdog','Đã stage probe nhưng không xác nhận được Ghost bắt đầu lại. Prompt được giữ để anh kiểm tra thủ công.');
    S.recovering=false; ui(); return;
  }

  S.lastRecoveryKey = key;
  S.recoveryCount += 1;
  S.recoveryBaselineAssistantHash = beforeAssistantHash;
  if (S.pendingCorrection.trim()) {
    S.pendingCorrection=''; GM_setValue(K.correction,'');
    const input=q('#ghostplus-watch [data-correction]'); if(input) input.value='';
  }
  markAnyActivity();
  notice('Ghost+ watchdog','Đã gửi recovery status probe qua chính Play/send-once của Ghost.');
  S.recovering=false; ui();
}

function sample() {
  addStyle(); controls(); layout();
  const snap = captureSnapshot(); updateActivity(snap);
  const silent = silenceMs();
  if (ghostRunning() && S.timeout>0 && !S.recovering && silent>=S.timeout*1000) {
    if (!S.suspectAt) {
      S.suspectAt=now();
      notice('Ghost+ watchdog',`Không thấy progress ${S.timeout}s. Bắt đầu grace ${Math.round(CFG.graceMs/1000)}s.`);
    } else if (now()-S.suspectAt>=CFG.graceMs) {
      if (!S.auto) {
        S.suspectAt=now(); notice('Ghost+ watchdog','Turn có vẻ stalled. Tự khôi phục đang tắt.');
      } else {
        recover().catch(e => { S.recovering=false; notice('Ghost+ watchdog error',String(e?.message||e)); ui(); });
      }
    }
  } else if (S.timeout===0 || silent<S.timeout*1000) {
    S.suspectAt=0;
  }
  ui();
}

addStyle(); controls();
S.lastSnapshot = captureSnapshot();
S.lastAnyActivityAt = S.lastTextActivityAt = S.lastToolActivityAt = now();
clearInterval(S.timer); S.timer=setInterval(sample,CFG.tickMs); sample();
})();