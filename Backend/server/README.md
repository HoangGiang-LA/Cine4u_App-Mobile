# Backend riêng cho Firebase Spark

Node.js + Firebase Admin SDK, chạy trên máy tính hoặc máy chủ riêng. Firebase tiếp tục xử lý đăng ký/đăng nhập email và lưu Realtime Database trong hạn mức Spark. Backend này không triển khai Cloud Functions.

Xác nhận trên máy phát triển ngày 30/10/2026: đã cấu hình khóa qua `.env` không được Git theo dõi, kết nối Firebase thật, publish Rules và kiểm tra app tự khởi tạo hồ sơ rồi đọc đủ 4 kỹ năng. Backend local dùng cổng 8080, web admin dùng cổng 5173. Các tiến trình cần được chạy lại sau khi tắt máy; thông tin khóa giữ riêng trên máy chủ.

## Luồng tài khoản

1. App đăng ký hoặc đăng nhập bằng Firebase Authentication.
2. App gửi Firebase ID token đến `POST /api/ensureUserProfile`.
3. Backend xác minh token, kiểm tra tài khoản bị vô hiệu hóa và trạng thái khóa/xóa.
4. Backend tạo những bản ghi còn thiếu: `users`, `userPrivate`, `userSettings`, `userStats`, `wallets`.
5. Sau khi khởi tạo thành công, backend tạo `accountAccess/{uid}/status = active` cho tài khoản mới. Tài khoản bị khóa/xóa không được tự mở lại.
6. App mới bắt đầu đọc danh mục và mở phần đã đăng nhập.

Việc này diễn ra tự động với tài khoản mới và tài khoản Auth đã có từ trước. Gọi lại không đặt lại số dư, rating hoặc tiến độ. UID, email và thông tin nhận dạng lấy từ Firebase Auth. Client không được gửi UID hoặc vai trò để tự cấp quyền.

## Thiết lập một lần để dùng Firebase thật

1. Firebase Console → **Project settings → Service accounts → Firebase Admin SDK → Generate new private key**. Lưu file JSON trên máy chạy backend, ví dụ `D:/private/englishbattle-service-account.json`. Đây là khóa riêng của server; không đưa vào app, web hoặc Git và không dán nội dung vào chat.
2. Trong thư mục này:

```powershell
Copy-Item .env.example .env
npm ci
```

3. Sửa `GOOGLE_APPLICATION_CREDENTIALS` trong `.env` thành đường dẫn tuyệt đối đến file JSON vừa lưu. Project và database URL đã có mẫu cho English Battle.
4. Chạy backend:

```powershell
npm start
```

Kiểm tra `http://127.0.0.1:8080/health` trả `{"status":"ok"}`. Mỗi lần phát triển, cần để tiến trình backend chạy.

5. Publish file `database.rules.json` ở thư mục gốc lên **Realtime Database → Rules**. File này yêu cầu tài khoản active, giới hạn danh mục theo query published và chặn mọi client write. Đây là cấu hình một lần; backend tự tạo quyền user cho các tài khoản về sau.
6. Chạy lại app Android trong Android Studio. Bản debug mặc định dùng `http://10.0.2.2:8080`, địa chỉ máy tính nhìn từ Android Emulator. Web khi chạy `npm run dev` dùng `http://127.0.0.1:8080`.

Không cần tạo từng UID hoặc sửa database cho từng người đăng ký.

## Mật khẩu tài khoản

Mật khẩu mới phải có ít nhất 8 kí tự, gồm số, chữ hoa và ký tự đặc biệt được Firebase hỗ trợ (ví dụ `!`, `@`, `#`, `_`, `-`). App kiểm tra ngay khi nhập và trước khi tạo tài khoản. Firebase Authentication cũng áp dụng chính sách này khi đăng ký hoặc đặt lại mật khẩu qua email; trang đặt lại do Firebase cung cấp tự hiển thị hướng dẫn của Firebase.

Đã bật chính sách trên project thật ngày 30/10/2026, không bật ép đổi mật khẩu khi đăng nhập. Tài khoản cũ tiếp tục đăng nhập bằng mật khẩu hiện tại; mật khẩu đặt mới phải tuân thủ chính sách.

```powershell
npm run password-policy -- show
# Áp dụng cho project trong .env sau khi thiết lập một project mới:
npm run password-policy -- apply
```

Lệnh `apply` sao lưu riêng cấu hình mật khẩu vào `build/backups/` (được Git bỏ qua) trước khi cập nhật; không thay đổi cấu hình Auth khác. Quyền admin vẫn được cấp theo UID, không dựa trên độ mạnh mật khẩu.

## Admin

Người đăng ký thông thường không được cấp quyền admin. Chủ dự án cấp quyền cho tài khoản quản trị được chọn từ máy chủ tin cậy:

```powershell
npm run admin -- grant FIREBASE_UID
npm run admin -- revoke FIREBASE_UID
```

Lệnh giữ nguyên các custom claims khác. Khi cấp mới, tài khoản cần đăng xuất/đăng nhập lại hoặc bấm **Refresh access**. `POST /api/getAdminSession` kiểm tra token, claim boolean `admin: true` trong hồ sơ Auth hiện tại và trạng thái active. Claim đã thu hồi không được dùng lại qua token cũ. Tài khoản bị khóa/xóa bị từ chối.

Web xác nhận quyền quản trị qua backend rồi mở Dashboard. Các trang nghiệp vụ dùng dữ liệu mẫu trong lúc chờ API quản lý người dùng, câu hỏi, trận đấu và báo cáo. Chỉ phiên admin hợp lệ được mở workspace; không có đường vào demo ở trang đăng nhập.

## Địa chỉ server

- Android: truyền Gradle property `-PbackendBaseUrl=https://your-server.example` hoặc biến môi trường `ENGLISH_BATTLE_BACKEND_URL`. Bản release yêu cầu HTTPS và phải có URL cấu hình.
- Điện thoại thật trong mạng LAN: cấu hình `HOST=0.0.0.0`, dùng IP LAN của máy tính cho `backendBaseUrl` khi build debug.
- Web: đặt `VITE_BACKEND_BASE_URL` trước khi build; bổ sung origin web thật vào `ADMIN_ORIGINS` của backend.
- Người dùng ngoài mạng LAN cần backend được triển khai ở địa chỉ HTTPS truy cập được. Máy chạy backend cần duy trì hoạt động. Firebase Spark và dịch vụ hosting nếu chọn sau này đều có giới hạn sử dụng; việc chạy local không cung cấp server công khai luôn bật.

## API

Gửi `Authorization: Bearer FIREBASE_ID_TOKEN`, JSON `{"data":{}}`. Hai phương thức tài khoản không nhận các trường tùy ý.

- Thành công: `{"result":{"serverNow":123}}`; `getAdminSession` thêm UID, role và displayName.
- Thất bại: `{"error":{"status":"PERMISSION_DENIED","message":"...","details":{"reason":"account-banned"}}}`.
- Các phương thức học/thi đấu chưa triển khai trả `UNIMPLEMENTED`; backend không trả dữ liệu mẫu thay thế.

Các API mới phải lấy danh tính đã xác minh từ middleware và gọi `requireActive` trước khi xử lý. API admin phải kiểm tra cả claim token và claim Auth hiện tại, như `getAdminSession`.

## Kiểm thử

```powershell
npm run check
npm test
```

Kiểm thử Firebase tích hợp từ thư mục gốc, dùng JDK 21+ và Firebase CLI:

```powershell
.\frontend\verification\node_modules\.bin\firebase.cmd emulators:exec --project demo-english-battle-auth --only auth,database --config firebase.auth-qa.json "npm --prefix Backend/server run test:integration"
```

Kiểm thử bắt buộc dùng Auth/Database emulator trên loopback và project `demo-`; không dùng khóa thật và không sửa dữ liệu production.

Tài liệu: [Admin SDK](https://firebase.google.com/docs/admin/setup), [xác minh ID token](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Firebase Spark](https://firebase.google.com/pricing).
