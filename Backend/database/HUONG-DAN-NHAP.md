# Nhập dữ liệu English Battle vào Firebase Realtime Database

## File cần nhập

**Chỉ nhập `english-battle.seed.json` vào database trống ở lần thiết lập đầu tiên.** File đã được tạo sẵn tại:

```text
D:\visual studio\EnglishBattle-full\Backend\database\english-battle.seed.json
```

Firebase Realtime Database nhận dữ liệu JSON. Không dán toàn bộ file vào ô Value dưới dạng chuỗi, không dán vào tab Rules và không cần viết lệnh SQL.

Các bước theo màn hình Firebase Console người dùng đã gửi:

1. Mở đúng project **EnglishBattleApp → Realtime Database → Data**.
2. Chọn node gốc, dòng địa chỉ database đang hiển thị `null` trong ảnh.
3. Bấm menu **ba chấm ⋮** bên phải khung dữ liệu.
4. Chọn **Import JSON**.
5. Chọn file `english-battle.seed.json` ở đường dẫn trên và bấm **Import**.
6. Kiểm tra xuất hiện các nhánh `appConfig`, `categories`, `topics`, `lessons`, `questions`, `questionVersions`, `questionAnswers` và các nhánh tĩnh còn lại.

Nhập JSON có thể ghi đè dữ liệu tại vị trí nhập. Hướng dẫn này dành cho database trống như ảnh. Khi đã có người dùng/trận đấu thật, hãy Export JSON để sao lưu và cập nhật có chọn lọc bằng script migration; không nhập lại toàn bộ seed vào root.

[Hướng dẫn Import JSON chính thức của Firebase](https://firebase.google.com/docs/database/manage-data-console).

## Nội dung file nhập

| Dữ liệu | Số lượng / mô tả |
|---|---|
| Kỹ năng | 4: Từ vựng, Ngữ pháp, Nghe, Đọc hiểu |
| Chủ đề | 25, gồm 24 chủ đề hiện có trong app và Idioms & Phrases thuộc Từ vựng |
| Bài luyện tập | 25, một bộ cho mỗi chủ đề |
| Câu hỏi | 250 câu: 70 từ vựng, 60 ngữ pháp, 60 nghe, 60 đọc |
| Câu mỗi chủ đề | 10 câu riêng biệt, 4 lựa chọn/câu, một đáp án đúng |
| Đáp án và giải thích | 250 bộ, lưu riêng tại `questionAnswers/{questionId}/v1` |
| Cấu hình đề | 28: 25 luyện tập + 1 kiểm tra + 1 thử thách ngày + 1 thi đấu |
| Thành tích | 25 thành tích hoàn thành mục luyện tập 20 lần + 6 huy hiệu mẫu theo giao diện hiện có |
| Nội dung nghe | 30 đoạn Text-to-Speech, mỗi đoạn dùng cho 2 câu hỏi |
| Chỉ mục / danh sách admin | Liên kết kỹ năng, chủ đề, bài, câu hỏi, mã câu và bản tóm tắt ngân hàng câu hỏi |
| Cấu hình trò chơi | Số câu, thời gian, rating, xu và giới hạn thử thách đã chốt |

Danh sách chủ đề:

- Từ vựng: Đời sống hằng ngày, Du lịch, Công việc, Ăn uống, Học tập, Sức khỏe, Idioms & Phrases.
- Ngữ pháp: Thì, Giới từ, Mạo từ, Danh từ, Động từ, Tính từ.
- Nghe: Hội thoại hằng ngày, Du lịch, Công việc, Giáo dục, Ăn uống, Sức khỏe.
- Đọc hiểu: Đời sống hằng ngày, Du lịch, Khoa học & Công nghệ, Giáo dục, Văn hóa & Xã hội, Sức khỏe.

Mỗi câu có ID, phiên bản `v1`, kỹ năng/chủ đề, mức độ, trạng thái published, nội dung và bốn lựa chọn có ID ổn định. Bài đọc có passage. Bài nghe có audioAssetId dẫn tới nội dung TTS. Đáp án đúng tham chiếu optionId, không tham chiếu vị trí sau khi đảo lựa chọn.

## Luật đã ghi vào dữ liệu cấu hình

| Chế độ | Số câu | Thời gian/câu | Xu |
|---|---:|---:|---:|
| Luyện tập | 10 | 30 giây | Hoàn thành +1 |
| Kiểm tra | 20 | 30 giây | Hoàn thành +2 |
| Thử thách ngày | 5 | 30 giây | Hoàn thành +2, một lượt/ngày |
| Thi đấu | 10 câu chung cho hai người | 30 giây | Thắng +5; thua/hòa 0 |

- Rating ban đầu 0, thắng +5, thua -2 và không thấp hơn 0; hòa không đổi.
- Đúng nhiều câu hơn thắng. Không dùng tốc độ để phá hòa.
- Chủ động thoát trận đang chơi là thua. Mất kết nối có 30 giây để trở lại, quá hạn thua.
- Cả hai cùng mất kết nối quá grace 30 giây khi trận chưa chốt: hòa, không đổi rating/xu. Kết quả đã chốt không mở lại.
- Thử thách tính lượt khi bắt đầu thành công; bỏ dở không được lượt khác. Resume cùng phiên, không đổi bộ câu hoặc reset deadline.
- Đến 00:00 Việt Nam kết thúc thử thách học của ngày cũ, không thưởng; ngày mới có lượt riêng. Câu hỏi sát nửa đêm bị cắt deadline tại 00:00. Wire status/outcome là `abandoned`.
- Xếp hạng Tuần/Tháng cùng rating tích lũy hiện tại của tất cả người chơi; không reset hoặc nhân điểm theo kỳ.
- Mỗi lần hoàn thành luyện tập hợp lệ tăng tiến độ của mục đó. Đủ 20 lần mở thành tích đúng một lần.
- Không có XP, level, Premium, thanh toán hoặc chức năng đổi thưởng bằng xu.
- Thưởng thành tích đang bằng 0: không tự thêm xu ngoài các mức đã được yêu cầu.

**Các con số cấu hình không tự thực thi luật.** Backend vẫn phải chọn đề, kiểm tra thời gian, chấm bài, xử lý thoát trận và cập nhật rating/xu/tiến độ theo cách chống xử lý trùng. Import dữ liệu chưa kết nối frontend hoặc triển khai các API này.

## Các mặc định khởi đầu đã chọn để file dữ liệu dùng được

Những lựa chọn dưới đây là mặc định triển khai có thể chỉnh, không phải yêu cầu mới do người dùng xác nhận:

- Đề kiểm tra, thử thách và thi đấu lấy ngẫu nhiên từ tất cả kỹ năng đã xuất bản. Có thể đổi questionPool khi chốt phạm vi.
- Bài luyện tập lọc đúng kỹ năng và chủ đề đã chọn. Mỗi chủ đề hiện có 10 câu nên một bài 10 câu sẽ dùng hết bộ đó và có thể đổi thứ tự; thêm câu mới để có nhiều tổ hợp đề hơn. Bộ câu khác nhau vẫn có thể lặp lại giữa các lần làm.
- Chọn không trùng questionId trong một đề; không đủ câu thì báo thiếu nội dung, không nhân bản câu cho đủ số.
- Timezone dùng `Asia/Ho_Chi_Minh` để tính ngày chung cho người chơi.
- Một câu hết giờ được coi là không đúng. Hoàn thành bài khi mọi câu đã được chốt; chưa đặt ngưỡng điểm tối thiểu để nhận xu hoàn thành.
- 6 huy hiệu ngoài mốc luyện tập lấy từ giao diện hiện có: thắng đầu tiên, thắng 3 liên tiếp, thắng 10, hoàn tất 20 trận, thắng 50, hoàn thành 7 thử thách ngày. Điều kiện chi tiết cho trận bỏ cuộc và streak cần hoàn thiện cùng backend.

Chưa seed người chơi trong bảng xếp hạng, sự kiện thi đấu theo ngày hoặc số liệu dashboard giả. Các chính sách rating, cả hai mất kết nối và hết ngày đã chốt ngày 25/10 và thêm vào `appConfig/server` trong **seed cục bộ**. Chưa sửa bản database đang chạy. Nếu đã import bản cũ, đối chiếu bằng [công cụ export](../../frontend/verification/README.md) rồi chuẩn bị migration cấu hình chọn lọc khi làm backend; không import lại toàn root. Lịch thi đấu ngày và phòng riêng phát triển sau, UI/model giữ nguyên.

## Hồ sơ, trận đấu và những nhánh chưa thấy sau Import

`runtime-examples.reference.json` chứa **57 mẫu nhánh động**, kèm đường dẫn, record ví dụ, lúc tạo và quyền truy cập dự kiến. File này là tài liệu cho backend, **không import**.

| Nhóm | Nhánh tiêu biểu | Khi nào có dữ liệu thật |
|---|---|---|
| Tài khoản | users, userPrivate, accountAccess, userSettings, userStats, wallets | Sau khi đăng ký bằng Firebase Auth, lấy UID thật |
| Thiết bị/kết nối | userDevices, presence | Khi đăng nhập hoặc đăng ký push |
| Làm bài | practiceAttempts, attemptQuestions, attemptAnswers, attemptReviews | Khi người dùng bắt đầu/trả lời/hoàn tất bài |
| Tiến độ | learningProgress, userSkillStats, userActivityDaily, userStreaks | Khi có hoạt động được backend xác nhận |
| Thử thách | dailyChallenges, userDailyChallenges | Khi backend tạo lịch và cấp một lượt theo UID/ngày |
| Thi đấu | matchmakingQueue, activeBattles, battleRooms, battleQuestionSets, battleRounds, battleConnections, battlePayloads, battleSubmissions | Khi tìm trận, tạo phòng hoặc chơi trận thật |
| Kết quả | battleResults, battleHistory, battleReviews, battleLogs | Khi có sự kiện/kết quả trận thật |
| Phần thưởng | rewardGrants, coinLedger, ratingLedger, userAchievements | Khi xử lý kết quả và thành tích đúng một lần |
| Xếp hạng | leaderboardPeriods, leaderboards, leaderboardRanks | Khi backend tổng hợp rating tích lũy hiện tại cho tất cả người chơi |
| Thông báo | notifications, notificationCounts, adminNotifications | Khi phát sinh thông báo |
| Quản trị | activityEvents, activeUserSets, analytics, adminViews/users, adminViews/battles, adminAuditLogs, reportJobs | Từ dữ liệu thật và thao tác của admin |
| Điều phối | operations, outbox, systemStatus | Do backend/tác vụ vận hành tạo |

RTDB không có bước CREATE TABLE: nhánh được tạo khi ghi record đầu tiên. `{}`/`null` không giữ chỗ cho một bảng rỗng. Vì vậy chưa thấy `users` hoặc `battleRooms` ngay sau import là bình thường, không phải thiếu dữ liệu khởi tạo. Không dùng bản ghi `_placeholder` vì ứng dụng có thể đọc nhầm thành user/trận/câu hỏi.

Không tạo tài khoản đăng nhập bằng cách tự thêm tên/email vào users. Firebase Authentication tạo UID; backend dùng UID đó cho users, userPrivate và những nhánh của tài khoản. Quyền admin dùng custom claims từ Admin SDK, không cấp bằng cách nhập `role: admin` trong Data.

Các ví dụ runtime dùng UID và ngày minh họa, không đại diện người dùng thật; từng record minh họa trạng thái riêng, không phải toàn bộ snapshot nhất quán để chạy demo. Các ví dụ mời bạn/tố cáo là tùy chọn, chưa kích hoạt trong seed.

## Phần nghe và quyền dữ liệu

Phần nghe hiện dùng Text-to-Speech (`kind: tts`, `locale: en-US`, `speechText`). Không có file MP3 giả hoặc storagePath trỏ tới file chưa tồn tại. Backend/app cần đọc đúng asset để phát bằng TTS. Nếu chuyển sang audio thu sẵn, tải file lên Storage và cập nhật metadata.

Không cấp quyền đọc toàn root cho người học: file seed chứa ngân hàng đáp án ở questionAnswers và transcript trong assets/answers. Backend phải chỉ giao payload theo phiên và mở đáp án đúng thời điểm. Với TTS phía client, nội dung văn bản cần được gửi cho bộ đọc; nếu muốn không gửi transcript cho client thì phải dùng audio đã tạo sẵn.

File `database.rules.json` trong repository hiện chặn toàn bộ client đọc/ghi. Chưa kiểm tra Rules đang triển khai trên Firebase Console. Việc Import không triển khai file Rules trong repository. Không bật `.read: true`/`.write: true` toàn root để nối app; bước tiếp theo là Rules/API phù hợp với thiết kế.

## File phụ và kiểm tra

- `english-battle.seed.json`: file JSON đầy đủ để **Import** vào database trống.
- `runtime-examples.reference.json`: mẫu cấu trúc động, **không Import**.
- `seed-manifest.json`: số lượng dữ liệu và các mặc định, **không Import**.
- `seed-validation.json`: kết quả kiểm tra cấu trúc, **không Import**.
- `seed/*.mjs`: nguồn tạo dữ liệu và công cụ kiểm tra, không phải Cloud Functions.

Nếu sửa nguồn câu hỏi, chạy từ thư mục dự án:

```powershell
node Backend/database/seed/build-seed.mjs
node Backend/database/seed/build-runtime-examples.mjs
node Backend/database/seed/validate-seed.mjs
```

Đã kiểm tra parse JSON, key hợp lệ của RTDB, không có node rỗng, số câu, tham chiếu đáp án/chủ đề/bài/tài nguyên, đủ câu cho từng loại đề, các mức thưởng và tất cả nhánh trong schema có dữ liệu seed hoặc mẫu runtime. Validator còn so chính sách mới với `frontend/contracts/business-rules.v1.json`. Đây là kiểm tra tĩnh; lần chuẩn bị này chưa import lên Firebase hoặc chạy backend. Rules đề xuất có test emulator riêng nhưng chưa deploy và không xác nhận Rules cloud.
