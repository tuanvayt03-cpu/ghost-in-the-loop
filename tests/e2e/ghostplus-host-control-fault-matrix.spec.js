// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const RUNTIME = fs.readFileSync(path.join(ROOT, 'ghost-plus-runtime-manager.js'), 'utf8');
const CORE = fs.readFileSync(path.join(ROOT, 'ghost-in-the-loop.user.js'), 'utf8')
  .replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/m, '');

const GM = `
window.__gmStore = {};
window.GM_getValue = (k, d) => Object.prototype.hasOwnProperty.call(window.__gmStore, k) ? window.__gmStore[k] : d;
window.GM_setValue = (k, v) => { window.__gmStore[k] = v; };
window.GM_setClipboard = () => {};
window.GM_notification = () => {};
window.GM_xmlhttpRequest = () => {};
`;

function html(body) {
  return `<!doctype html><html><head><style>
    body{font:14px system-ui;margin:0;min-height:900px}
    main{padding:24px}
    form[data-type="unified-composer"]{position:fixed;left:20%;right:20%;bottom:20px;display:flex;gap:8px;align-items:end}
    #prompt-textarea{min-height:48px;flex:1;border:1px solid #999;padding:8px}
    button{min-width:36px;min-height:36px}
  </style></head><body><main>${body}</main></body></html>`;
}

const composer = (action, draft='') => `
<form data-type="unified-composer">
  <div id="prompt-textarea" role="textbox" contenteditable="true" aria-label="Message ChatGPT">${draft}</div>
  ${action}
</form>`;

async function openFixture(page, body, { core=false } = {}) {
  await page.route('https://chatgpt.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: html(body)
  }));
  await page.goto('https://chatgpt.com/c/ghostplus-fault-matrix');
  await page.addScriptTag({ content: GM + '\n' + RUNTIME + (core ? '\n' + CORE : '') });
  await page.waitForFunction(() => !!window.__ghostPlusRuntime);
  if (core) await expect(page.locator('#gitl9')).toBeVisible({ timeout: 5000 });
}

async function host(page) {
  return page.evaluate(() => {
    const rt = window.__ghostPlusRuntime;
    const state = rt.dom.chatgptHostControlState();
    const fault = rt.dom.chatgptFaultState();
    const activity = rt.dom.chatgptActivityState();
    return {
      mode: state.mode,
      busy: state.busy,
      ready: state.ready,
      why: state.why,
      faultType: state.faultType || fault.type || '',
      generating: rt.dom.isChatgptGenerating(),
      activityBusy: activity.busy,
      activityStrong: activity.strong,
      activityReason: activity.reason
    };
  });
}

test.describe('Ghost+ authoritative ChatGPT host-control fault matrix', () => {
  test('explicit Stop is authoritative and Play adopts without a host Send', async ({ page }) => {
    await openFixture(page, composer(
      '<button id="composer-submit-button" data-testid="stop-button" aria-label="Stop streaming" type="button">■</button>'
    ), { core:true });
    await page.evaluate(() => {
      window.__host = { clicks:0 };
      document.getElementById('composer-submit-button').addEventListener('click', () => window.__host.clicks++);
    });

    expect(await host(page)).toMatchObject({ mode:'stop', busy:true, generating:true });
    await page.locator('#gitl9 [data-a="play"]').click();
    await expect(page.locator('#gitl9 .status')).toContainText('RUNNING');
    expect(await page.evaluate(() => window.__host.clicks)).toBe(0);
  });

  test('ready Send with a staged user task dispatches once and only once', async ({ page }) => {
    await openFixture(page, composer(
      '<button id="composer-submit-button" data-testid="send-button" aria-label="Send prompt" type="button">↑</button>',
      'finish the current task'
    ), { core:true });
    await page.evaluate(() => {
      window.__host = { clicks:0 };
      const button = document.getElementById('composer-submit-button');
      button.addEventListener('click', () => {
        window.__host.clicks++;
        const article = document.createElement('article');
        article.setAttribute('data-testid', 'conversation-turn-user-' + window.__host.clicks);
        article.setAttribute('aria-label', 'You said:');
        article.textContent = document.getElementById('prompt-textarea').textContent || 'sent';
        document.querySelector('main').prepend(article);
        button.setAttribute('data-testid', 'stop-button');
        button.setAttribute('aria-label', 'Stop streaming');
        button.textContent = '■';
      });
    });

    expect(await host(page)).toMatchObject({ mode:'send', busy:false, ready:true, generating:false });
    await page.locator('#gitl9 [data-a="play"]').click();
    await expect.poll(() => page.evaluate(() => window.__host.clicks)).toBe(1);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__host.clicks)).toBe(1);
  });

  test('Resume stream unavailable + stale Resuming + voice-only composer is fault-idle, never fake BUSY', async ({ page }) => {
    await openFixture(page,
      '<div data-stream-error>Resume stream unavailable</div>' +
      '<div role="status">Resuming...</div>' +
      composer('<button aria-label="Start voice mode" type="button">voice</button>'),
      { core:true }
    );

    expect(await host(page)).toMatchObject({
      mode:'idle',
      busy:false,
      ready:false,
      faultType:'STREAM_RESUME_UNAVAILABLE',
      generating:false,
      activityBusy:false
    });

    await page.locator('#gitl9 [data-a="play"]').click();
    await expect(page.locator('#gitl9 .status')).toContainText('PAUSED');
    await expect(page.locator('#gitl9 .status')).toContainText('STREAM_RESUME_UNAVAILABLE');
  });

  test('RUNNING Ghost releases stale Model-working state when Stop becomes Resume stream unavailable', async ({ page }) => {
    await openFixture(page, composer(
      '<button id="composer-submit-button" data-testid="stop-button" aria-label="Stop streaming" type="button">■</button>'
    ), { core:true });

    await page.locator('#gitl9 [data-a="play"]').click();
    await expect(page.locator('#gitl9 .status')).toContainText('RUNNING');

    await page.evaluate(() => {
      const main=document.querySelector('main');
      const error=document.createElement('div');
      error.setAttribute('data-stream-error','');
      error.textContent='Resume stream unavailable';
      main.prepend(error);
      const stale=document.createElement('div');
      stale.setAttribute('role','status');
      stale.textContent='Resuming...';
      main.prepend(stale);
      const button=document.getElementById('composer-submit-button');
      button.removeAttribute('id');
      button.removeAttribute('data-testid');
      button.setAttribute('aria-label','Start voice mode');
      button.textContent='voice';
    });

    await expect.poll(async () => (await host(page)).mode).toBe('idle');
    await expect.poll(async () => (await host(page)).generating).toBe(false);
    await expect(page.locator('#gitl9 .status')).not.toContainText('Model working...', { timeout: 2500 });
    await expect(page.locator('#gitl9 .status')).toContainText('Waiting for assistant output', { timeout: 2500 });
  });

  test('a real Stop still wins even when Resume stream unavailable remains visible', async ({ page }) => {
    await openFixture(page,
      '<div data-stream-error>Resume stream unavailable</div>' +
      composer('<button id="composer-submit-button" data-testid="stop-button" aria-label="Stop streaming" type="button">■</button>')
    );
    expect(await host(page)).toMatchObject({ mode:'stop', busy:true, generating:true });
  });

  test('message delivery timeout suppresses stale weak status but does not invent Send readiness', async ({ page }) => {
    await openFixture(page,
      '<div role="alert">Message delivery timed out. Please try again.</div>' +
      '<div role="status">Processing...</div>' +
      composer('<button aria-label="Start voice mode" type="button">voice</button>')
    );
    expect(await host(page)).toMatchObject({
      mode:'idle',
      busy:false,
      ready:false,
      faultType:'MESSAGE_DELIVERY_TIMEOUT',
      generating:false
    });
  });

  test('fault banner cannot override an explicit Stop during a Send-to-Stop race', async ({ page }) => {
    await openFixture(page,
      '<div data-stream-error>Resume stream unavailable</div>' +
      composer('<button id="composer-submit-button" data-testid="send-button" aria-label="Send prompt" type="button" disabled>↑</button>', 'recovery probe')
    );

    const result = await page.evaluate(async () => {
      const rt = window.__ghostPlusRuntime;
      const scope = rt.module('browser-race');
      const button = document.getElementById('composer-submit-button');
      setTimeout(() => {
        button.disabled = false;
        button.setAttribute('data-testid','stop-button');
        button.setAttribute('aria-label','Stop streaming');
        button.textContent='■';
      }, 150);
      return await rt.dom.waitChatgptSendReady(scope,{expectedText:'recovery probe',timeoutMs:1200});
    });
    expect(result).toMatchObject({ ok:false, mode:'stop', busy:true });
  });

  test('unresolved voice-only composer without a terminal fault fails closed as uncertain', async ({ page }) => {
    await openFixture(page, composer('<button aria-label="Start voice mode" type="button">voice</button>'));
    expect(await host(page)).toMatchObject({ mode:'uncertain', busy:false, ready:false, generating:false });
  });

  test('exact managed-draft cleanup preserves unrelated user text', async ({ page }) => {
    await openFixture(page, composer(
      '<button id="composer-submit-button" data-testid="stop-button" aria-label="Stop streaming" type="button">■</button>',
      'my manual draft'
    ));
    const result = await page.evaluate(async () => {
      const rt=window.__ghostPlusRuntime, scope=rt.module('browser-clear');
      const wrong=await rt.dom.clearComposerIfExact('ghost recovery probe',scope,{verifyMs:400});
      const afterWrong=rt.dom.readComposer();
      const exact=await rt.dom.clearComposerIfExact('my manual draft',scope,{verifyMs:700});
      return {wrong,afterWrong,exact,afterExact:rt.dom.readComposer()};
    });
    expect(result.wrong).toMatchObject({ok:false,why:'composer-changed'});
    expect(result.afterWrong).toBe('my manual draft');
    expect(result.exact).toMatchObject({ok:true});
    expect(result.afterExact).toBe('');
  });
});