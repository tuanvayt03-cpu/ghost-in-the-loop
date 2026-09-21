(() => {
'use strict';
const RT=window.__ghostPlusRuntime?.module('ui-vi');if(!RT)return;
if (window.__GHOST_PLUS_VI_SAFE__) return;
window.__GHOST_PLUS_VI_SAFE__ = true;

const style = document.createElement('style');
style.id = 'ghost-plus-vi-safe-style';
style.textContent = `
/* Ghost core: visual-only Vietnamese labels. No DOM mutation, no observer. */
#gitl9 [data-tab="play"],
#gitl9 [data-tab="export"],
#gitl9 [data-a="play"],
#gitl9 [data-a="stop"],
#gitl9 [data-a="reload"],
#gitl9 [data-a="report"],
#gitl9 [data-a="copy"],
#gitl9 [data-a="md"],
#gitl9 [data-a="json"] { font-size: 0 !important; }

#gitl9 [data-tab="play"]::after { content: "Chạy"; font-size: 12px; }
#gitl9 [data-tab="export"]::after { content: "Xuất"; font-size: 12px; }
#gitl9 [data-a="play"]::after { content: "▶ Chạy"; font-size: 12px; }
#gitl9 [data-a="stop"]::after { content: "■ Dừng"; font-size: 12px; }
#gitl9 [data-a="reload"]::after { content: "↻ Tải lại"; font-size: 12px; }
#gitl9 [data-a="report"]::after { content: "Sao chép báo cáo"; font-size: 12px; }
#gitl9 [data-a="copy"]::after { content: "Sao chép MD"; font-size: 12px; }
#gitl9 [data-a="md"]::after { content: "Lưu MD"; font-size: 12px; }
#gitl9 [data-a="json"]::after { content: "Lưu JSON"; font-size: 12px; }

#gitl9 [data-pane="play"] > .tiny,
#gitl9 [data-pane="aoa"] > .tiny,
#gitl9 [data-pane="export"] > .tiny { font-size: 0 !important; }

#gitl9 [data-pane="play"] > .tiny::after {
  content: "Cơ chế lõi: đọc dòng điều khiển cuối → gửi đúng một lần → lặp. Không tự gửi lại khi trạng thái gửi chưa chắc chắn.";
  font-size: 10px;
}
#gitl9 [data-pane="aoa"] > .tiny::after {
  content: "Các giao thức tùy chọn vẫn dùng nguồn ngoài. Ghost chỉ trỏ AI tới nguồn chuẩn; cơ chế gửi không thay đổi.";
  font-size: 10px;
}
#gitl9 [data-pane="export"] > .tiny::after {
  content: "Ưu tiên API khi được hỗ trợ; nếu phải đọc DOM sẽ được đánh dấu là dữ liệu một phần.";
  font-size: 10px;
}

/* Watchdog controls are already rendered directly in Vietnamese by ghost-plus-companion.js.
   Do not rewrite them here; this file remains visual-only and side-effect free. */
`;
(document.head || document.documentElement).appendChild(style);RT.node(style);
})();
