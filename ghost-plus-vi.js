(() => {
'use strict';
if (window.__GHOST_PLUS_VI__) return;
window.__GHOST_PLUS_VI__ = true;

const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];

const BUTTONS = {
  'play': 'Chạy',
  'aoa': 'AoA',
  'export': 'Xuất',
  'stop': '■ Dừng',
  'reload': '↻ Tải lại',
  'report': 'Sao chép báo cáo',
  'copy': 'Sao chép MD',
  'md': 'Lưu MD',
  'json': 'Lưu JSON'
};

const ACT_NAMES = {
  plex: 'PLEX',
  relay: 'Chuyển model',
  human: 'Cổng xác nhận người dùng',
  cleanerz: 'Cleanerz',
  quorum: 'Quorum',
  ctrl: 'CTRL-AI',
  rduck: 'R-Duck'
};

function setText(el,text){
  if(el && el.textContent !== text) el.textContent=text;
}

function localizeGhost(){
  const p=q('#gitl9');
  if(!p) return;

  qa('[data-tab]',p).forEach(btn=>{
    const k=btn.dataset.tab;
    if(BUTTONS[k]) setText(btn,BUTTONS[k]);
  });

  qa('[data-a]',p).forEach(btn=>{
    const k=btn.dataset.a;
    if(k==='play') setText(btn,'▶ Chạy');
    else if(BUTTONS[k]) setText(btn,BUTTONS[k]);
  });

  qa('[data-act]',p).forEach(box=>{
    const label=box.closest('label');
    const k=box.dataset.act;
    if(label && ACT_NAMES[k]){
      const checked=box.checked;
      label.textContent='';
      label.appendChild(box);
      label.appendChild(document.createTextNode(ACT_NAMES[k]));
      box.checked=checked;
    }
  });

  const custom=q('[data-custom]',p);
  if(custom) custom.placeholder='Đường dẫn AoA, ví dụ: personas/compass.md';

  const panePlay=q('[data-pane="play"]',p);
  if(panePlay){
    const tiny=q('.tiny',panePlay);
    if(tiny) setText(tiny,'Cơ chế lõi: đọc dòng điều khiển cuối → gửi đúng một lần → lặp. Không tự gửi lại nếu trạng thái gửi chưa chắc chắn.');
  }

  const paneAoa=q('[data-pane="aoa"]',p);
  if(paneAoa){
    const tiny=q('.tiny',paneAoa);
    if(tiny) setText(tiny,'Các giao thức tùy chọn vẫn ở nguồn ngoài. Ghost chỉ trỏ AI tới nguồn chuẩn; cơ chế gửi của Play không thay đổi.');
  }

  const paneExport=q('[data-pane="export"]',p);
  if(paneExport){
    const tiny=q('.tiny',paneExport);
    if(tiny) setText(tiny,'Ưu tiên lấy dữ liệu qua API khi hỗ trợ; nếu phải đọc DOM sẽ đánh dấu là dữ liệu một phần.');
  }
}

function localizePlus(){
  const w=q('#ghostplus-watch');
  if(!w) return;

  const bold=q('b',w);
  if(bold) setText(bold,'Theo dõi');

  const st=q('[data-state]',w);
  if(st){
    const map={ready:'sẵn sàng',idle:'đang nghỉ',recovering:'đang khôi phục',off:'tắt',suspect:'nghi treo',healthy:'ổn định'};
    const raw=(st.textContent||'').trim().toLowerCase();
    if(map[raw]) setText(st,map[raw]);
  }

  const sel=q('[data-time]',w);
  if(sel){
    const labels={'0':'Tắt','180':'3 phút','300':'5 phút','600':'10 phút','900':'15 phút','1500':'25 phút'};
    qa('option',sel).forEach(o=>{ if(labels[o.value]) o.textContent=labels[o.value]; });
  }

  const auto=q('[data-auto]',w);
  const label=auto?.closest('label');
  if(auto && label){
    const checked=auto.checked;
    label.textContent='';
    label.appendChild(auto);
    label.appendChild(document.createTextNode(' tự dừng khi treo'));
    auto.checked=checked;
  }

  const c=q('#ghostplus-collapse');
  if(c) c.title='Thu nhỏ Ghost';
  const m=q('#ghostplus-mini');
  if(m && !m.title.includes('silent')) m.title='Mở Ghost';
}

function run(){
  localizeGhost();
  localizePlus();
}

const observer=new MutationObserver(()=>queueMicrotask(run));
observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
setInterval(run,1500);
run();
})();
