import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const modules=[
  'ghost-plus-alert-router.js','ghost-plus-telegram.js','ghost-plus-turn-budget-v2.js',
  'ghost-in-the-loop.user.js','ghost-plus-operator-gate.js','ghost-plus-uncertain-reconcile.js',
  'ghost-plus-companion-v2.js','ghost-plus-core-busy-gate.js','ghost-plus-context-boundary.js',
  'ghost-plus-web-recovery.js','ghost-plus-ui-vi-safe.js','ghost-plus-help.js','ghost-plus-layout-fix.js'
];
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const manager=read('ghost-plus-runtime-manager.js');
const loader=read('ghost-plus.user.js');

assert.match(manager,/previous\.destroy\('reinject'\)/);
assert.match(manager,/removeEventListener/);
assert.match(manager,/h\.abort\(\)/);
assert.match(manager,/Object\.defineProperty\(p\.obj,p\.key,p\.desc\)/);
assert.match(loader,/ghostplus\.15\.0/);
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
