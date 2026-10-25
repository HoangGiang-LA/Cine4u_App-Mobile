# Phân tích database English Battle

Ngày đối chiếu: 25/10/2026. Trạng thái: thiết kế dữ liệu và seed cục bộ, chưa triển khai API/backend hoặc Rules cloud. Database cloud người dùng đã có; chưa có export hiện tại để xác nhận toàn bộ dữ liệu khớp.

Cập nhật dữ liệu khởi tạo: đã tạo [english-battle.seed.json](english-battle.seed.json) gồm cấu hình, danh mục và 250 câu hỏi; [runtime-examples.reference.json](runtime-examples.reference.json) mô tả 57 nhánh phát sinh, không dùng để import. Xem [hướng dẫn nhập](HUONG-DAN-NHAP.md) để phân biệt dữ liệu tĩnh và record do backend tạo. Chưa triển khai backend/Rules hoặc import lên Firebase.

**Phạm vi đã chốt: bỏ Premium tháng/năm và bỏ XP/level.** Không thiết kế thuê bao, quyền Premium, thanh toán, hoàn tiền, doanh thu, điểm kinh nghiệm hoặc cấp độ. Trang admin thứ năm chuyển thành Analytics: thống kê người dùng, học tập và thi đấu. Giữ rating và xu trong game; chưa làm đổi thưởng bằng xu.

## 0. Quy tắc đã được người dùng xác nhận

| Nội dung | Quy tắc |
|---|---|
| Rating ban đầu | 0, giá trị nhỏ nhất là 0 |
| Thắng trận | +5 rating và +5 xu |
| Thua trận | `ratingAfter = max(0, ratingBefore - 2)`; không thưởng xu |
| Hòa | Hai người đúng bằng nhau: không đổi rating, không thưởng xu, không thêm câu phụ |
| Hoàn thành luyện tập | +1 xu cho mỗi bài hoàn thành hợp lệ |
| Hoàn thành bài kiểm tra | +2 xu cho mỗi bài hoàn thành hợp lệ |
| Hoàn thành thử thách ngày | +2 xu cho mỗi bài hoàn thành hợp lệ |
| Thời gian câu hỏi | 30 giây/câu cho thi đấu, luyện tập, thử thách ngày và bài kiểm tra |
| Đề thi đấu | 10 câu ngẫu nhiên từ ngân hàng câu hỏi; hai người dùng cùng bộ 10 câu |
| Số câu luyện tập | 10 câu mỗi bài |
| Số câu bài kiểm tra | 20 câu mỗi bài |
| Số câu thử thách ngày | 5 câu mỗi bài |
| Lượt thử thách ngày | Mỗi người dùng chỉ được tham gia 1 lần/ngày |
| Cách tính lượt thử thách đã xác nhận | Tính lượt khi backend tạo phiên bắt đầu thành công; bỏ dở không hoàn lại lượt; mở lại chỉ tiếp tục cùng phiên còn hợp lệ, giữ bộ câu hỏi và deadline cũ |
| Cách xác định thắng | Người trả lời đúng nhiều câu hơn thắng; tốc độ trả lời không dùng để phá hòa |
| Chủ động thoát trận đang đấu | Người thoát thua, người còn lại thắng; áp dụng rating và xu theo kết quả đó |
| Mất mạng/đóng app đột ngột | Chờ kết nối lại 30 giây; quá hạn xử thua. Không mở lại trận đã có kết quả cuối |
| Cả hai cùng mất kết nối quá hạn | Nếu cả hai đều quá grace 30 giây khi trận chưa chốt: hòa, không đổi rating/xu. Kết quả đã chốt bất biến |
| Thử thách học qua nửa đêm | Đến 00:00 `Asia/Ho_Chi_Minh` kết thúc phiên cũ, không thưởng; ngày mới có lượt độc lập. DTO dùng abandoned |
| Xếp hạng Tuần/Tháng | Cùng rating tích lũy hiện tại của tất cả người chơi; không reset rating theo kỳ, không lọc theo hoạt động trong kỳ |
| Phạm vi thi đấu ban đầu | Chạy thật thi đấu nhanh; giữ UI/model thi đấu ngày và phòng riêng để phát triển sau |
| Bài kiểm tra và thử thách/luyện tập hằng ngày | Câu hỏi ngẫu nhiên từ ngân hàng câu hỏi |
| Luyện tập kỹ năng | Câu hỏi ngẫu nhiên thuộc đúng kỹ năng đã chọn |
| Idioms & Phrases | Là câu hỏi thuộc Vocabulary; không tạo kỹ năng thứ năm |
| Tiến độ 0/20 | Số lần hoàn thành mục luyện tập đó; đạt 20 lần thì hoàn thành thành tích của mục |
| Làm lại luyện tập | Một phiên làm mới hoàn thành được tính thêm một lần; gửi lại cùng kết quả không được tính trùng |
| Xu | Lưu số dư và lịch sử thưởng; chưa có cửa hàng/đổi thưởng |

Các quy tắc thắng/thua/hòa áp dụng chung cho thi đấu; không tự loại phòng riêng khỏi rating/thưởng. Số câu đã chốt: thi đấu 10, luyện tập 10, kiểm tra 20, thử thách ngày 5. Backend lấy `questionCount` từ cấu hình theo chế độ, không cho client tự đổi số câu hoặc mức thưởng.

## 1. Căn cứ và hiện trạng

Các căn cứ ở lần phân tích ban đầu ngày 24/10 (một số file đã được thay thế):

- `frontend/app/src/main/java/com/englishbattle/app/ui/`: điều hướng, xác thực, học tập, bài tập, thi đấu, hồ sơ, tiến độ, thành tích, thông báo, cài đặt.
- `frontend/app/src/main/java/com/englishbattle/app/data/QuizData.kt`: câu hỏi và đáp án mẫu, bộ 10 câu lặp từ các danh sách mẫu.
- `Backend/database/schema.md`: danh sách nhánh sơ bộ, chưa định nghĩa trường, quan hệ và truy vấn.
- `Backend/functions/src/index.ts`: khung Cloud Functions, chưa có nghiệp vụ được export.
- `database.rules.json`: đang chặn toàn bộ đọc/ghi từ client.
- `frontend/app/build.gradle.kts`: đã khai báo Firebase Auth và Analytics, chưa khai báo SDK Realtime Database; luồng giao diện vẫn dùng dữ liệu mẫu.
- Chat trước “Compare local code with GitHub”, gồm phân tích admin và 5 ảnh admin do người dùng cung cấp. Đã mở lại trực tiếp 5 ảnh: Dashboard, Users, Question & Content, Battle & Moderation, Analytics & Revenue.

Hiện trạng cập nhật 25/10: Android đã dùng Models/Repositories/FirebaseRepositories/WireCodec thay QuizData, có SDK RTDB/Functions và adapter cho 13 callable; chưa có backend đáp ứng. Web admin có SDK Auth/Database và 22 phương thức AdminService, nghiệp vụ vẫn demo. Có hợp đồng máy đọc, Rules đề xuất và test emulator tại [frontend/contracts](../../frontend/contracts/README.md); chưa deploy Rules. Không coi việc khởi tạo SDK là đã đọc mọi nhánh cloud.

Các nhận xét thiết kế admin dựa trên 5 ảnh đã xem lại, không khẳng định mọi frame Figma đã được kiểm tra. Chi tiết đối chiếu mobile ở [FIGMA-RESTORATION.md](../../frontend/docs/FIGMA-RESTORATION.md). Yêu cầu mới nhất giữ nguyên giao diện theo Figma; chỉ đổi lớp dữ liệu/hợp đồng phía dưới. Luật nghiệp vụ mới ở mục 0 được ưu tiên hơn dữ liệu demo cũ, không dùng làm lý do đổi bố cục/nhãn giao diện.

Các điểm khác nhau cần xử lý khi nối backend:

1. App có bốn kỹ năng; “Idioms & Phrases” trong ảnh admin phải được xếp vào Vocabulary theo yêu cầu đã chốt. Có thể gắn topic/tag để quản lý riêng bên trong từ vựng.
2. “Bài kiểm tra” hiện dùng chung màn hình quiz; cần phân biệt loại bài trong dữ liệu để thống kê và quy tắc chấm điểm đúng.
3. Thi đấu nhanh, thi đấu theo ngày và phòng riêng là ba chế độ riêng trong giao diện; demo hiện chưa thể hiện đầy đủ nghiệp vụ từng chế độ.
4. Giao diện demo còn XP, level, mức thưởng và rating cũ. Khi triển khai cần bỏ XP/level, thay các số demo theo mục 0; phân biệt rating, số câu đúng và số dư xu.
5. Đăng nhập có nhãn email/số điện thoại; quên mật khẩu có nút “Gửi mã”. Luồng xác thực thực tế cần thống nhất với Firebase Auth trước khi triển khai.

## 2. Phân chia trách nhiệm lưu trữ

| Thành phần | Trách nhiệm |
|---|---|
| Firebase Authentication | Tài khoản đăng nhập, email, mật khẩu, nhà cung cấp Google/điện thoại nếu được chọn, xác minh và khôi phục tài khoản |
| Firebase Realtime Database | Hồ sơ, nội dung, tiến độ, phiên làm bài, trận đấu, điểm, phần thưởng, thông báo, dữ liệu quản trị và thống kê |
| Cloud Storage | File âm thanh, ảnh tải lên, file xuất báo cáo; RTDB chỉ giữ đường dẫn và metadata |
| Backend / Cloud Functions | Kiểm tra quyền, chọn câu hỏi, chấm điểm, ghép trận, kết thúc trận, cấp thưởng, tổng hợp thống kê, thao tác quản trị |
| Firebase Cloud Messaging | Gửi push notification; RTDB lưu hộp thư, trạng thái đã đọc và thông tin thiết bị |

Firebase Auth là nguồn chuẩn cho thông tin đăng nhập. Nếu RTDB chứa bản sao email để admin tìm kiếm, backend phải đồng bộ khi email thay đổi. Không lưu mật khẩu, mã khôi phục hoặc thông tin bí mật server trong hồ sơ.

Trong đề xuất này, app và web admin dùng chung nguồn dữ liệu nghiệp vụ. Các nhánh dành cho admin chủ yếu là danh sách rút gọn, chỉ mục, thống kê và log.

## 3. Danh mục dữ liệu đề xuất

Các đường dẫn dưới đây là nhánh JSON và mẫu đường dẫn, không phải bảng SQL. `{uid}` là UID của Firebase Auth; `{id}` là khóa ổn định của bản ghi. Trường liệt kê là các trường chính, chưa phải hợp đồng JSON cuối cùng.

### 3.1. Tài khoản, hồ sơ và phân quyền

| Nhánh | Trường chính / mục đích |
|---|---|
| `users/{uid}` | `displayCode`, `displayName`, `avatarPath`, `createdAt`, `updatedAt`; thông tin hồ sơ được phép hiển thị cho người học khác |
| `userPrivate/{uid}` | Email đồng bộ, số điện thoại nếu dùng, thông tin riêng tư và liên kết nhà cung cấp cần thiết; chỉ chủ tài khoản và admin được phép đọc |
| `accountAccess/{uid}` | `status`, `bannedAt`, `banReason`, `bannedBy`, `deletedAt`; backend quản lý trạng thái truy cập |
| `adminProfiles/{uid}` | Tên quản trị viên và metadata vai trò để hiển thị; quyền thực tế phải được backend kiểm tra bằng custom claims và trạng thái tài khoản |
| `userSettings/{uid}` | `notificationsEnabled`, `soundVolume`, `language`, `theme`, tùy chọn nhắc học nếu triển khai |
| `userDevices/{uid}/{deviceId}` | FCM token, nền tảng, phiên bản app, thời điểm cập nhật; token không công khai |
| `presence/{uid}/{connectionId}` | Trạng thái kết nối, thời điểm kết nối/hoạt động; hỗ trợ nhiều thiết bị, mất kết nối và ghép trận |

Không đặt email bên dưới nhánh mà người chơi khác được đọc. Không cho người dùng tự sửa trạng thái khóa, quyền admin hoặc điểm. `displayCode` như `#24892` chỉ dùng để hiển thị/tìm kiếm; quan hệ dữ liệu dùng UID. Quyền sửa hồ sơ chỉ áp dụng cho các trường đã cho phép.

Admin tạo/sửa/khóa/xóa tài khoản thông qua backend. Tạo tài khoản ở Auth và tạo hồ sơ ở RTDB là hai bước riêng, cần trạng thái tác vụ để thử lại/khôi phục khi một bước lỗi. Khóa phải có hiệu lực tại Rules/API ngay cả với phiên đã đăng nhập, kết hợp vô hiệu hóa tài khoản và thu hồi phiên phù hợp. Xóa tài khoản phải xử lý dữ liệu cá nhân và thay danh tính trong lịch sử còn cần giữ.

### 3.2. Kỹ năng, chủ đề, bài học và tài nguyên

| Nhánh | Trường chính / mục đích |
|---|---|
| `categories/{categoryId}` | `name`, `slug`, `icon`, `sortOrder`, `status`; Vocabulary, Grammar, Listening, Reading |
| `topics/{topicId}` | `categoryId`, `title`, `description`, `sortOrder`, `status`; ví dụ Travel, Tenses |
| `lessons/{lessonId}` | `topicId`, `title`, `description`, nội dung hướng dẫn nếu có, `difficulty`, `status`, `version` |
| `lessonQuestions/{lessonId}/{questionId}` | Quan hệ bài học–câu hỏi, `order`, phiên bản được chọn nếu cần cố định |
| `contentAssets/{assetId}` | `storagePath`, `mimeType`, `durationMs`, `sizeBytes`, `createdBy`, `status`; metadata tài nguyên |

Đề xuất luồng `category → topic → lesson/question set`. Hiện app đi từ chủ đề trực tiếp vào quiz nên có thể gán một bộ mặc định cho chủ đề mà chưa cần thêm màn hình chọn bài học.

Cho phép draft/published/archived. Dữ liệu draft và đáp án không được cấp quyền đọc cho người học qua việc cấp quyền rộng ở nhánh cha. Dữ liệu danh mục xuất bản có thể được tạo thành bản đọc riêng cho app. Xóa nội dung đang được tham chiếu nên chuyển sang archived; dọn file chỉ khi không còn phiên bản cần dùng.

### 3.3. Ngân hàng câu hỏi và đáp án

| Nhánh | Trường chính / mục đích |
|---|---|
| `questions/{questionId}` | Metadata hiện hành: `displayCode`, `categoryId`, `topicId`, `lessonId` nếu có, `difficulty`, `type`, `currentVersion`, `status`, `createdBy`, `updatedAt` |
| `questionVersions/{questionId}/{version}` | Nội dung bất biến: `prompt`, lựa chọn theo `optionId`, `passage`, `audioAssetId`, ảnh, thứ tự mặc định |
| `questionAnswers/{questionId}/{version}` | `correctOptionId`, `explanation`, transcript cần ẩn trong bài nghe, quy tắc chấm điểm; chỉ backend và admin nội dung |

Ngân hàng câu hỏi đầy đủ được truy cập qua backend/admin; app nhận bộ câu hỏi đã chọn cho phiên làm bài. Nếu luyện tập được phép xem đáp án ngay, backend trả lời sau khi chốt câu trả lời. Trong trận đấu, chỉ mở giải thích khi không còn ảnh hưởng đối thủ, ví dụ hết lượt cho cả hai hoặc kết thúc trận.

Các phiên làm bài/trận đấu giữ `questionId + version`, thứ tự câu và thứ tự lựa chọn. Nếu cần xóa phiên bản gốc, phải giữ snapshot phục vụ xem lại trước khi xóa. Sửa câu hỏi hôm nay không làm thay đổi điểm hay nội dung của lịch sử hôm qua. `optionId` ổn định giúp tránh nhầm đáp án khi đảo thứ tự lựa chọn.

### 3.4. Luyện tập và bài kiểm tra

| Nhánh | Trường chính / mục đích |
|---|---|
| `quizTemplates/{templateId}` | `mode` (practice/test/dailyChallenge), kỹ năng/chủ đề, `questionCount` tương ứng 10/20/5, `questionTimeLimitSeconds: 30`, `selectionMode: random`, điều kiện hoàn thành, `scoringVersion` |
| `practiceAttempts/{uid}/{attemptId}` | `templateId`, `mode`, `categoryId`, `topicId`, `status`, `startedAt`, `finishedAt`, `correctCount`, `answeredCount`, `questionCount`, `score`, `durationMs`, `coinsAwarded`, `rewardGrantId` |
| `attemptQuestions/{uid}/{attemptId}/{ordinal}` | Câu hỏi được giao, phiên bản, thứ tự đáp án, `openedAt`, `deadlineAt`; nội dung được phép hiển thị, không có đáp án đúng chưa mở |
| `attemptAnswers/{uid}/{attemptId}/{ordinal}` | `questionId`, `selectedOptionId`, `receivedAt`, `isCorrect`, `timedOut`; backend ghi kết quả đã xác nhận |
| `attemptReviews/{uid}/{attemptId}/{ordinal}` | Đáp án và giải thích được phép xem lại tại thời điểm tương ứng |

Lưu cả phiên đang làm, hoàn thành, hết hạn và bỏ dở. Bài kiểm tra và thử thách ngày dùng cùng hệ thống attempts với `mode=test`/`dailyChallenge`. Backend bốc câu ngẫu nhiên một lần khi tạo phiên và cố định danh sách để tải lại app không đổi đề. Luyện tập bắt buộc lọc `categoryId` theo kỹ năng đã chọn; nếu màn hình chọn chủ đề cần lọc thêm thì cấu hình `topicId` tương ứng. Bài kiểm tra/thử thách ngày cũng bốc ngẫu nhiên; phạm vi kỹ năng của hai chế độ này còn cấu hình riêng.

Đề xuất bốc không lặp câu trong cùng phiên; thiếu câu hợp lệ thì báo chưa đủ nội dung, không âm thầm lặp câu mẫu cho đủ số lượng. Chỉ chọn câu published cùng phiên bản hợp lệ. Một phiên mới có thể gặp lại câu của phiên trước.

Mỗi câu có deadline riêng `openedAt + 30.000 ms` do server quyết định. Không dùng một giới hạn 30 giây cho cả bài. Client gửi lựa chọn; backend xác thực phiên, thời hạn, quyền sở hữu và chấm điểm. Đề xuất câu hết giờ được chốt là không đúng; hoàn thành khi tất cả câu đã được chốt, không yêu cầu điểm đạt tối thiểu nếu chưa có yêu cầu riêng. Bỏ dở không được thưởng. Mỗi attempt chỉ chuyển completed và cộng xu/tiến độ một lần.

### 3.5. Tiến độ, hoạt động và chuỗi ngày học

| Nhánh | Trường chính / mục đích |
|---|---|
| `learningProgress/{uid}/{topicId}` | `completedAttempts`, `completionTarget: 20`, `achievementUnlockedAt`, `correctCount`, `answeredCount`, `bestScore`, `lastCompletedAt`; topicId định danh mục luyện tập đang hiển thị 0/20 |
| `userActivityDaily/{uid}/{dateKey}` | Số câu, số bài, thời gian học hợp lệ, số trận, xu được thưởng và số đúng theo ngày |
| `userSkillStats/{uid}/{categoryId}` | Tổng đúng/tổng trả lời, số bài hoàn thành, thời gian học, thời điểm cập nhật |
| `userStreaks/{uid}` | `current`, `longest`, `lastQualifiedDate`, lịch ngày đạt điều kiện |

Tiến độ 0/20 đếm số lần hoàn thành luyện tập ở mục tương ứng, không đếm câu đúng hoặc số đề khác nhau. Mỗi attempt mới có `mode=practice` hoàn thành hợp lệ tăng `completedAttempts` thêm 1 và thưởng 1 xu, kể cả luyện lại cùng mục. Bài kiểm tra, thử thách ngày và trận đấu không tăng bộ đếm này. Cùng attempt gửi lại không được tăng thêm. Ở lần thứ 20, mở thành tích của mục đúng một lần. Đề xuất vẫn lưu tổng lần hoàn thành thực tế sau 20, còn UI hiển thị `min(completedAttempts, 20)/20` và trạng thái đã đạt. Chưa có thưởng xu bổ sung cho mốc 20 vì người dùng chưa yêu cầu.

Độ chính xác tính từ tổng số đúng và tổng số câu theo định nghĩa thống nhất, không lấy trung bình các phần trăm khác mẫu số. Ngày chưa có bài làm hiển thị chưa có dữ liệu.

### 3.6. Thử thách ngày và thi đấu theo ngày

| Nhánh | Trường chính / mục đích |
|---|---|
| `dailyChallenges/{dateKey}/{challengeId}` | Điều kiện, cấu hình bốc câu ngẫu nhiên, `questionCount: 5`, `questionTimeLimitSeconds: 30`, `maxAttemptsPerUserPerDay: 1`, `startsAt`, `endsAt`, `completionCoins: 2` |
| `userDailyChallenges/{uid}/{dateKey}` | Một lượt duy nhất theo UID/ngày: `challengeId`, `attemptId`, `status`, `startedAt`, tiến độ, `completedAt`, `rewardClaimedAt`, liên kết bản ghi thưởng |
| `dailyBattleEvents/{eventId}` | Ngày tổ chức, chủ đề, bộ luật, thời gian mở/đóng, giới hạn lượt và thưởng nếu có |
| `dailyBattleEntries/{eventId}/{uid}` | Lượt tham gia, liên kết trận, thành tích và trạng thái nhận thưởng theo luật sự kiện |

Không gộp thử thách học cá nhân với chế độ thi đấu theo ngày. Thử thách học có 5 câu ngẫu nhiên, 30 giây/câu, thưởng 2 xu khi hoàn thành và chỉ được tham gia 1 lần/ngày. Cách thực hiện đã được người dùng xác nhận: lượt được tính khi backend tạo phiên bắt đầu thành công; bỏ dở không hoàn lại lượt. Mở lại chỉ tiếp tục attempt đang làm nếu còn hợp lệ, giữ bộ câu và deadline cũ, không tạo lượt mới hoặc thưởng lại. Phiên đã completed/abandoned/expired không được khởi tạo lại trong cùng ngày.

Khóa duy nhất nằm ở `userDailyChallenges/{uid}/{dateKey}`, không nằm theo challengeId, để đổi thiết bị hoặc đổi challengeId không tạo thêm lượt. Backend xác định ngày theo `Asia/Ho_Chi_Minh` và thời gian server; không dùng ngày do thiết bị gửi. Cần transaction/reservation có thể phục hồi để hai yêu cầu đồng thời không tạo hai attempt; lỗi backend giữa chừng phải tiếp tục được cùng attemptId. Giới hạn này áp dụng chung cho cả ngày, không chỉ giới hạn nhận thưởng.

Đã chốt hết phiên lúc 00:00 Việt Nam. Mỗi deadline câu là min(đầu câu + 30 giây, mốc hết ngày); quá mốc này resume/submit không được gia hạn hoặc nhận thưởng. Wire trả `status/outcome: abandoned` và `coins: 0`; nguyên nhân hết ngày có thể lưu nội bộ. Lượt ngày mới độc lập, phiên cũ không tiêu thụ lượt mới. Kết quả đã hoàn tất hợp lệ trước mốc hết ngày không bị thay đổi.

Thi đấu theo ngày dùng luật trận chung: cùng 10 câu ngẫu nhiên, 30 giây/câu, so số đúng, thắng +5 rating/+5 xu, thua -2 có sàn 0, hòa không đổi/không thưởng; chỉ lịch mở, phạm vi câu và giới hạn tham gia sự kiện còn cần chốt. Quy định thử thách học 1 lần/ngày không tự áp dụng cho thi đấu theo ngày. Không tự thêm thưởng sự kiện ngoài mức thắng trận đã xác nhận.

### 3.7. Ghép trận và phòng riêng

| Nhánh | Trường chính / mục đích |
|---|---|
| `matchmakingQueue/{poolId}/{uid}` | Chế độ, kỹ năng, rating do server lấy, `joinedAt`, `expiresAt`, trạng thái ghép |
| `activeBattles/{uid}` | Trận hiện tại, trạng thái reservation và phiên sở hữu; dùng tránh ghép cùng người vào nhiều trận |
| `privateRoomCodes/{code}` | `roomId`, `expiresAt`; tra cứu qua backend, chống dò mã và chiếm lại mã khi phòng còn hiệu lực |
| `battleInvites/{uid}/{inviteId}` | Người mời, phòng, thời hạn, trạng thái accepted/declined/expired; dùng nếu làm lời mời trong app |

Tạo/join phòng dùng backend để kiểm tra đủ chỗ, tư cách người chơi và tính duy nhất. Mã phòng phải được cấp có kiểm soát xung đột. Phòng riêng có thể chia sẻ mã qua hệ điều hành mà không cần xây thêm mạng bạn bè/chat. Lời mời trong app là lựa chọn giao diện bổ sung, không phải yêu cầu đã được xác nhận.

### 3.8. Trạng thái trận, câu trả lời, kết quả và log

| Nhánh | Trường chính / mục đích |
|---|---|
| `battleRooms/{roomId}` | `displayCode`, `mode`, `eventId`, `categoryId` hoặc mixed, `topicId` nếu có, hai thành viên, `status`, `createdAt`, `startedAt`, `questionCount: 10`, `questionTimeLimitSeconds: 30`, lượt hiện tại, số đúng công bố, `rulesVersion` |
| `battleQuestionSets/{roomId}` | Một bộ 10 câu ngẫu nhiên cố định cho cả hai người: questionId, version, ordinal, optionOrder; backend giữ để tránh đọc trước câu chưa tới lượt |
| `battleRounds/{roomId}/{roundId}` | `openedAt`, `deadlineAt`, trạng thái lượt, trạng thái đã nộp/hết giờ của hai bên; cùng mốc thời gian server cho cả hai |
| `battleConnections/{roomId}/{uid}` | Phiên kết nối đang thi đấu, `disconnectedAt`, `reconnectDeadlineAt`, thời điểm kết nối lại; backend kiểm soát hạn 30 giây |
| `battlePayloads/{roomId}/{uid}` | Câu/lượt hiện được phép đọc, thứ tự lựa chọn, thông tin đối thủ được phép công bố |
| `battleSubmissions/{roomId}/{roundId}/{uid}` | Lựa chọn được backend tiếp nhận, `receivedAt`, `requestId`, điểm chấm; đối thủ không đọc đáp án chưa công bố |
| `battleResults/{roomId}` | `correctCounts`, `winnerUid` nếu có, kết quả mỗi người, `endReason`, `forfeitedUid` nếu có, `ratingBefore`, `ratingAfter`, `ratingDelta`, `coinsAwarded`, `finishedAt`, `settlementVersion` |
| `battleHistory/{uid}/{roomId}` | Bản rút gọn để phân trang lịch sử: đối thủ, điểm, kết quả, rating delta, thời điểm |
| `battleReviews/{roomId}/{uid}` | Nội dung và giải thích được mở để xem lại theo chính sách sau trận |
| `battleLogs/{roomId}/{eventId}` | Log có cấu trúc: `type`, `actorUid`, `roundId`, `serverAt`, `requestId`, thông tin xử lý cần thiết; phục vụ View Logs của admin |

Máy trạng thái đề xuất: waiting → ready → playing → completed; cancelled/expired dành cho trận không diễn ra hợp lệ. Trận xử thua do thoát/mất kết nối vẫn có kết quả cuối với `endReason=forfeit`/`disconnect_timeout`; kết quả thường dùng `endReason=all_questions_resolved`. Kết quả hòa không có winnerUid.

Backend chọn ngẫu nhiên một bộ 10 câu, giao cùng nội dung/phiên bản và đề xuất cùng thứ tự câu/lựa chọn cho hai bên. Không bốc riêng cho từng người. Đề xuất lượt đồng bộ: mở cùng lúc, mỗi bên nộp tối đa một đáp án; chuyển câu khi cả hai đã chốt hoặc hết 30 giây. Chỉ công bố đáp án sau khi cả hai đã chốt để người trả lời trước không làm lộ đáp án cho người còn lại. Thắng theo số đúng, không theo thời gian trả lời. Bằng số đúng thì hòa, không thưởng và không đổi rating.

Chủ động rời trận khi playing: backend chốt ngay người rời thua, đối thủ thắng, kể cả người rời đang có nhiều câu đúng hơn. Không cho reconnect đảo kết quả này. Mất mạng/đóng app đột ngột: backend ghi `reconnectDeadlineAt = disconnectedAt + 30.000 ms`, cho trở lại trước hạn; một người quá hạn xử thua và người còn lại thắng. Nếu cả hai đều quá grace khi trận chưa được chốt, xử hòa, không đổi rating/xu. Kết quả đã chốt bất biến; server phải kiểm tra và chuyển trạng thái nguyên tử trước khi trao thưởng. Đề xuất đồng hồ câu hỏi vẫn chạy trong thời gian mất mạng để hai người dùng cùng deadline, không cấp lại 30 giây cho câu hiện tại khi trở lại.

Presence chỉ là tín hiệu mất kết nối; backend xác nhận hạn bằng thời gian server và phiên đang chơi. Kết nối ở thiết bị khác không tự chứng minh phiên thi đấu còn hoạt động. Tác vụ hết hạn và yêu cầu thoát/nộp đáp án có thể đến đồng thời: chỉ một thao tác được chốt kết quả cuối; mọi callback muộn phải bị bỏ qua. Nếu cả hai cùng mất kết nối hoặc cùng thoát, cần chính sách riêng, không tự cấp hai chiến thắng. Thời điểm mạng mất trên thiết bị có thể khác thời điểm server phát hiện.

### 3.9. Rating và xu thưởng

| Nhánh | Trường chính / mục đích |
|---|---|
| `userStats/{uid}` | `rating` khởi tạo 0 và không âm, `matchesPlayed`, `wins`, `losses`, `draws`, chuỗi thắng; backend cập nhật |
| `rewardGrants/{uid}/{grantId}` | `sourceType`, `sourceId`, `coinDelta`, trạng thái xử lý và thời điểm; khóa xác định theo attemptId/roomId và UID |
| `ratingLedger/{uid}/{roomId}` | `outcome`, `ratingBefore`, `ratingAfter`, `ratingDelta`, `settledAt`; lịch sử rating mỗi trận |
| `wallets/{uid}` | `coinBalance`, `updatedAt`; chỉ xu trong game, không có tiền thật hoặc chức năng thanh toán |
| `coinLedger/{uid}/{entryId}` | Lịch sử biến động xu, nguồn thưởng/điều chỉnh, `delta`, số dư nếu cần đối chiếu |

Không có XP, level hoặc xpLedger trong schema mục tiêu. Rating chỉ đổi theo trận: thắng +5; thua `max(0, before - 2)`; hòa giữ nguyên. Lưu delta thực tế: từ 1 xuống 0 là -1, từ 0 xuống 0 là 0. Khởi tạo tài khoản với rating 0. Số câu đúng của bài/trận là chỉ số riêng.

Xu: thắng trận +5; hoàn thành luyện tập +1; hoàn thành thử thách ngày +2; hoàn thành bài kiểm tra +2. Không cần thắng/đạt điểm tối thiểu cho các bài học nếu không có yêu cầu bổ sung. Cùng sự kiện chỉ thưởng một lần; mỗi attempt mới hoàn thành hợp lệ là một sự kiện mới. Giữ ví và ledger, chưa có chức năng đổi thưởng/cửa hàng. Không tự thêm xu cho huy hiệu hoặc bảng xếp hạng khi chưa chốt.

### 3.10. Thành tích và bảng xếp hạng

| Nhánh | Trường chính / mục đích |
|---|---|
| `achievements/{achievementId}` | Tên, mô tả, biểu tượng, `conditionType`, `targetId`, `threshold`, `ruleVersion`, trạng thái; mốc luyện tập có `conditionType=practice_completion_count`, `targetId=topicId`, `threshold=20` |
| `userAchievements/{uid}/{achievementId}` | Tiến độ, `unlockedAt`, `rewardClaimedAt`, phiên bản luật đã áp dụng |
| `leaderboardPeriods/{periodId}` | Metadata kỳ/snapshot nếu cần; metric `current_cumulative_rating`; không reset rating hoặc tự cấp thưởng theo kỳ |
| `leaderboards/{periodId}/{uid}` | Rating tích lũy hiện tại của mọi người chơi, thông tin hiển thị rút gọn và khóa sắp xếp; Tuần/Tháng dùng cùng bảng hoặc cùng snapshot nguồn |
| `leaderboardRanks/{periodId}/{uid}` | Hạng đã tổng hợp, `calculatedAt`, số người tham gia; phục vụ hạng riêng của người ngoài top 100 |

Thành tích luyện tập được định danh riêng theo từng mục, mở một lần ở completedAttempts >= 20; tiến độ của mục A không mở thành tích mục B. Các huy hiệu thắng trận trong giao diện vẫn có thể dùng định nghĩa riêng. Chưa chốt thưởng huy hiệu/tuần nên không tự cấp xu cho chúng. Nếu bổ sung sau thì dùng rewardGrants có khóa theo huy hiệu/kỳ và UID. Metric đã chốt: rating tích lũy hiện tại, tất cả người chơi, Tuần/Tháng cùng một bảng; không dùng XP hoặc điểm kiếm được trong kỳ. Mặc định phá hòa thứ tự bằng UID tăng dần sau rating giảm dần. Không xóa rating khi đổi kỳ; backend xác định độ trễ và snapshot phân trang nhất quán.

### 3.11. Thông báo

| Nhánh | Trường chính / mục đích |
|---|---|
| `notifications/{uid}/{notificationId}` | Loại, tiêu đề, nội dung, `createdAt`, `readAt`, `targetType`, `targetId`, khóa chống gửi lặp |
| `notificationCounts/{uid}` | Bộ đếm chưa đọc do backend tổng hợp nếu cần; có thể tính từ danh sách nhỏ ở phiên bản đầu |
| `adminNotifications/{adminUid}/{notificationId}` | Thông báo vận hành dành riêng cho admin, trạng thái đã đọc |

Người dùng chỉ được đổi trạng thái đọc của thông báo của mình. Đọc tất cả có thể dùng mốc `readThroughAt` thay vì cập nhật hàng nghìn bản ghi; cần đồng nhất cách tính unread khi triển khai. Push dùng FCM, việc ghi một bản ghi RTDB không tự gửi push. Sự kiện tạo phần thưởng và sự kiện thông báo phải dùng khóa ổn định khi retry.

### 3.12. Thống kê Dashboard và Analytics

| Nhánh | Trường chính / mục đích |
|---|---|
| `activityEvents/{dateKey}/{eventId}` | Sự kiện nghiệp vụ từ backend: đăng ký, hoàn thành bài, trận bắt đầu/kết thúc, mở huy hiệu; không nhận số liệu thưởng do client tự khai |
| `activeUserSets/{periodType}/{periodKey}/{uid}` | Tập người dùng hoạt động duy nhất theo ngày/tuần/tháng |
| `analytics/daily/{dateKey}` | Số đăng ký mới, bài hoàn thành, trận bắt đầu/kết thúc/bỏ dở, số câu đúng/trả lời, tổng thời gian hợp lệ |
| `analytics/weekly/{weekKey}` và `analytics/monthly/{monthKey}` | Tổng hợp theo kỳ, số active users đã khử trùng UID |
| `analytics/categories/{periodKey}/{categoryId}` | Số trận, tỷ trọng, số hoàn thành, độ chính xác, số bài theo kỹ năng |
| `adminViews/recentActivities/{eventId}` | Hoạt động gần đây để Dashboard phân trang nhanh |

Đề xuất định nghĩa ban đầu, chưa phải yêu cầu người dùng đã xác nhận:

- Active user: có hoạt động học/thi đấu được server xác nhận trong kỳ. Nếu muốn tính đăng nhập phải ghi thêm sự kiện tương ứng.
- Người dùng hoạt động theo tháng là số UID khác nhau, không cộng DAU của các ngày. Khoảng ngày tùy ý phải hợp các tập ngày hoặc dùng tác vụ tổng hợp riêng; không cộng các tổng đã khử trùng theo từng kỳ.
- Total Users: hiển thị tài khoản còn tồn tại hiện tại; báo cáo tại cuối kỳ dùng snapshot/sự kiện đăng ký và xóa. Tách `newUsers` với `totalUsers` để biểu đồ không nhập nhằng.
- Độ chính xác: tổng đúng / tổng câu trả lời hợp lệ; quy định riêng câu hết giờ có thuộc mẫu số hay không.
- Completion rate của trận: số completed / số started của cùng tập trận; nếu nhóm theo ngày bắt đầu thì phải cập nhật lại bucket đó khi trận kết thúc ngày sau.
- Tỷ trọng kỹ năng: trận của kỹ năng / tổng trận thuộc bộ lọc. Với trận nhiều kỹ năng, chọn một nhóm mixed hoặc quy tắc phân bổ rõ ràng để tránh cộng trên 100%.
- Tăng trưởng: so với kỳ trước có cùng độ dài; mẫu số bằng 0 hiển thị N/A hoặc mới phát sinh, không chia cho 0.
- Thời gian lưu là UTC epoch milliseconds từ server; ngày thống kê và tuần dùng timezone đã cấu hình. Đề xuất `Asia/Ho_Chi_Minh`, tuần bắt đầu thứ Hai.

Theo yêu cầu bỏ Premium, Dashboard đề xuất thay Revenue bằng Battles Completed hoặc Lessons Completed. Analytics thay Revenue by Month bằng hoạt động học/thi đấu theo tháng; thay Subscription Types bằng phân bố hoạt động theo kỹ năng; giữ Most Popular Categories và completion rate. Các chỉ số thay thế là đề xuất giao diện, chưa triển khai.

### 3.13. Quản trị, truy vấn, báo cáo và cấu hình

| Nhánh | Trường chính / mục đích |
|---|---|
| `adminAuditLogs/{dateKey}/{eventId}` | Admin nào, thao tác gì, đối tượng, trường thay đổi cần thiết, thời điểm, kết quả; backend append, không ghi bí mật |
| `adminViews/users/{uid}` | Dòng danh sách có tên/email chuẩn hóa, displayCode, trạng thái, ngày tạo; admin đọc, server ghi |
| `adminViews/questions/{questionId}` | Dòng rút gọn ngân hàng câu hỏi, trạng thái, kỹ năng, độ khó, ngày cập nhật |
| `adminViews/battles/{roomId}` | Hai người chơi, điểm công bố, trạng thái, ngày tạo/kết thúc; không nhúng toàn bộ log |
| `lookupIndexes/...` | Ánh xạ mã hiển thị → ID và các nhóm lọc cần dùng, ví dụ usersByStatus, questionsByCategoryDifficulty, battlesByStatus |
| `reportJobs/{jobId}` | Người yêu cầu, bộ lọc, `snapshotAt`, trạng thái, storagePath của file, `expiresAt`; dùng cho xuất dữ liệu lớn |
| `appConfig/public` | Phiên bản app tối thiểu, thông báo bảo trì, liên kết chính sách, thông tin ứng dụng, tính năng hiển thị |
| `appConfig/server` | Luật ghép trận, `battleQuestionCount: 10`, `questionTimeLimitSeconds: 30`, `reconnectGraceSeconds: 30`, `initialRating: 0`, `ratingFloor: 0`, `winRating: 5`, `lossRating: -2`, `drawRating: 0`, `battleWinCoins: 5`, `practiceCompletionCoins: 1`, `dailyChallengeCompletionCoins: 2`, `testCompletionCoins: 2`, `drawCoins: 0`, `practiceAchievementTarget: 20`, timezone; cấu hình được version hóa |
| `systemStatus/{serviceId}` | Tình trạng do kiểm tra backend cập nhật và `checkedAt`, nếu hiện thực dòng “All systems operational” trong mockup |

Cấu hình số câu bổ sung trong `appConfig/server`: `practiceQuestionCount: 10`, `testQuestionCount: 20`, `dailyChallengeQuestionCount: 5`, `dailyChallengeMaxAttemptsPerUserPerDay: 1`. Chụp phiên bản cấu hình vào attempt khi bắt đầu để thay đổi cấu hình sau đó không sửa bài đang làm.

Tìm kiếm/đếm/lọc/phân trang phải thiết kế theo truy vấn thật:

- Tra đúng mã user/question/battle bằng `lookupIndexes`.
- Truy vấn mới nhất với trường thời gian và khóa ID làm tie-breaker; Rules có `.indexOn` đúng trường.
- Tìm prefix tên/email qua trường đã chuẩn hóa. `.indexOn` không tự tạo full-text search.
- Tìm chứa một đoạn bất kỳ hoặc tìm toàn hệ thống cần chỉ mục tìm kiếm riêng/API; nếu giữ tất cả dữ liệu trong RTDB thì phải xây inverted index, giới hạn truy vấn và đồng bộ cập nhật. Không tải mọi bản ghi xuống trình duyệt để tìm.
- Bộ lọc kết hợp như status + ngày tạo hoặc category + difficulty cần bucket/chỉ mục kết hợp phục vụ đúng query. Các index chứa email cũng chỉ admin được đọc.
- Đề xuất phân trang cursor. Nếu giữ nhảy trực tiếp tới trang 2.490 như ảnh, cần API snapshot/chỉ mục trang và số lượng theo bộ lọc; RTDB không cung cấp offset như SQL.
- Dữ liệu adminViews/lookupIndexes là bản dẫn xuất, có thể dựng lại; backend cập nhật cùng thay đổi nguồn hoặc có cơ chế retry/reconcile và báo độ trễ.
- Báo cáo nhỏ có thể trả CSV trực tiếp qua API. Báo cáo lớn có job, snapshot ổn định và file tải xuống được kiểm tra quyền, không phát link công khai dài hạn chứa email/log.

### 3.14. Điều phối tác vụ và chống xử lý trùng

| Nhánh | Trường chính / mục đích |
|---|---|
| `operations/{operationId}` | Loại thao tác, `requestId`, trạng thái pending/processing/completed/failed, lease/retry, kết quả; backend quản lý |
| `outbox/{eventId}` | Sự kiện cần xử lý tiếp như cập nhật view, gửi thông báo, tổng hợp thống kê; trạng thái và số lần thử |

Cần cho đăng ký, kết thúc trận, trao thưởng, cập nhật thống kê và thông báo có thể bị gửi/chạy lại. Việc thêm một cờ `processed=true` riêng lẻ không tự bảo đảm chống trùng nếu tiến trình dừng giữa chừng. Cần thiết kế phạm vi transaction, khóa deterministic cho từng hiệu ứng và cơ chế thử lại có thể phục hồi.

RTDB hỗ trợ atomic multi-location update để ghi nhiều nhánh cùng lúc; đó không thay thế compare-and-set/transaction khi kiểm tra tranh chấp. Chỉ commit kết quả trận một lần, sau đó áp dụng các hiệu ứng với khóa theo roomId + uid + loại hiệu ứng. Với cập nhật số dư/điểm và ledger, phải thiết kế chúng trong cùng miền giao dịch hoặc dùng journal có đối soát; không thực hiện read-modify-write từ hai máy cùng lúc.

## 4. Đối chiếu 5 trang admin

| Trang | Chức năng thực tế | Nguồn dữ liệu |
|---|---|---|
| Dashboard | Tổng user, active user, tăng trưởng, biểu đồ, hoạt động gần đây, xuất báo cáo; KPI thay Revenue | analytics, activeUserSets, recentActivities, reportJobs |
| Users | Tìm tên/email/ID, lọc, thêm/sửa/khóa/xóa, phân trang | Auth + users + userPrivate + accountAccess + adminViews/users + audit logs |
| Question & Content | Quản lý kỹ năng/chủ đề/bài/câu hỏi, đáp án, audio, draft/publish/archive | categories, topics, lessons, questions, versions, answers, assets, adminViews/questions |
| Battle & Moderation | Xem danh sách, lọc trạng thái, tìm mã, điểm, View Logs | battleRooms, results, logs, adminViews/battles |
| Analytics | Khoảng ngày, số bài/trận, độ chính xác, kỹ năng phổ biến, completion rate, xuất báo cáo | analytics, activeUserSets, reportJobs |

Thanh tìm kiếm chung dùng API tìm kiếm phân quyền trên các nhóm dữ liệu tương ứng. Chuông admin dùng adminNotifications. Menu tài khoản dùng Auth/adminProfiles. Form thêm/sửa, trang xem log, trạng thái lỗi/loading cũng phải được xây trong web admin.

Tên “Moderation” chưa đủ căn cứ để tự thêm tố cáo, hủy trận hoặc đảo kết quả. Nếu xác nhận có các luồng này, bổ sung `moderationReports/{reportId}` và `moderationActions/{actionId}`, quy trình duyệt và ledger điều chỉnh rating/xu. Không sửa trực tiếp kết quả cũ mà bỏ qua các bản sao/thống kê liên quan.

## 5. Quan hệ và phân quyền cốt lõi

Quan hệ chính:

```text
Auth UID → users + userPrivate + accountAccess + settings
category → topic → lesson → questionId/version
uid → attempt → questions + answers + reviews → progress + rewards
uid → queue / private room → battle → submissions → result
result → history của hai người + stats + rating + rewards + leaderboard
events → analytics + recent activities + notifications
admin command → dữ liệu nghiệp vụ + audit log
```

| Dữ liệu | Người học | Admin | Bên ghi có thẩm quyền |
|---|---|---|---|
| Hồ sơ hiển thị | Đọc theo chính sách; sửa trường cá nhân cho phép | Đọc, yêu cầu sửa | Chủ hồ sơ cho trường an toàn; backend cho mã/trạng thái |
| Dữ liệu riêng/tùy chọn | Chỉ của mình | Theo quyền quản trị | Chủ hồ sơ với allowlist; backend đồng bộ Auth |
| Ngân hàng câu hỏi/đáp án | Không đọc trực tiếp toàn kho | Admin nội dung qua API | Backend sau kiểm tra dữ liệu |
| Nội dung phiên/bài/trận | Chỉ phiên thuộc mình, đúng giai đoạn | Theo quyền hỗ trợ/quản trị | Backend |
| Câu trả lời nộp | Gửi lựa chọn của mình qua API | Xem theo quyền | Backend xác nhận, không nhận điểm client |
| Rating/xu/kết quả | Đọc phần được phép | Đọc; điều chỉnh qua nghiệp vụ riêng nếu có | Backend |
| Thông báo | Đọc và đánh dấu đã đọc của mình | Riêng hộp thư admin | Backend tạo, người nhận đổi read state |
| Log, email tìm kiếm, thống kê quản trị | Không đọc | Theo quyền | Backend |

Rules phải tránh cấp quyền ở cha làm lộ nhánh con; Rules không lọc bỏ từng record trong một lần đọc collection. Backend dùng Admin SDK phải tự kiểm tra quyền, trạng thái khóa, kiểu dữ liệu và quan hệ vì truy cập đặc quyền không dựa vào Rules client. Giới hạn số câu, kích thước text, option hợp lệ, participant hợp lệ và trạng thái chuyển tiếp ở cả validation/API thích hợp.

## 6. Những lựa chọn còn cần chốt khi viết schema cuối cùng

1. Auth: email + Google; điện thoại là đăng nhập OTP hay chỉ thông tin hồ sơ? Luồng “Gửi mã” sẽ dùng link reset email chuẩn hay giải pháp mã riêng?
2. Bài học: chỉ quiz theo chủ đề hay có nội dung lý thuyết và nhiều lesson? Số câu đã chốt: luyện tập 10, kiểm tra 20, thử thách ngày 5; tất cả đều ngẫu nhiên, 30 giây/câu. Tiến độ 0/20 đã chốt là 20 lần hoàn thành mục luyện tập.
3. Daily battle: lịch, chủ đề/phạm vi ngân hàng câu hỏi và số lượt thuộc giai đoạn sau. Thử thách học một lần/ngày đã chốt hết hạn lúc 00:00 Việt Nam; không kéo dài sang ngày mới.
4. Hai người cùng chủ động thoát, sự cố server và thứ tự sự kiện kết quả/reconnect cạnh tranh. Hai người cùng mất kết nối quá grace đã chốt hòa, không đổi rating/xu; một người thoát và reconnect 30 giây đã có luật.
5. Điều kiện streak và độ trễ cập nhật bảng hạng. Metric đã chốt là rating tích lũy hiện tại cho tất cả người chơi, cùng bảng ở Tuần/Tháng. Mức thưởng đã chốt; không tự đặt thêm giới hạn/điều kiện thưởng cho các bài hợp lệ.
6. Phạm vi câu hỏi ngẫu nhiên cho kiểm tra, thử thách ngày và thi đấu: trộn kỹ năng hay giới hạn theo cấu hình sự kiện; luyện tập luôn thuộc kỹ năng đã chọn. Idioms & Phrases luôn nằm trong Vocabulary.
7. Quy mô đồng thời, cách tìm kiếm và thiết kế index/snapshot phân trang để giữ giao diện nhảy số trang hiện có; không đổi UI chỉ vì RTDB dùng cursor.
8. Admin Moderation chỉ xem log hay có tố cáo/hủy/đảo kết quả? Có lời mời trong app hay chỉ chia sẻ mã phòng?
9. Định nghĩa các chỉ số, thời gian giữ log/attempt chi tiết và xử lý dữ liệu khi xóa tài khoản; có thể lưu trữ dữ liệu cũ sang Storage trước khi dọn RTDB.

Các lựa chọn này không ngăn việc xác định các phân hệ dữ liệu ở trên, nhưng ảnh hưởng trường bắt buộc, Rules, API và kiểm thử cuối cùng. Không cần thêm subscriptions, plans, payments, refunds hoặc quyền Premium.

## 7. Thứ tự triển khai và tiêu chí kiểm tra

1. Chốt hợp đồng JSON, danh sách query, quyền và luật nghiệp vụ; tạo dữ liệu seed, Rules và kiểm thử emulator.
2. Auth/hồ sơ + admin Users; nội dung + admin Content; nối luồng luyện tập và kiểm tra.
3. Tiến độ, ngày học, thử thách, thưởng, huy hiệu.
4. Ghép trận nhanh, chấm điểm server, deadline, reconnect, lịch sử và log. Phòng riêng/daily battle giữ lại để phát triển sau.
5. Bảng xếp hạng, thông báo, admin Battles.
6. Tổng hợp thống kê, Dashboard/Analytics, tìm kiếm và xuất báo cáo.

Các ca kiểm tra cần có khi triển khai: không đọc được email/đáp án người khác; không tự tăng rating/xu; retry submit/reward/result không nhân đôi; hai worker không ghép một người vào hai trận; admin sửa câu hỏi không đổi phiên đang làm; xóa/khóa tài khoản xử lý đúng phiên hiện tại; số active theo kỳ khử trùng UID; câu hỏi và log phân trang không mất/trùng khi thời gian bằng nhau; view/index dựng lại được từ nguồn.

Kiểm thử luật đã chốt: rating mới bằng 0; thắng +5 rating/+5 xu; thua từ 0 vẫn 0, từ 1 về 0, từ 5 về 3; hòa không thưởng/không đổi rating; thoát khi đang dẫn điểm vẫn thua; reconnect trong 30 giây giữ trận nếu chưa kết thúc, quá hạn xử thua đúng một lần; hai bên nhận cùng 10 questionId/version; luyện tập không nhận câu thuộc kỹ năng khác; tải lại phiên không bốc lại đề; mọi câu có thời hạn 30 giây; luyện tập +1 xu, kiểm tra/thử thách +2 xu; lần hoàn thành thứ 19 chưa mở thành tích, lần 20 mở một lần, lần 21 không mở lại; một attempt retry không tăng lượt, attempt mới hoàn thành cùng mục tăng lượt; bài kiểm tra không tăng tiến độ luyện tập.

Kiểm thử bổ sung về số câu và lượt ngày: practice có 10 câu, test 20 câu, dailyChallenge 5 câu; client không sửa được số câu; hai thiết bị cùng bắt đầu thử thách trong một ngày chỉ tạo một attempt; đổi challengeId không vượt giới hạn; tải lại không đổi đề/reset deadline; completed/bỏ dở không tạo lượt thứ hai trong ngày; đổi ngày theo server cho phép một lượt mới; thưởng thử thách tối đa một lần cho attempt hợp lệ.

Kiểm thử bổ sung đã chốt: hai tab hạng trả cùng rating hiện tại/toàn bộ người chơi; cả hai mất kết nối quá grace hòa 0 rating/0 xu; daily đang dở hết hạn 00:00, gửi muộn không thưởng và không chiếm lượt ngày mới. Phá hòa thứ tự hạng bằng rating giảm dần rồi UID tăng dần và kết quả cuối bất biến là mặc định kỹ thuật đã ghi riêng, không phải câu trả lời mới của người dùng.

Tài liệu là thiết kế và bàn giao. Có test seed, hợp đồng, frontend demo và Rules emulator; chưa chạy nghiệp vụ backend end-to-end vì chưa có backend. Xem [bàn giao trước backend](../../frontend/docs/PRE-BACKEND-HANDOFF.md).

## 8. Tài liệu kỹ thuật đối chiếu

- [Firebase: cấu trúc cây JSON và tránh lồng dữ liệu quá sâu](https://firebase.google.com/docs/database/web/structure-data).
- [Firebase: truy vấn, sắp xếp và phân trang](https://firebase.google.com/docs/database/web/lists-of-data).
- [Firebase: đọc/ghi, multi-location update và transactions](https://firebase.google.com/docs/database/web/read-and-write).
- [Firebase: Security Rules và indexes](https://firebase.google.com/docs/database/security).
- [Firebase: custom claims do server quản lý](https://firebase.google.com/docs/auth/admin/custom-claims).
- [Firebase: presence và onDisconnect](https://firebase.google.com/docs/database/web/offline-capabilities).
- [Firebase Authentication](https://firebase.google.com/docs/auth), [Cloud Storage](https://firebase.google.com/docs/storage), [Cloud Messaging](https://firebase.google.com/docs/cloud-messaging).
