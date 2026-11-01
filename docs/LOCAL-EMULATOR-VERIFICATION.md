# Kết quả triển khai Firebase Emulator

Ngày kiểm tra: 01/11/2026. Nhánh: `codex/integrate-tuong-auth`.
Base commit: `524c18a`. Working tree sạch trước triển khai; không stage/commit/push,
merge, deploy, đổi billing hoặc thay đổi tài nguyên Firebase thật.

## Kết quả đã chạy

| Kiểm tra | Kết quả |
| --- | --- |
| Functions TypeScript build | PASS |
| ESLint file firebaseAdmin.ts đã sửa | PASS |
| Backend/server unit và guard local | 9/9 PASS |
| Backend/server integration cũ + Rules thật trên Emulator | 6/6 PASS |
| Admin Web production build | PASS |
| Admin Web unit/component tests | 39/39 PASS |
| Runtime demo: Auth/Callable/HTTP, seed lặp, account blocked, Practice, Rules | 4/4 PASS |
| Chromium với Auth/Callable/HTTP local thật, không mock response | 2/2 PASS |
| Android compileDebugKotlin, compileReleaseKotlin | PASS |
| Android testDebugUnitTest | 11/11 PASS |
| Android SDK runtime smoke trên Pixel_4a AVD | 1/1 PASS, không skip |
| BE1 ensureUserProfile, Dashboard và Dashboard security scripts | PASS |
| BE1 Practice/History/Reviews | 55 tình huống PASS |
| BE1 TEST/DAILY | 12/12 PASS |
| Export, restart/import, đọc lại Auth/admin claims/catalog/wallet/Callable | PASS |
| Ctrl+C trong terminal và export-on-exit hoàn tất | PASS |
| PowerShell scripts | Parse PASS; Setup -CheckOnly chạy cả PowerShell 7 và Windows PowerShell 5.1 |
| Git diff --check | PASS |

Android smoke đăng nhập tài khoản demo, gọi ensureUserProfile, đọc catalog qua Rules,
load Dashboard, start/resume/leave Practice và đọc kết quả bằng repository thật.
Đây chưa phải kiểm thử toàn bộ giao diện Android từ đầu đến cuối.

Script Run-Android bản cuối đã được chạy để build APK, cài đúng AVD được chỉ định
bằng adb -s và mở MainActivity. Web đã mở Dashboard sau đăng nhập Admin; tài khoản
thường bị giữ ngoài workspace. Runtime Node kiểm tra cả banned/disabled.

Seed đã thêm 926 mục nội dung còn thiếu, tạo hai tài khoản local. Test chạy seed lại
xác nhận dữ liệu runtime đã có được giữ nguyên. Export/import đã kiểm tra bằng dữ
liệu thật của Emulator, không chỉ kiểm tra sự tồn tại của file manifest.

Setup đầy đủ trên máy mới vẫn cần internet tải dependencies/tooling. Trong lượt
triển khai này dependencies có sẵn; đã chạy CheckOnly, build và các runtime script.

## Rà soát tương thích cuối trước commit

Đã sửa các điểm cấu hình cụ thể:

- Server khai báo Node >=22.9.0 thay cho >=22, vì npm start dùng tùy chọn
  --env-file-if-exists có từ 22.9; lockfile chỉ đổi metadata engines, không đổi dependencies.
- Setup kiểm tra đúng major 24 thay vì nhận cả 25+, khớp engines Functions đã có từ base.
- Run-Android tìm adb theo sdk.dir và các biến SDK/PATH; hỗ trợ đường dẫn có khoảng
  trắng và Java Properties Unicode escapes mà không ghi lại local.properties.
- Khôi phục biến môi trường đúng cả trường hợp biến vốn chưa tồn tại. Trước sửa,
  PowerShell 7 có thể tạo biến rỗng và làm giá trị .env bị che khi chạy tiếp cùng terminal.

Kiểm tra bổ sung trong lượt review:

- Node thực tế: 24.22.0. Chưa chạy runtime Node 22; mức tối thiểu của server đối chiếu
  với tài liệu Node, mức Web đối chiếu engines dependencies đang cài.
- npm start nguyên gốc chạy và /health trả 200 trên cổng tạm 18080, dùng cấu hình demo
  qua biến môi trường và đường dẫn key không tồn tại. Không có .env thật hoặc key thật
  được tạo/đọc; chưa kiểm tra đăng nhập production.
- npm run dev nguyên gốc chạy và trả HTML/module 200 trên cổng tạm 15173.
  Unit test xác nhận không bật flag thì dùng cấu hình Firebase cũ.
- compileDebugKotlin không truyền flag PASS; BuildConfig USE_FIREBASE_EMULATORS=false.
  Chưa thao tác nút Run trong Android Studio ở lượt review này.
- Probe trên PowerShell 5.1 và 7: SDK path tùy chỉnh có khoảng trắng/Unicode, fallback
  SDK env, bảo toàn biến đã có/biến chưa tồn tại và thư mục hiện tại, từ chối cổng bận.
- Chạy lại server tests 9/9 và Web environment tests 3/3: PASS.

Các script không tự tạo/ghi đè .env hoặc local.properties. npm ci thay node_modules;
export-on-exit cập nhật bản lưu Emulator đã chọn theo thiết kế. Chế độ -Fresh giữ bản
lưu mặc định và xuất sang thư mục khác. Hai môi trường không chạy đồng thời trên
8080/5173; bộ BE1 QA cũ dùng chung các cổng Auth/Database/Functions.

## Thành phần được giữ nguyên

Đối chiếu Git với base xác nhận không sửa:

- `Backend/functions/src/be1/**` và `Backend/tests/**`.
- `frontend/contracts/**`, gồm mobile.v1.mjs.
- FirebaseRepositories.kt và WireCodec.kt; learning API vẫn dùng Callable.
- database.rules.json: default-deny và cả ba BE1 indexes giữ nguyên.
- firebase.json, .firebaserc, google-services.json và Android main manifest.
- Nghiệp vụ BE2, settlement, userSettlements, wallets và grant logic.

firebaseAdmin.ts chỉ thêm lựa chọn Database namespace cho demo Emulator, vẫn giữ
địa chỉ production hiện có. HTTP server chỉ thêm guard local, không có writer mới.
Release luôn có USE_FIREBASE_EMULATORS=false. Ngoại lệ HTTP vẫn chỉ ở Debug.

Các file thay đổi đã được quét mẫu private key/service-account/token phổ biến,
không có phát hiện. Giá trị đăng nhập demo và API key giả không phải credentials
production. .local, log, APK và ảnh test được Git ignore; không stage file nào.

## Danh sách file thay đổi (41)

```text
.gitignore
README.md
firebase.local.json
Backend/functions/src/config/firebaseAdmin.ts
Backend/server/README.md
Backend/server/package.json
Backend/server/package-lock.json
Backend/server/src/firebase.mjs
Backend/server/test/local-config.test.mjs
Backend/server/test/local.integration.test.mjs
Backend/server/tools/local-config.mjs
Backend/server/tools/seed-local.mjs
docs/LOCAL-EMULATOR.md
docs/LOCAL-EMULATOR-VERIFICATION.md
frontend/admin-web/.env.example
frontend/admin-web/README.md
frontend/admin-web/docs/API-CONTRACT.md
frontend/admin-web/e2e-local/auth.spec.ts
frontend/admin-web/playwright.local.config.ts
frontend/admin-web/src/firebase/auth.ts
frontend/admin-web/src/firebase/backend.ts
frontend/admin-web/src/firebase/client.ts
frontend/admin-web/src/firebase/environment.ts
frontend/admin-web/src/test/auth-flow.test.ts
frontend/admin-web/src/test/emulator-environment.test.ts
frontend/admin-web/vite.config.ts
frontend/app/build.gradle.kts
frontend/app/src/androidTest/java/com/englishbattle/app/FirebaseEmulatorSmokeTest.kt
frontend/app/src/debug/AndroidManifest.xml
frontend/app/src/debug/java/com/englishbattle/app/FirebaseEnvironment.kt
frontend/app/src/main/java/com/englishbattle/app/EnglishBattleApplication.kt
frontend/app/src/release/java/com/englishbattle/app/FirebaseEnvironment.kt
scripts/local/Export.ps1
scripts/local/Local.Common.ps1
scripts/local/Run-Android.ps1
scripts/local/Seed.ps1
scripts/local/Setup.ps1
scripts/local/Start-AdminServer.ps1
scripts/local/Start-AdminWeb.ps1
scripts/local/Start-Emulators.ps1
scripts/local/Test-Local.ps1
```

## Giới hạn

- Dữ liệu mỗi thành viên độc lập; không có đồng bộ giữa các máy.
- Chỉ hỗ trợ browser và Android Emulator trên cùng máy; chưa cấu hình LAN/điện thoại thật.
- Admin Auth chạy thật trên Emulator, các trang nghiệp vụ vẫn dùng MockAdminService.
- API nghiệp vụ chưa có và lịch production không tự xuất hiện trong Emulator.
- Gradle/Compose có cảnh báo deprecation hiện có; không chặn build.
- Khi công cụ tự động dừng cưỡng bức tiến trình, export-on-exit có thể không chạy;
  dùng Export.ps1 để lưu chủ động trước khi đóng terminal hoặc dừng cưỡng bức.

Lệnh chạy cho nhóm: [LOCAL-EMULATOR.md](LOCAL-EMULATOR.md).
