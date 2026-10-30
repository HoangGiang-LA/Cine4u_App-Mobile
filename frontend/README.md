# English Battle — Frontend

## Backend tài khoản hiện tại

Firebase Spark + [backend Node.js riêng](../Backend/server/README.md). App dùng Firebase Authentication rồi chờ backend tự khởi tạo hồ sơ/quyền user trước khi đọc danh mục. Web kiểm tra quyền admin qua backend riêng. Xem README backend để thiết lập file khóa một lần, chạy server và publish Rules; các API học tập/quản trị còn lại vẫn đang chờ triển khai.

## Web admin

Web quản trị nằm riêng trong [`admin-web/`](admin-web/README.md), dùng React + TypeScript + Vite. Chạy `npm ci` rồi `npm run dev` trong thư mục đó, mở `http://127.0.0.1:5173/`. Firebase Auth + backend riêng xác nhận admin rồi mở thẳng Dashboard. Các trang nghiệp vụ giữ dữ liệu mẫu để nối API sau; trang đăng nhập không có nút demo.

## Android người dùng

Ứng dụng Kotlin + Jetpack Compose. Frontend đã có Firebase Authentication thật, đọc danh mục Realtime Database và lớp giao tiếp để tích hợp backend học tập/thi đấu.

Đăng ký yêu cầu mật khẩu ít nhất 8 kí tự, có số, chữ hoa và ký tự đặc biệt. Ô mật khẩu hiển thị hướng dẫn/lỗi ngay khi nhập, chặn gửi mật khẩu chưa đạt. Cùng chính sách đã bật trên Firebase cho mật khẩu mới; đăng nhập tài khoản cũ vẫn dùng mật khẩu hiện tại. Đặt lại mật khẩu dùng trang trong email do Firebase cung cấp.

## Chạy

Mở thư mục `frontend` trong Android Studio; dùng Gradle JDK 21. Trên máy hiện tại:

```powershell
$env:JAVA_HOME='C:\Users\Acer\.jdks\jbr-21.0.11'
.\gradlew.bat assembleDebug lintDebug testDebugUnitTest
.\gradlew.bat connectedDebugAndroidTest
```

APK: `app/build/outputs/apk/debug/app-debug.apk`.

## Chế độ dữ liệu

- **Firebase thật (mặc định):** đăng ký/đăng nhập email, đặt lại mật khẩu, đổi tên/email và khôi phục phiên. Danh mục đọc `categories`/`topics` published. Cần bật Email/Password và cấp Rules phù hợp. Lỗi dịch vụ được hiển thị, không chuyển sang dữ liệu giả.
- **Mô phỏng (chỉ debug):** bấm “Khám phá bản mô phỏng” ở màn đăng nhập. Dùng 250 câu/25 chủ đề từ seed, thử cả 4 chế độ, rating/xu/tiến độ/lịch sử lưu riêng trên thiết bị. Đối thủ và phòng đều được ghi rõ mô phỏng. Không tạo tài khoản hay giao dịch Firebase.
- **Backend:** app gọi HTTPS JSON ở `/api/{method}` trên server riêng. `ensureUserProfile` và `getAdminSession` đã có code và kiểm thử emulator. Chấm điểm, nhận thưởng, ghép trận thật và tổng hợp dashboard cần phát triển tiếp. Thông báo đẩy chưa có dịch vụ FCM.

## Tài liệu bàn giao

Xem [10 nhóm việc, hợp đồng API và các bước kiểm tra](docs/FRONTEND-HANDOFF.md).

Tài liệu giai đoạn frontend: [bàn giao trước backend](docs/PRE-BACKEND-HANDOFF.md), [hợp đồng máy đọc](contracts/README.md), [công cụ kiểm tra/emulator/so export thật](verification/README.md). Backend tài khoản được mô tả trong `Backend/server/README.md`; đã kết nối Firebase thật và publish Rules ngày 30/10/2026.

Giao diện đã được khôi phục về bố cục thiết kế gốc, bỏ XP/level: [phạm vi và giới hạn đối chiếu Figma](docs/FIGMA-RESTORATION.md), [ảnh xem nhanh](docs/figma-restoration-preview.png).

Kết quả kiểm thử: [QA ngày 24/10/2026](docs/QA-2026-10-24.md). Khi seed thay đổi, chạy `pwsh -File tools/build-demo-content.ps1` từ thư mục frontend để tạo lại asset chỉ dành cho debug.

`database.rules.json` ở thư mục gốc cho tài khoản active đọc danh mục published và đọc trạng thái truy cập của mình; client không ghi dữ liệu. Dữ liệu nghiệp vụ và admin đi qua server. `contracts/database.rules.proposed.json` là đề xuất quyền mở rộng cho các giai đoạn tiếp theo. Rules hiện tại đã publish và app đã đọc được đủ 4 kỹ năng trên Firebase thật.

## Mã nguồn

`data/` chứa model, repository interfaces, Firebase adapter, DTO codec và mô phỏng. `ui/UserViewModels.kt` quản lý trạng thái theo nhóm chức năng; `ui/App.kt` điều hướng, lifecycle và phiên người dùng. Các màn hình có loading/rỗng/lỗi/retry và hỗ trợ cuộn, TTS, kích thước chữ lớn.

Tài khoản và dữ liệu Firebase thật cần được kiểm thử tích hợp trên môi trường staging trước phát hành. Bản release không đóng gói seed có đáp án của demo.
