// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT=path.resolve(__dirname,'../..');
const RUNTIME=fs.readFileSync(path.join(ROOT,'ghost-plus-runtime-manager.js'),'utf8');
const ROUTER=fs.readFileSync(path.join(ROOT,'ghost-plus-alert-router.js'),'utf8');
const TELEGRAM=fs.readFileSync(path.join(ROOT,'ghost-plus-telegram.js'),'utf8');

const GM=`
window.__gmStore={
  'ghostplus.tg.enabled':true,
  'ghostplus.tg.token':'123456:TESTTOKEN',
  'ghostplus.tg.chat':'-1001234567890'
};
window.__desktop=[];
window.__telegram=[];
window.GM_getValue=(k,d)=>Object.prototype.hasOwnProperty.call(window.__gmStore,k)?window.__gmStore[k]:d;
window.GM_setValue=(k,v)=>{window.__gmStore[k]=v};
window.GM_setClipboard=()=>{};
window.GM_notification=(o)=>{window.__desktop.push(typeof o==='string'?{text:o}:o)};
window.GM_xmlhttpRequest=(o)=>{
  let body={};try{body=JSON.parse(o.data||'{}')}catch(_){}
  window.__telegram.push({url:o.url,body});
  setTimeout(()=>o.onload?.({status:200,responseText:'{"ok":true,"result":{"message_id":1}}'}),0);
  return {abort(){}};
};
`;

async function boot(page,{telegram=false}={}){
  await page.route('https://chatgpt.com/**',route=>route.fulfill({
    status:200,contentType:'text/html',
    body:'<!doctype html><html><body><main><form data-type="unified-composer"><div id="prompt-textarea" role="textbox" contenteditable="true"></div><button aria-label="Start voice mode">voice</button></form></main></body></html>'
  }));
  await page.goto('https://chatgpt.com/c/alert-dedupe');
  await page.addScriptTag({content:GM+'\n'+RUNTIME+'\n'+ROUTER+(telegram?'\n'+TELEGRAM:'')});
  await page.waitForFunction(()=>!!window.__ghostPlusAlerts);
}

test('alert router emits one notification/subscriber event for one semantic CORE_BLOCKED episode',async({page})=>{
  await boot(page);
  const result=await page.evaluate(()=>{
    let delivered=0;window.__ghostPlusAlerts.subscribe(()=>delivered++);
    const suppressed=[];
    for(let i=0;i<6;i++){
      suppressed.push(window.__ghostPlusAlerts.emit({
        id:'volatile-'+i,
        type:'CORE_BLOCKED',severity:'critical',group:'core',
        title:'Ghost core blocked',
        text:'PLAY-HOST-CONTROL: ChatGPT host control unresolved',
        reason:'PLAY-HOST-CONTROL: ChatGPT host control unresolved',
        source:'structured'
      }).suppressed===true);
    }
    const distinct=window.__ghostPlusAlerts.emit({
      id:'distinct',type:'CORE_BLOCKED',severity:'critical',group:'core',
      title:'Ghost core blocked',
      text:'PLAY-INPUT: composer missing',
      reason:'PLAY-INPUT: composer missing',
      source:'structured'
    });
    return {desktop:window.__desktop.length,delivered,suppressed,distinctSuppressed:distinct.suppressed};
  });
  expect(result.desktop).toBe(1); // distinct critical reason is still inside desktop group-rate-limit
  expect(result.delivered).toBe(2);
  expect(result.suppressed.filter(Boolean)).toHaveLength(5);
  expect(result.distinctSuppressed).toBe(false);
});

test('Telegram independently dedupes repeated critical events even when volatile ids differ',async({page})=>{
  await boot(page,{telegram:true});
  const result=await page.evaluate(async()=>{
    const mk=i=>({
      id:'volatile-'+i,
      type:'CORE_BLOCKED',severity:'critical',group:'core',
      title:'Ghost core blocked',
      text:'PLAY-HOST-CONTROL: ChatGPT host control unresolved',
      reason:'PLAY-HOST-CONTROL: ChatGPT host control unresolved',
      source:'structured',at:Date.now()+i
    });
    const outcomes=await Promise.all([0,1,2,3,4].map(i=>window.__ghostPlusTelegram.send(mk(i))));
    await new Promise(r=>setTimeout(r,30));
    const first=window.__telegram.filter(x=>/sendMessage$/.test(x.url)).length;
    const different=await window.__ghostPlusTelegram.send({
      ...mk(99),
      text:'PLAY-INPUT: composer missing',
      reason:'PLAY-INPUT: composer missing'
    });
    await new Promise(r=>setTimeout(r,30));
    return {
      outcomes,
      first,
      after:window.__telegram.filter(x=>/sendMessage$/.test(x.url)).length,
      different
    };
  });
  expect(result.first).toBe(1);
  expect(result.after).toBe(2);
  expect(result.outcomes.filter(Boolean)).toHaveLength(1);
  expect(result.different).toBe(true);
});

test('legacy desktop notices with identical meaning are also semantically deduped',async({page})=>{
  await boot(page);
  const result=await page.evaluate(()=>{
    for(let i=0;i<5;i++)GM_notification({
      title:'Ghost+ watchdog',
      text:'ChatGPT vẫn đang thực thi (host-busy). Không recovery.'
    });
    return window.__desktop.length;
  });
  expect(result).toBe(1);
});
