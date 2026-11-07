# Ghost+ 15.36 · Việt hóa native · Bàn giao

Ngày: 2026-11-07
Repo: tuanvayt03-cpu/ghost-in-the-loop
Baseline ban đầu: main@e269df3fd95bf8a7c9b3f606d8671d0906e5fe89
Branch: feat/ghost-full-vi-20261107
Source checkpoint: 2ef3ddf272ff476245d4def5b02a370799c39f9e
Loader chuẩn bị phát hành: 9.0.0-alpha.2+ghostplus.15.36
Runtime: 0.15.36

## Thay đổi

- Bộ từ điển `ghost-plus-i18n-vi.js` native, dùng khi render, không dùng CSS đè/ẩn chữ tiếng Anh.
- Panel: nút/nhãn/tab, trạng thái Core, xuất Markdown, thông báo chẩn đoán.
- Machine state dùng `data-ghost-code` và `data-ghost-detail` để các module không phụ thuộc nhãn dịch.
- Operator Gate: nhãn, cảnh báo, hướng dẫn và nút tiếp tục.
- Watchdog/continuity/turn budget: đếm thời gian, trạng thái, cảnh báo và tooltip.
- Web Recovery: mã lỗi hiển thị qua từ điển, cảnh báo và hướng dẫn bằng tiếng Việt.
- Alert Router: phân loại và dedupe trên event gốc, sau đó mới bản địa hóa tiêu đề/nội dung.
- Telegram: cấu hình bot/nhóm/chủ đề, nút thao tác, nhãn thông báo, tin test và lý do. Dedupe ưu tiên khóa sự kiện độc lập ngôn ngữ.
- Context boundary: thông báo giới hạn hội thoại và hướng dẫn bàn giao.
- CSS cuối chỉ hỗ trợ bố cục màn hình nhỏ; không còn `font-size:0` để che tiếng Anh.
- `@require` có 15 module, i18n ở ngay sau runtime manager, các module thay đổi pin về đúng source SHA.

## Fresh QA trên loader cuối

PASS:
- `git diff --check`
- `node --check` cho module đã sửa
- `npm run test:ghostplus-runtime`: VM/static/scroll PASS
- `npm run lint`: PASS
- Composer contract Jest: 48/48 PASS
- Chromium Ghost+ current stack: **64/64 PASS** (có 5 bài mới về Việt hóa)
- Thông báo desktop và Telegram được xác minh bằng mock in-browser; **không gửi tin thật**.
- Regression nhận diện Host BUSY, Send/receipt, Operator Gate, Recovery, Turn Budget giữ nguyên cơ chế.

## Giới hạn và nợ còn lại

- Chưa có authenticated ChatGPT live canary trong phiên này; KHÔNG tuyên bố live-certified.
- Lỗi vendor/API chưa biết và nội dung gốc của ChatGPT có thể giữ nguyên tiếng Anh để bảo toàn bằng chứng, không phải chuỗi do Ghost tạo.
- Legacy Firefox v8, old harness, package 8.8.5 và migration build là debt tách biệt.
- Chưa thao tác gửi tin ChatGPT hoặc Telegram thật trong quá trình test.
- Release cần merge commit giữ source SHA bất biến, rồi kiểm tra loader và Git baseline mới nhất.

## Next

1. Commit/push loader + tài liệu/evidence.
2. PR merge bằng merge commit giữ source SHA.
3. Resolve lại main; kiểm tra metadata `15.36`, 15 @require và pin source commit.
4. Đưa đường dẫn immutable để cập nhật Tampermonkey; refresh ChatGPT.
