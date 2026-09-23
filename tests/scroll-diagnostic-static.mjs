import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const loader=fs.readFileSync(path.join(root,'ghost-plus.user.js'),'utf8');
const diag=fs.readFileSync(path.join(root,'debug/ghost-scroll-diagnostic.user.js'),'utf8');
const core=fs.readFileSync(path.join(root,'ghost-in-the-loop.user.js'),'utf8');

assert.doesNotMatch(loader,/ghost-scroll-diagnostic/,'manual scroll diagnostic must never be in production loader');
assert.match(diag,/addEventListener\('wheel',onWheel,\{capture:true,passive:true\}\)/,'wheel diagnostic must remain passive');
assert.doesNotMatch(diag,/preventDefault\s*\(/,'diagnostic must never prevent wheel input');
assert.doesNotMatch(diag,/\b(?:scrollTo|scrollBy|scrollIntoView)\s*\(/,'diagnostic must never move viewport');
assert.doesNotMatch(diag,/\.scrollTop\s*=/,'diagnostic must never assign scrollTop');
assert.match(diag,/ghostScrollLastDiagnostic/,'diagnostic must publish a page-visible snapshot');
assert.doesNotMatch(core,/data-a="unload"/,'Unload must not return to the production panel');
const play=(core.match(/data-pane="play"[\s\S]*?data-pane="aoa"/)||[''])[0];
assert.doesNotMatch(play,/data-a="report"/,'diagnostic report must not occupy the Play pane');
assert.match(core,/data-pane="export"[\s\S]*data-a="report"/,'diagnostic report should remain under Export');
console.log('Ghost scroll diagnostic static audit: PASS');
