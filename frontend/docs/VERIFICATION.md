# Kiểm tra bản frontend

Môi trường: JDK 21.0.11, Gradle 8.13, Android Gradle Plugin 8.13.2, Android SDK/API 35; Pixel 7 API 35, Android 15.

- Build debug APK thành công.
- Android lint: không có lỗi; còn các cảnh báo không chặn build, chủ yếu về phiên bản thư viện/SDK và quy ước code.
- Unit test: bộ câu hỏi của bốn kỹ năng luôn có 10 câu với chỉ mục đáp án hợp lệ.
- UI test: kiểm tra lỗi khi đăng nhập trống, đăng nhập mẫu, chọn ngữ pháp, trả lời 10 câu và xác nhận điểm 10/10.
- UI test: mở và chụp 25 màn hình (24 màn hình thiết kế và trang xem lại đáp án).
- UI test: trang chủ, luyện tập, hồ sơ, cài đặt, xếp hạng trong vùng 320 × 640 dp với font scale 1.3.

Ảnh chụp thực tế lưu ở `docs/screenshots/`. Ảnh tổng hợp xem nhanh ở `docs/preview.png`.

Chưa kiểm tra trên điện thoại vật lý, máy tính bảng thực hoặc các phiên bản Android khác. Bố cục rộng giới hạn 600 dp; chưa có thiết kế tablet riêng trong Figma. Đây là frontend demo, các kiểm thử không xác nhận dịch vụ xác thực, gửi email hoặc thi đấu trực tuyến.
