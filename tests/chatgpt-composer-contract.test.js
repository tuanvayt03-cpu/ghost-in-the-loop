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


test('finds a current ChatGPT send control independently from disabled readiness',()=>{
  document.body.innerHTML=`
    <main>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT">continue task</div>
        <button id="composer-submit-button" data-testid="send-button" aria-label="Send prompt" disabled></button>
      </form>
    </main>
  `;
  show(document.getElementById('prompt-textarea'));
  show(document.getElementById('composer-submit-button'),{width:36,height:36});
  const rt=boot();
  const pending=rt.dom.chatgptSendState();
  expect(pending.found).toBe(true);
  expect(pending.ready).toBe(false);
  expect(pending.why).toBe('send-not-ready');
  document.getElementById('composer-submit-button').disabled=false;
  const ready=rt.dom.chatgptSendState();
  expect(ready.ready).toBe(true);
  expect(rt.dom.isChatgptSendControl(ready.el)).toBe(true);
});

test('waits through delayed ChatGPT send-button readiness',async()=>{
  document.body.innerHTML=`
    <main>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT">continue task</div>
        <button id="composer-submit-button" data-testid="send-button" aria-label="Send prompt" disabled></button>
      </form>
    </main>
  `;
  show(document.getElementById('prompt-textarea'));
  const button=show(document.getElementById('composer-submit-button'),{width:36,height:36});
  const rt=boot(),scope=rt.module('send-wait-test');
  setTimeout(()=>{button.disabled=false},220);
  const result=await rt.dom.waitChatgptSendReady(scope,{expectedText:'continue task',timeoutMs:900});
  expect(result.ok).toBe(true);
  expect(result.waitedMs).toBeGreaterThanOrEqual(150);
  expect(result.el).toBe(button);
});

test('rejects the same composer control when it is in stop mode',()=>{
  document.body.innerHTML=`
    <main>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT">continue task</div>
        <button id="composer-submit-button" data-testid="stop-button" aria-label="Stop streaming"></button>
      </form>
    </main>
  `;
  show(document.getElementById('prompt-textarea'));
  const button=show(document.getElementById('composer-submit-button'),{width:36,height:36});
  const rt=boot();
  const state=rt.dom.chatgptSendState();
  expect(state.mode).toBe('stop');
  expect(state.ready).toBe(false);
  expect(rt.dom.isChatgptSendControl(button)).toBe(false);
});

test('supports a composer-scoped semantic submit fallback without selecting outside buttons',()=>{
  document.body.innerHTML=`
    <button type="submit" aria-label="Submit">outside</button>
    <main>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT">continue task</div>
        <button type="submit" aria-label="Send"></button>
      </form>
    </main>
  `;
  show(document.body.firstElementChild,{top:40,width:80,height:30});
  show(document.getElementById('prompt-textarea'));
  const inside=show(document.querySelector('main form button'),{width:36,height:36});
  const rt=boot();
  const state=rt.dom.chatgptSendState();
  expect(state.ready).toBe(true);
  expect(state.el).toBe(inside);
});

test('actuation fails closed if the staged composer changed and clicks exactly once when unchanged',()=>{
  document.body.innerHTML=`
    <main>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT">continue task</div>
        <button type="button" id="composer-submit-button" data-testid="send-button" aria-label="Send prompt"></button>
      </form>
    </main>
  `;
  const composer=show(document.getElementById('prompt-textarea'));
  const button=show(document.getElementById('composer-submit-button'),{width:36,height:36});
  let clicks=0;button.addEventListener('click',()=>{clicks+=1});
  const rt=boot();
  composer.textContent='user changed draft';
  expect(rt.dom.actuateChatgptSend('continue task')).toMatchObject({ok:false,attempted:false,why:'composer-changed'});
  expect(clicks).toBe(0);
  composer.textContent='continue task';
  expect(rt.dom.actuateChatgptSend('continue task')).toMatchObject({ok:true,attempted:true,why:'clicked'});
  expect(clicks).toBe(1);
});


test('falls back to data-turn roles when conversation articles and legacy author roles are absent',()=>{
  document.body.innerHTML=`
    <main>
      <div data-turn="user">keep going</div>
      <div data-turn="assistant"><div class="markdown">checkpoint reached
[[GITL::PROCEED]]</div></div>
    </main>
  `;
  document.querySelectorAll('[data-turn]').forEach(el=>show(el,{top:220}));
  const rt=boot();
  const turns=rt.dom.chatgptTurns();
  expect(turns.map(x=>x.role)).toEqual(['user','assistant']);
  expect(rt.dom.latestChatgptAssistantText()).toContain('[[GITL::PROCEED]]');
});

test('treats scoped tool/status activity as busy even when the native Stop control is missing',()=>{
  document.body.innerHTML=`
    <main>
      <div role="status">Searching the web</div>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT"></div>
        <button id="composer-submit-button" data-testid="send-button" aria-label="Send prompt"></button>
      </form>
    </main>
  `;
  show(document.querySelector('[role="status"]'),{top:300,width:180,height:20});
  show(document.getElementById('prompt-textarea'));
  show(document.getElementById('composer-submit-button'),{width:36,height:36});
  const rt=boot();
  const activity=rt.dom.chatgptActivityState();
  expect(activity.busy).toBe(true);
  expect(activity.strong).toBe(false);
  expect(rt.dom.isChatgptGenerating()).toBe(true);
  expect(rt.dom.actuateChatgptSend('')).toMatchObject({ok:false,attempted:false,why:'generation-active'});
});

test('does not infer busy from ordinary assistant prose that merely says working',()=>{
  document.body.innerHTML=`
    <main>
      <div data-message-author-role="assistant"><div class="markdown">I am working with a historical dataset in this explanation.</div></div>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT"></div>
      </form>
    </main>
  `;
  show(document.querySelector('[data-message-author-role="assistant"]'),{top:220});
  show(document.getElementById('prompt-textarea'));
  const rt=boot();
  expect(rt.dom.chatgptActivityState()).toMatchObject({busy:false});
});

test('classifies recent ChatGPT stream-resume and delivery-timeout faults explicitly',()=>{
  const rt=boot();
  expect(rt.dom.classifyChatgptFaultText('Resume stream unavailable')).toBe('STREAM_RESUME_UNAVAILABLE');
  expect(rt.dom.classifyChatgptFaultText('Message delivery timed out. Please try again.')).toBe('MESSAGE_DELIVERY_TIMEOUT');
  expect(rt.dom.classifyChatgptFaultText('Connection interrupted. Waiting for a complete response')).toBe('CONNECTION_INTERRUPTED');
  expect(rt.dom.classifyChatgptFaultText('Timed out waiting to send')).toBe('SEND_TIMEOUT');
});

test('finds Resume stream unavailable through the bounded page-text fallback',()=>{
  document.body.innerHTML=`
    <main>
      <div data-stream-error>Resume stream unavailable</div>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT"></div>
      </form>
    </main>
  `;
  show(document.querySelector('[data-stream-error]'),{top:220,width:260,height:24});
  show(document.getElementById('prompt-textarea'));
  const rt=boot();
  expect(rt.dom.chatgptFaultState()).toMatchObject({type:'STREAM_RESUME_UNAVAILABLE'});
});

test('send readiness stays blocked while inferred ChatGPT activity is still present',async()=>{
  document.body.innerHTML=`
    <main>
      <div role="status">Analyzing results</div>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT">continue task</div>
        <button id="composer-submit-button" data-testid="send-button" aria-label="Send prompt"></button>
      </form>
    </main>
  `;
  const status=show(document.querySelector('[role="status"]'),{top:300,width:150,height:20});
  show(document.getElementById('prompt-textarea'));
  show(document.getElementById('composer-submit-button'),{width:36,height:36});
  const rt=boot(),scope=rt.module('activity-send-test');
  setTimeout(()=>{status.textContent='';status.style.display='none'},240);
  const result=await rt.dom.waitChatgptSendReady(scope,{expectedText:'continue task',timeoutMs:1000});
  expect(result.ok).toBe(true);
  expect(result.waitedMs).toBeGreaterThanOrEqual(150);
});


test('recognizes an unlabeled composer-local arrow control as Send after Ghost stages text',()=>{
  document.body.innerHTML=`
    <main>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT">continue task</div>
        <button class="composer-action"><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"></path></svg></button>
      </form>
    </main>
  `;
  show(document.getElementById('prompt-textarea'));
  const button=show(document.querySelector('.composer-action'),{top:626,width:36,height:36});
  const rt=boot();
  const state=rt.dom.chatgptHostControlState();
  expect(state).toMatchObject({mode:'send',busy:false,ready:true});
  expect(state.el).toBe(button);
});

test('recognizes the square Stop glyph even when ChatGPT drops stop data-testid and aria-label',()=>{
  document.body.innerHTML=`
    <main>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT">queued draft</div>
        <button id="composer-submit-button"><svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10"></rect></svg></button>
      </form>
    </main>
  `;
  show(document.getElementById('prompt-textarea'));
  const button=show(document.getElementById('composer-submit-button'),{top:626,width:36,height:36});
  const rt=boot();
  const state=rt.dom.chatgptHostControlState();
  expect(state).toMatchObject({mode:'stop',busy:true,ready:false,why:'host-stop-control'});
  expect(state.el).toBe(button);
  expect(rt.dom.actuateChatgptSend('queued draft')).toMatchObject({ok:false,attempted:false,why:'generation-active'});
});

test('host control resolves BUSY instead of Send when scoped ChatGPT activity conflicts with an arrow control',()=>{
  document.body.innerHTML=`
    <main>
      <div role="status">Analyzing results</div>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT">continue task</div>
        <button class="composer-action"><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"></path></svg></button>
      </form>
    </main>
  `;
  show(document.querySelector('[role="status"]'),{top:300,width:160,height:20});
  show(document.getElementById('prompt-textarea'));
  show(document.querySelector('.composer-action'),{top:626,width:36,height:36});
  const rt=boot();
  expect(rt.dom.chatgptHostControlState()).toMatchObject({mode:'busy',busy:true,ready:false});
});

test('waitChatgptSendReady returns immediately as BUSY when the primary control flips from Send to Stop',async()=>{
  document.body.innerHTML=`
    <main>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT">continue task</div>
        <button id="composer-submit-button" data-testid="send-button" aria-label="Send prompt" disabled></button>
      </form>
    </main>
  `;
  show(document.getElementById('prompt-textarea'));
  const button=show(document.getElementById('composer-submit-button'),{top:626,width:36,height:36});
  const rt=boot(),scope=rt.module('send-to-stop-test');
  setTimeout(()=>{
    button.disabled=false;
    button.setAttribute('data-testid','stop-button');
    button.setAttribute('aria-label','Stop streaming');
  },180);
  const result=await rt.dom.waitChatgptSendReady(scope,{expectedText:'continue task',timeoutMs:1200});
  expect(result.ok).toBe(false);
  expect(result).toMatchObject({mode:'stop',busy:true});
  expect(result.waitedMs).toBeLessThan(900);
});

test('clearComposerIfExact removes only the Ghost-managed staged text during a BUSY race',async()=>{
  document.body.innerHTML=`
    <main>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT">ghost managed prompt</div>
        <button id="composer-submit-button" data-testid="stop-button" aria-label="Stop streaming"></button>
      </form>
    </main>
  `;
  show(document.getElementById('prompt-textarea'));
  show(document.getElementById('composer-submit-button'),{top:626,width:36,height:36});
  const rt=boot(),scope=rt.module('clear-managed-test');
  expect(await rt.dom.clearComposerIfExact('different user text',scope,{verifyMs:400})).toMatchObject({ok:false,why:'composer-changed'});
  expect(rt.dom.readComposer()).toBe('ghost managed prompt');
  expect(await rt.dom.clearComposerIfExact('ghost managed prompt',scope,{verifyMs:600})).toMatchObject({ok:true});
  expect(rt.dom.readComposer()).toBe('');
});
