# Ghost+ · Việt hóa toàn bộ bề mặt người dùng · 07/11/2026

## Baseline và phạm vi

- Nguồn trước khi sửa: GitHub `main@e269df3fd95bf8a7c9b3f606d8671d0906e5fe89` (Ghost+ 15.35).
- Branch chính: `feat/ghost-full-vi-20261107`.
- Checkpoint source bất biến: `2ef3ddf272ff476245d4def5b02a370799c39f9e`.
- Phát hành dự kiến: loader `9.0.0-alpha.2+ghostplus.15.36`, runtime `0.15.36`.
- 15 module được nạp bởi Tampermonkey; thêm `ghost-plus-i18n-vi.js` ngay sau runtime manager và trước alert router.
- Phạm vi: Ghost+ đang dùng trên ChatGPT web. Firefox extension 8.8 legacy, mã trong recovery/diagnostics và nội dung gốc do ChatGPT/Telegram cung cấp không thuộc scope.

## V0. Kiểm kê bề mặt

| Module | Phạm vi người dùng | Hướng xử lý |
|---|---|---|
| `ghost-plus-runtime-manager.js` | Version, quan sát DOM/receipt | Giữ mã máy, nâng runtime 15.36 |
| `ghost-plus-i18n-vi.js` | Nhãn, trạng thái, lỗi, cảnh báo có biến | Bộ từ điển `vi-VN`; dịch khi hiển thị |
| `ghost-plus-alert-router.js` | Desktop, alert bus | Phân loại/dedupe bằng dữ liệu gốc rồi mới dịch `title/text/reason` |
| `ghost-plus-telegram.js` | Màn hình liên kết, outbox, tin thông báo | Nút, hướng dẫn, nhãn thông báo Việt; giữ code và chống trùng độc lập ngôn ngữ |
| `ghost-plus-turn-budget-v2.js` | Cấu hình thời gian, trạng thái từng lượt | Nhãn tiếng Việt, không thay đổi prompt-wire/click |
| `ghost-in-the-loop.user.js` | Panel, trạng thái, tab, nút, xuất báo cáo | Native render `vi(...)`, `data-ghost-code` cho máy; xuất Markdown tiếng Việt |
| `ghost-plus-operator-gate.js` | Chốt an toàn, nút Tiếp tục, cảnh báo | Tiếng Việt trên UI, mã gate không đổi |
| `ghost-plus-uncertain-reconcile.js` | Nhận biết Send uncertain | Đọc machine state thay vì chữ Việt |
| `ghost-plus-companion-v2.js` | Watchdog, timer, cảnh báo treo | Việt hóa nhãn/tình huống, giữ nhận diện host BUSY |
| `ghost-plus-core-busy-gate.js` | Chặn tác động khi ChatGPT bận | Đọc machine state; giữ native host selector/ARIA |
| `ghost-plus-context-boundary.js` | Giới hạn hội thoại và cảnh báo | Hướng dẫn thủ công bằng tiếng Việt |
| `ghost-plus-web-recovery.js` | Tình trạng web/recovery/probe | Hiển thị lỗi từ mã sự kiện + bản dịch; không đổi nhận diện lỗi |
| `ghost-plus-ui-vi-safe.js` | Bố cục tiếng Việt | Bỏ CSS ẩn tiếng Anh `font-size:0`, chỉ giữ wrapping |
| `ghost-plus-help.js` | Tooltip trợ giúp | Đã có nội dung tiếng Việt; giữ tên tính năng riêng |
| `ghost-plus-layout-fix.js` | Bố cục/không có nội dung | Không đổi |

## Quy tắc ngôn ngữ

- Người dùng đọc: **Đang chạy, Đã tạm dừng, Đang nghỉ, Chờ đồng bộ giao thức, Đã hoàn thành, Cần người dùng xử lý, Khôi phục, Đã gửi một lần, Chưa xác minh được kết quả gửi**.
- Mã điều khiển vẫn là `RUNNING`, `PAUSED`, `PROTOCOL_WAIT`, `HUMAN_REQUIRED`, `PLAY-SEND-UNCERTAIN`, `SEND_TIMEOUT` và `[[GITL::...]]`. Không dịch giá trị machine state, protocol marker, storage key, event type, CSS selector hoặc model prompt đang dùng để điều khiển tác vụ.
- Core ghi mã gốc vào `data-ghost-code` và `data-ghost-detail`; các module đọc chính mã này trước, không parse chữ Việt trên panel để quyết định Send/Stop.
- Chuỗi lạ đến từ ChatGPT, Telegram API hoặc do người dùng nhập không được dịch bừa hoặc dùng để thay đổi logic; giữ nguyên làm bằng chứng kỹ thuật. Các lỗi phổ biến đã có bản dịch; mã lỗi vẫn tra được qua báo cáo chẩn đoán.
- Tên riêng Ghost, ChatGPT, Telegram, PLEX, Cleanerz, AoA và mã lệnh `/ghost_bind` giữ nguyên.

## V3-NOTIFY. Đường phát thông báo

1. **Core**: trạng thái chờ/chạy/gửi/xuất dữ liệu, lỗi gửi và receipt.
2. **Operator Gate**: khóa/chờ/cho phép tiếp tục/hủy, hướng dẫn thao tác.
3. **Watchdog + Continuity**: bận, nghỉ, nghi treo, mốc thời gian, điều kiện can thiệp.
4. **Web Recovery**: báo lỗi mạng, status probe, retry, chưa xác minh, hướng dẫn thủ công.
5. **Transaction / Context**: gửi chưa chắc, chặn gửi lại, giới hạn hội thoại.
6. **Desktop (Tampermonkey)**: alert router dịch sau khi định danh và chống trùng.
7. **Telegram**: tiêu đề sự kiện, mã tác vụ, lý do, trạng thái, nhắc lại; giữ event type và dedupe key gốc.
8. **Cấu hình/Trợ giúp/Xuất**: lỗi người dùng nhập, thao tác, tooltip, file Markdown.
9. **Bề mặt nhỏ**: kiểm tra wrapping của nút/nhãn trên viewport hẹp.

## Regression gate

- Runtime VM/static/scroll và lint phải PASS.
- Composer contract và host-control/recovery/uncertain/alert-dedupe suite không được suy yếu.
- E2E phiên bản đầy đủ (theo thứ tự 15 module) phải PASS cho:
  - nhãn và trạng thái tiếng Việt + machine state tách biệt;
  - chốt HUMAN hiển thị tiếng Việt nhưng không tự clear;
  - event type/severity và dedupe không đổi;
  - thông báo desktop và Telegram giả lập đều tiếng Việt, không gửi thật;
  - nút ở màn hình hẹp vẫn sử dụng được;
  - CSS không che chữ tiếng Anh để giả Việt hóa.
- `@require` phải nạp i18n trước alert router và pin các module thay đổi vào cùng source SHA bất biến.
- Không tuyên bố **live-certified** nếu chưa chạy authenticated ChatGPT E2E trên môi trường được phép.

## Giới hạn đã biết

- Hệ thống có thể hiển thị nguyên văn câu lỗi chưa biết đến từ nhà cung cấp nhằm giữ bằng chứng. Ghost không chỉnh sửa nội dung cuộc trò chuyện gốc.
- Người dùng vẫn cần cài/update userscript và tải lại ChatGPT để chạy 15.36.
- Legacy Firefox và các test harness 8.8 không nằm trong release này.
