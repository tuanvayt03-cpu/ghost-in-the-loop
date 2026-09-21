(() => {
'use strict';
const RT=window.__ghostPlusRuntime?.module('help');if(!RT)return;
if (window.__GHOST_PLUS_HELP__) return;
window.__GHOST_PLUS_HELP__ = true;

const HELP = Object.freeze({
  plex: 'PLEX: tự kiểm tra host/runtime và năng lực thật đang có, rồi dùng model hiện tại cho vai trò phù hợp nhất. Chỉ đề nghị chuyển model khi model/runtime khác có lợi thế rõ ràng.',
  relay: 'Model Relay: giao phần việc chưa giải quyết cho model/runtime khác khi có lợi thế cụ thể. Ghost chỉ đọc marker chuyển model; việc đổi model vẫn cần controller hoặc người dùng thực hiện.',
  human: 'Human Gate: dùng cho quyết định quan trọng, khó đảo ngược hoặc có xung đột bằng chứng. Tổ chức phản biện đa góc nhìn rồi dừng ở cổng quyết định khi thật sự cần chủ dự án chọn.',
  cleanerz: 'Cleanerz: chế độ phá vòng lặp. Khi sửa đi sửa lại mà không tiến triển, nó dừng công việc, xác định loop, giữ phần tốt, bỏ phần sai và chốt một hướng mới.',
  quorum: 'Quorum: hội đồng tối thiểu để kiểm tra một quyết định. Ưu tiên phương pháp của các practitioner thật, có dissent và phản biện; phù hợp quyết định kiến trúc/rủi ro lớn, không cần cho việc thường ngày.',
  ctrl: 'CTRL-AI: lớp governance tổng quát cho AI, nhấn mạnh evidence, verification, dissent, routing theo loại task và mức rủi ro. Khá nặng; chỉ bật khi cần audit/governance sâu.',
  rduck: 'R-Duck: operating layer thiên về R&D/build, đặt outcome đo được, autonomy, review commands và handoff/reflect để giảm drift trong project dài.'
});

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

function injectStyle(){
  if ($('#ghost-plus-help-style')) return;
  const st = document.createElement('style');
  st.id = 'ghost-plus-help-style';
  st.textContent = `
#gitl9 [data-pane="aoa"] .grid label{position:relative;cursor:help;transition:background .12s ease,border-color .12s ease,box-shadow .12s ease}
#gitl9 [data-pane="aoa"] .grid label input[type="checkbox"]{accent-color:#10b981;width:14px;height:14px;flex:0 0 auto}
#gitl9 [data-pane="aoa"] .grid label:has(input[type="checkbox"]:checked){background:rgba(209,250,229,.96)!important;border-color:rgba(16,185,129,.72)!important;color:#065f46!important;box-shadow:inset 0 0 0 1px rgba(16,185,129,.12)}
#gitl9 [data-pane="aoa"] .grid label:has(input[type="checkbox"]:checked)::after{content:"✓";margin-left:auto;color:#047857;font-weight:800;font-size:12px}
#gitl9 [data-pane="aoa"] .grid label:hover{border-color:rgba(59,130,246,.55)!important;background:rgba(239,246,255,.92)!important}
#gitl9 [data-pane="aoa"] .grid label:has(input[type="checkbox"]:checked):hover{background:rgba(209,250,229,.98)!important}
#ghost-plus-aoa-hint{font-size:10px;color:#64748b;margin:5px 0 2px;line-height:1.3}
`;
  (document.head || document.documentElement).appendChild(st);RT.node(st);
}

function decorate(){
  injectStyle();
  const panel = $('#gitl9');
  if (!panel) return;

  const aoaTab = $('[data-tab="aoa"]', panel);
  if (aoaTab) aoaTab.title = 'Giao thức nâng cao. Chỉ bật khi task thật sự cần; có thể bật nhiều mục nhưng càng nhiều protocol càng nặng.';

  $$('[data-act]', panel).forEach(input => {
    const key = input.dataset.act;
    const tip = HELP[key];
    if (!tip) return;
    const label = input.closest('label');
    if (label) {
      label.title = tip;
      label.setAttribute('aria-label', tip);
    }
    input.title = tip;
  });

  const pane = $('[data-pane="aoa"]', panel);
  if (pane && !$('#ghost-plus-aoa-hint', pane)) {
    const hint = document.createElement('div');
    hint.id = 'ghost-plus-aoa-hint';
    hint.textContent = 'ⓘ Di chuột vào từng mục để xem công dụng. Ô xanh + ✓ = đang bật.';
    const grid = $('.grid', pane);
    if (grid) grid.insertAdjacentElement('afterend', hint);
    else pane.prepend(hint);
  }

  const custom = $('[data-custom]', panel);
  if (custom) custom.title = 'Dành cho người biết chính xác đường dẫn component AoA cần kích hoạt. Bình thường để trống.';
}

injectStyle();
decorate();
RT.interval(decorate,1200);
})();
