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
      <article data-testid="conversation-turn-2" aria-label="ChatGPT said:">
        <div role="status">Searching the web</div>
      </article>
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
      <article data-testid="conversation-turn-2" aria-label="ChatGPT said:">
        <div role="status">Analyzing results</div>
      </article>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT">continue task</div>
        <button id="composer-submit-button" data-testid="send-button" aria-label="Send prompt"></button>
      </form>
    </main>
  `;
  show(document.querySelector('article'),{top:220,width:600,height:70});
  const status=show(document.querySelector('[role="status"]'),{top:240,width:150,height:20});
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
      <article data-testid="conversation-turn-2" aria-label="ChatGPT said:">
        <div role="status">Analyzing results</div>
      </article>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT">continue task</div>
        <button class="composer-action"><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"></path></svg></button>
      </form>
    </main>
  `;
  show(document.querySelector('article'),{top:220,width:600,height:70});
  show(document.querySelector('[role="status"]'),{top:240,width:160,height:20});
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

test('Resume stream unavailable with an empty voice-only composer resolves fault-idle instead of stale BUSY',()=>{
  document.body.innerHTML=`
    <main>
      <div data-stream-error>Resume stream unavailable</div>
      <div role="status">Resuming...</div>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT"></div>
        <button aria-label="Start voice mode"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle></svg></button>
      </form>
    </main>
  `;
  show(document.querySelector('[data-stream-error]'),{top:500,width:260,height:24});
  show(document.querySelector('[role="status"]'),{top:520,width:120,height:20});
  show(document.getElementById('prompt-textarea'));
  show(document.querySelector('button'),{top:626,width:36,height:36});
  const rt=boot();
  expect(rt.dom.chatgptFaultState()).toMatchObject({type:'STREAM_RESUME_UNAVAILABLE'});
  expect(rt.dom.chatgptActivityState()).toMatchObject({busy:false,strong:false,faultType:'STREAM_RESUME_UNAVAILABLE'});
  expect(rt.dom.chatgptHostControlState()).toMatchObject({mode:'idle',busy:false,ready:false,faultType:'STREAM_RESUME_UNAVAILABLE'});
  expect(rt.dom.isChatgptGenerating()).toBe(false);
});

test('an explicit Stop control still wins over Resume stream unavailable fault-idle suppression',()=>{
  document.body.innerHTML=`
    <main>
      <div data-stream-error>Resume stream unavailable</div>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT"></div>
        <button id="composer-submit-button" data-testid="stop-button" aria-label="Stop streaming"></button>
      </form>
    </main>
  `;
  show(document.querySelector('[data-stream-error]'),{top:500,width:260,height:24});
  show(document.getElementById('prompt-textarea'));
  show(document.getElementById('composer-submit-button'),{top:626,width:36,height:36});
  const rt=boot();
  expect(rt.dom.chatgptHostControlState()).toMatchObject({mode:'stop',busy:true,ready:false});
  expect(rt.dom.isChatgptGenerating()).toBe(true);
});

test('a staged recovery prompt may resolve Send readiness while Resume stream unavailable remains visible',async()=>{
  document.body.innerHTML=`
    <main>
      <div data-stream-error>Resume stream unavailable</div>
      <div role="status">Resuming...</div>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT">recovery status probe</div>
        <button id="composer-submit-button" data-testid="send-button" aria-label="Send prompt"></button>
      </form>
    </main>
  `;
  show(document.querySelector('[data-stream-error]'),{top:500,width:260,height:24});
  show(document.querySelector('[role="status"]'),{top:520,width:120,height:20});
  show(document.getElementById('prompt-textarea'));
  const send=show(document.getElementById('composer-submit-button'),{top:626,width:36,height:36});
  const rt=boot(),scope=rt.module('resume-fault-send-test');
  expect(rt.dom.chatgptHostControlState()).toMatchObject({mode:'send',busy:false,ready:true});
  const ready=await rt.dom.waitChatgptSendReady(scope,{expectedText:'recovery status probe',timeoutMs:600});
  expect(ready).toMatchObject({ok:true,mode:'send',ready:true});
  expect(ready.el).toBe(send);
});

test('fault fallback ignores ordinary conversation prose that quotes ChatGPT error text',()=>{
  document.body.innerHTML=`
    <main>
      <article data-testid="conversation-turn-1" aria-label="You said:">
        <div class="markdown">Why does ChatGPT say Resume stream unavailable?</div>
      </article>
      <article data-testid="conversation-turn-2" aria-label="ChatGPT said:">
        <div class="markdown">The phrase "Message delivery timed out. Please try again." is an error message you may encounter.</div>
      </article>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT"></div>
        <button aria-label="Start voice mode"></button>
      </form>
    </main>
  `;
  document.querySelectorAll('article,.markdown').forEach((el,i)=>show(el,{top:180+i*30,width:500,height:24}));
  show(document.getElementById('prompt-textarea'));
  show(document.querySelector('button'),{top:626,width:36,height:36});
  const rt=boot();
  expect(rt.dom.chatgptFaultState()).toMatchObject({type:''});
  expect(rt.dom.chatgptHostControlState()).toMatchObject({mode:'idle',busy:false,ready:false,why:'resting-composer-control'});
});

test('ignores stale page-global loading status when the composer is visibly resting',()=>{
  document.body.innerHTML=`
    <main>
      <div role="status">Đang tải tin nhắn cũ...</div>
      <article data-testid="conversation-turn-2" aria-label="ChatGPT said:">
        <div class="markdown">Final answer is already complete.</div>
      </article>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT"></div>
        <button aria-label="Start voice mode"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle></svg></button>
      </form>
    </main>
  `;
  show(document.querySelector('[role="status"]'),{top:80,width:240,height:20});
  show(document.querySelector('article'),{top:250,width:600,height:80});
  show(document.querySelector('.markdown'),{top:270,width:500,height:30});
  show(document.getElementById('prompt-textarea'));
  show(document.querySelector('button'),{top:626,width:36,height:36});
  const rt=boot();
  expect(rt.dom.chatgptActivityState()).toMatchObject({busy:false});
  expect(rt.dom.chatgptHostControlState()).toMatchObject({mode:'idle',busy:false,ready:false,why:'resting-composer-control'});
  expect(rt.dom.isChatgptGenerating()).toBe(false);
});

test('ignores page-global progress indicators that are unrelated to the active assistant/composer',()=>{
  document.body.innerHTML=`
    <main>
      <div role="progressbar">Loading conversation history</div>
      <article data-testid="conversation-turn-2" aria-label="ChatGPT said:">
        <div class="markdown">Done.</div>
      </article>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT"></div>
        <button aria-label="Start voice mode"></button>
      </form>
    </main>
  `;
  show(document.querySelector('[role="progressbar"]'),{top:90,width:200,height:18});
  show(document.querySelector('article'),{top:250,width:600,height:80});
  show(document.querySelector('.markdown'),{top:270,width:500,height:30});
  show(document.getElementById('prompt-textarea'));
  show(document.querySelector('button'),{top:626,width:36,height:36});
  const rt=boot();
  expect(rt.dom.chatgptActivityState()).toMatchObject({busy:false});
  expect(rt.dom.chatgptHostControlState()).toMatchObject({mode:'idle',busy:false});
});

test('scoped weak status expires after its TTL when no Stop control corroborates it',()=>{
  const realNow=window.Date.now;
  let fakeNow=1_000_000;
  window.Date.now=()=>fakeNow;
  try{
    document.body.innerHTML=`
      <main>
        <article data-testid="conversation-turn-2" aria-label="ChatGPT said:">
          <div role="status">Đang tải dữ liệu...</div>
        </article>
        <form data-type="unified-composer">
          <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT"></div>
          <button aria-label="Start voice mode"></button>
        </form>
      </main>
    `;
    show(document.querySelector('article'),{top:240,width:600,height:80});
    show(document.querySelector('[role="status"]'),{top:260,width:180,height:20});
    show(document.getElementById('prompt-textarea'));
    show(document.querySelector('button'),{top:626,width:36,height:36});
    const rt=boot();
    expect(rt.dom.chatgptActivityState()).toMatchObject({busy:true,strong:false});
    expect(rt.dom.chatgptHostControlState()).toMatchObject({mode:'busy',busy:true});
    fakeNow+=12001;
    expect(rt.dom.chatgptActivityState()).toMatchObject({busy:false});
    expect(rt.dom.chatgptHostControlState()).toMatchObject({mode:'idle',busy:false,why:'resting-composer-control'});
  }finally{
    window.Date.now=realNow;
  }
});

test('changing scoped weak status text re-arms its TTL while unchanged stale text does not',()=>{
  const realNow=window.Date.now;
  let fakeNow=2_000_000;
  window.Date.now=()=>fakeNow;
  try{
    document.body.innerHTML=`
      <main>
        <article data-testid="conversation-turn-2" aria-label="ChatGPT said:">
          <div role="status">Analyzing results</div>
        </article>
        <form data-type="unified-composer">
          <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT"></div>
          <button aria-label="Start voice mode"></button>
        </form>
      </main>
    `;
    show(document.querySelector('article'),{top:240,width:600,height:80});
    const status=show(document.querySelector('[role="status"]'),{top:260,width:180,height:20});
    show(document.getElementById('prompt-textarea'));
    show(document.querySelector('button'),{top:626,width:36,height:36});
    const rt=boot();
    expect(rt.dom.chatgptActivityState().busy).toBe(true);
    fakeNow+=12001;
    expect(rt.dom.chatgptActivityState().busy).toBe(false);
    status.textContent='Searching the web';
    expect(rt.dom.chatgptActivityState()).toMatchObject({busy:true,strong:false});
  }finally{
    window.Date.now=realNow;
  }
});

test('explicit ready Send beats unrelated global stale loading text',()=>{
  document.body.innerHTML=`
    <main>
      <div role="status">Đang tải tin nhắn cũ...</div>
      <form data-type="unified-composer">
        <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT">continue</div>
        <button id="composer-submit-button" data-testid="send-button" aria-label="Send prompt"></button>
      </form>
    </main>
  `;
  show(document.querySelector('[role="status"]'),{top:80,width:240,height:20});
  show(document.getElementById('prompt-textarea'));
  show(document.getElementById('composer-submit-button'),{top:626,width:36,height:36});
  const rt=boot();
  expect(rt.dom.chatgptActivityState()).toMatchObject({busy:false});
  expect(rt.dom.chatgptHostControlState()).toMatchObject({mode:'send',busy:false,ready:true});
});
test('Tampermonkey loader, embedded core and Firefox manifest are ChatGPT-only',()=>{
  const root=path.resolve(__dirname,'..');
  for(const filename of ['ghost-plus.user.js','ghost-in-the-loop.user.js']){
    const source=fs.readFileSync(path.join(root,filename),'utf8');
    const matches=source.split(/\r?\n/).filter(line=>line.startsWith('// @match')).map(line=>line.slice('// @match'.length).trim());
    expect(matches).toEqual(['https://chatgpt.com/*','https://chat.openai.com/*']);
  }
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'extension','manifest.json'),'utf8'));
  expect(manifest.content_scripts[0].matches).toEqual(['https://chatgpt.com/*','https://chat.openai.com/*']);
});

test('reads all markdown blocks in a completed assistant reply and retains the last terminal line',()=>{
  document.body.innerHTML=`
  <main>
    <article data-testid="conversation-turn-10" aria-label="You said:">Continue study</article>
    <article data-testid="conversation-turn-11" aria-label="ChatGPT said:">
      <div class="markdown"><h3>Trader results</h3><table><tr><td>Stable Growth 3</td><td>20.53%</td></tr></table></div>
      <div class="markdown"><p>Git commit pushed successfully</p></div>
      <div class="markdown"><p>Checkpoint saved.</p><p>[[GITL::HALT]]</p></div>
    </article>
  </main>`;
  document.querySelectorAll('article').forEach(el=>show(el,{top:220}));
  const rt=boot(),text=rt.dom.latestChatgptAssistantText();
  expect(text).toContain('Trader results');
  expect(text).toContain('Git commit pushed successfully');
  expect(text).toContain('Checkpoint saved.');
  expect(text.endsWith('[[GITL::HALT]]')).toBe(true);
});

test('finds an assistant author container when user and assistant have different wrappers',()=>{
  document.body.innerHTML=`
  <main>
    <article data-testid="conversation-turn-10" aria-label="You said:">Please continue</article>
    <section data-message-author-role="assistant">
      <div class="markdown">Work done.</div><div class="markdown">[[GITL::PROCEED]]</div>
    </section>
  </main>`;
  document.querySelectorAll('article,section').forEach(el=>show(el,{top:220}));
  const rt=boot();
  expect(rt.dom.chatgptTurns().map(x=>x.role)).toEqual(['user','assistant']);
  expect(rt.dom.latestChatgptAssistantText()).toContain('[[GITL::PROCEED]]');
});

test('uses a local assistant copy-action as fallback when a turn loses its role attribute',()=>{
  document.body.innerHTML=`
  <main>
    <article data-testid="conversation-turn-10" aria-label="You said:">next?</article>
    <article data-testid="conversation-turn-11">
      <div class="markdown">The simulation is complete.</div>
      <div class="markdown">There are zero copy-ready accounts.</div>
      <button aria-label="Copy" data-testid="copy-turn-action-button">Copy</button>
    </article>
  </main>`;
  document.querySelectorAll('article,button').forEach(el=>show(el,{top:220}));
  const rt=boot();
  expect(rt.dom.latestChatgptAssistantText()).toContain('The simulation is complete.');
  expect(rt.dom.latestChatgptAssistantText()).toContain('There are zero copy-ready accounts.');
});

test('never infers assistant output from a user quote or an unrelated markdown panel',()=>{
  document.body.innerHTML=`
  <main>
    <article data-testid="conversation-turn-10" aria-label="You said:"><div class="markdown">[[GITL::HALT]]</div></article>
    <div class="unrelated-panel"><div class="markdown">Summary posted</div><button aria-label="Copy">Copy</button></div>
  </main>`;
  document.querySelectorAll('article,.unrelated-panel,button').forEach(el=>show(el,{top:220}));
  const rt=boot();
  expect(rt.dom.latestChatgptAssistantText()).toBe('');
  expect(rt.dom.chatgptTurns().map(x=>x.role)).toEqual(['user']);
});

test('recovers an assistant answer whose article/role wrapper disappeared but turn copy action survives',()=>{
  document.body.innerHTML=`
  <main>
    <article data-testid="conversation-turn-8" aria-label="You said:">Scan the trader dataset</article>
    <div class="group assistant-result">
      <div><div class="markdown">I processed 45 scenarios.</div></div>
      <div class="reply-toolbar"><button data-testid="copy-turn-action-button" aria-label="Copy">Copy</button></div>
    </div>
  </main>`;
  document.querySelectorAll('article,.assistant-result,button').forEach(el=>show(el,{top:220}));
  const rt=boot();
  expect(rt.dom.chatgptTurns().map(x=>x.role)).toEqual(['user','assistant']);
  expect(rt.dom.latestChatgptAssistantText()).toBe('I processed 45 scenarios.');
});

test('an old assistant message is not mistaken for the answer to a newer user turn',()=>{
  document.body.innerHTML=`
  <main>
    <article data-testid="conversation-turn-6" aria-label="ChatGPT said:"><div class="markdown">[[GITL::HALT]]</div></article>
    <article data-testid="conversation-turn-7" aria-label="You said:">Please continue</article>
  </main>`;
  document.querySelectorAll('article').forEach(el=>show(el,{top:220}));
  const rt=boot();
  expect(rt.dom.chatgptTurns().map(x=>x.role)).toEqual(['assistant','user']);
  expect(rt.dom.latestChatgptAssistantText()).toBe('');
});

test('a text block uses textContent when innerText is an empty string',()=>{
  document.body.innerHTML=`
  <main><article data-testid="conversation-turn-2" aria-label="ChatGPT said:">
    <div class="markdown">Completed and saved. [[GITL::HALT]]</div>
  </article></main>`;
  show(document.querySelector('article'),{top:220});
  Object.defineProperty(document.querySelector('.markdown'),'innerText',{configurable:true,value:''});
  const rt=boot();
  expect(rt.dom.latestChatgptAssistantText()).toContain('Completed and saved.');
});
test('Ghost title cleaner removes legacy badge stacks but keeps the task name',()=>{
  const rt=boot(),clean=rt.dom.cleanGhostTabTitle;
  expect(clean('🔴 HUMAN · 🔴 HUMAN · Copy trade research')).toBe('Copy trade research');
  expect(clean('🟠 RELAY · 🔴 HUMAN · Second Brain')).toBe('Second Brain');
  expect(clean('🔴 Top Down')).toBe('Top Down');
  expect(clean('HUMAN research project')).toBe('HUMAN research project');
  expect(clean('🔴 HUMAN · 🔴 HUMAN')).toBe('');
});

test('modern data-turn-key ChatGPT group exposes user and assistant as separate ordered messages',()=>{
  document.body.innerHTML=`
    <main>
      <div data-turn-key="conv-turn-1">
        <div data-user-message-bubble>continue the project</div>
        <section data-conversation-role="assistant">
          <div class="markdown">Final checklist</div>
          <div class="markdown">[[GITL::HALT]]</div>
        </section>
      </div>
    </main>`;
  const rt=boot();
  expect(rt.dom.chatgptTurns().map(x=>x.role)).toEqual(['user','assistant']);
  expect(rt.dom.chatgptUserCount()).toBe(1);
  expect(rt.dom.latestChatgptAssistantText()).toContain('Final checklist');
  expect(rt.dom.latestChatgptAssistantText()).toContain('[[GITL::HALT]]');
});

test('modern data-turn-key group with only new user message does not reuse an old assistant answer',()=>{
  document.body.innerHTML=`
    <main>
      <div data-turn-key="conv-turn-1">
        <div data-user-message-bubble>previous request</div>
        <div data-conversation-role="assistant"><div class="markdown">Previous answer</div></div>
      </div>
      <div data-turn-key="conv-turn-2"><div data-user-message-bubble>new user request</div></div>
    </main>`;
  const rt=boot();
  expect(rt.dom.chatgptTurns().map(x=>x.role)).toEqual(['user','assistant','user']);
  expect(rt.dom.latestChatgptAssistantText()).toBe('');
});

test('ChatGPT message receipt requires new matching user text rather than Stop, cleared composer or unrelated reply',()=>{
  document.body.innerHTML=`
    <main><div data-turn-key="conv-turn-1"><div data-user-message-bubble>previous request</div></div></main>`;
  const rt=boot();
  const before=rt.dom.chatgptUserSnapshot();
  expect(rt.dom.chatgptSubmissionObserved(before,'run exact checklist')).toBe(false);
  document.querySelector('[data-user-message-bubble]').textContent='unrelated manual message';
  expect(rt.dom.chatgptSubmissionObserved(before,'run exact checklist')).toBe(false);
  document.querySelector('[data-user-message-bubble]').textContent='run exact checklist';
  expect(rt.dom.chatgptSubmissionObserved(before,'run exact checklist')).toBe(true);
});

test('missing pre-submit snapshot cannot acknowledge an already visible matching user message',()=>{
  document.body.innerHTML=`<main><div data-turn-key="a"><div data-user-message-bubble>continue safely</div></div></main>`;
  const rt=boot();
  expect(rt.dom.chatgptSubmissionObserved(null,'continue safely')).toBe(false);
  expect(rt.dom.chatgptSubmissionObserved({count:1,latestText:'continue safely'},'continue safely')).toBe(false);
});
