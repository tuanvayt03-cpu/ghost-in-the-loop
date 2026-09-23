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
assert.match(loader,/ghostplus\.15\.7/);
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
assert.match(read('ghost-in-the-loop.user.js'),/data-a="unload"/);
assert.match(read('ghost-in-the-loop.user.js'),/destroy\?\.\('operator-unload'\)/);

for(const file of ['ghost-in-the-loop.user.js','ghost-plus-operator-gate.js','ghost-plus-companion-v2.js','ghost-plus-web-recovery.js','ghost-plus-turn-budget-v2.js']){
  assert.match(read(file),/preventScroll:true/,`${file}: composer focus must prevent scroll`);
}
console.log('Ghost+ runtime lifecycle static audit: PASS');

assert.match(watchdog,/tickMs:\s*2000/,'watchdog BUSY polling must stay throttled');
assert.match(watchdog,/deepScanMs:\s*5000/,'watchdog deep scan cadence regressed');
assert.match(watchdog,/if \(stops\.length \|\| square\)/,'strong BUSY short-circuit missing');
assert.match(watchdog,/last\?\.textContent \|\| ''/,'BUSY assistant hash must avoid innerText');
assert.doesNotMatch(watchdog,/last\?\.innerText/,'BUSY assistant hash must not use innerText');
assert.match(watchdog,/now\(\)-S\.lastLayoutAt < CFG\.layoutMs/,'watchdog layout throttle missing');
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

const webRecovery=read('ghost-plus-web-recovery.js');
assert.match(webRecovery,/verifiedFailureRetryMax:\s*1/,'verified SEND_TIMEOUT retry budget regressed');
assert.match(webRecovery,/explicitTimeout:error\.type==='SEND_TIMEOUT'/,'verified SEND_TIMEOUT classification regressed');
assert.match(webRecovery,/retryVisible:error\.retryVisible===true/,'Retry button evidence missing');
assert.match(webRecovery,/userCountStable:users\(\)\.length===beforeUsers/,'user-count evidence missing');
assert.match(webRecovery,/assistantCountStable:assistants\(\)\.length===beforeAssistants/,'assistant-count evidence missing');
assert.match(webRecovery,/managedDraft:managedRecoveryDraft\(draft,snap\)/,'managed recovery draft evidence missing');
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
