# Hợp đồng frontend admin — chuẩn bị tích hợp, chưa có backend

Nguồn chuẩn là [`src/domain.ts`](../src/domain.ts): `AdminService`, model, input và kiểu kết quả. `src/data/mock-service.ts` là adapter nghiệp vụ hiện tại. UI lấy service qua `AdminContext`; `App` nhận prop `api` để thay adapter. Đăng nhập dùng Firebase Auth, BE1 Callable `ensureUserProfile`, rồi HTTP `POST /api/getAdminSession` để xác minh quyền trước khi mở workspace. Các API nghiệp vụ AdminService vẫn chưa được tích hợp. Môi trường local dùng cùng luồng qua Emulator; xem [hướng dẫn](../../../docs/LOCAL-EMULATOR.md).

Cập nhật 25/10/2026: [ánh xạ máy đọc](../../contracts/admin.v1.json) bao phủ đủ 22 phương thức: 21 callable đề xuất trong region `asia-southeast1` và `reset` chỉ demo. Mọi response có `serverNow` epoch ms và trường payload ghi trong file; mutation có payloadKey null chỉ trả `serverNow`. Kiểm tra tên phương thức tự động ở [verification](../../verification/README.md). Chưa có adapter transport thật. Giao diện theo Figma giữ nguyên khi thay service.

## Nguyên tắc tích hợp

1. Web App đã đăng ký trong project Firebase hiện có, cấu hình nằm ở `src/firebase/config.ts`; không cần database riêng cho admin.
2. Firebase Auth đã có đăng nhập, phục hồi phiên, đăng xuất và refresh claim `admin: true` trong `src/firebase/`. HTTP server đã kiểm tra token, quyền hiện tại và trạng thái accountAccess; BE1 Callable là chủ sở hữu provisioning. Bước kế tiếp cho nghiệp vụ là triển khai adapter AdminService; không chuyển BE1 learning API sang HTTP hoặc tự cấp quyền từ client.
3. Viết một adapter triển khai các phương thức dưới đây. Chuyển `mode` sang union phù hợp khi thêm adapter thật; loại bỏ/bật tắt rõ demo trước phát hành. Không chuyển sang demo khi API thật lỗi.
4. Danh sách dùng API có giới hạn, bộ lọc và phân trang. Các số tổng hợp/active users do backend tính. Không thay mock bằng lệnh đọc toàn bộ root RTDB để lọc trên web.
5. Quyền ghi tài khoản, trạng thái, đáp án, xuất bản và dữ liệu vận hành nằm ở backend. Không đưa Firebase Admin SDK, khóa riêng hoặc service-account vào bundle.

## Phương thức

| Nhóm          | Phương thức                                | Kết quả/hành vi cần giữ                                                             |
| ------------- | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| Hồ sơ         | `profile`, `saveProfile(name)`             | `AdminProfile`; quyền quản trị không được thay bằng sửa hồ sơ                       |
| Tổng quan     | `overview(range, categoryId?)`             | `Overview`; mốc thời gian, series, KPI và danh mục theo đúng bộ lọc                 |
| Người dùng    | `users(query)`, `user(id)`                 | `Page<UserRecord>` và chi tiết; mặc định không liệt kê deleted                      |
| Người dùng    | `saveUser({name,email}, id?)`              | Tạo/sửa hồ sơ + Auth đồng bộ ở server; xử lý email trùng                            |
| Truy cập      | `setUserStatus(id,status,reason)`          | Khóa/mở khóa/xóa có lý do; xử lý tài khoản Auth, token và lịch sử ở backend         |
| Ngân hàng câu | `questions(query)`, `question(id)`         | Dòng danh sách/chi tiết; chỉ admin nội dung được xem đáp án                         |
| Câu hỏi       | `saveQuestion(input,id?,expectedVersion?)` | Trả câu hỏi phiên bản mới; từ chối sửa trên version cũ                              |
| Câu hỏi       | `archiveQuestion(id,expectedVersion)`      | Không xóa nội dung mà phiên đang làm/lịch sử vẫn tham chiếu                         |
| Danh mục      | `catalog()`, `saveContent(input)`          | 4 kỹ năng, chủ đề, bài học và trạng thái; giữ liên kết cha–con                      |
| Trận          | `battles(query)`, `battle(id)`             | Danh sách công bố và chi tiết log; không có command đổi kết quả                     |
| Hoạt động     | `activities(query)`, `audit()`             | Phân trang hoạt động; audit thật phải append ở backend                              |
| Tìm chung     | `search(q)`                                | Kết quả giới hạn theo từng nhóm, ID và đường dẫn trang cho phép                     |
| Thông báo     | `notifications`, `readNotifications(id?)`  | Chỉ hộp thư của admin đã đăng nhập; thay đổi trạng thái đã đọc                      |
| Báo cáo       | `exportReport(kind,query,range)`           | Bộ lọc phải giống trang hiện tại; trả CSV nhỏ hoặc mở rộng bằng job cho dữ liệu lớn |
| Demo          | `reset()`                                  | Chỉ phục vụ dữ liệu mẫu. Không cung cấp reset dữ liệu production qua UI này         |

## Model và truy vấn

- `UserRecord`: UID ổn định, mã hiển thị, tên/email, `active/banned/deleted`, thời điểm, rating/xu chỉ đọc. Form không nhận mật khẩu; cách mời người dùng/cấp mật khẩu ban đầu do backend chọn khi làm Auth thật.
- `QuestionInput`: kỹ năng/chủ đề/bài học, câu hỏi, 4 option có ID ổn định, `correctOptionId`, giải thích, passage/audio/text nghe, difficulty, status. Metadata `id/code/version/createdAt/updatedAt` do service trả.
- Mã hiển thị không phải UID. Không dùng tên/email làm khóa liên kết trận hay phiên làm bài.
- `ListQuery`: `q,status,categoryId,difficulty,mode,page,pageSize`. Các kích thước trang UI là 10/20/50; trang đầu là 1. Bộ lọc thay đổi đặt về trang đầu.
- `Page<T>` trả `items,total,page,pageSize` và dùng cùng thứ tự có khóa ID phá hòa. Backend RTDB cần chỉ mục/snapshot phù hợp cho giao diện nhảy trang; nếu chọn cursor cần điều chỉnh adapter/điều khiển phân trang, không giả lập offset bằng cách đọc mọi dòng.
- `catalog()` hiện phục vụ tập danh mục nhỏ; nếu tăng lớn cần thêm phân trang/chỉ mục trước khi dùng thật.
- `DateRange` dùng `YYYY-MM-DD`, bao gồm cả ngày cuối theo `Asia/Ho_Chi_Minh`; tối đa 366 ngày trong UI hiện tại. Server phải tự kiểm tra lại.
- Admin dùng `version: 1`, RTDB dùng `currentVersion: v1`; adapter đổi giữa integer và khóa `vN`. Options array `{id,text}` đổi thành map keyed theo ID với `order`; không lấy vị trí làm ID. Version/snapshot đã tham chiếu phải bất biến.
- Trạng thái trận UI `ongoing` tổng hợp từ `playing/reconnecting`; không ghi trực tiếp enum UI vào node authoritative. Thi đấu ngày/phòng riêng vẫn giữ bộ lọc và model nhưng triển khai nghiệp vụ sau.
- Hai tab leaderboard người dùng cùng rating tích lũy hiện tại của tất cả người chơi. Analytics theo khoảng ngày là bộ lọc thống kê riêng, không tự đổi metric rating thành điểm kiếm trong kỳ.

## Kiểm tra dữ liệu và tính nhất quán

- Tên/email được trim; email trùng phải do Auth/backend xác nhận, không chỉ kiểm tra tại UI.
- Bốn lựa chọn phải có ID/text khác nhau, đáp án nằm trong tập đó. Câu published cần giải thích; reading cần passage; listening cần audio hoặc text. Chủ đề/bài phải đúng kỹ năng và các cấp cha phải được xuất bản trước.
- Audio base64 trong mock chỉ nhằm xem trước cục bộ. Tích hợp thật phải tải lên Storage có kiểm tra quyền/kích thước/loại file và lưu metadata; không đưa base64 vào RTDB production. Xử lý file mồ côi nếu lưu câu hỏi thất bại.
- Thay đổi câu không được sửa version/snapshot của phiên đang học/thi đấu. Chống stale update bằng `expectedVersion` hoặc cơ chế tương đương tại server.
- Với thao tác ghi thật, bổ sung khóa request chống xử lý lặp khi retry/timeout, trạng thái pending và phục hồi thao tác. Mock hiện chỉ khóa việc gửi cùng form và tuần tự hóa ghi trong một instance; không bảo đảm idempotency giữa nhiều máy.
- Các callable ghi trong `admin.v1.json` nhận `requestId`; adapter thật giữ ID của thao tác qua retry/timeout thay vì tạo ID mỗi lần bấm lại. Server dedupe theo UID+operation+ID, kiểm tra quyền/expectedVersion và ghi audit cùng kết quả. Đây là việc phải triển khai khi nối API, chưa có trong mock transport.
- Backend audit phải ghi actor UID lấy từ token, thao tác, target, thời gian server và kết quả; không tin tên actor do client gửi và không lưu mật khẩu/token.
- Xóa tài khoản thật cần thiết kế đồng bộ Auth/RTDB và ẩn danh hóa lịch sử; trạng thái mock không thay thế việc thu hồi truy cập thật.

## Định nghĩa chỉ số dùng trong demo

- Total users: số tài khoản chưa deleted tại hiện tại. Phần trăm bên dưới là thay đổi số đăng ký mới so với khoảng trước có cùng độ dài.
- Active users: UID khác nhau có sự kiện học/trận trong kỳ. Số liệu production phải tính cả hai người tham gia và loại trừ sự kiện giả/không hợp lệ; fixture chỉ mô tả hoạt động mẫu.
- Battles/lessons completed: số sự kiện hoàn thành trong tập mẫu thuộc kỳ. Khi viết backend, chọn rõ nhóm theo ngày bắt đầu hay ngày kết thúc và thống nhất toàn hệ thống.
- Accuracy: tổng đúng / tổng trả lời. Completion: tổng hoạt động hoàn thành / tổng hoạt động bắt đầu trong tập đang lọc. Mẫu số 0 trả null, UI hiển thị N/A.
- Tỷ trọng trong bảng kỹ năng loại mixed-skill để tổng không bị cộng trùng. Donut tính số bài học hoàn thành theo kỹ năng.
- CSV Analytics xuất từng ngày của khoảng đã chọn và kỹ năng được lọc. Export Users/Questions/Battles dùng bộ lọc danh sách, không áp khoảng ngày chưa có trên các trang đó.

## Trạng thái lỗi cần adapter thật ánh xạ

Hết phiên → đăng nhập lại; thiếu quyền → trang từ chối; email trùng/validation → lỗi trong form; version conflict → yêu cầu tải lại; lỗi mạng/timeout → giữ form và cho thử lại; không tìm thấy → đóng chi tiết hoặc làm mới danh sách. Không báo thành công nếu server chưa xác nhận.

Các tài liệu Firebase dùng cho giai đoạn tích hợp sau: [Web setup](https://firebase.google.com/docs/web/setup), [custom claims](https://firebase.google.com/docs/auth/admin/custom-claims), [callable functions](https://firebase.google.com/docs/functions/callable).
