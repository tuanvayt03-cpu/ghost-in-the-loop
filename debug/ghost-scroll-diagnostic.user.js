// ==UserScript==
// @name         Ghost Scroll Diagnostic (manual)
// @namespace    https://github.com/tuanvayt03-cpu/ghost-in-the-loop
// @version      0.1.0
// @description  Manual passive diagnostic for intermittent ChatGPT scroll stalls. Not part of Ghost production loader.
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @run-at       document-idle
// @noframes
// @license      AGPL-3.0
// ==/UserScript==

(() => {
'use strict';
if(window.__GHOST_SCROLL_DIAG__)return;
window.__GHOST_SCROLL_DIAG__=true;
const now=()=>Date.now();
const norm=v=>String(v||'').replace(/\s+/g,' ').trim();
let lastCheckAt=0,lastSnapshot=null;
function desc(el){
  if(!el)return null;
  const tag=(el.tagName||'').toLowerCase();
  const id=el.id?('#'+String(el.id).slice(0,80)):'';
  const cls=typeof el.className==='string'&&el.className.trim()?'.'+el.className.trim().split(/\s+/).slice(0,3).join('.'):'';
  return (tag+id+cls).slice(0,180);
}
function metrics(el){
  if(!el)return null;
  let cs=null;try{cs=getComputedStyle(el)}catch(_){}
  return {element:desc(el),top:Number(el.scrollTop)||0,left:Number(el.scrollLeft)||0,height:Number(el.scrollHeight)||0,client:Number(el.clientHeight)||0,overflowY:cs?.overflowY||'',overscrollY:cs?.overscrollBehaviorY||'',scrollBehavior:cs?.scrollBehavior||'',position:cs?.position||''};
}
function scrollable(el){
  if(!el||el===document.body||el===document.documentElement)return false;
  let cs;try{cs=getComputedStyle(el)}catch(_){return false}
  return /(auto|scroll|overlay)/.test(cs.overflowY||'')&&el.scrollHeight>el.clientHeight+2;
}
function findScroller(target){
  for(let el=target instanceof Element?target:null;el;el=el.parentElement)if(scrollable(el))return el;
  return document.scrollingElement||document.documentElement;
}
function generating(){return !!document.querySelector('button[data-testid="stop-button"],button[aria-label="Stop generating"],button[aria-label="Stop streaming"]')}
function overlayStack(x,y){try{return document.elementsFromPoint(x,y).slice(0,6).map(desc)}catch(_){return[]}}
function safeSnapshot(reason,event,scroller,before,after){
  const root=document.scrollingElement||document.documentElement;
  let selection=false;try{selection=!!window.getSelection?.()&&!window.getSelection().isCollapsed}catch(_){}
  const snap={version:'0.1.0',at:new Date().toISOString(),reason,wheel:{deltaX:Number(event?.deltaX)||0,deltaY:Number(event?.deltaY)||0,defaultPrevented:!!event?.defaultPrevented},target:desc(event?.target),scroller:{before,after},documentScroller:metrics(root),htmlOverflow:getComputedStyle(document.documentElement).overflowY,bodyOverflow:document.body?getComputedStyle(document.body).overflowY:null,activeElement:desc(document.activeElement),selectionActive:selection,generating:generating(),ghost:{present:!!document.querySelector('#gitl9'),status:norm(document.querySelector('#gitl9 .status')?.textContent||'').slice(0,160),runtimeGeneration:document.documentElement.dataset.ghostplusRuntimeGeneration||null},stack:overlayStack(Number(event?.clientX)||0,Number(event?.clientY)||0)};
  lastSnapshot=snap;
  try{document.documentElement.dataset.ghostScrollLastDiagnostic=JSON.stringify(snap)}catch(_){}
  try{console.warn('[Ghost ScrollDiag] wheel produced no scroll movement',snap)}catch(_){}
  return snap;
}
function onWheel(event){
  if(event.target instanceof Element&&event.target.closest('#gitl9,#ghostplus-watch,#ghostplus-mini,#ghostplus-collapse'))return;
  const t=now();if(t-lastCheckAt<200)return;lastCheckAt=t;
  const scroller=findScroller(event.target);
  const before=metrics(scroller);if(!before||before.height<=before.client+2)return;
  const dy=Number(event.deltaY)||0;if(Math.abs(dy)<2)return;
  const max=Math.max(0,before.height-before.client);
  const atBoundary=(dy>0&&before.top>=max-2)||(dy<0&&before.top<=2);
  if(atBoundary)return;
  const x=event.clientX,y=event.clientY,target=event.target,dx=event.deltaX,dp=event.defaultPrevented;
  setTimeout(()=>{
    if(!scroller?.isConnected)return;
    const after=metrics(scroller);if(!after)return;
    if(Math.abs(after.top-before.top)<=0.5){safeSnapshot('wheel-no-movement',{deltaX:dx,deltaY:dy,defaultPrevented:dp,target,clientX:x,clientY:y},scroller,before,after)}
  },120);
}
window.addEventListener('wheel',onWheel,{capture:true,passive:true});
try{
  GM_registerMenuCommand('Copy last scroll diagnostic',()=>{
    const raw=document.documentElement.dataset.ghostScrollLastDiagnostic||JSON.stringify(lastSnapshot||{message:'No scroll stall captured yet.'},null,2);
    GM_setClipboard(raw,'text');
  });
  GM_registerMenuCommand('Log current scroll state',()=>{
    const root=document.scrollingElement||document.documentElement,m=metrics(root);
    safeSnapshot('manual-state',{deltaX:0,deltaY:0,defaultPrevented:false,target:document.activeElement,clientX:innerWidth/2,clientY:innerHeight/2},root,m,m);
  });
}catch(_){}
console.info('[Ghost ScrollDiag] active · passive only · no preventDefault/no programmatic scroll');
})();
