# Frontend người dùng — bàn giao tích hợp backend

Ngày cập nhật: 25/10/2026. Nền tảng: Android Kotlin + Jetpack Compose. Giao diện phải giữ theo Figma; các chuẩn bị backend không thay bố cục, nút hoặc nhãn. Xem [bàn giao trước backend](PRE-BACKEND-HANDOFF.md) và [hợp đồng máy đọc](../contracts/README.md).

## Trạng thái 10 nhóm việc

| Nhóm | Đã triển khai trong frontend | Phần cần môi trường/backend |
|---|---|---|
| 1. Đồng bộ UI | Bỏ XP/level, rating/xu, 4 chế độ với số câu riêng, 25 chủ đề trong bản mô phỏng | Nội dung thật theo dữ liệu đã xuất bản |
| 2. Kiến trúc | Model, Auth/Catalog/UserData/Play ViewModel, repository interfaces và adapter Firebase/demo | Triển khai callable theo hợp đồng bên dưới |
| 3. Xác thực | Email/password, đăng ký, reset password, đổi tên, đổi email có reauthentication, khôi phục phiên, đăng xuất | Bật Email/Password tại Firebase Console; kiểm tra email gửi thật. Nút Google được khôi phục theo Figma và hiện thông báo chưa cấu hình; chưa có xác thực Google/điện thoại |
| 4. Danh mục | Firebase Database SDK, listener categories/topics theo query published, lỗi/rỗng/loading/retry | Rules cho phép truy vấn này và dữ liệu đã nhập |
| 5. Làm bài | Chọn chủ đề, hướng dẫn, chọn/gửi đáp án, receipt, timeout, TTS, kết quả/review, resume | Server chọn đề, deadline, chấm và trả kết quả |
| 6. Thử thách/tiến độ | Trạng thái lượt ngày, resume, thống kê, mốc 20 lần | Server quản lý ngày/lượt, tiến độ, thành tích |
| 7. Thi đấu | Sảnh, tìm/hủy, phòng riêng, mã phòng, vào trận, trạng thái kết nối, kết quả/lịch sử | Server ghép trận, đồng bộ lượt, grace period, phân xử |
| 8. Hồ sơ/phụ | Profile thật từ Auth, wallet, lịch sử, leaderboard tuần/tháng/phân trang, achievements, notification/read, settings theo tài khoản | Dashboard/kết quả/thông báo do backend cung cấp; chưa có dịch vụ push notification |
| 9. Hợp đồng | Interfaces, adapter callable, DTO/parser, request IDs, trạng thái/lỗi, ranh giới quyền | Hai bên triển khai và xác nhận contract |
| 10. QA | Unit test contract và instrumentation cho repository/demo/UI, ảnh màn hình nhỏ/chữ lớn, build/lint | Kiểm thử tích hợp với backend và tài khoản Firebase thật trước phát hành |

Các trạng thái trên mô tả phần frontend. Mô phỏng chạy được toàn bộ luồng không có nghĩa là đã có backend hoạt động. Chưa thể tuyên bố thi đấu thật, thưởng thật hoặc thông báo đẩy đã chạy end-to-end.

## Chạy ứng dụng

Mở thư mục `frontend` bằng Android Studio, chọn Gradle JDK 21. Máy hiện tại:

```powershell
$env:JAVA_HOME='C:\Users\Acer\.jdks\jbr-21.0.11'
.\gradlew.bat assembleDebug lintDebug testDebugUnitTest
.\gradlew.bat connectedDebugAndroidTest
```

APK: `app/build/outputs/apk/debug/app-debug.apk`.

Bản debug có nút **Khám phá bản mô phỏng** trên màn hình đăng nhập. Bản release không có nút và không đóng gói `src/debug/assets/demo-content.json`. Chế độ thật là mặc định. Chỉ người dùng chủ động chọn demo mới dùng dữ liệu mô phỏng; lỗi mạng/Firebase không chuyển sang demo.

Demo có 250 câu/25 chủ đề từ seed, lưu phiên/kết quả/xu trong SharedPreferences riêng trên thiết bị. Đối thủ có nhãn “Đối thủ mô phỏng”, phòng chỉ giả lập. Nhận diện demo là `demo-local`, không tạo Firebase user. Điểm/xu của demo không được gửi vào Firebase.

## Thiết lập Firebase thật

- Package: `com.englishbattle.app`.
- Project: `englishbattleapp-8d764`.
- RTDB: `https://englishbattleapp-8d764-default-rtdb.asia-southeast1.firebasedatabase.app`.
- File ứng dụng: `app/google-services.json`. SDK/plugin đã được thêm.
- Bật Authentication → Sign-in method → Email/Password.
- Đăng ký qua Firebase Auth chỉ tạo tài khoản Auth. Frontend gọi `ensureUserProfile` để backend khởi tạo dữ liệu nghiệp vụ; frontend không tự ghi rating/ví.
- Đọc danh mục dùng `orderByChild("status").equalTo("published")` trên `/categories` và `/topics`, listener được gỡ khi kết thúc phiên/ViewModel hoặc retry.
- `database.rules.json` ở gốc dự án được giữ nguyên deny-all do người dùng đã đặt. Rules đề xuất và các kiểm thử được mô tả bên dưới; chưa triển khai lên Firebase.
- Bản đề xuất đầy đủ hơn ở `contracts/database.rules.proposed.json`, kiểm thử bằng emulator riêng. Nó yêu cầu backend provision `accountAccess` active, chặn toàn bộ client writes và chỉ mở các read đã liệt kê. Chưa deploy. Chưa xác nhận toàn bộ nội dung/Rules cloud vì chưa có export thật.
- Đăng ký/đăng nhập vẫn hoạt động khi RTDB deny-all; màn danh mục sẽ báo chưa có quyền.
- Chưa tạo tài khoản trên project thật hoặc thay Rules trên Console trong lần triển khai frontend này.

## Cấu trúc

- `data/Models.kt`: model và các giá trị hiển thị mặc định.
- `data/Repositories.kt`: hợp đồng tác vụ.
- `data/FirebaseRepositories.kt`: Auth, danh mục RTDB và callable Functions.
- `data/WireCodec.kt`: parser/serialization DTO.
- `data/DemoRepositories.kt`: mô phỏng tách khỏi dữ liệu thật.
- `EnglishBattleApplication.kt`: nơi chọn repository và cấu hình project/region.
- `ui/UserViewModels.kt`: trạng thái xác thực, catalog, dashboard và phiên làm bài/tìm trận.
- `ui/App.kt`: điều hướng, chặn truy cập khi chưa đăng nhập, xóa trạng thái UI khi đổi phiên, lifecycle/network banner.

## Hợp đồng callable đề xuất v1

**Đây là hợp đồng frontend đã chuẩn bị, chưa phải các Functions đã được triển khai.** Adapter hiện dùng region `asia-southeast1`. Nếu backend dùng region khác, đổi trong `FirebaseGameRepository`.

Tất cả callable nhận Firebase Auth token qua SDK. Server lấy UID từ `request.auth.uid`, không tin UID do client tự gửi. Mọi phản hồi thành công có `serverNow` là Unix epoch milliseconds dạng số để đồng bộ đồng hồ hiển thị. Không dùng chuỗi timestamp hoặc timestamp thiết bị làm nguồn quyết định.

| Function | Request | Response ngoài `serverNow` |
|---|---|---|
| `ensureUserProfile` | `{}` | `{}`; idempotent, khởi tạo rating 0/ví 0 nếu thiếu, đồng bộ tên từ Firebase Auth |
| `getUserDashboard` | `{}` | `{ dashboard: Dashboard }` |
| `startAttempt` | `{ mode, topicId?, requestId }` | `{ attempt: AttemptState }` |
| `resumeAttempt` | `{ attemptId }` | `{ attempt: AttemptState }` |
| `submitAttemptAnswer` | `{ attemptId, questionId, optionId: string|null, requestId }` | `{ attempt: AttemptState }` |
| `advanceAttempt` | `{ attemptId, requestId }` | `{ attempt: AttemptState }` |
| `leaveAttempt` | `{ attemptId, requestId }` | `{ attempt: AttemptState }` |
| `findBattle` | `{ kind: quick|daily|create|join, roomCode?, requestId }` | `{ ticket: MatchTicket }` |
| `getBattleTicket` | `{ ticketId }` | `{ ticket: MatchTicket }` |
| `cancelBattleSearch` | `{ ticketId }` | `{}`; idempotent |
| `getLeaderboard` | `{ period: week|month, cursor?: string|null }` | `{ page: LeaderboardPage }` |
| `markNotificationsRead` | `{ ids: string[] }` | `{}`; chỉ thông báo của chính UID |
| `getAttemptResult` | `{ attemptId }` | `{ result: QuizResult }`; kiểm tra quyền sở hữu/thành viên |

Các enum mode trên wire là `PRACTICE`, `TEST`, `DAILY`, `BATTLE`. `topicId` bắt buộc cho PRACTICE. Backend thực thi số câu/tập câu phù hợp, không tin mode/topic/count do frontend gửi ngoài phạm vi được phép.

Schema request/response: [`contracts/mobile.v1.mjs`](../contracts/mobile.v1.mjs). `findBattle` giai đoạn đầu chỉ triển khai `quick`; `daily/create/join` giữ UI/hợp đồng để phát triển sau và server trả `UNIMPLEMENTED` khi chưa hỗ trợ, không tự chuyển thành trận nhanh.

### DTO quan trọng

Tên trường chính xác được định nghĩa trong `Models.kt` và `WireCodec.kt`. Danh sách trên wire là JSON array, kể cả options; ID không được thay bằng vị trí trong array. Các trường tùy chọn vắng mặt/null được ghi rõ dưới đây.

```json
{
  "serverNow": 1792846800000,
  "attempt": {
    "id": "attempt_123",
    "mode": "PRACTICE",
    "topicId": "vocabulary_daily_life",
    "index": 0,
    "deadlineAt": 1792846830000,
    "status": "active",
    "opponentName": "",
    "receipts": [],
    "questions": [{
      "id": "q_0001",
      "version": "v1",
      "categoryId": "vocabulary",
      "topicId": "vocabulary_daily_life",
      "prompt": "Choose the correct word.",
      "passage": "",
      "audioText": "",
      "options": [{"id":"opt_1","text":"First"},{"id":"opt_2","text":"Second"}]
    }],
    "result": null,
    "reconnectDeadlineAt": null
  }
}
```

Ví dụ rút gọn còn một câu; phiên PRACTICE thật phải có 10 câu. `questions` chỉ chứa dữ liệu được phép tiết lộ. Nếu backend cần ẩn câu tương lai thì cùng thống nhất mở rộng DTO để phân trang từng câu; adapter v1 hiện nhận bộ câu cố định. Không có `correctId` hoặc explanation trong question đang chơi.

- `receipts`: `[{questionId, optionId: string|null, correct: boolean|null}]`. Null option nghĩa là không trả lời/hết giờ. `correct` có thể bỏ qua/null trong battle để không công bố sớm. Khi receipt được trả, frontend khóa gửi lại câu đó.
- `status`: `active`, `waiting`, `completed`, `abandoned`. Phiên terminal phải trả `result` để UI điều hướng. Khi waiting chưa có câu được phép đọc có thể trả questions rỗng; frontend hiển thị chờ và tải lại.
- `index`: zero-based trong questions; ID phải duy nhất. `deadlineAt` và `reconnectDeadlineAt` là epoch ms theo server. Backend vẫn kiểm tra trễ ngay cả khi client gửi trước khi UI thấy 0.
- `QuizResult`: `{attemptId, mode, correct, total, coins, ratingDelta, outcome, opponentName, opponentCorrect, completedAt, reviews}`. `outcome`: completed/abandoned/win/loss/draw/left. `coins`, `ratingDelta` là thay đổi thực tế đã áp dụng, gồm floor rating 0. `reviews`: `[{question: QuizQuestion,pickedId:string|null,correctId,explanation}]` chỉ trả khi được phép xem. Rời trận trước lúc phân xử có thể trả reviews rỗng.
- `Dashboard`: `{rating,coins,wins,losses,draws,streak,progress,daily,history,achievements,notifications,ledger,skills}`. `progress` map topicId→số lần hoàn thành. `daily` là `{status,attemptId?}`, status available/active/waiting/completed/abandoned; ngày và lượt tính phía server. `history`/ledger là danh sách gần đây, đề xuất giới hạn 50 bản ghi để không tải toàn bộ lịch sử.
- `achievements`: `[{id,title,description,unlocked}]`.
- `notifications`: `[{id,title,body,destination,read,createdAt}]`. Destination frontend cho phép: Achievements/Challenge/Practice/Battle/Leaderboard/History/Wallet. Không thực thi URL hoặc tên màn hình tùy ý.
- `ledger`: `[{id,label,delta,createdAt}]`.
- `skills`: `[{id,name,answered,correct}]`.
- `MatchTicket`: `{id,status,opponentName?,attemptId?,roomCode?}`, status searching/waiting/matched/cancelled/expired/failed. Phòng riêng dùng mã 6 ký tự A–Z/0–9 ở frontend hiện tại; backend chuẩn hóa/kiểm tra trùng và kiểm tra phòng đầy/hết hạn.
- `LeaderboardPage`: `{title,entries:[{uid,name,rank,rating}],self:{uid,name,rank,rating}|null,nextCursor:string|null}`. `rank` bắt đầu 1. Đã chốt: cả `week` và `month` trả cùng bảng rating tích lũy hiện tại của tất cả người chơi; không reset rating hoặc lọc người chơi theo kỳ. Mặc định phá hòa bằng UID tăng dần sau rating giảm dần. Client gộp trang theo UID; backend giữ snapshot/cursor nhất quán.

### Tính nhất quán và vòng đời

- Start/find có requestId UUID được giữ trên thiết bị đến khi nhận kết quả, dùng lại khi retry/mở lại app. Cần server deduplicate theo UID+operation+requestId; không dùng chuỗi requestId thô làm RTDB path nếu chứa ký tự không hợp lệ.
- Submit/advance/leave dùng khóa ổn định theo attempt/question/index. Khóa gửi lại không được tạo đáp án, lượt, reward hoặc completion mới. Server kiểm tra quyền và trạng thái cùng với dedupe.
- Sau timeout không giả định giao dịch chưa chạy. Frontend dùng lại requestId hoặc resume trước khi tiếp tục.
- `advanceAttempt` trong battle chỉ đồng bộ lượt được server cho phép; một client không được tự thay đổi lượt/deadline của cả trận. Server phải tự chạy deadline và phân xử dù client không gọi advance.
- Backend bảo đảm một bộ câu/version chung cho hai người; không lộ lựa chọn chưa commit của đối thủ; kết quả đã chốt không được mở lại.
- `cancelBattleSearch` nếu race với matched/started phải xử lý nguyên tử: hủy yêu cầu trước khi trận bắt đầu, hoặc áp dụng quy tắc rời trận/đưa lỗi kèm khả năng lấy lại ticket. Không để orphan battle mà client không thể khôi phục.
- Mã phiên/ticket đang dở được lưu theo mode+UID. Các StateFlow/UI bị xóa khi đăng xuất/đổi tài khoản, không lưu mật khẩu hoặc đáp án đúng của phiên thật vào preferences. Settings và demo có namespace riêng.
- Resume từ app nền tính lại thời gian theo deadline, không đặt lại 30 giây. TTS dừng khi sang câu, thoát màn hình hoặc app xuống nền.
- Adapter v1 cập nhật ticket và trận đang mở bằng polling callable mỗi 3 giây; dừng khi app xuống nền, kết thúc hoặc hủy; lỗi có backoff. Đây chưa phải listener battle RTDB. Có thể thay implementation bằng `battlePayloads/{roomId}/{uid}` khi backend chốt payload/Rules, giữ nguyên interface/UI.
- Mất mạng không tự phân xử thắng/thua. UI chỉ hiển thị reconnectDeadlineAt nếu server cung cấp. Server quản lý grace period 30 giây kể cả khi client bị tắt.
- Nếu cả hai đều mất kết nối quá grace 30 giây trước khi có kết quả cuối, xử hòa, không đổi rating và không thưởng xu. Kết quả đã chốt bất biến. Thứ tự sự kiện cạnh tranh phải được xử lý nguyên tử tại server.
- Thử thách học kết thúc lúc 00:00 `Asia/Ho_Chi_Minh`: `deadlineAt` của câu là min(đầu câu + 30 giây, mốc hết ngày). Phiên cũ trả `status: abandoned`, `result.outcome: abandoned`, `coins: 0`, không chiếm lượt ngày mới. Không nhận đáp án/thưởng gửi trễ hoặc mở lại phiên cũ sau mốc này. Demo đã mô phỏng quy tắc này; thật vẫn do server quyết định.
- Khi callable trả UNAUTHENTICATED, adapter đăng xuất phiên local để người dùng xác thực lại. Các lỗi khác không biến thành kết quả thành công.

### Lỗi

Dùng Firebase callable codes: UNAUTHENTICATED, PERMISSION_DENIED, INVALID_ARGUMENT, FAILED_PRECONDITION, ALREADY_EXISTS, NOT_FOUND, UNIMPLEMENTED, UNAVAILABLE, DEADLINE_EXCEEDED. Frontend có thông báo tiếng Việt và retry. Không trả stack trace hoặc dữ liệu người khác trong error message.

## Những việc backend còn phải thực hiện

1. Provision tài khoản/hồ sơ/ví, kiểm soát accountAccess/admin bằng server.
2. Chọn đề, giữ đáp án, deadline, chấm bài, resume và kết quả/review.
3. Daily slot theo UID+ngày Việt Nam; hết hạn phiên cũ lúc 00:00 và không thưởng.
4. Ghép trận nhanh, presence/reconnect, shared rounds, rời trận và chốt kết quả. Thi đấu ngày/phòng riêng giữ để phát triển sau.
5. Reward/coinLedger/ratingLedger/progress chống xử lý trùng và cập nhật nhất quán.
6. Tổng hợp dashboard, leaderboard và notification theo contract.
7. Security Rules đầy đủ, test phân quyền; không mở ghi rating/wallet/reward cho client.
8. Hoàn thiện thứ tự sự kiện kết thúc đồng thời, sự cố server, streak và chính sách vận hành. Metric leaderboard, cả hai mất kết nối quá hạn và daily qua nửa đêm đã chốt ở trên; lịch thi đấu ngày thuộc giai đoạn sau.
9. Push notification là hạng mục tích hợp riêng: FCM token/device registration, dịch vụ gửi, xử lý foreground/background/deep link và chính sách quyền. Frontend hiện có trung tâm thông báo, thao tác đã đọc và xin quyền Android; chưa có FCM delivery.

## Kiểm tra trước phát hành

- Bật provider; tạo tài khoản thử riêng, kiểm tra đăng nhập sai/đúng, email reset, đổi tên/email và đổi tài khoản.
- Với Rules deny-all: danh mục phải báo lỗi quyền. Với ví dụ Rules: chỉ query published được đọc; chưa đăng nhập/ghi danh mục/đọc đáp án phải bị từ chối.
- Backend staging: thử API timeout sau khi server đã commit, submit/advance/finalization lặp và hai thiết bị cùng tài khoản.
- Bài học: hết giờ, TTS không có giọng, app nền/kill/reopen, rời bài, lượt ngày và thành tích 20/20.
- Trận: hủy tìm ngay khi matched, phòng sai/đầy/hết hạn, hai client cùng đề, mất mạng 30 giây, cả hai ngắt kết nối, thua ở rating 0/1, hòa và phần thưởng đúng một lần.
- Notification read, danh sách rỗng, lỗi mạng, phân trang leaderboard, màn nhỏ và chữ lớn.
- Build release và xác nhận không có demo asset/nút demo. Signing/distribution và chính sách bảo mật phát hành vẫn cần cấu hình của chủ dự án.

Nguồn SDK: https://firebase.google.com/docs/auth/android/password-auth ; https://firebase.google.com/docs/database/android/read-and-write ; https://firebase.google.com/docs/functions/callable .
