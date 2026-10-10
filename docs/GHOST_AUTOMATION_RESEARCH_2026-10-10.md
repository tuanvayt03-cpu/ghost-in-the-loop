# Ghost+ — Research Ops: giao diện ChatGPT và lựa chọn kiến trúc (2026-10-10)

## Quyết định

**Giữ Ghost+ làm sản phẩm chính. Không thay thế ngay bằng một fork khác.** Áp dụng có chọn lọc mô hình outbox, sender lease, exact receipt và fail-closed từ chatgpt-yolo. Chỉ xem xét fork toàn diện nếu kết quả live smoke/E2E thất bại sau khi adapter ổn định.

Đây là kết luận kiến trúc, không phải tuyên bố Ghost+ đã được chứng nhận trên ChatGPT đang đăng nhập.

## Bằng chứng

1. OpenAI Developer Community — September 27, 2026: người dùng báo cáo nhiều regression ở giao diện ChatGPT đăng nhập, gồm điều khiển bàn phím và in PDF. Đây là bằng chứng thay đổi giao diện gây lỗi cho người dùng khác, nhưng **không chứng minh** chính OpenAI gây mọi lỗi của Ghost.
   https://community.openai.com/t/multiple-chatgpt-web-regressions-after-recent-ui-changes-keyboard-navigation-and-print-to-pdf-broken/1401223
2. chatgpt-yolo — MIT; Chrome extension local-first, durable queue, one background sender lease, exact matching user-message receipt, route identity và unknown outcome không retry. Architecture/model:
   https://github.com/kartikkabadi/chatgpt-yolo
   https://github.com/kartikkabadi/chatgpt-yolo/blob/main/docs/RELIABILITY_MODEL.md
3. codex-chatgpt-web — MIT; Playwright-based bridge exposed selectors for modern grouped `data-turn-key` renderer, alternative `data-chatgpt-agent-turn-start` marker. Đây là bằng chứng về biến thể DOM; không sao chép code.
   https://github.com/miuuyy/codex-chatgpt-web/blob/main/src/chatgpt-session.ts
4. chatgpt-continuity-manager — MIT; export handoff JSON, không phải execution-controller tương đương.
   https://github.com/popvarachat/chatgpt-continuity-manager

## So sánh

| Tiêu chí | Ghost+ | chatgpt-yolo | codex-chatgpt-web |
| --- | --- | --- | --- |
| Tiếp tục vòng chat bằng marker | Có (GITL/AOA) | Có (/goal, /loop) | Không cùng mô hình |
| Exact receipt / fail-closed | Có, từ 0.15.28 | Có, queue lease bền vững | Có cơ chế điều khiển web riêng |
| Giám sát Watchdog/Telegram | Có | Không giữ cùng hợp đồng Ghost | Không |
| Durable queue đa tab | Chưa có chủ sở hữu duy nhất như YOLO | Có | Phụ thuộc bridge |
| Fork/integrate | Repo nội bộ hiện hữu | Có thể fork MIT, nhưng phải chuyển runtime & UI | Phức tạp hơn cho Ghost |

## Nguyên nhân gốc

- ChatGPT DOM không có API công khai, ổn định: Stop/Send có thể nằm ngoài form; UI hiển thị user/assistant trong một `data-turn-key`; output nhiều Markdown block hoặc thay đổi wrapper.
- Stop vuông, spinner, empty composer không chứng minh tin đã gửi. Xác nhận chính xác dựa trên **new matching user message**.
- Core, Web Recovery và Operator Gate cần chung một owner cho send/recovery để tránh race.
- Missing marker: không đoán trạng thái COMPLETE/CONTINUE từ văn xuôi.

## Patch 0.15.30

Bổ sung fallback có kiểm soát cho `data-chatgpt-agent-turn-start` khi nằm trong `data-turn-key` và thực sự có nội dung phản hồi; marker rỗng không tạo kết quả assistant giả. Có Jest unit + Chromium E2E để bắt regression. Không can thiệp submit/Stop, không sửa user draft, không thay đổi broker hoặc API.

## Giới hạn / technical debt

- Authenticated ChatGPT live DOM chưa được kiểm thử trong phiên này. Chromium E2E dùng fixture, không thay thế live acceptance.
- Legacy Jest toàn repo (49/52 suite đỏ ở baseline 0.15.29) đang kiểm tra kiến trúc 8.x; tuyệt đối không xoá/giảm test để PASS.
- Firefox `extension/content.js` là runtime legacy khác userscript hiện tại; `npm run check:committed` FAIL baseline. Chạy build để khớp máy móc sẽ xóa hơn 6000 dòng logic legacy, nên đã hoàn nguyên thay đổi thử nghiệm. Cần tách migration extension riêng để giữ tính năng.
- Upstream YOLO local validate:core thất bại ở fixture xác minh media/ffprobe và Windows case-sensitive filename collision; không quy kết core queue hỏng. Không copy mã từ upstream.

## Roadmap sau patch

1. Nhận diện live DOM trên phiên ChatGPT đã đăng nhập, read-only snapshots (không chứa tin nhắn/secret), test Play/Stop/HALT/PROCEED.
2. Tách `ChatGPT UI Adapter` độc lập, versioned test fixtures cho từng layout.
3. Chuyển các kênh gửi Ghost vào một serialized durable outbox + single sender lease mỗi conversation; route binding và exact receipt trước khi advancement; uncertain giữ blocked.
4. Migration Firefox build riêng; không xoá engine legacy nếu chưa có functional parity + full test.
5. Giữ GitHub Actions manual, test local theo AGENTS.md, không kích CI tốn phí khi không cần.

## Chốt an toàn

Không tự replay request có outcome UNKNOWN; không click Stop model; không overwrite draft; không tự giải HUMAN/AUTH gates, không commit secrets. Một primary writer cho repo. Terminal acceptance cần fresh tests sau release commit, repo sạch, remote main khớp.
