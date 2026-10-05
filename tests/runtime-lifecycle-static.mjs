import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const modules=[
  'ghost-plus-alert-router.js','ghost-plus-telegram.js','ghost-plus-turn-budget-v2.js',
  'ghost-in-the-loop.user.js','ghost-plus-operator-gate.js','ghost-plus-uncertain-reconcile.js',
  'ghost-plus-companion-v2.js','ghost-plus-core-busy-gate.js','ghost-plus-context-boundary.js',
  'ghost-plus-web-recovery.js','ghost-plus-ui-vi-safe.js','ghost-plus-help.js','ghost-plus-layout-fix.js'
];
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const manager=read('ghost-plus-runtime-manager.js');
const loader=read('ghost-plus.user.js');
const watchdog=read('ghost-plus-companion-v2.js');
const budget=read('ghost-plus-turn-budget-v2.js');
const core=read('ghost-in-the-loop.user.js');

assert.match(manager,/previous\.destroy\('reinject'\)/);
assert.match(manager,/removeEventListener/);
assert.match(manager,/h\.abort\(\)/);
assert.match(manager,/Object\.defineProperty\(p\.obj,p\.key,p\.desc\)/);
assert.match(manager,/ghostplusLastDiagnostics/);
assert.match(manager,/allZero:Object\.values\(totals\)\.every/);
assert.match(manager,/CHATGPT_COMPOSER_SELECTORS/,'shared ChatGPT composer contract missing');
assert.match(manager,/[data-testid="prompt-textarea"]/,'current ChatGPT data-testid composer selector missing');
assert.match(manager,/role="textbox"/,'role-based ChatGPT composer fallback missing');
assert.match(manager,/stageComposerText/,'shared staged-write verifier missing');
assert.match(manager,/top\.score-second\.score<90/,'ambiguous composer candidates must fail closed');
assert.match(manager,/CHATGPT_TURN_SELECTOR/,'shared ChatGPT turn contract missing');
assert.match(manager,/article\[data-testid\*="conversation-turn"\]/,'current ChatGPT conversation-turn fallback missing');
assert.match(manager,/latestChatgptAssistantText/,'shared assistant-turn resolver missing');
assert.match(manager,/chatgptUserCount/,'shared user-turn counter missing');
assert.match(manager,/isChatgptGenerating/,'shared ChatGPT generation detector missing');
assert.match(manager,/#composer-submit-button\[data-testid="stop-button"\]/,'current composer stop mode missing');
assert.match(manager,/domTurnText/,'turn text must preserve line boundaries');
assert.match(manager,/CHATGPT_SEND_SELECTORS/,'shared ChatGPT send contract missing');
assert.match(manager,/chatgptSendState/,'shared ChatGPT send-state resolver missing');
assert.match(manager,/waitChatgptSendReady/,'bounded ChatGPT send-readiness wait missing');
assert.match(manager,/actuateChatgptSend/,'shared ChatGPT single-actuation helper missing');
assert.match(manager,/isChatgptSendControl/,'shared ChatGPT send identity helper missing');
assert.match(manager,/button\[type="submit"\]/,'composer-scoped semantic submit fallback missing');
assert.match(manager,/data-turn="user"/,'data-turn user fallback missing');
assert.match(manager,/data-turn="assistant"/,'data-turn assistant fallback missing');
assert.match(manager,/chatgptActivityState/,'shared ChatGPT activity-state contract missing');
assert.match(manager,/CHATGPT_PENDING_RE/,'scoped pending/tool activity matcher missing');
assert.match(manager,/classifyChatgptFaultText/,'shared ChatGPT fault classifier missing');
assert.match(manager,/chatgptFaultState/,'shared ChatGPT fault-state resolver missing');
assert.match(manager,/STREAM_RESUME_UNAVAILABLE/,'Resume stream unavailable classification missing');
assert.match(manager,/MESSAGE_DELIVERY_TIMEOUT/,'message delivery timeout classification missing');
assert.match(manager,/domChatGptFaultFallbackText/,'bounded page-text stream-fault fallback missing');
assert.match(loader,/ghostplus\.15\.20/);
const requires=[...loader.matchAll(/^\/\/ @require\s+(.+)$/gm)].map(m=>m[1]);
assert.equal(requires.length,14);
assert.match(requires[0],/ghost-plus-runtime-manager\.js$/);

const forbidden=[
  [/\bsetInterval\s*\(/,'native setInterval'],
  [/\bsetTimeout\s*\(/,'native setTimeout'],
  [/\.addEventListener\s*\(/,'native addEventListener'],
  [/new\s+MutationObserver\s*\(/,'MutationObserver'],
  [/\brequestAnimationFrame\s*\(/,'requestAnimationFrame'],
  [/\b(?:scrollIntoView|scrollTo|scrollBy)\s*\(/,'programmatic scroll'],
  [/\b(?:wheel|mousewheel|DOMMouseScroll|touchmove|selectstart)\b/,'viewport input interception']
];
for(const file of modules){
  const src=read(file);
  assert.match(src,/window\.__ghostPlusRuntime\?\.module\(/,`${file}: missing runtime scope`);
  for(const [re,label] of forbidden)assert.doesNotMatch(src,re,`${file}: forbidden ${label}`);
}
assert.match(read('ghost-plus-turn-budget-v2.js'),/RT\.patch\(HTMLButtonElement\.prototype,'click',wrapped\)/);
assert.match(read('ghost-plus-telegram.js'),/RT\.abortable\(h\)/);
assert.match(read('ghost-plus-telegram.js'),/RT\.cleanup\(unsubscribe\)/);
const telegram=read('ghost-plus-telegram.js');
const alertRouter=read('ghost-plus-alert-router.js');
assert.match(telegram,/e\?\.data\?\.runScoped===true&&!!n\(e\?\.data\?\.runId\)&&e\?\.data\?\.ghostRunning===true/,'Telegram must reject STALL_WARNING without active-run evidence');
assert.match(telegram,/function validQueuedEvent\(e\)/,'Telegram queued-event validation missing');
assert.match(telegram,/if\(e\.type==='STALL_WARNING'\)return e\.runScoped===true&&!!n\(e\.runId\)&&ghostRunningNow\(\)/,'legacy or stale queued stall alerts must be purged unless Ghost is currently RUNNING');
assert.match(telegram,/!validQueuedEvent\(rec\.event\)/,'outbox drain must refuse invalid legacy stall events');
assert.match(telegram,/const ghostRunningNow=\(\)=>\/\^RUNNING\\b\/i\.test/,'Telegram must verify current Ghost RUNNING state before draining queued stall alerts');
assert.match(alertRouter,/if\(e\.type==='STALL_WARNING'&&e\.data\?\.runScoped!==true\)return/,'desktop router must drop unscoped stall popups');
assert.match(alertRouter,/e\.type==='COMPLETE'\?6\*60\*60\*1000/,'completion popup must have a long dedupe window');
assert.doesNotMatch(read('ghost-in-the-loop.user.js'),/data-a="unload"/,'Unload must stay out of the production panel');

for(const file of ['ghost-in-the-loop.user.js','ghost-plus-operator-gate.js','ghost-plus-companion-v2.js','ghost-plus-web-recovery.js','ghost-plus-turn-budget-v2.js']){
  assert.match(read(file),/preventScroll:true/,`${file}: composer focus must prevent scroll`);
}
for(const file of ['ghost-in-the-loop.user.js','ghost-plus-operator-gate.js','ghost-plus-companion-v2.js','ghost-plus-web-recovery.js','ghost-plus-turn-budget-v2.js']){
  assert.match(read(file),/__ghostPlusRuntime\?\.dom/,`${file}: must use shared ChatGPT composer contract`);
}
assert.match(read('ghost-plus-web-recovery.js'),/requireEmpty:true/,'web recovery must not overwrite a newly-arrived user draft');
assert.match(read('ghost-plus-companion-v2.js'),/requireEmpty:true/,'watchdog recovery must not overwrite a newly-arrived user draft');
assert.match(read('ghost-plus-operator-gate.js'),/requireEmpty:true/,'operator resume must not overwrite a user draft');
console.log('Ghost+ runtime lifecycle static audit: PASS');

assert.match(watchdog,/tickMs:\s*2000/,'watchdog BUSY polling must stay throttled');
assert.match(watchdog,/deepScanMs:\s*5000/,'watchdog deep scan cadence regressed');
assert.match(watchdog,/if \(sharedBusy \|\| stops\.length \|\| square\)/,'shared strong BUSY short-circuit missing');
assert.match(watchdog,/const text = latestAssistantText\(\);/,'BUSY assistant hash must use shared turn text');
assert.doesNotMatch(watchdog,/last\?\.innerText/,'BUSY assistant hash must not use innerText');
assert.match(watchdog,/now\(\)-S\.lastLayoutAt < CFG\.layoutMs/,'watchdog layout throttle missing');
assert.match(watchdog,/const running = ghostRunning\(\);/,'watchdog must capture Ghost RUNNING state before stall alert decisions');
assert.match(watchdog,/syncRunState\(running\)/,'watchdog run-scope transition tracking missing');
assert.match(watchdog,/if\(progressed&&running\)S\.stallEpisodeNotified=false/,'meaningful progress must re-arm exactly one future stall episode');
assert.match(watchdog,/if\(running\)\{[\s\S]*?signal\('STALL_WARNING'/,'STALL_WARNING must be nested under an active Ghost RUNNING guard');
assert.match(watchdog,/!S\.stallEpisodeNotified/,'stall alert must be one-shot per stall episode');
assert.match(watchdog,/data:\{runScoped:true,runId:S\.runId,ghostRunning:true,staleMs:stale\}/,'STALL_WARNING must carry positive run-scoped evidence');
assert.match(watchdog,/S\.lastProgressAt = S\.runStartedAt/,'starting Ghost must reset stale age so pre-Play BUSY time cannot trigger an immediate warning');
assert.match(watchdog,/S\.runId = ''/,'leaving RUNNING must clear the alert run id');
assert.match(budget,/if\(startedAt && !ghostRunning\(\) && !T\.injectedText\)/,'stale Turn Budget reset missing');

assert.match(watchdog,/continuityLeaseMs:\s*25\s*\*\s*60\s*\*\s*1000/,'continuity lease must stay at 25 minutes');
assert.match(watchdog,/recover\(snap,\{allowStopped:true,source:'lease'\}\)/,'continuity lease safe recovery path missing');
assert.match(watchdog,/snap\.busy\.busy\|\|operatorLocked\(\)\|\|ghostUncertain\(\)\|\|webErrorActive\(\)\|\|contextBoundaryActive\(\)/,'continuity safety gate regressed');
assert.match(watchdog,/if\(composerText\(\)\)return false/,'continuity must not overwrite composer');
assert.match(watchdog,/Outcome gửi không chắc chắn; không tự resend/,'unconfirmed recovery must not auto resend');
assert.match(watchdog,/lock\('HUMAN_REQUIRED'/,'unconfirmed recovery must escalate to HUMAN');
assert.doesNotMatch(watchdog,/sendOnce\(continuationPrompt/,'watchdog must never blind-send continue');
assert.match(core,/armContinuity\(\)/,'confirmed core send must arm continuity lease');
assert.match(core,/clearContinuity\(\); complete/,'HALT/complete must clear continuity lease');

const coreHeader=read('ghost-in-the-loop.user.js');
assert.match(coreHeader,/👻 GHOST <span class="brandver">· v/,'visible version next to Ghost missing');
assert.match(coreHeader,/scrollDebugActive\?' · DBG':''/,'DBG indicator missing');

const corePlay=read('ghost-in-the-loop.user.js');
const playBody=corePlay.slice(corePlay.indexOf('async function play()'),corePlay.indexOf('function pause(',corePlay.indexOf('async function play()')));
assert.match(playBody,/if \(generating\(\)\) \{/,'active generation adopt branch missing');
assert.match(playBody,/Adopted active ChatGPT turn · monitoring without sending/,'active generation adopt detail missing');
assert.ok(playBody.indexOf('if (generating()) {') < playBody.indexOf('} else if (draft.trim())'),'active generation must be adopted without Send before draft bootstrap');
assert.match(core,/latestChatgptAssistantText/,'core must read current ChatGPT turn contract');
assert.match(core,/chatgptUserCount/,'core must use shared ChatGPT user count');
assert.match(core,/isChatgptGenerating/,'core must use shared ChatGPT generation state');
assert.match(read('ghost-plus-operator-gate.js'),/latestChatgptAssistantText/,'operator gate must use shared assistant turn');
assert.match(read('ghost-plus-turn-budget-v2.js'),/chatgptUserCount/,'turn budget must use shared user count');
assert.match(read('ghost-plus-web-recovery.js'),/chatgptTurns/,'web recovery must use shared turn rows');
assert.match(watchdog,/chatgptTurns/,'watchdog must use shared turn rows');
assert.match(read('ghost-plus-core-busy-gate.js'),/isChatgptGenerating/,'core busy gate must use shared generation state');
assert.match(read('ghost-plus-core-busy-gate.js'),/chatgptTurns/,'core busy gate must use shared assistant turn');
assert.match(read('ghost-plus-uncertain-reconcile.js'),/latestChatgptAssistantText/,'uncertain reconciliation must use shared assistant turn');
assert.match(core,/CHATGPT_SEND_WAIT_MS = 10000/,'ChatGPT send readiness window must tolerate delayed React enablement');
assert.match(core,/waitChatgptSendReady/,'core must use shared ChatGPT send readiness');
assert.match(core,/actuateChatgptSend/,'core must use shared ChatGPT send actuation');
assert.match(budget,/isChatgptSendControl/,'Turn Budget must follow the same shared send identity contract');
assert.match(core,/Prompt is staged, but the current host Send control did not become ready/,'pre-actuation send failure must remain distinguishable from uncertain send');
assert.match(core,/if\(actuation\?\.attempted\)/,'post-actuation uncertainty guard missing');
assert.match(core,/CHATGPT_SEND_CONFIRM_MS = 45000/,'ChatGPT send acceptance window must tolerate delayed renderer/backend acknowledgement');
assert.match(core,/streamFaultBlocksNewSend/,'core must quarantine known stream-desync faults before new sends');
assert.match(core,/chatgptFaultState/,'core must use shared stream fault state');

const webRecovery=read('ghost-plus-web-recovery.js');
assert.match(webRecovery,/verifiedFailureRetryMax:\s*1/,'verified SEND_TIMEOUT retry budget regressed');
assert.match(webRecovery,/const explicitFailureType=error\.type==='SEND_TIMEOUT'/,'only an explicit SEND_TIMEOUT may prove a recovery send failed');
assert.match(webRecovery,/retryVisible:error\.retryVisible===true/,'Retry button must remain corroborating evidence');
assert.match(webRecovery,/userCountStable:users\(\)\.length===beforeUsers/,'user-count evidence missing');
assert.match(webRecovery,/assistantCountStable:assistants\(\)\.length===beforeAssistants/,'assistant-count evidence missing');
assert.match(webRecovery,/ownedRecoveryAttempt:recoveryAttemptOwned\(snap,attempt\)/,'owned recovery-attempt evidence missing');
assert.match(webRecovery,/S\.verifiedFailureRetries < CFG\.verifiedFailureRetryMax/,'controlled retry path missing');
assert.match(webRecovery,/Không nâng HUMAN và không resend thêm/,'verified failed send must not escalate to HUMAN');
assert.match(webRecovery,/Outcome thật sự uncertain; cần kiểm tra thủ công\./,'uncertain evidence must still escalate to HUMAN');

const gateRuntime=read('ghost-plus-operator-gate.js');
assert.match(gateRuntime,/transient!=='WEB_SEND_UNCERTAIN'/,'transient WEB_SEND_UNCERTAIN gate must auto-reconcile only for the intended provenance');
assert.match(gateRuntime,/const userAdvanced=bu!==null&&users\(\)>bu/,'late user-turn evidence missing');
assert.match(gateRuntime,/const assistantAdvanced=ba!==null&&assistants\(\)>ba/,'late assistant-turn evidence missing');
assert.match(gateRuntime,/const busy=modelBusy\(\)/,'late generation evidence missing');
assert.match(gateRuntime,/GATE_AUTO_RECONCILED/,'transient gate auto-clear event missing');
assert.match(gateRuntime,/if\(busy\)\{/,'busy late-accept must adopt active turn');
assert.doesNotMatch(gateRuntime,/transient:'WEB_SEND_UNCERTAIN'.*\[\[GITL::HUMAN\]\]/s,'assistant HUMAN must remain hard');
assert.match(webRecovery,/transient:'WEB_SEND_UNCERTAIN'/,'web recovery uncertainty must mark transient gate provenance');
assert.match(webRecovery,/baselineUsers:beforeUsers,baselineAssistants:beforeAssistants/,'web recovery uncertainty must carry message baselines');

assert.match(webRecovery,/kết nối bị gián đoạn/,'connection interrupted Vietnamese detector missing');
assert.match(webRecovery,/đang chờ câu trả lời hoàn chỉnh/,'waiting-for-complete-response detector missing');
assert.match(webRecovery,/return 'CONNECTION_INTERRUPTED'/,'CONNECTION_INTERRUPTED classification missing');
assert.match(webRecovery,/interruptionSettleMs:\s*30000/,'connection interruption reconnect grace regressed');
assert.match(webRecovery,/streamDesyncMinSettleMs:\s*180000/,'stream-desync minimum quarantine regressed');
assert.match(webRecovery,/streamDesyncQuietMs:\s*90000/,'stream-desync quiet window regressed');
assert.match(webRecovery,/streamSendVerifyMs:\s*45000/,'stream recovery acceptance window regressed');
assert.match(webRecovery,/streamRecoveryReady/,'stream-desync recovery safety gate missing');
assert.match(webRecovery,/lastProgressSig/,'stream progress tracking missing');
assert.match(webRecovery,/progressSig/,'fault progress signature missing');
assert.match(webRecovery,/const key = active \? \(error\.type \|\| \['PLAY_SEND_UNCERTAIN',hash\(status\)\]\.join\('\|'\)\) : ''/,'fault identity must remain stable across changing banner/turn text');
assert.match(webRecovery,/chatgptFaultState/,'Web Recovery must consume the shared ChatGPT fault contract');
assert.match(webRecovery,/chatgptActivityState/,'Web Recovery must consume the shared ChatGPT activity contract');
assert.match(webRecovery,/STREAM_RESUME_UNAVAILABLE/,'Web Recovery must quarantine Resume stream unavailable');
assert.match(webRecovery,/MESSAGE_DELIVERY_TIMEOUT/,'Web Recovery must quarantine message delivery timeout');
assert.match(webRecovery,/\['STREAM_RESUME_UNAVAILABLE','MESSAGE_DELIVERY_TIMEOUT','CONNECTION_INTERRUPTED'\]/,'connection interruption must share the stream-desync quarantine');
assert.doesNotMatch(webRecovery,/document\.body\?\.textContent/,'Web Recovery must not scan hidden page text for interruption banners');
assert.doesNotMatch(webRecovery,/S\.faultSeenAt = 0;\s*renderWebState\(snap, 'Operator Gate đang LOCKED/,'operator gates must not erase the stream quarantine clock');
assert.match(webRecovery,/\['SEND_TIMEOUT','CONNECTION_INTERRUPTED','STREAM_RESUME_UNAVAILABLE','MESSAGE_DELIVERY_TIMEOUT','NETWORK_ERROR','GENERATION_ERROR'\]/,'stream-desync faults must remain recoverable');
assert.match(webRecovery,/clearManagedRecoveryDraft\(snap\)/,'verified failed recovery must clear its own staged draft');

assert.match(webRecovery,/const explicitWebError = !!error\.type/,'explicit web error detector flag missing');
assert.match(webRecovery,/const active = pausedUncertain \|\| explicitWebError/,'explicit web error must not depend on Ghost PAUSED');
assert.match(webRecovery,/đã detect nhưng ChatGPT vẫn đang generating; chỉ theo dõi, chưa recovery/,'visible error + generating must defer recovery');
assert.doesNotMatch(watchdog,/data-testid\*="stop"/,'Watchdog must not use wildcard stop testids');
assert.doesNotMatch(watchdog,/aria-label\*="stop"/,'Watchdog must not use wildcard global stop aria labels');
assert.doesNotMatch(watchdog,/title\*="stop"/,'Watchdog must not use wildcard global stop titles');
assert.match(watchdog,/button\[data-testid="stop-button"\]/,'Watchdog must align with core stop-button selector');
assert.match(watchdog,/button\[aria-label="Stop generating"\]/,'Watchdog must align with core Stop generating selector');
assert.match(watchdog,/button\[aria-label="Stop streaming"\]/,'Watchdog must align with core Stop streaming selector');

const timeoutWeb=read('ghost-plus-web-recovery.js');
const timeoutCore=read('ghost-in-the-loop.user.js');
const timeoutGate=read('ghost-plus-operator-gate.js');
assert.match(timeoutWeb,/\[GHOST TIMEOUT TRIAGE REPORT\]/,'timeout triage report header missing');
assert.match(timeoutWeb,/TRẠNG THÁI: TIẾP_TỤC \| CẦN_NGƯỜI \| ĐÃ_XONG \| KHÔNG_CHẮC/,'timeout triage status choices missing');
assert.match(timeoutWeb,/SIDE EFFECT CHƯA XÁC MINH: có \| không/,'timeout triage side-effect field missing');
assert.match(timeoutWeb,/CHỈ kiểm tra trạng thái và lập báo cáo; chưa tiếp tục công việc/,'timeout triage must be report-only');
assert.match(timeoutWeb,/chờ ô nhập trống để gửi báo cáo trạng thái\. Không ghi đè và không nâng HUMAN/,'composer draft must wait without HUMAN');
assert.doesNotMatch(timeoutWeb,/Ô nhập đang có nội dung\. Ghost\+ không ghi đè recovery probe; cần kiểm tra thủ công/,'legacy composer-draft HUMAN escalation returned');
assert.match(timeoutCore,/function timeoutTriage\(text\)/,'core timeout triage parser missing');
assert.match(timeoutCore,/triageMismatch:true/,'triage marker mismatch guard missing');
assert.match(timeoutCore,/continue after timeout triage/,'safe triage continuation path missing');
assert.match(timeoutCore,/TIMEOUT_TRIAGE_CONTINUE/,'timeout triage continue event missing');
assert.match(timeoutGate,/function clearLegacyOperationalGate\(\)/,'legacy composer-draft gate migration missing');
assert.match(timeoutGate,/legacy-composer-draft-gate/,'legacy composer-draft gate migration reason missing');

assert.match(webRecovery,/function recoveryAttemptOwned\(snap,attempt=S\.recoveryAttempt\)/,'recovery attempt ownership helper missing');
assert.match(webRecovery,/function beginRecoveryAttempt\(prompt,snap,beforeUsers,beforeAssistants\)/,'recovery attempt fingerprint helper missing');
assert.match(webRecovery,/promptHash:hash\(norm\(prompt\|\|''\)\)/,'staged recovery prompt hash missing');
assert.match(webRecovery,/beforeAssistantHash:hash\(latestText\(assistants\(\)\)\)/,'assistant baseline hash missing');
assert.match(webRecovery,/assistantTextStable:/,'assistant text stability evidence missing');
assert.match(webRecovery,/ownedRecoveryAttempt:recoveryAttemptOwned\(snap,attempt\)/,'staged recovery ownership must survive composer clearing');
assert.doesNotMatch(webRecovery,/managedDraft:managedRecoveryDraft\(draft,snap\)/,'composer presence must not be required to verify failed send');
assert.doesNotMatch(webRecovery,/\^RUNNING\\b\/i\.test\(ghostStatus\(\)\)/,'Ghost RUNNING must not count as ChatGPT send acceptance');
assert.match(webRecovery,/await setComposerText\(attempt\.prompt\)/,'verified failed retry must restage cleared report');
assert.match(webRecovery,/Lý do khôi phục: \$\{source\}\./,'managed recovery draft must recognize current Vietnamese prompt');
assert.match(webRecovery,/chờ ô nhập trống, không ghi đè và không nâng HUMAN/,'unrelated user draft must block retry without false HUMAN');

assert.match(webRecovery,/const explicitFailureType=error\.type==='SEND_TIMEOUT';/,'stream-resume/delivery faults must never be treated as proof that Send failed');
assert.doesNotMatch(webRecovery,/retryEvidence:/,'retry button must not be required for verified send failure');
assert.match(webRecovery,/corroborating=\{/,'corroborating failure diagnostics missing');
assert.doesNotMatch(timeoutCore,/src\.replace\(\/\[\*_\\`\]\/g,''\)/,'timeout triage parser must never strip enum underscores globally');
assert.match(timeoutCore,/const md='\[\*_`\]\*';/,'timeout triage markdown wrapper matcher missing');
assert.match(timeoutCore,/triageIncomplete:true/,'incomplete timeout triage must not auto-continue');
assert.match(timeoutCore,/Báo cáo timeout thiếu trường bắt buộc; không tự tiếp tục/,'incomplete timeout triage reason missing');

assert.match(timeoutGate,/function latestRaw\(\)/,'raw assistant text helper missing for triage migration');
assert.match(timeoutGate,/function clearV01513FalseTriageGate\(\)/,'v0.15.13 false triage gate migration missing');
assert.match(timeoutGate,/v0\.15\.13-underscore-parser/,'false triage gate migration provenance missing');
assert.match(timeoutGate,/if\(!g\.h\|\|hash\(raw\)!==g\.h\)return false/,'false triage gate migration must require and verify the exact assistant hash');
assert.match(timeoutGate,/if\(!sm\|\|!em\|\|ty!=='proceed'\)return false/,'false triage gate migration must require safe PROCEED report');
