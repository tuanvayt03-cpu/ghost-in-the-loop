const fs = require('node:fs');
const path = require('node:path');

test('ChatGPT-only Ghost canary pins every required module to the reviewed immutable payload', () => {
  const loader = fs.readFileSync(path.resolve(__dirname, '..', 'ghost-plus.user.js'), 'utf8');
  const runtime = fs.readFileSync(path.resolve(__dirname, '..', 'ghost-plus-runtime-manager.js'), 'utf8');
  const sha = '4db2659f1b8a24f57ed31485e62e5ee4a35cd88f';
  const requires = [...loader.matchAll(/^\/\/ @require\s+(\S+)$/gm)].map(m => m[1]);
  expect(requires).toHaveLength(14);
  for (const url of requires) {
    expect(url).toMatch(/^https:\/\/raw\.githubusercontent\.com\/tuanvayt03-cpu\/ghost-in-the-loop\//);
    expect(url).toContain('/' + sha + '/');
  }
  expect(loader).toContain('@version      9.0.0-alpha.2+ghostplus.15.31-canary1');
  expect(runtime).toContain("const VERSION='0.15.31-canary1';");
  expect(loader).toContain('@match        https://chatgpt.com/*');
  expect(loader).toContain('@match        https://chat.openai.com/*');
  expect(loader).not.toMatch(/^\/\/ @match\s+.*(perplexity|gemini|claude)/mi);
  expect(loader).toContain('refs/heads/fix/ghost-unprimed-play-20261014/ghost-plus.user.js');
});
