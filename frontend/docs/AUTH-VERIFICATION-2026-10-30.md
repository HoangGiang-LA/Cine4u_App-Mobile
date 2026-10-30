# Xác minh tài khoản và phân quyền — 30/10/2026

Đăng ký, đăng nhập, đăng xuất và phân quyền user/admin đã vượt qua kiểm thử trên môi trường phát triển với backend local và Firebase thật `englishbattleapp-8d764`. Đợt kiểm tra này không sửa mã xử lý tài khoản hay quyền của tài khoản đang sử dụng.

## Kiểm thử tự động

| Nhóm | Số kiểm thử đạt |
|---|---:|
| Backend HTTP | 5 |
| Backend + Auth/Database emulator, project demo riêng | 6 |
| Web unit/component | 32 |
| Web trình duyệt, desktop, Firebase/backend giả lập | 5 |
| Android unit | 11 |
| Android emulator: PasswordPolicyScreenTest, AccountAccessViewModelTest, CatalogViewModelTest | 8 |
| Tổng | 67 |

Build Android debug/test APK và web production đều thành công. Các kiểm thử Android được chạy riêng, không đăng xuất hay xóa phiên Firebase đang lưu của người dùng.

## Kiểm tra Firebase thật

Dùng Firebase client SDK trong một tiến trình riêng với tài khoản thử có email ngẫu nhiên; gửi ID token đến backend đang chạy tại `127.0.0.1:8080`. Không dùng mật khẩu của tài khoản admin hiện có. Bảy nhóm kiểm tra đều đạt:

1. Email/Password đang bật; chính sách mật khẩu ENFORCE, tối thiểu 8 ký tự, bắt buộc số/chữ hoa/ký tự đặc biệt, không ép đổi mật khẩu cũ khi đăng nhập. Rules trên Firebase trùng file `database.rules.json`. Tài khoản admin đã chỉ định có claim boolean `admin: true`, không bị vô hiệu hóa và có trạng thái active.
2. Đăng ký bằng SDK thật tạo được tài khoản; mật khẩu được kiểm tra theo policy; đăng ký trùng email bị từ chối.
3. Backend tự tạo đủ hồ sơ/quyền user. Thiếu token bị từ chối 401; gửi UID/role giả bị từ chối 400; user mới không có quyền admin và bị từ chối API admin với 403.
4. User active đọc được categories/topics published. Chưa đăng nhập, query không đúng điều kiện và tự ghi accountAccess đều bị Rules từ chối.
5. SDK đăng xuất đưa currentUser về null. Đăng nhập sai mật khẩu bị từ chối; đăng nhập lại đúng mật khẩu khôi phục đúng UID và backend nhận tài khoản.
6. Chỉ cấp admin từ server mới được backend xác nhận. Token cũ chưa có claim admin không được vào; sau khi refresh token thì được vào. Thu hồi claim admin khiến token admin cũ cũng bị từ chối.
7. Tài khoản bị banned hoặc Auth bị disabled đều bị backend từ chối; gọi khởi tạo lại không tự mở khóa.

Đã xác nhận dọn sạch tài khoản thử khỏi Firebase Authentication và cả sáu nhánh dữ liệu do backend tạo: users, userPrivate, userSettings, userStats, wallets, accountAccess. Không lưu mật khẩu hay token vào báo cáo.

## Phạm vi còn lại

Kiểm thử trình duyệt dùng dịch vụ giả lập; SDK Firebase và backend thật được kiểm tra riêng như mô tả trên. Đây không phải kiểm thử tải hay kiểm thử triển khai Internet. Cấu hình nguồn hiện vẫn dùng backend local; cần triển khai backend HTTPS và cấu hình URL trước khi chia sẻ cho người ngoài máy/mạng phát triển. Dashboard nghiệp vụ admin vẫn dùng dữ liệu mẫu theo yêu cầu; các API học tập/quản trị tiếp tục phát triển sau phần tài khoản.
