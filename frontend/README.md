# English Battle — Android frontend

Giao diện Kotlin + Jetpack Compose dựa trên [thiết kế Figma App English Battle](https://www.figma.com/design/KH2g6ct0xPjDKMkR2SzKLk/App-English-Battle?node-id=122-2).

## Mở trong Android Studio

1. Chọn **File → Open**, mở thư mục `D:\visual studio\frontend`.
2. Chọn **Gradle JDK 21** trong Settings → Build, Execution, Deployment → Build Tools → Gradle. Trên máy hiện tại có `C:\Users\Acer\.jdks\jbr-21.0.11`. Gradle 8.13 không chạy được với JDK 25 đang đi kèm bản Android Studio trên máy.
3. Đồng bộ Gradle, chọn module **app** và chạy trên điện thoại/trình giả lập Android 8.0 trở lên.

`local.properties` đã trỏ đến SDK có sẵn tại `D:\Androidstudio\Sdk`; khi chuyển máy, để Android Studio tạo lại file này.

```powershell
$env:JAVA_HOME='C:\Users\Acer\.jdks\jbr-21.0.11'
.\gradlew.bat assembleDebug
```

APK sau khi build: `app/build/outputs/apk/debug/app-debug.apk`.

## Màn hình và luồng

- Splash → đăng nhập, đăng ký, quên mật khẩu.
- Trang chủ → thử thách hằng ngày, luyện tập, bài kiểm tra, thi đấu, bảng xếp hạng.
- Bốn kỹ năng: từ vựng, ngữ pháp, nghe, đọc hiểu; mỗi kỹ năng có danh sách chủ đề.
- Bài tập 10 câu, chọn đáp án, giải thích, đồng hồ, kết quả và xem lại đáp án.
- Sảnh thi đấu, tìm đối thủ mẫu, trận đấu, kết quả và lịch sử.
- Bảng xếp hạng tuần/tháng, biểu đồ tiến độ.
- Hồ sơ, chỉnh sửa thông tin, thành tích, thông báo, cài đặt.

Để xem giao diện: nhập email hợp lệ và mật khẩu bất kỳ có ít nhất 6 ký tự. Đây là **luồng demo frontend**, không xác thực tài khoản thật. Không lưu mật khẩu.

## Phạm vi dữ liệu mẫu

- Chưa kết nối backend, Firebase, Google OAuth, gửi email hoặc ghép trận thật. Các thao tác cần dịch vụ này hiển thị thông tin rõ ràng.
- Chế độ thi đấu dùng đối thủ mẫu Maya; bảng xếp hạng, lịch sử, XP và biểu đồ là dữ liệu minh họa. Các chủ đề trong cùng kỹ năng dùng chung bộ câu hỏi mẫu.
- Bài nghe dùng Text-to-Speech có sẵn trên Android. Thiết bị cần cài giọng tiếng Anh. Nếu không có, màn hình hiển thị văn bản thay thế.
- Tên/email hồ sơ, âm lượng và tùy chọn thông báo được lưu cục bộ. Tùy chọn thông báo chưa đăng ký push notification.
- Chế độ sáng và tiếng Việt theo Figma. Không có giao diện tối/bản dịch tiếng Anh trong thiết kế này.

## Thiết kế và kích thước

- Font Nunito, logo và 28 ảnh nguồn được lấy từ tài nguyên của file Figma được cung cấp. Một số ảnh đã loại bỏ vùng trong suốt dư thừa để hiển thị chính xác trong Compose.
- Bố cục dựng bằng các thành phần Android thật; không dùng ảnh chụp toàn màn hình để giả lập UI.
- Dùng `dp`/`sp`, safe area và IME insets; màn hình dài cuộn được; vùng nội dung giới hạn 600 dp trên thiết bị lớn.
- Không vẽ thanh trạng thái iOS trong Figma; Android hiển thị thanh trạng thái và điều hướng của thiết bị.
- Hai avatar đầu chó/mèo và các biểu tượng nhỏ được dựng lại bằng vector/Material Icons vì không có bản xuất vector từ phiên Figma khách. Vì vậy chưa thể coi là bản đối chiếu pixel chính xác 100%.

## Cấu trúc

```text
app/src/main/java/com/englishbattle/app/
  MainActivity.kt          Điểm khởi chạy
  data/QuizData.kt         Bộ câu hỏi mẫu
  ui/App.kt               Điều hướng và trạng thái chung
  ui/Theme.kt             Màu, font, kiểu chữ
  ui/Components.kt        Nút, thẻ, thanh tiêu đề, progress
  ui/AuthScreens.kt       Splash và tài khoản
  ui/LearningScreens.kt   Trang chủ và luyện tập
  ui/QuizScreens.kt       Làm bài và kết quả
  ui/BattleScreens.kt     Thi đấu và lịch sử
  ui/CommunityScreens.kt  Xếp hạng, tiến độ, thành tích
  ui/ProfileScreens.kt    Hồ sơ, thông báo, cài đặt
```

## Kiểm tra

```powershell
.\gradlew.bat assembleDebug lintDebug testDebugUnitTest
# Cần thiết bị Android đang chạy:
.\gradlew.bat connectedDebugAndroidTest
```

Bộ kiểm thử giao diện đi qua đăng nhập, phản hồi câu trả lời và chụp các màn hình. Ảnh được lưu trong thư mục external files `screenshots` của app trên thiết bị kiểm thử.

Tài liệu nền tảng: [Jetpack Compose — Android Developers](https://developer.android.com/develop/ui/compose/setup).
