// ==UserScript==
// @name         Ghost Scroll Diagnostic (manual)
// @namespace    https://github.com/tuanvayt03-cpu/ghost-in-the-loop
// @version      0.2.0
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
try{document.documentElement.dataset.ghostScrollDiagActive='1'}catch(_){}
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
  const snap={version:'0.2.0',at:new Date().toISOString(),reason,wheel:{deltaX:Number(event?.deltaX)||0,deltaY:Number(event?.deltaY)||0,defaultPrevented:!!event?.defaultPrevented},target:desc(event?.target),scroller:{before,after},documentScroller:metrics(root),htmlOverflow:getComputedStyle(document.documentElement).overflowY,bodyOverflow:document.body?getComputedStyle(document.body).overflowY:null,activeElement:desc(document.activeElement),selectionActive:selection,generating:generating(),ghost:{present:!!document.querySelector('#gitl9'),status:norm(document.querySelector('#gitl9 .status')?.textContent||'').slice(0,160),runtimeGeneration:document.documentElement.dataset.ghostplusRuntimeGeneration||null},stack:overlayStack(Number(event?.clientX)||0,Number(event?.clientY)||0)};
  lastSnapshot=snap;
  try{document.documentElement.dataset.ghostScrollLastDiagnostic=JSON.stringify(snap)}catch(_){}
  try{console.warn('[Ghost ScrollDiag] wheel produced no scroll movement',snap)}catch(_){}
  return snap;
}
function currentSnapshot(reason='manual-state'){
  const root=document.scrollingElement||document.documentElement,m=metrics(root);
  return safeSnapshot(reason,{deltaX:0,deltaY:0,defaultPrevented:false,target:document.activeElement,clientX:innerWidth/2,clientY:innerHeight/2},root,m,m);
}
function copySnapshot(){
  const snap=lastSnapshot||currentSnapshot('manual-copy');
  const raw=JSON.stringify(snap,null,2);
  try{GM_setClipboard(raw,'text')}catch(_){try{navigator.clipboard?.writeText?.(raw)}catch(_){}}
  return raw;
}
function addWidget(){
  if(document.querySelector('#ghost-scroll-diag-widget'))return;
  const wrap=document.createElement('div');
  wrap.id='ghost-scroll-diag-widget';
  wrap.innerHTML='<span data-dbg-title>DBG</span><button type="button" data-dbg-copy>Copy</button><button type="button" data-dbg-log>Log</button>';
  Object.assign(wrap.style,{position:'fixed',right:'14px',bottom:'14px',zIndex:'2147483646',display:'flex',gap:'4px',alignItems:'center',padding:'5px 6px',border:'1px solid #f59e0b',borderRadius:'9px',background:'rgba(255,251,235,.96)',boxShadow:'0 2px 10px rgba(0,0,0,.15)',font:'12px/1.2 system-ui,sans-serif',color:'#92400e'});
  for(const b of wrap.querySelectorAll('button'))Object.assign(b.style,{border:'1px solid #fbbf24',borderRadius:'6px',background:'#fff',padding:'3px 7px',cursor:'pointer',font:'inherit'});
  wrap.querySelector('[data-dbg-copy]').addEventListener('click',()=>{
    copySnapshot();
    const t=wrap.querySelector('[data-dbg-title]');const old=t.textContent;t.textContent='Copied';setTimeout(()=>{if(t.isConnected)t.textContent=old},900);
  });
  wrap.querySelector('[data-dbg-log]').addEventListener('click',()=>currentSnapshot('manual-widget-log'));
  (document.body||document.documentElement).appendChild(wrap);
}
function onWheel(event){
  if(event.target instanceof Element&&event.target.closest('#gitl9,#ghostplus-watch,#ghostplus-mini,#ghostplus-collapse,#ghost-scroll-diag-widget'))return;
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
  GM_registerMenuCommand('Copy last scroll diagnostic',copySnapshot);
  GM_registerMenuCommand('Log current scroll state',()=>currentSnapshot('manual-menu-log'));
}catch(_){}
addWidget();
console.info('[Ghost ScrollDiag] active · widget ready · passive only · no preventDefault/no programmatic scroll');
})();
