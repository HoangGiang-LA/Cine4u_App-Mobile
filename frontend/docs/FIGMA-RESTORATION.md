# Khôi phục giao diện người dùng theo Figma — 24/10/2026

Nguồn: https://www.figma.com/design/KH2g6ct0xPjDKMkR2SzKLk/App-English-Battle?node-id=122-2 .

Đã đọc lại trang web công khai, xác nhận file **App English Battle**, quyền link mở và tải ảnh tổng thể từ URL thumbnail do chính trang Figma trả về. Ảnh gốc ở `figma-reference/canvas-public.png`, metadata không chứa phiên đăng nhập ở `figma-reference/reference-summary.json`.

## Phần đã khôi phục

- Splash: nền xanh gradient, mây, logo, nhóm linh vật và vị trí nút bắt đầu.
- Đăng nhập/đăng ký/quên mật khẩu: bố cục và khoảng cách gốc; field nền xám, nút tím, nút Google. Xác thực email thật và reset link được giữ nguyên. Nút Google có thông báo chưa cấu hình, không giả lập đăng nhập thành công.
- Trang chủ: avatar/tên, ví xu góc phải, banner thử thách kèm rương, lưới 2×2 Thi đấu/Luyện tập/Bài kiểm tra/Xếp hạng với ảnh nguồn tương ứng. Bỏ level và các nhãn XP.
- Luyện tập/chủ đề: lưới kỹ năng 2×2, màu/icon riêng, linh vật đọc sách; danh sách chủ đề có icon/màu và tiến độ. ID/dữ liệu vẫn đến từ catalog repository.
- Thử thách: ảnh lịch/quà, tiêu đề chuỗi ngày, nút bắt đầu/tiếp tục, tuần học; trạng thái lượt từ dashboard.
- Sảnh/tìm trận/trận đấu: thẻ rating có linh vật cúp, ba thẻ chế độ, hai avatar/VS/vòng tròn tìm trận, hai thẻ người chơi; deadline và receipt vẫn dùng PlayViewModel. Điểm đối thủ chưa được dịch vụ cung cấp hiển thị “—”, không tự bịa điểm.
- Kết quả: hình linh vật, điểm căn giữa, thẻ thống kê và nút đúng nhóm; bỏ XP, hiển thị rating/xu thực nhận. Đấu lại mở yêu cầu ghép trận mới.
- Lịch sử: danh sách avatar/trạng thái/điểm và delta; lịch sử học có trang riêng.
- Xếp hạng: bục 2–1–3, avatar/cúp, danh sách và thẻ vị trí bản thân cố định. Mẫu demo có người chơi giả lập; adapter thật chỉ hiển thị dữ liệu trả về.
- Tiến độ: tab tuần/tháng, độ chính xác, biểu đồ cột và thanh kỹ năng; không dùng phần trăm/ngày giả trong tài khoản thật.
- Hồ sơ: avatar, Rating/Wins/Losses, nút sửa hồ sơ, thẻ thông tin, các hàng menu theo bố cục gốc; bỏ level.
- Thành tích/thông báo/cài đặt: thẻ bộ sưu tập, hàng huy hiệu, hàng thông báo và sáu hàng cài đặt như bản gốc. Âm lượng nằm trong dialog. Thoát phiên dùng nút Đăng xuất.
- Thanh điều hướng: 4 tab ở Home/Profile; biến thể Home/Học tập/Thử thách/Cá nhân ở Challenge. Các màn con không thêm thanh 5 tab.
- Dấu mô phỏng được thu thành nhãn nhỏ chỉ có ở debug, không chiếm một thanh lớn phía trên giao diện.

## Dữ liệu và nghiệp vụ

Không chuyển lại các số liệu mẫu trong thiết kế thành số liệu tài khoản thật. Số câu, rating/xu và phần thưởng vẫn theo quy tắc đã chốt trong database; tên/điểm/tiến độ thay đổi theo dữ liệu. Các màn hỗ trợ mới chưa có frame riêng trong Figma (ví, phòng riêng, hướng dẫn bài, lịch sử học, review) dùng cùng hệ màu/font/thẻ.

Không triển khai hoặc sửa Functions/Rules trên Firebase trong thay đổi giao diện này.

## Kiểm tra

- Build debug và release; Lint 0 lỗi.
- 7 unit test đã qua.
- 13 instrumentation test đã qua trên Medium_Phone Android 15, gồm luồng học, gửi bài, xem lại, bài tiếp theo, đăng xuất, ghép trận/rời trận/đấu lại và render nhiều màn hình.
- 44 ảnh QA ở `../build/figma-qa/screenshots/`, gồm 25 ảnh design, 15 màn nhỏ font scale 1.3 và các ảnh luồng học/xác thực.
- Preview tổng hợp: `figma-restoration-preview.png`.

## Giới hạn đối chiếu

Bản web hiện cung cấp ảnh tổng thể 675×800, không đủ để đo toàn bộ từng frame ở độ phân giải gốc. Các ảnh chụp app cũ trong repository được dùng làm đối chiếu bổ sung và không được coi là ảnh export Figma. Hai đầu linh vật và một số icon nhỏ vẫn là vector/Material Icons tái dựng như bản đầu.

Vì chưa lấy được scene graph/thông số và ảnh export riêng từng frame, chưa xác nhận khớp 1:1 từng pixel. Để nghiệm thu yêu cầu đó cần các frame user xuất PNG/SVG ở kích thước gốc hoặc một phiên đọc được node/design properties. Quyền chia sẻ công khai đã được xác nhận; giới hạn nằm ở dữ liệu thiết kế mà công cụ đọc được.
