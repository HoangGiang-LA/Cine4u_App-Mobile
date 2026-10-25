# Bàn giao trước khi làm backend

Cập nhật 25/10/2026. Phạm vi là frontend, hợp đồng, dữ liệu khởi tạo và QA cục bộ. **Giữ nguyên giao diện theo Figma**: không đổi bố cục, màu, nút, nhãn hoặc thêm màn chẩn đoán. XP/level tiếp tục được bỏ theo yêu cầu trước đó. Chưa triển khai backend, sửa Rules cloud hoặc ghi dữ liệu lên Firebase thật.

## Các phần đã chuẩn bị

| Phần | Kết quả | Giới hạn |
|---|---|---|
| Firebase config | Android, Web và `.firebaserc` cùng `englishbattleapp-8d764`, đúng URL RTDB `asia-southeast1` | Config khớp chưa chứng minh mọi nhánh cloud đọc/ghi được |
| Xác thực | Có adapter Auth thật; người dùng đã đăng nhập Web thành công | Claim admin chưa được cấp; Google/điện thoại chưa được tích hợp đầy đủ |
| Android | 13 callable có schema request/response và kiểm tra đáp án không lọt vào câu đang chơi | Các function chưa được triển khai |
| Admin | 22 phương thức có ánh xạ: 21 callable dự kiến, một reset demo | Chưa có adapter/API quản trị thật; trang nghiệp vụ đang dùng local demo |
| Luật | Đã thống nhất rating, mất kết nối và hết ngày; demo dùng cùng rating Tuần/Tháng và hết phiên daily lúc nửa đêm | Server vẫn phải thực thi và chống xử lý trùng |
| Seed | 250 câu, 25 chủ đề, 4 kỹ năng, 28 template, 31 thành tích, 30 TTS; validator đạt | Chưa so với bản export cloud mới nhất; chưa import thay đổi cấu hình mới |
| Quyền dữ liệu | Có Rules đề xuất và 9 ca emulator | Rules gốc vẫn deny-all; chưa deploy đề xuất |
| Đối chiếu cloud | Có công cụ so sánh export chỉ đọc, không in giá trị riêng tư | Chưa có bản export thật để chạy |

Thi đấu ngày và phòng riêng vẫn được giữ trong thiết kế/mã nguồn, phát triển sau. Giai đoạn đầu backend chỉ phục vụ thi đấu nhanh. Không xem kết quả demo là dữ liệu nghiệp vụ thật.

## Quy tắc phải giữ khi viết backend

- Bảng Tuần/Tháng cùng xếp tất cả người chơi theo **rating tích lũy hiện tại**. Không nhân điểm theo tháng, không reset rating theo kỳ. Thứ tự ổn định mặc định là rating giảm dần rồi UID tăng dần; backend phải phân trang trên cùng một snapshot để tránh trùng/mất khi rating đang thay đổi.
- Một người mất kết nối quá 30 giây thì thua theo luật hiện có. Khi cả hai đều quá hạn 30 giây và chưa có kết quả cuối: hòa, rating delta 0, xu 0. Kết quả đã chốt không mở lại. Server xử lý cạnh tranh nguyên tử; không dùng đồng hồ/client disconnect làm bằng chứng duy nhất.
- Thử thách học có một lượt/người/ngày, tính khi start thành công. Đến 00:00 Việt Nam kết thúc phiên cũ, trả `abandoned` với kết quả 0 xu; ngày mới có lượt riêng. Deadline câu cuối ngày bị cắt tại 00:00, không tự gia hạn 30 giây khi resume. Không cấp thưởng cho kết quả cũ gửi trễ.
- Số câu: luyện tập 10, kiểm tra 20, thử thách học 5, thi đấu 10; 30 giây/câu. Thắng +5 rating/+5 xu; thua -2 rating, sàn 0; hòa không thưởng; hoàn thành luyện tập +1 xu, kiểm tra/thử thách +2 xu. Client không được tự chốt những giá trị này.

Nguồn máy đọc: [business rules](../contracts/business-rules.v1.json). Các mặc định kỹ thuật và phần còn cần thiết kế được phân biệt trong [contracts README](../contracts/README.md), không coi là yêu cầu mới do người dùng xác nhận.

## Thứ tự triển khai backend sau này

1. Tạo môi trường staging; cấp claim admin bằng môi trường tin cậy. Provision `accountAccess`, hồ sơ, ví và stats từ UID Firebase Auth. Chặn tài khoản banned/deleted ở API.
2. Nối Auth → `ensureUserProfile` → catalog/dashboard; đồng thời làm API admin Users/Content. Chuyển version/options giữa model admin và RTDB; giữ snapshot câu hỏi bất biến.
3. Làm start/resume/submit/advance/leave/result, deadline server và đáp án riêng. Chống request trùng, reward/progress trùng; daily slot nguyên tử theo UID/ngày và hết hạn 00:00.
4. Làm quick matchmaking, bộ câu chung, vòng câu, reconnect 30 giây, phân xử/ledger đúng một lần. Giữ `daily/create/join` chưa hỗ trợ và trả lỗi chuẩn.
5. Tổng hợp bảng rating chung, lịch sử, notification trong app, dashboard/admin Analytics, tìm kiếm và export có giới hạn. Index/view dựng lại được; không tải cả root để lọc.
6. Thay adapter admin demo bằng adapter thật, dùng đúng interface để giữ nguyên UI. Adapter ghi cần request ID ổn định xuyên retry, kiểm tra version conflict và chỉ báo thành công khi server xác nhận.
7. Hoàn tất các tích hợp đã có chỗ trong giao diện nhưng chưa chạy thật: Google/điện thoại theo phạm vi được chọn, FCM nếu cần push, Storage nếu dùng upload audio thật. Hosting/deploy thực hiện sau khi đã kiểm thử; đăng ký Web App không tự triển khai web.
8. Kiểm thử tích hợp hai tài khoản/hai thiết bị, các trường hợp khóa tài khoản, timeout, qua ngày và cạnh tranh kết quả. Sau đó mới triển khai Rules/API tương thích lên môi trường thật.

Các bước 1–8 là bàn giao cho giai đoạn sau, chưa được thực hiện trong phần việc frontend này. Việc cần thêm trước khi xác nhận database cloud đầy đủ là xuất bản JSON hiện tại để đối chiếu, không phải bật quyền đọc/ghi toàn root.

## Kiểm chứng hiện có và việc còn chờ

Kiểm tra tĩnh đã xác nhận config, tên phương thức, cấu trúc seed và chính sách khớp nhau. Android debug/release build, lint, 8 JVM test và 15 test trên máy ảo đã đạt. Admin build, 25 unit test và 14 browser test đạt; QA hợp đồng/export 9 test và Rules emulator 9 test đạt. Chi tiết ở [QA ngày 25/10](QA-2026-10-25.md).

Ảnh đăng nhập Web của người dùng chứng minh Auth đã hoạt động. Các lần đọc RTDB ẩn danh trả Permission denied; chúng không chứng minh nội dung riêng tư, quyền người dùng/admin hoặc toàn bộ Rules cloud đúng. Công cụ hiện không đọc được Console qua trình duyệt Cốc Cốc, vì vậy không kết luận “tất cả database đã kết nối xong”.

Để hoàn tất đối chiếu dữ liệu thật, làm theo [verification README](../verification/README.md): export root vào thư mục `verification/exports/` rồi chạy `compare:export`. Bản seed vừa được bổ sung chính sách; cloud nhập trước đó có thể cần migration cấu hình chọn lọc khi làm backend. Không import lại seed vào root có dữ liệu. Không tạo user/trận/số dư giả để lấp các nhánh runtime còn chưa phát sinh.

## Tài liệu nguồn

- [Hợp đồng Android](FRONTEND-HANDOFF.md), [schema 13 callable](../contracts/mobile.v1.mjs).
- [Hợp đồng admin](../admin-web/docs/API-CONTRACT.md), [ánh xạ service](../contracts/admin.v1.json).
- [Rules đề xuất](../contracts/database.rules.proposed.json), [cách chạy QA](../verification/README.md).
- [Schema dữ liệu](../../Backend/database/schema.md), [phân tích chi tiết](../../Backend/database/PHAN-TICH-DATABASE.md), [hướng dẫn seed](../../Backend/database/HUONG-DAN-NHAP.md).

Mức độ đối chiếu Figma của giao diện hiện tại được ghi riêng trong [FIGMA-RESTORATION.md](FIGMA-RESTORATION.md); không khẳng định mọi frame đã được so pixel 1:1. Lần chuẩn bị backend này không thay đổi các màn hình.
