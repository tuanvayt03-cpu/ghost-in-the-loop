import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'ghost-plus-runtime-manager.js'),'utf8');

globalThis.window=globalThis;
globalThis.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),5);
globalThis.cancelAnimationFrame=id=>clearTimeout(id);

const ghostNode={removed:false,remove(){this.removed=true}};
const documentElement={dataset:{},removeAttribute(name){delete this[name]}};
globalThis.document={
  documentElement,
  title:'🔴 HUMAN · VM test',
  querySelectorAll(){return[ghostNode]}
};

const wait=ms=>new Promise(r=>setTimeout(r,ms));
const boot=()=>{eval(source);return globalThis.__ghostPlusRuntime};
const assertAllZero=d=>{
  assert.equal(d.active,false);
  for(const [k,v] of Object.entries(d.totals))assert.equal(v,0,`expected ${k}=0, got ${v}`);
};

const r1=boot();
assert.equal(r1.version,'0.15.7');
assert.equal(r1.generation,1);
const s1=r1.module('vm-test');

let intervalHits=0,timeoutHits=0,eventHits=0,rafHits=0,cleanupHits=0;
s1.interval(()=>intervalHits++,1000);
s1.timeout(()=>timeoutHits++,1000);
const sleepP=s1.sleep(1000);
s1.raf(()=>rafHits++);

const target=new EventTarget();
s1.listen(target,'ping',()=>eventHits++);
target.dispatchEvent(new Event('ping'));
assert.equal(eventHits,1);

const observer={observed:false,disconnected:false,observe(){this.observed=true},disconnect(){this.disconnected=true}};
s1.observe(observer,{}, {childList:true});
assert.equal(observer.observed,true);

const abortable={aborted:false,abort(){this.aborted=true}};
s1.abortable(abortable);
const node={removed:false,remove(){this.removed=true}};
s1.node(node);

const patchTarget={value:1};
const patched=()=>2;
assert.equal(s1.patch(patchTarget,'value',patched),true);
assert.equal(patchTarget.value,patched);
s1.cleanup(reason=>{cleanupHits++;assert.equal(reason,'operator-unload')});

const before=r1.diagnostics();
assert.equal(before.active,true);
assert.equal(before.totals.intervals,1);
assert.ok(before.totals.timeouts>=2);
assert.equal(before.totals.sleeps,1);
assert.equal(before.totals.listeners,1);
assert.equal(before.totals.observers,1);
assert.equal(before.totals.abortables,1);
assert.equal(before.totals.nodes,1);
assert.equal(before.totals.patches,1);
assert.equal(before.totals.cleanups,1);

const d1=r1.destroy('operator-unload');
assertAllZero(d1);
assert.equal(await sleepP,false);
assert.equal(observer.disconnected,true);
assert.equal(abortable.aborted,true);
assert.equal(node.removed,true);
assert.equal(ghostNode.removed,true);
assert.equal(patchTarget.value,1);
assert.equal(cleanupHits,1);

target.dispatchEvent(new Event('ping'));
assert.equal(eventHits,1,'listener survived destroy');
await wait(20);
assert.equal(timeoutHits,0,'timeout survived destroy');
assert.equal(intervalHits,0,'interval survived destroy');
assert.equal(rafHits,0,'RAF survived destroy');

const published1=JSON.parse(documentElement.dataset.ghostplusLastDiagnostics);
assert.equal(published1.allZero,true);
assert.equal(published1.destroyReason,'operator-unload');

// Reinject while an old generation is active: old callbacks must die.
const r2=boot();
assert.equal(r2.generation,2);
const old=r2.module('old-generation');
let staleHits=0;
old.interval(()=>staleHits++,1000);
old.timeout(()=>staleHits++,25);
const staleTarget=new EventTarget();
old.listen(staleTarget,'stale',()=>staleHits++);

const r3=boot();
assert.equal(r3.generation,3);
assert.equal(r2.active,false);
const reinject=JSON.parse(documentElement.dataset.ghostplusLastDiagnostics);
assert.equal(reinject.destroyReason,'reinject');
assert.equal(reinject.allZero,true);

staleTarget.dispatchEvent(new Event('stale'));
await wait(60);
assert.equal(staleHits,0,'stale generation callback fired after reinject');

const fresh=r3.module('fresh');
let freshHits=0;
fresh.timeout(()=>freshHits++,5);
await wait(15);
assert.equal(freshHits,1,'fresh generation callback did not run');

const d3=r3.destroy('operator-unload');
assertAllZero(d3);
const published3=JSON.parse(documentElement.dataset.ghostplusLastDiagnostics);
assert.equal(published3.allZero,true);
assert.equal(published3.generation,3);

console.log('Ghost+ runtime lifecycle VM audit: PASS');
