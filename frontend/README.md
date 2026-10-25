# English Battle — Frontend

## Web admin

Web quản trị nằm riêng trong [`admin-web/`](admin-web/README.md), dùng React + TypeScript + Vite. Chạy `npm ci` rồi `npm run dev` trong thư mục đó, mở `http://127.0.0.1:5173/`. Đã cấu hình Firebase Web và đăng nhập Auth; các trang quản trị vẫn dùng dữ liệu mô phỏng qua **Open demo workspace**, chưa triển khai backend/API quản trị.

## Android người dùng

Ứng dụng Kotlin + Jetpack Compose. Frontend đã có Firebase Authentication thật, đọc danh mục Realtime Database và lớp giao tiếp để tích hợp backend học tập/thi đấu.

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
- **Backend:** các callable đã được định nghĩa ở frontend, chưa được triển khai bởi thay đổi này. Chấm điểm, nhận thưởng, ghép trận thật và tổng hợp dashboard cần backend. Thông báo đẩy chưa có dịch vụ FCM.

## Tài liệu bàn giao

Xem [10 nhóm việc, hợp đồng API và các bước kiểm tra](docs/FRONTEND-HANDOFF.md).

Chuẩn bị ngày 25/10: [bàn giao trước backend](docs/PRE-BACKEND-HANDOFF.md), [hợp đồng máy đọc và Rules đề xuất](contracts/README.md), [công cụ kiểm tra/emulator/so export thật](verification/README.md). Các thay đổi dữ liệu/nghiệp vụ giữ nguyên giao diện theo Figma. Chưa viết backend, triển khai Rules hoặc xác nhận toàn bộ dữ liệu cloud.

Giao diện đã được khôi phục về bố cục thiết kế gốc, bỏ XP/level: [phạm vi và giới hạn đối chiếu Figma](docs/FIGMA-RESTORATION.md), [ảnh xem nhanh](docs/figma-restoration-preview.png).

Kết quả kiểm thử: [QA ngày 24/10/2026](docs/QA-2026-10-24.md). Khi seed thay đổi, chạy `pwsh -File tools/build-demo-content.ps1` từ thư mục frontend để tạo lại asset chỉ dành cho debug.

`contracts/database.rules.proposed.json` là bản Rules đề xuất được kiểm thử bằng emulator, yêu cầu `accountAccess` active và chặn client ghi dữ liệu. Rules gốc deny-all được giữ nguyên; bản đề xuất chưa được triển khai lên Firebase.

## Mã nguồn

`data/` chứa model, repository interfaces, Firebase adapter, DTO codec và mô phỏng. `ui/UserViewModels.kt` quản lý trạng thái theo nhóm chức năng; `ui/App.kt` điều hướng, lifecycle và phiên người dùng. Các màn hình có loading/rỗng/lỗi/retry và hỗ trợ cuộn, TTS, kích thước chữ lớn.

Tài khoản và dữ liệu Firebase thật cần được kiểm thử tích hợp trên môi trường staging trước phát hành. Bản release không đóng gói seed có đáp án của demo.
