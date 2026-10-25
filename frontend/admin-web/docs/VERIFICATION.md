# Kiểm tra frontend admin

Ngày: 24/10/2026. Phạm vi: **chỉ frontend web admin**, theo yêu cầu dừng phần backend. Người dùng đã đăng ký Web App và cung cấp cấu hình; đã đưa vào frontend và thêm Firebase Auth SDK. Không deploy, không sửa backend/Rules hoặc ghi dữ liệu nghiệp vụ Firebase. Ảnh Firebase Console người dùng gửi xác nhận Email/Password đã Activated.

## Thiết kế

Nguồn đối chiếu là 5 ảnh admin người dùng đã gửi ở cuộc trao đổi trước, được lưu trong `design-reference/`. Chúng cũng xuất hiện trên thumbnail công khai của file Figma App English Battle.

| Trang               | Đã bám theo ảnh                                                              | Điều chỉnh theo phạm vi                                                                |
| ------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Dashboard           | Sidebar tối, breadcrumb/header, 3 KPI, biểu đồ tăng trưởng, bảng hoạt động   | Thay Revenue bằng Battles Completed; hoạt động không có Premium/XP                     |
| Users               | Ô tìm kiếm, Filter, Add User, bảng avatar/trạng thái/hành động và phân trang | Số liệu mẫu thực, thêm export và các biểu mẫu/xác nhận                                 |
| Question & Content  | Tìm kiếm/lọc, Add Question, bảng câu hỏi/kỹ năng/độ khó và phân trang        | Thêm các tab quản lý 4 kỹ năng, chủ đề, bài học và trạng thái xuất bản                 |
| Battle & Moderation | Tìm mã, lọc, hai người chơi, điểm, trạng thái, View Logs                     | Thêm lọc chế độ và modal timeline; không thêm hủy/đảo kết quả                          |
| Analytics           | Hai panel biểu đồ cột/tròn, bảng kỹ năng, bộ lọc ngày và export              | Chuyển doanh thu/subscription sang học tập/thi đấu; 4 kỹ năng, Idioms thuộc Vocabulary |

Màn đăng nhập, modal, biểu mẫu và bố cục mobile được bổ sung theo cùng phong cách, vì 5 ảnh không mô tả những frame này. Đã xem trực tiếp ảnh chụp app và chỉnh độ cao dòng bảng, nhãn demo nhỏ trên header, độ rộng select phân trang và tỷ lệ biểu đồ mobile. Chưa có phép đo pixel với các frame/tokens Figma gốc; không coi các số liệu minh họa trong ảnh thiết kế là dữ liệu Firebase thật.

## Kết quả kiểm tra

- `npm run build`: TypeScript và Vite thành công. Trang được tách chunk để giảm bundle tải đầu; không còn cảnh báo chunk trên 500 kB.
- `npm test`: **25/25** kiểm thử qua, gồm đăng nhập, claim và trường hợp SDK khởi tạo chậm không làm mất mật khẩu đang nhập.
- Playwright: **10/10** ca workspace và **4/4** ca Firebase SDK qua trên Microsoft Edge headless: desktop 1280×800 và mobile 390×844. Sau khi phát hiện/sửa lỗi khởi tạo chậm trên desktop, chạy lại riêng bộ Firebase SDK thành công trên cả hai viewport.
- Mỗi viewport kiểm tra đủ 5 trang, không có page error hoặc overflow ngang của trang; các bảng cuộn bên trong vùng riêng.
- Các trang demo chỉ tải tài nguyên cục bộ, không có HTTP request ra Firebase hoặc dịch vụ bên ngoài trong ca kiểm tra 5 trang.
- Font Inter và icon đóng gói trong app; Firebase SDK được tải riêng. Web App đã cấu hình đúng project/appId/databaseURL do người dùng cung cấp.
- Các ca Auth chặn và trả lời request Firebase ngay trong Playwright: thử provider bị tắt, phiên thành công không có admin claim, reload, sign out trước khi vào demo. Không gửi tài khoản thử/token giả lên Firebase thật.
- Không có mật khẩu thật để kiểm chứng đăng nhập live trong phiên làm việc này. Chưa kiểm chứng đọc/ghi Realtime Database; chỉ khởi tạo SDK và URL, không cấp quyền đọc/ghi.

## Những luồng đã kiểm thử

1. Đăng nhập đi qua Firebase SDK, ánh xạ lỗi, hiện trạng thái phiên/claim, không tự mở trang quản trị thật. Vào demo, chuyển đủ 5 trang, đăng xuất và xóa phiên demo; không dùng phiên Firebase để thao tác mẫu.
2. Thêm/sửa người dùng, email trùng, tìm theo email, phân trang, dữ liệu còn sau reload.
3. Khóa/mở tài khoản có lý do; xóa yêu cầu nhập mã; lịch sử tham chiếu đến người dùng đã ẩn danh.
4. Thêm câu published, chọn đáp án/giải thích, learner preview không hiện đáp án, archive, xử lý sửa trên version cũ và hai thao tác đồng thời.
5. Quan hệ kỹ năng–chủ đề–bài học, bốn kỹ năng cố định; thêm chủ đề/bài học draft và kiểm tra cấp cha khi xuất bản.
6. Listening có text từ nguồn TTS mẫu; từ chối file sai định dạng/quá 2 MB; reading yêu cầu passage; từ chối URL audio không HTTPS.
7. Lọc phòng riêng, mở timeline trận, tìm không ra và xóa bộ lọc.
8. Bộ lọc ngày, thống kê mẫu số 0, UID hoạt động không đếm trùng, độ chính xác tính theo tổng số câu.
9. Tải CSV đúng bộ lọc và toàn bộ kết quả thay vì chỉ trang hiện tại; escape công thức/ngoặc kép/dòng mới.
10. Tìm chung, thông báo đã đọc, reset demo, thử lại sau lỗi, Tab giữ focus trong modal và Escape đóng modal.
11. Lỗi hết localStorage không commit thay đổi hoặc ghi audit thành công giả.

## Ảnh chụp app

Ảnh trong `qa/` là kết quả từ Playwright chạy app, không phải ảnh Figma:

- [Dashboard desktop](qa/desktop-dashboard.png), [Users desktop](qa/desktop-users.png), [Content desktop](qa/desktop-content.png).
- [Battles desktop](qa/desktop-battles.png), [Analytics desktop](qa/desktop-analytics.png).
- [Đăng nhập](qa/desktop-login.png), [Biểu mẫu câu hỏi](qa/desktop-question-editor.png), [Log trận](qa/desktop-battle-log.png).
- [Dashboard mobile](qa/mobile-dashboard.png), [Content mobile](qa/mobile-content.png), [Analytics mobile](qa/mobile-analytics.png).

## Còn thuộc giai đoạn tích hợp thật

Thử đăng nhập bằng tài khoản thật của người dùng, cấp quyền admin từ môi trường server tin cậy, nối phiên Auth với API và upload Storage, dữ liệu realtime/đồng bộ nhiều admin, xử lý khóa/xóa Auth, thống kê production, Rules, hosting và kiểm thử staging. Lớp service và [hợp đồng](API-CONTRACT.md) đã chuẩn bị cho bước đó, chưa triển khai backend theo yêu cầu hiện tại.
