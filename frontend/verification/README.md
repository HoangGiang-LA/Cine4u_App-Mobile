# Kiểm tra trước khi triển khai backend

Thư mục này chỉ chứa công cụ QA, không phải API/backend. Không cần đăng nhập Firebase CLI; không dùng token, mật khẩu hoặc service-account. Giao diện Android/admin không bị thay đổi bởi các công cụ này.

## Kiểm tra mã nguồn và hợp đồng

Trong `frontend/verification`:

```powershell
npm ci
npm test
npm run check
```

`check` đối chiếu project/URL/package Android và Web, 13 callable của Android, 22 phương thức AdminService và cấu hình seed với `../contracts/business-rules.v1.json`. Đây là kiểm tra file cục bộ, **không xác nhận dữ liệu hoặc Rules đang chạy trên cloud**.

`npm test` kiểm tra schema request/response, trường đáp án bị cấm trong câu hỏi đang chơi, trạng thái terminal, ID/receipt và công cụ so sánh export. Tài liệu hợp đồng nằm trong [contracts](../contracts/README.md).

## Kiểm tra Rules đề xuất bằng emulator

Cần Java 21 trở lên. Máy hiện tại:

```powershell
$env:JAVA_HOME='C:/Users/Acer/.jdks/jbr-21.0.11'
$env:PATH=$env:JAVA_HOME+'/bin;'+$env:PATH
npm run test:rules
```

Lệnh chỉ khởi động Database emulator của project **`demo-english-battle`** tại `127.0.0.1:19000`, hub `19440`, logging `19450`; dừng khi xong. Lần đầu CLI có thể tải emulator. Test từ chối chạy nếu địa chỉ emulator không đúng. Không chạy `firebase deploy`.

Config riêng là `../firebase.emulator-qa.json`; file Rules được thử là `../contracts/database.rules.proposed.json`. Cả `firebase.json` và `database.rules.json` ở gốc vẫn giữ nguyên. Các cảnh báo `permission_denied` trong ca ghi trái phép là kết quả mong đợi.

Rules đề xuất yêu cầu backend tạo `accountAccess/{uid}/status = active`. Chưa có provisioning này thì đăng nhập Auth thành công vẫn chưa được đọc danh mục. Vì vậy **chưa triển khai Rules đề xuất lên project thật**. Admin SDK phải tự kiểm tra quyền trong API; kết quả test client Rules không chứng minh API an toàn.

## Đối chiếu dữ liệu Firebase đang có

Trong Firebase Console của `englishbattleapp-8d764`, mở **Realtime Database → Data**, chọn root rồi **Export JSON**. Lưu bản xuất vào `frontend/verification/exports/firebase-export.json` (thư mục này được Git bỏ qua). Giữ file trên máy; không đưa bản export hoặc token vào tài liệu công khai.

```powershell
npm run compare:export -- "exports/firebase-export.json"
```

Công cụ chỉ đọc file export và seed, không ghi lên Firebase. Nó kiểm tra các trường tĩnh seed yêu cầu, chấp nhận nhánh runtime/nội dung bổ sung, báo đường dẫn thiếu/khác mà không in email, số dư, đáp án hoặc giá trị riêng tư. Tên trường mật khẩu/token/khóa riêng được báo để rà soát; Firebase Auth quản lý mật khẩu, không cần chép password/hash sang RTDB.

Mã thoát: `0` khớp; `1` có khác biệt cần xem; `2` đầu vào không hợp lệ. `MATCH` chỉ chứng minh bản export khớp tại thời điểm xuất; không chứng minh kết nối đăng nhập/đọc/ghi trực tiếp hoặc Rules cloud. Nội dung do admin sửa hợp lệ có thể khác seed; xem từng khác biệt, không tự ghi đè để làm báo cáo xanh. File seed không được chấp nhận làm cả hai đầu vào.

Seed cục bộ ngày 25/10 đã thêm chính sách rating, mất kết nối và hết ngày. Bản cloud nhập trước đó có thể thiếu các trường này. Khi làm backend, lập migration cấu hình có chọn lọc; **không import lại root** của database đã có dữ liệu.

## Phụ thuộc QA

Các gói Firebase CLI, Rules test và Ajv nằm riêng ở đây, không đóng gói vào APK/web. Khi cài ngày 25/10/2026, npm audit báo 6 advisory mức moderate trong cây phụ thuộc công cụ, không có high/critical. Chưa ép hạ major Firebase CLI theo `audit fix --force`; rà soát lại khi nâng phiên bản công cụ.

Tham khảo chính thức: [Rules unit testing](https://firebase.google.com/docs/rules/unit-tests), [Emulator Suite](https://firebase.google.com/docs/emulator-suite/install_and_configure), [RTDB indexes](https://firebase.google.com/docs/database/security/indexing-data).
