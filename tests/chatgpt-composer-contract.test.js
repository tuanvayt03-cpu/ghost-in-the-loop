/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://chatgpt.com/"}
 */
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.resolve(__dirname,'..','ghost-plus-runtime-manager.js'),'utf8');

function boot(){
  delete window.__ghostPlusRuntime;
  delete window.__ghostPlusRuntimeSeq;
  window.eval(source);
  return window.__ghostPlusRuntime;
}
function show(el,{top=620,width=700,height=52}={}){
  Object.defineProperty(el,'offsetWidth',{configurable:true,value:width});
  Object.defineProperty(el,'offsetHeight',{configurable:true,value:height});
  el.getClientRects=()=>[{top,left:20,bottom:top+height,right:20+width,width,height}];
  el.getBoundingClientRect=()=>({top,left:20,bottom:top+height,right:20+width,width,height,x:20,y:top,toJSON(){}});
  return el;
}

afterEach(()=>{
  try{window.__ghostPlusRuntime?.destroy?.('test')}catch(_){}
  document.body.innerHTML='';
  delete window.__ghostPlusRuntime;
  delete window.__ghostPlusRuntimeSeq;
});

test('resolves the current ChatGPT composer while rejecting sidebar search decoys',()=>{
  document.body.innerHTML=`
    <aside><textarea aria-label="Search"></textarea></aside>
    <main><form data-type="unified-composer"><div role="textbox" contenteditable="true" aria-label="Message ChatGPT"></div></form></main>
  `;
  show(document.querySelector('aside textarea'),{top:80,width:240});
  const composer=show(document.querySelector('main [role="textbox"]'));
  const rt=boot();
  expect(rt.dom.composer()).toBe(composer);
});

test('fails closed when two non-strong composer candidates are equally plausible',()=>{
  document.body.innerHTML=`
    <main>
      <form><div role="textbox" contenteditable="true" aria-label="Message ChatGPT"></div></form>
      <form><div role="textbox" contenteditable="true" aria-label="Message ChatGPT"></div></form>
    </main>
  `;
  document.querySelectorAll('[role="textbox"]').forEach(el=>show(el));
  const rt=boot();
  expect(rt.dom.composer()).toBeNull();
});

test('staged write reacquires a composer replaced by React reconciliation',async()=>{
  document.body.innerHTML=`<main><form data-type="unified-composer"><div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT"></div></form></main>`;
  const original=show(document.getElementById('prompt-textarea'));
  original.addEventListener('input',()=>{
    const replacement=original.cloneNode(false);
    replacement.textContent=original.textContent;
    show(replacement);
    original.replaceWith(replacement);
  },{once:true});
  const rt=boot(), scope=rt.module('composer-test');
  const result=await rt.dom.stageComposerText('status probe payload',scope,{requireEmpty:true,verifyMs:700});
  expect(result.ok).toBe(true);
  expect(result.replaced).toBe(true);
  expect(rt.dom.readComposer(rt.dom.composer())).toBe('status probe payload');
});

test('requireEmpty prevents recovery from overwriting a user draft',async()=>{
  document.body.innerHTML=`<main><form data-type="unified-composer"><div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT">my draft</div></form></main>`;
  show(document.getElementById('prompt-textarea'));
  const rt=boot(), scope=rt.module('draft-test');
  const result=await rt.dom.stageComposerText('recovery probe',scope,{requireEmpty:true,verifyMs:400});
  expect(result).toMatchObject({ok:false,why:'composer-not-empty'});
  expect(rt.dom.readComposer(rt.dom.composer())).toBe('my draft');
});


test('reads current conversation-turn articles and preserves terminal marker line boundaries',()=>{
  document.body.innerHTML=`
    <main>
      <article data-testid="conversation-turn-1" aria-label="You said:"><div>continue this task</div></article>
      <article data-testid="conversation-turn-2" aria-label="ChatGPT said:"><div class="markdown">working result
[[GITL::PROCEED]]</div></article>
    </main>
  `;
  document.querySelectorAll('article').forEach(el=>show(el,{top:200}));
  const rt=boot();
  const turns=rt.dom.chatgptTurns();
  expect(turns.map(x=>x.role)).toEqual(['user','assistant']);
  expect(turns[1].text).toContain('\n[[GITL::PROCEED]]');
  expect(rt.dom.latestChatgptAssistantText()).toBe('working result\n[[GITL::PROCEED]]');
  expect(rt.dom.chatgptUserCount()).toBe(1);
});

test('detects the current composer stop-button mode as active generation',()=>{
  document.body.innerHTML=`
    <main>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT"></div>
        <button id="composer-submit-button" data-testid="stop-button" aria-label="Stop streaming"></button>
      </form>
    </main>
  `;
  show(document.getElementById('prompt-textarea'));
  const stop=show(document.getElementById('composer-submit-button'),{width:36,height:36});
  const rt=boot();
  expect(rt.dom.isChatgptGenerating()).toBe(true);
  stop.setAttribute('data-testid','send-button');
  stop.setAttribute('aria-label','Send prompt');
  expect(rt.dom.isChatgptGenerating()).toBe(false);
});

test('recognizes a thinking status leaf in the latest turn without scanning answer prose',()=>{
  document.body.innerHTML=`
    <main>
      <article data-testid="conversation-turn-2" aria-label="ChatGPT said:">
        <div><span data-status>Thinking</span></div>
      </article>
    </main>
  `;
  const article=show(document.querySelector('article'),{top:200});
  show(document.querySelector('[data-status]'),{top:230,width:80,height:20});
  const rt=boot();
  expect(rt.dom.isChatgptGenerating()).toBe(true);
  document.querySelector('[data-status]').className='markdown';
  expect(rt.dom.isChatgptGenerating()).toBe(false);
});
