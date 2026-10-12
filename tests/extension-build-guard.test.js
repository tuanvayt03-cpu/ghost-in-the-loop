const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'..');
const artifact=path.join(root,'extension','content.js');
const build=path.join(root,'scripts','build-extension.js');
const sha=()=>crypto.createHash('sha256').update(fs.readFileSync(artifact)).digest('hex');

describe('legacy Firefox artifact non-destructive migration guard',()=>{
  const legacy=fs.readFileSync(artifact,'utf8');
  test('baseline fixture contains the legacy v8 engine',()=>{
    expect(legacy).toContain('__GITL_V8__');
    expect(fs.readFileSync(path.join(root,'ghost-in-the-loop.user.js'),'utf8')).not.toContain('__GITL_V8__');
  });
  test.each([{label:'default',args:[]},{label:'preflight',args:['--check-overwrite']}])(
    'rejects $label build and preserves the original artifact byte-for-byte',
    ({args})=>{
      const before=sha();
      const proc=spawnSync(process.execPath,[build,...args],{cwd:root,encoding:'utf8'});
      expect(proc.status).toBe(2);
      expect(proc.stderr).toContain('REFUSED: extension/content.js contains the legacy v8 engine');
      expect(sha()).toBe(before);
    }
  );
});
