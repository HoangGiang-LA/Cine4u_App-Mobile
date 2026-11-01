# Thi đấu nhanh, kết nối lại và kết quả bất biến

## Luật đang áp dụng

- Chỉ `quick` hoạt động; `daily`, `create`, `join` trả `UNIMPLEMENTED`.
- Hai UID khác nhau cùng bộ 10 câu, phiên bản và thứ tự lựa chọn. Trận bắt đầu
  khi cả hai bấm vào trận, với tối đa 30 giây chờ vào. Không ai vào thì hòa;
  chỉ một người vào và còn kết nối thì người chưa vào bị xử thua.
- Mỗi câu tối đa 30 giây. Hai người chốt xong thì chuyển lượt; hết giờ chấm
  lựa chọn cuối server đã lưu trước deadline, chưa chọn thì sai. Đáp án đúng,
  giải thích và điểm đối thủ được giữ kín đến kết quả cuối. Bằng số đúng thì
  hòa, không dùng thời gian trả lời để phân thắng thua.
- Polling `resumeAttempt` khoảng 3 giây là heartbeat server xác nhận. Hạn trở
  lại là 30 giây từ heartbeat cuối; không dùng cờ mất mạng do client gửi làm
  bằng chứng xử thua. Kết nối lại không đặt lại đồng hồ câu hỏi. Request đến
  sau hạn không được gia hạn trước khi xét kết quả.
- Một bên hết grace thì thua. Nếu cả hai đã hết grace khi chưa chốt thì hòa,
  không đổi rating/xu. Kết quả đã chốt không đổi khi người kia hết grace sau.
- Chủ động rời mở cửa sổ 3 giây đã chốt với người dùng: cả hai rời trước khi
  hết cửa sổ thì hòa; chỉ một người rời thì người đó thua. Gửi lại không kéo
  dài cửa sổ. Leave đến đúng/sau hạn không đổi kết quả đã được quyết định.
- Thắng +5 rating/+5 xu; thua trừ tối đa 2 rating, sàn 0; hòa 0/0. Ledger ghi
  delta thực tế, ví dụ thua từ rating 1 là −1. `left` là kết quả rời trận và
  được tính vào số trận thua. Chuỗi thắng tăng khi thắng, đặt lại khi thua/hòa.

## Dữ liệu và quyền truy cập

- `battleCoordinator` chứa hàng chờ, reservation theo UID và allocation outbox.
  Một transaction ghép hai ticket, ngăn tự ghép/ghép trùng và quyết định race
  hủy–ghép. Ticket tìm tối đa 120 giây. Ticket terminal lưu ở
  `battleTickets/{uid}/{id}` để retry request cũ không tạo yêu cầu mới. Tombstone
  giữ 60 giây sau khi đã lưu; request đang chạy cũng có hạn 60 giây.
- `battleRooms/{id}` là trạng thái canonical, gồm cả trusted answer snapshot.
  **Không cấp quyền đọc trực tiếp nhánh này cho client.** Callable chỉ trả DTO
  riêng của thành viên và không xuất trusted keys hoặc đáp án của đối thủ.
- `clientSessionId` được Android lưu theo lần cài đặt. Một thiết bị khác không
  thể giữ sống/điều khiển session đang đấu. Session được giữ qua lần mở lại app;
  kết quả terminal vẫn đọc được bởi đúng UID trên thiết bị mới. Client cũ không
  gửi trường này dùng session `legacy`; client hiện tại luôn gửi ID thiết bị.
- `battleWork` là hàng đợi có lease 90 giây, `wakeAt` và retry 1–60 giây.
  Allocation chưa ghi xong, job thiếu và reservation chưa giải phóng được phục
  hồi bởi worker. Job lỗi không chặn các job còn lại.
- `battleResults`, `battleHistory/{uid}`, `battleReviews/{roomId}/{uid}`,
  `battleLogs` và `ratingLedger/{uid}/{roomId}` lưu kết quả/lịch sử/review/log.
  Dashboard gộp tối đa 50 mục mới nhất của học tập và thi đấu.
- Rules giữ default-deny; thêm index `battleWork/dueAt` và
  `battleHistory/$uid/finishedAt`. Không cấp client quyền tự ghi điểm, rating,
  xu, deadline, kết nối hoặc kết quả.

## Tính nguyên tử và phục hồi

Answer, timeout, heartbeat, leave và quyết định terminal cùng dùng transaction
của trận. `finish` chỉ được tạo một lần. Các callback thử lại không gửi thưởng
hoặc phụ thuộc biến đếm bên ngoài transaction.

Mỗi UID dùng `userSettlements/{uid}` chung với học tập, grant ổn định theo trận.
Ví, thống kê, ledger và kỹ năng dùng `appliedGrants`. Rating được quyết định
cùng grant để replay không tính lại sàn 0 hoặc ghi đè rating của trận sau.
Sau khi cả hai UID đã ghi xong, một update nguyên tử lưu hai bộ kết quả và
marker settlement; rồi mới giải phóng reservation. Gián đoạn giữa chừng được
retry; replay kết quả cũ không giải phóng reservation của trận mới.

Transaction trên trạng thái phiên và enqueue công việc thử lại tối đa 8 lần
khi chính SDK hủy với `Error("set")` do một projection đồng thời ghi vào cùng
nhánh. Lỗi quyền truy cập/kết nối khác được giữ nguyên. Callback tiếp tục đọc
trạng thái mới, giữ kết quả/grant đã chốt; không tính thưởng lại khi retry.

## Chạy và kiểm tra

Chạy `npm.cmd run dev:local` trong `frontend/admin-web`. Worker local hiện xử lý
cả học tập và thi đấu; lỗi một loại không chặn loại còn lại. Auth/Database dùng
Firebase thật. Giữ máy, Internet và terminal chạy; khi máy dừng, công việc được
tiếp tục ở lần chạy sau. Cloud Scheduler `maintainBattles` dành cho lúc deploy
sau này, hiện dùng worker local trên gói Spark.

Kiểm thử tạo hai/nhiều tài khoản chỉ trên project
`demo-englishbattle-finalization`, Auth `9199`, Database `9100`. Không tạo tài
khoản/trận giả trên Firebase thật. Lệnh ở README Functions bổ sung file
`Backend/tests/be1/battle/battle.test.mjs`; các test kiểm tra cả chạy worker bằng
tiến trình riêng, race, mất kết nối và gián đoạn từng bước settlement.

Kiểm thử bổ sung dùng hai tiến trình backend có kết nối/cache Admin SDK riêng,
cùng một Database Emulator: ghép trận và gửi đáp án đồng thời đủ 10 câu, hủy
đua với ghép, restart backend giữ lựa chọn/deadline, kết nối lại sau grace và
hai worker cùng chạy. `PlayBattleFlowTest` trên Android kiểm tra hủy tìm trận
đúng lúc được ghép vẫn polling đến kết quả, và hủy chưa ghép không tạo phiên.
