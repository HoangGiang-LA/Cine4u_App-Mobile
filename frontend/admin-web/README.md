# English Battle — Web admin

Frontend quản trị React + TypeScript + Vite, chạy độc lập với Gradle/Android. Đã thêm cấu hình Firebase Web và SDK đăng nhập email/mật khẩu. Phạm vi vẫn **chỉ frontend**: chưa viết backend hoặc API quản trị, không sửa Rules, không đọc/ghi dữ liệu nghiệp vụ Firebase.

## Chạy trên máy của bạn

Mở terminal trong thư mục `frontend/admin-web`:

```powershell
npm ci
npm run dev
```

Mở **http://127.0.0.1:5173/**. Đăng nhập bằng tài khoản Firebase thật để kiểm tra phiên xác thực; bấm **Open demo workspace** để xem các trang quản trị bằng dữ liệu mẫu. Nếu đã cài thư viện, chỉ cần `npm run dev`.

## Firebase Web đã cấu hình

Cấu hình người dùng cung cấp nằm trong [`src/firebase/config.ts`](src/firebase/config.ts), project `englishbattleapp-8d764`, Web App `EnglishBattleAdmin`. [`src/firebase/client.ts`](src/firebase/client.ts) khởi tạo Firebase App, Authentication và Realtime Database SDK. Việc khởi tạo Database SDK chưa chứng minh đã đọc/ghi thành công.

Để thử đăng nhập thật:

1. Trong Firebase Console → **Authentication → Sign-in method**, bật **Email/Password** nếu chưa bật.
2. Dùng tài khoản đã có trong **Authentication → Users**, hoặc tạo tài khoản thử tại đó. Nhập mật khẩu trực tiếp trên trang đăng nhập; không gửi mật khẩu vào chat hoặc file cấu hình.
3. Chạy web và bấm **Sign in**. Khi thành công, trang hiển thị email, UID, project và trạng thái claim `admin`.
4. Nếu chưa được cấp claim `admin: true`, màn hình hiển thị **Not assigned**. Claim phải được cấp từ server tin cậy; đăng ký Web App hoặc tạo tài khoản Auth không tự cấp quyền admin.
5. Nếu claim có sẵn, màn hình vẫn thông báo API quản trị chưa triển khai; không tự mở dữ liệu mô phỏng thành dữ liệu thật. Quyền thật phải tiếp tục được backend và Rules xác thực.

Phiên Firebase dùng `browserSessionPersistence`; ứng dụng không lưu mật khẩu. Có khôi phục phiên trong tab, đăng xuất và làm mới claim. Khi từ phiên Firebase chuyển sang demo, web đăng xuất Firebase trong trình duyệt trước. Nếu báo `auth/unauthorized-domain`, thêm domain đang chạy (`127.0.0.1` hoặc `localhost`) trong **Authentication → Settings → Authorized domains**.

Database URL đã cấu hình đúng vùng `asia-southeast1`; Rules deny-all giữ nguyên. Không bật Analytics, Messaging hoặc upload Storage tự động chỉ vì cấu hình có các trường tương ứng.

Giao diện dùng tiếng Anh như 5 ảnh thiết kế. Font Inter và icon được đóng gói cục bộ, không cần gọi CDN.

## Chức năng đã có

| Phần                | Luồng trong frontend                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard           | KPI tính từ mẫu, ngày bắt đầu/kết thúc, biểu đồ ngày/tuần/tháng, hoạt động gần đây/phân trang và CSV                                                                         |
| Users               | Tìm tên/email/ID, lọc trạng thái, phân trang, xem chi tiết, thêm/sửa, khóa/mở khóa có lý do, xác nhận xóa bằng mã tài khoản                                                  |
| Question & Content  | 250 câu mẫu, 4 kỹ năng, 25 chủ đề, 25 bài học; thêm/sửa câu, đáp án đúng, giải thích, bài đọc, nghe bằng text/audio, xem trước, draft/published/archived, phân trang/lọc/CSV |
| Nội dung phụ        | Sửa kỹ năng; thêm/sửa chủ đề và bài học; trạng thái xuất bản, kiểm tra quan hệ cha–con; không tạo kỹ năng thứ năm                                                            |
| Battle & Moderation | Tìm mã, lọc trạng thái/chế độ nhanh/ngày/phòng riêng, phân trang, xem hai người chơi/điểm/timeline log và CSV                                                                |
| Analytics           | Chọn ngày/kỹ năng, khoảng ngày nhanh, biểu đồ cột/tròn, độ chính xác/tỷ lệ hoàn thành, xếp hạng kỹ năng và CSV                                                               |
| Dùng chung          | Tìm kiếm toàn workspace, Ctrl/Cmd+K, thông báo/đã đọc, hồ sơ admin, nhật ký thao tác, đăng xuất, reset demo, trạng thái tải/rỗng/lỗi/retry, preview thiếu quyền, menu mobile |

Giữ rating và xu; không có XP/level, Premium, thanh toán hoặc doanh thu. Trong Analytics, Idioms & Phrases nằm trong Vocabulary.

## Dữ liệu và giới hạn

- Các trang quản trị vẫn là **demo frontend**, kể cả bản `npm run build`. Phần xác thực đã dùng Firebase SDK thật; đăng nhập thành công mở màn hình trạng thái tích hợp, chưa mở dữ liệu admin thật. Nút demo không xác thực quyền quản trị.
- Dữ liệu mô phỏng được lưu trong `localStorage` theo khóa `english-battle.admin.demo.v1`. Phiên demo lưu trong `sessionStorage`. Thao tác trong demo không tạo tài khoản hoặc thay đổi dữ liệu Firebase thật.
- Mỗi trình duyệt có bộ dữ liệu riêng. Đăng xuất giữ dữ liệu; chọn menu tài khoản → **Profile & workspace → Reset demo data** và nhập `RESET` để khôi phục mẫu. Dữ liệu demo không phải cơ chế đồng bộ nhiều admin.
- Người dùng bị xóa được ẩn và đổi thành “Deleted user” trong lịch sử demo. Chưa có tác động đến Firebase Auth hoặc phiên đang chạy trên điện thoại.
- Câu hỏi thay đổi có phiên bản mới; demo giữ tối đa 20 bản trước đó. Đây không phải hệ thống lưu trữ lịch sử production.
- Audio tải lên tối đa 2 MB, lưu cục bộ cho demo. Khi hết dung lượng, thao tác báo lỗi và không commit. URL phải dùng HTTPS; phát được hay không còn phụ thuộc file và máy chủ nguồn. TTS dùng giọng do trình duyệt hỗ trợ.
- Các trận có trạng thái mẫu cố định; nút Refresh nạp lại dữ liệu mẫu, không mô phỏng người thật đang thi đấu. Log chỉ để xem; chưa có nghiệp vụ hủy trận/đảo kết quả/tố cáo.
- CSV xuất toàn bộ tập dữ liệu khớp bộ lọc, có BOM UTF-8 và xử lý chuỗi có thể bị đọc thành công thức bảng tính.
- Ngày thống kê theo `Asia/Ho_Chi_Minh`; số liệu minh họa không đại diện database hiện tại. Nhánh thống kê mixed-skill được loại riêng khỏi bảng tỷ trọng từng kỹ năng.

## Cấu trúc

```text
src/
  domain.ts            # Model và hợp đồng AdminService cho tích hợp sau
  context.ts           # Service, ngày chọn và thông báo dùng chung
  data/
    mock-service.ts    # Mô phỏng có kiểm tra dữ liệu, lưu và nhật ký
    metrics.ts         # Tính KPI từ dữ liệu mẫu
    seed.ts            # Khởi tạo người dùng/trận/hoạt động mẫu
    content-seed.json  # Snapshot nội dung khởi tạo công khai của dự án
  pages/               # 5 trang và biểu mẫu
  firebase/            # Config Web App, SDK và màn hình xác thực/trạng thái quyền
  test/                # Kiểm thử logic và React
e2e/                   # Kiểm thử Edge desktop/mobile
docs/design-reference/ # 5 ảnh thiết kế do người dùng cung cấp
docs/qa/               # Ảnh chụp app từ kiểm thử trình duyệt
```

`tools/refresh-demo-content.ps1` chỉ đọc seed trong repository và ghi lại snapshot cho frontend admin; không kết nối Firebase hoặc sửa backend:

```powershell
pwsh -File tools/refresh-demo-content.ps1
```

## Kiểm tra và build

```powershell
npm test
npm run build
npm run test:e2e
```

Kiểm thử trình duyệt mặc định dùng Edge đã cài trên Windows. Máy dùng Chromium có thể chạy `npx playwright install chromium` rồi đặt `$env:PLAYWRIGHT_CHANNEL='chromium'` trước lệnh E2E. Không chạy hai bộ E2E cùng lúc vì chúng ghi cùng thư mục ảnh.

Để xem gói đã build: `npm run preview`. Kết quả nằm trong `dist/` và bị Git bỏ qua. Hiện chưa cấu hình/deploy hosting.

## Bàn giao

- [Hợp đồng tích hợp backend sau này](docs/API-CONTRACT.md)
- [Bàn giao trước backend và quy tắc đã chốt ngày 25/10](../docs/PRE-BACKEND-HANDOFF.md)
- [Kiểm tra hợp đồng, Rules emulator và bản export Firebase](../verification/README.md)
- [Phạm vi thiết kế và kiểm tra](docs/VERIFICATION.md)
- [Dashboard desktop](docs/qa/desktop-dashboard.png), [Content desktop](docs/qa/desktop-content.png), [Analytics desktop](docs/qa/desktop-analytics.png), [mobile](docs/qa/mobile-dashboard.png)

Web App đã được người dùng đăng ký và cấu hình vào frontend. Tích hợp dữ liệu quản trị thật vẫn cần backend/API/Rules. Không có tài khoản hoặc bản ghi nào được tạo trên Firebase trong quá trình kiểm thử tự động.

Dependency override `@grpc/grpc-js@1.14.6` xử lý advisory của phụ thuộc Node đi kèm gói Firebase tổng hợp. Web này chỉ import App/Auth/Realtime Database; không dùng Firestore hoặc gRPC trong trình duyệt.
