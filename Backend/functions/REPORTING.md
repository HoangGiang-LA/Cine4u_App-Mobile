# Thống kê theo kỳ, thời lượng và phân trang

## Thời gian và cách tính

Người dùng đã chọn tính thời gian làm từng câu, do server ghi nhận. Cộng từ
openedAt đến lúc server nhận xác nhận, hoặc deadline nếu hết giờ, tối đa 30
giây/câu. Lựa chọn chưa xác nhận được chấm khi hết giờ và tính đến deadline.
Không cộng thời gian xem giải thích, chờ đối thủ sau khi đã trả lời, chờ vào
trận, xem kết quả hoặc độ trễ do worker xử lý muộn. Rời phiên tính phần thời gian
của câu đang mở đến lúc rời/hết grace, vẫn giới hạn bởi deadline.

Đây là thời gian của cửa sổ câu hỏi trên server; không suy đoán người dùng có
đang nhìn màn hình. Các cửa sổ đi qua 00:00 được chia đúng ngày Việt Nam.
Không dùng thời gian client gửi hoặc lấy finishedAt trừ startedAt để tính.

`durationMs` trong kết quả là tổng thời lượng. Phiên cũ thiếu timing tin cậy
trả null; không mặc định thành 30 giây/câu. Tổng phút chỉ cộng phần đã biết,
kèm unknownDurationSessions để giao diện giải thích dữ liệu còn thiếu.

## Thống kê đầy đủ theo kỳ

`getStudyStatistics({period: "week" | "month"})` trả statistics gồm:

- from/to và previousFrom/previousTo: khoảng nửa mở, múi giờ Asia/Ho_Chi_Minh.
  Tuần bắt đầu thứ Hai; tháng là tháng lịch, kỳ trước là tuần/tháng lịch trước.
  Ngày chưa đến trong kỳ hiện tại được trả với số liệu 0.
- current/previous: sessions, answered, correct, durationMs,
  unknownDurationSessions và skills theo kỹ năng.
- days: đủ 7 hoặc 28–31 ngày của kỳ hiện tại, dùng vẽ biểu đồ phút học.
- accuracyDelta: chênh lệch điểm phần trăm, null nếu một kỳ chưa có câu.
- streak: số ngày hoạt động liên tiếp đến hôm nay hoặc hôm qua.

Accuracy tính tổng đúng/tổng câu đã chấm, bao gồm timeout; không lấy trung
bình các phần trăm. Phiên học bỏ dở không tăng số phiên hoàn tất hoặc accuracy,
nhưng thời gian làm câu hợp lệ vẫn được ghi nhận. Trận đã kết thúc tính các
câu thực tế được xử lý; câu chưa chơi do forfeit không tự biến thành câu sai
trong thống kê này. Kết quả/trạng thái/thưởng trận giữ nguyên luật thi đấu.
Lịch sử học cũ không còn đáp án riêng dùng correctCount/questionCount đã lưu
cho thống kê tổng; thống kê kỹ năng chỉ cộng khi còn snapshot nguồn tương ứng.

Số phiên/câu được ghi vào ngày kết thúc; thời lượng được chia theo ngày thực
tế của cửa sổ câu hỏi. Ngày có thời lượng dương hoặc phiên hoàn tất có câu đã
chấm là ngày hoạt động. Chuỗi học khác chuỗi thắng trận. Dashboard giữ trường
streak cũ để tương thích, thêm studyStreak và studyDates của tuần hiện tại.

## Ghi một lần và phục hồi

`studyActivities/{uid}/{eventId}` giữ snapshot thống kê bất biến của mỗi kết
quả. `userActivityDaily/{uid}/{date}` chứa tổng và appliedEvents; transaction
theo ngày chống cộng hai lần. `studyActiveDays` phục vụ chuỗi học mà không cần
tải toàn bộ lịch sử. Ghi dữ liệu thống kê trước marker settlement, nên tác vụ
học tập/thi đấu có thể retry sau lỗi giữa chừng, kể cả lúc chia qua hai ngày.

`reportingBackfill/{uid}` giữ phase/cursor/lease để tổng hợp toàn bộ dữ liệu
cũ, 25 bản ghi/trang. Worker riêng tiến dần qua các tài khoản; API thống kê
cũng xử lý tối đa 4 trang/lần. Chưa xong bootstrap trả UNAVAILABLE để tải lại,
không công bố thống kê mới chỉ tổng hợp một phần. Android cho phép riêng yêu
cầu thống kê chờ tối đa 120 giây khi xử lý dữ liệu cũ. Cursor được checkpoint sau
khi xử lý cả trang thành công; replay trang cũ không nhân đôi tổng.
View dùng phiên bản 3: khi gặp checkpoint/sự kiện của phiên bản cũ, backfill
tự duyệt lại dữ liệu nguồn. Transaction theo ngày trừ phần đã chiếu của phiên
bản cũ rồi cộng bản mới đúng một lần. Cơ chế này sửa thống kê thiếu câu từng
được dựng trong quá trình phát triển, không gọi lại thưởng hoặc sửa kết quả.
Phiên học completed dùng đủ questionCount và correctCount đã chốt; cache đáp
án không đầy đủ không làm giảm mẫu số. Luyện tập một kỹ năng có đủ snapshot
câu hỏi dùng tổng cuối phiên cho kỹ năng đó.

Phiên completed thiếu đáp án không được coi thời lượng của vài câu còn lại là
thời lượng toàn phiên. Timing được ghép theo từng câu từ bản canonical và
snapshot cũ khi có đủ thông tin. Thi đấu cũ còn timing trong battleRooms cũng
được phục hồi thời lượng vào lịch sử. Ngày học lưu active/revision; khi dựng
lại, ngày không còn hoạt động được bỏ khỏi chuỗi học. Revision ngăn phản hồi
chiếu ngày cũ ghi đè dữ liệu mới; cờ boolean cũ vẫn đọc được khi đang chuyển đổi.

## Lịch sử và ví

- `getHistory({kind: "learning" | "battle", cursor?})`: 25 kết quả tóm tắt,
  không kèm câu hỏi/đáp án; bấm một phiên gọi getAttemptResult như trước.
- `getCoinLedger({cursor?})`: 25 giao dịch, giữ delta âm/dương từ dữ liệu nguồn.
- Thứ tự mới nhất trước theo thời gian và khóa RTDB, kể cả khóa số trùng giờ.
  Cursor opaque gắn UID/loại danh sách, hạn 10 phút, dùng index hiện có.
  Cursor hết hạn cần làm mới. Sự kiện hoàn tất/được phục hồi sau khi đã đọc
  trang cần tải lại đầu danh sách để thấy; không dùng offset dễ bị dịch trang.
- App giữ các dòng cũ khi tải thêm lỗi, chặn tải thêm trùng và bỏ phản hồi cũ
  sau khi đổi kỳ/loại lịch sử/tài khoản. Dashboard vẫn giới hạn 50 mục.

## Chạy và kiểm thử

`npm.cmd run dev:local` chạy thêm reporting maintenance trong worker hiện có.
Auth/RTDB vẫn là Firebase thật, không deploy Scheduler khi đang dùng Spark.
Không thêm quyền client ghi số liệu hoặc quyền đọc lịch sử người khác.

`Backend/tests/be1/reporting.test.mjs` chỉ chạy với project demo và
Auth 9199/Database 9100. Bao gồm hơn 100 phiên, độ chính xác có trọng số,
qua nửa đêm/tháng/năm, thời lượng thi đấu, retry, nhiều backend và phân trang.
