import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const folder = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const seed = JSON.parse(fs.readFileSync(path.join(folder,'english-battle.seed.json'),'utf8'));
const t = Date.parse('2026-10-24T09:00:00+07:00');
const uid = 'AUTH_UID_A';
const other = 'AUTH_UID_B';
const topic = 'vocabulary_daily_life';
const questionId = Object.keys(seed.lookupIndexes.questionsByTopic[topic])[0];
const question = seed.questionVersions[questionId].v1;
const correct = seed.questionAnswers[questionId].v1;
const examples = {};
function record(root, location, value, purpose, access = 'Backend ghi; chủ tài khoản đọc dữ liệu của mình.') {
  examples[root] = {path:location,example:value,createdWhen:purpose,access};
}
record('users','users/{uid}',{displayCode:'U000001',displayName:'Tên người dùng',avatarKey:'default_01',createdAt:t,updatedAt:t},'Sau khi tài khoản Firebase Auth được tạo thành công.');
record('userPrivate','userPrivate/{uid}',{email:'user@example.com',emailVerified:false,authProviders:{password:true},updatedAt:t},'Backend đồng bộ từ Auth; example.com chỉ là địa chỉ minh họa.');
record('accountAccess','accountAccess/{uid}',{status:'active',updatedAt:t},'Khởi tạo tài khoản; backend cập nhật khi khóa/xóa.', 'Backend ghi; Rules/API đọc để kiểm tra quyền, không để người học tự sửa.');
record('adminProfiles','adminProfiles/{adminUid}',{displayName:'Quản trị viên',roleLabel:'Administrator',createdAt:t},'Khi cấp quyền quản trị bằng Admin SDK.', 'Không tự cấp quyền qua trường roleLabel; phải kiểm tra custom claims do server cấp.');
record('userSettings','userSettings/{uid}',{notificationsEnabled:true,soundVolume:0.7,language:'vi',theme:'light',updatedAt:t},'Khi khởi tạo hoặc đổi tùy chọn.', 'Chủ tài khoản ghi trường trong allowlist; backend kiểm tra kiểu/giới hạn.');
record('userDevices','userDevices/{uid}/{deviceId}',{fcmToken:'REAL_FCM_TOKEN_FROM_DEVICE',platform:'android',appVersion:'1.0.0',updatedAt:t},'Khi thiết bị đăng ký push; dùng token thật từ SDK.', 'Chỉ chủ tài khoản/backend; không công khai token.');
record('presence','presence/{uid}/{connectionId}',{connected:true,connectedAt:t,lastSeenAt:t},'Theo vòng đời kết nối; đăng ký onDisconnect.', 'Chủ tài khoản cập nhật kết nối của mình; backend dùng làm tín hiệu, không dùng làm điểm/kết quả.');
record('userStats','userStats/{uid}',{rating:0,matchesPlayed:0,wins:0,losses:0,draws:0,currentWinStreak:0,bestWinStreak:0,updatedAt:t},'Hồ sơ mới; mọi thay đổi sau đó do backend chốt trận.');
record('wallets','wallets/{uid}',{coinBalance:0,updatedAt:t},'Ví mới, không tạo lịch sử thưởng giả.');
record('learningProgress','learningProgress/{uid}/{topicId}',{completedAttempts:0,completionTarget:20,correctCount:0,answeredCount:0,bestScore:0,updatedAt:t},'Lần đầu dùng mục luyện tập; khi chưa có node, UI coi số lần hoàn thành bằng 0.');
record('userSkillStats','userSkillStats/{uid}/{categoryId}',{correctCount:0,questionCount:0,completedAttempts:0,durationMs:0,updatedAt:t},'Backend tổng hợp từ các phiên hợp lệ.');
record('userActivityDaily','userActivityDaily/{uid}/{dateKey}',{practiceCompleted:1,testsCompleted:0,dailyChallengesCompleted:0,battlesPlayed:0,correctCount:8,questionCount:10,coinsEarned:1,durationMs:180000,updatedAt:t+180000},'Ví dụ một bài luyện tập đã hoàn thành, không phải giá trị khởi tạo.');
record('userStreaks','userStreaks/{uid}',{current:1,longest:1,lastQualifiedDate:'2026-10-24',qualifiedDates:{'2026-10-24':true}},'Sau hoạt động đạt điều kiện streak; điều kiện streak còn phải thống nhất.');

record('practiceAttempts','practiceAttempts/{uid}/{attemptId}',{templateId:`practice_${topic}`,mode:'practice',categoryId:'vocabulary',topicId:topic,status:'in_progress',questionCount:10,questionTimeLimitSeconds:30,currentOrdinal:1,startedAt:t,correctCount:0,answeredCount:0,scoringVersion:'v1'},'Backend bắt đầu một bài ngẫu nhiên; test dùng 20 câu, dailyChallenge dùng 5 câu.');
record('attemptQuestions','attemptQuestions/{uid}/{attemptId}/{ordinal}',{questionId,version:'v1',ordinal:1,prompt:question.prompt,options:question.options,openedAt:t,deadlineAt:t+30000},'Backend giao câu cho phiên; snapshot cố định, không chứa đáp án đúng chưa mở.');
record('attemptAnswers','attemptAnswers/{uid}/{attemptId}/{ordinal}',{questionId,version:'v1',selectedOptionId:correct.correctOptionId,receivedAt:t+5000,isCorrect:true,timedOut:false,requestId:'SERVER_VALIDATED_REQUEST_ID'},'Sau khi server nhận và chốt lựa chọn.');
record('attemptReviews','attemptReviews/{uid}/{attemptId}/{ordinal}',{questionId,version:'v1',correctOptionId:correct.correctOptionId,explanation:correct.explanation,releasedAt:t+5000},'Chỉ công bố khi chính sách xem đáp án cho phép.');
record('dailyChallenges','dailyChallenges/{dateKey}/{challengeId}',{templateId:'daily_mixed',title:'Thử thách hôm nay',questionCount:5,questionTimeLimitSeconds:30,selectionMode:'random_without_replacement',completionCoins:2,maxAttemptsPerUserPerDay:1,startsAt:Date.parse('2026-10-24T00:00:00+07:00'),endsAt:Date.parse('2026-10-25T00:00:00+07:00'),status:'published'},'Backend tạo lịch theo ngày thực tế; không nhập cố định ngày minh họa này vào seed.');
record('userDailyChallenges','userDailyChallenges/{uid}/{dateKey}',{challengeId:'daily',attemptId:'daily_attempt_001',status:'in_progress',startedAt:t,completedQuestionCount:0},'Transaction chiếm đúng một lượt theo UID/ngày trước khi trả phiên; retry dùng cùng attemptId.');
record('dailyBattleEvents','dailyBattleEvents/{eventId}',{title:'Thi đấu theo ngày',dateKey:'2026-10-24',templateId:'battle_mixed',status:'draft',questionCount:10,questionTimeLimitSeconds:30},'Khi có cấu hình lịch sự kiện; draft cho đến khi chốt lịch/phạm vi câu.');
record('dailyBattleEntries','dailyBattleEntries/{eventId}/{uid}',{battleIds:{battle_001:true},joinedAt:t},'Khi người chơi tham gia sự kiện thi đấu theo ngày, khác thử thách học.');

record('matchmakingQueue','matchmakingQueue/{poolId}/{uid}',{mode:'quick',rating:0,joinedAt:t,expiresAt:t+120000,status:'waiting'},'Khi tìm trận; 120 giây ở đây chỉ là ví dụ thời hạn hàng chờ, chưa phải luật đã chốt.', 'Backend ghi/xử lý, người chơi chỉ được xem trạng thái của mình.');
record('activeBattles','activeBattles/{uid}',{roomId:'battle_001',status:'playing',assignedAt:t},'Server đặt reservation trước khi ghép để một UID không vào hai trận.');
record('privateRoomCodes','privateRoomCodes/{code}',{roomId:'battle_001',expiresAt:t+600000},'Backend tạo mã duy nhất; 10 phút là thời hạn minh họa cần cấu hình.', 'Tra mã qua backend; không cấp đọc danh sách tất cả mã phòng.');
record('battleRooms','battleRooms/{roomId}',{displayCode:'B000001',mode:'quick',templateId:'battle_mixed',categoryId:'mixed',status:'playing',participants:{[uid]:{displayName:'Người A'},[other]:{displayName:'Người B'}},questionCount:10,questionTimeLimitSeconds:30,currentRound:1,correctCounts:{[uid]:0,[other]:0},createdAt:t-10000,startedAt:t,rulesVersion:'v1'},'Server xác nhận hai thành viên và bắt đầu trận.', 'Chỉ hai thành viên và admin phù hợp đọc; backend ghi.');
const sharedQuestions = Object.keys(seed.lookupIndexes.questionsByTopic[topic]).map((id,i)=>[String(i+1).padStart(2,'0'),{questionId:id,version:'v1',ordinal:i+1,optionOrder:{opt_1:1,opt_2:2,opt_3:3,opt_4:4}}]);
record('battleQuestionSets','battleQuestionSets/{roomId}',Object.fromEntries(sharedQuestions),'Ví dụ một bộ có đủ 10 câu; khi chạy thật backend bốc ngẫu nhiên một lần và dùng chung.', 'Chỉ backend/admin đọc cả bộ; người chơi nhận battlePayloads theo lượt.');
record('battleRounds','battleRounds/{roomId}/{roundId}',{ordinal:1,openedAt:t,deadlineAt:t+30000,status:'open',resolvedPlayers:{[uid]:false,[other]:false}},'Khi mở lượt; không gia hạn deadline do tải lại.', 'Thành viên đọc phần được phép; backend ghi.');
record('battleConnections','battleConnections/{roomId}/{uid}',{connectionId:'connection_001',status:'disconnected',disconnectedAt:t+1000,reconnectDeadlineAt:t+31000},'Khi server phát hiện phiên thi đấu bị ngắt; chờ đúng 30 giây.', 'Backend kiểm soát hạn và kết quả, không nhận hạn do client tự khai.');
record('battlePayloads','battlePayloads/{roomId}/{uid}',{roundId:'01',questionId,version:'v1',prompt:question.prompt,options:question.options,openedAt:t,deadlineAt:t+30000},'Giao cùng câu/phiên bản cho hai người.', 'Mỗi người chỉ đọc payload của mình; không có correctOptionId/explanation.');
record('battleSubmissions','battleSubmissions/{roomId}/{roundId}/{uid}',{selectedOptionId:correct.correctOptionId,receivedAt:t+7000,requestId:'SERVER_VALIDATED_REQUEST_ID',isCorrect:true},'Chấm sau khi kiểm tra thành viên, vòng, thời gian và chưa nộp.', 'Không cho đối thủ đọc trước khi lượt được chốt.');
record('battleResults','battleResults/{roomId}',{status:'settled',winnerUid:uid,endReason:'all_questions_resolved',correctCounts:{[uid]:8,[other]:6},players:{[uid]:{outcome:'win',ratingBefore:0,ratingAfter:5,ratingDelta:5,coinsAwarded:5},[other]:{outcome:'loss',ratingBefore:0,ratingAfter:0,ratingDelta:0,coinsAwarded:0}},finishedAt:t+300000,settlementVersion:1},'Ví dụ trận A thắng từ rating 0; hòa bỏ winnerUid, cả hai delta/xu bằng 0.');
record('battleHistory','battleHistory/{uid}/{roomId}',{opponentUid:other,opponentDisplayName:'Người B',correctCount:8,opponentCorrectCount:6,outcome:'win',ratingDelta:5,coinsAwarded:5,finishedAt:t+300000},'Fan-out bản rút gọn sau khi có kết quả chính thức.');
record('battleReviews','battleReviews/{roomId}/{uid}/{roundId}',{questionId,version:'v1',correctOptionId:correct.correctOptionId,explanation:correct.explanation,releasedAt:t+300000},'Sau thời điểm cho phép xem lại.');
record('battleLogs','battleLogs/{roomId}/{eventId}',{type:'answer_accepted',actorUid:uid,roundId:'01',serverAt:t+7000,requestId:'SERVER_VALIDATED_REQUEST_ID'},'Mỗi chuyển trạng thái/sự kiện có ý nghĩa.', 'Backend append; admin có quyền xem log; không chứa token/mật khẩu.');

record('ratingLedger','ratingLedger/{uid}/{roomId}',{outcome:'win',ratingBefore:0,ratingAfter:5,ratingDelta:5,settledAt:t+300000},'Chỉ một entry mỗi UID/trận; loss delta có thể -1 hoặc 0 vì sàn rating.');
record('rewardGrants','rewardGrants/{uid}/{grantId}',{sourceType:'practice_completion',sourceId:'attempt_001',coinDelta:1,status:'applied',appliedAt:t+180000},'Khóa deterministic như practice_attempt_001, không tạo push ID mới mỗi retry.');
record('coinLedger','coinLedger/{uid}/{entryId}',{sourceType:'practice_completion',sourceId:'attempt_001',grantId:'practice_attempt_001',delta:1,balanceBefore:0,balanceAfter:1,createdAt:t+180000},'Ghi cùng giao dịch/miền nhất quán với số dư và reward grant.');
record('userAchievements','userAchievements/{uid}/{achievementId}',{progress:20,threshold:20,status:'unlocked',unlockedAt:t,ruleVersion:'v1'},'Khi mục luyện tập tương ứng đạt 20 lần; không cộng thưởng huy hiệu chưa được yêu cầu.');
record('leaderboardPeriods','leaderboardPeriods/{periodId}',{periodType:'current',timeZone:'Asia/Ho_Chi_Minh',metric:'current_cumulative_rating',participants:'all_users',weekMonthUseSameRanking:true,status:'draft'},'Snapshot bảng rating hiện tại; cả hai tab Tuần/Tháng dùng cùng nguồn. Ví dụ này không kích hoạt hoặc tạo người chơi trong seed.');
record('leaderboards','leaderboards/{periodId}/{uid}',{displayName:'Người A',score:5,updatedAt:t},'Score là rating tích lũy hiện tại, không phải rating kiếm được trong kỳ; mọi người chơi dùng cùng bảng.');
record('leaderboardRanks','leaderboardRanks/{periodId}/{uid}',{rank:1,participantCount:2,calculatedAt:t},'Backend tính hạng, không chỉ dựa trên query top 100.');
record('notifications','notifications/{uid}/{notificationId}',{type:'practice_achievement',title:'Hoàn thành thành tích luyện tập',body:'Bạn đã hoàn thành mục này 20 lần.',createdAt:t,targetType:'achievement',targetId:`practice_20_${topic}`,sourceEventId:'achievement_event_001'},'Backend tạo một lần; thêm readAt khi người dùng đọc.');
record('notificationCounts','notificationCounts/{uid}',{unreadCount:1,updatedAt:t},'Bản đếm dẫn xuất, cần đồng bộ với chính sách readAt/readThroughAt.');
record('adminNotifications','adminNotifications/{adminUid}/{notificationId}',{type:'operation_failed',title:'Cần kiểm tra tác vụ',operationId:'operation_001',createdAt:t},'Thông báo vận hành thật, không seed cảnh báo giả.', 'Admin nhận thông báo đọc; backend ghi.');

record('activityEvents','activityEvents/{dateKey}/{eventId}',{type:'practice_completed',actorUid:uid,sourceId:'attempt_001',categoryId:'vocabulary',topicId:topic,correctCount:8,questionCount:10,coinsAwarded:1,occurredAt:t},'Backend tạo sự kiện có mã ổn định sau hoàn thành.', 'Backend ghi; chỉ admin/phân hệ thống kê đọc.');
record('activeUserSets','activeUserSets/{periodType}/{periodKey}/{uid}',{firstActivityAt:t,lastActivityAt:t},'Lưu UID duy nhất theo ngày/tuần/tháng để không cộng trùng.');
record('analytics','analytics/daily/{dateKey}',{newUsers:0,activeUsers:1,practiceCompleted:1,testsCompleted:0,dailyChallengesCompleted:0,battlesStarted:0,battlesCompleted:0,correctCount:8,questionCount:10,coinsAwarded:1,updatedAt:t},'Tổng hợp thật từ sự kiện; weekly/monthly khử trùng active UID.', 'Admin đọc; backend ghi.');
record('adminViews','adminViews/users/{uid}',{displayCode:'U000001',displayName:'Tên người dùng',email:'user@example.com',nameNormalized:'ten nguoi dung',emailNormalized:'user@example.com',status:'active',createdAt:t},'Bản rút gọn từ dữ liệu nguồn. Các nhánh battles/recentActivities cũng tạo khi có sự kiện.', 'Chỉ admin đọc; backend ghi.');
record('lookupIndexes','lookupIndexes/usersByDisplayCode/{displayCode}',uid,'Tạo lookup thật khi cấp mã user; không dùng # trong key.', 'Email/name index chỉ admin đọc; backend ghi.');
record('adminAuditLogs','adminAuditLogs/{dateKey}/{eventId}',{actorUid:'REAL_ADMIN_UID',action:'question.publish',targetType:'question',targetId:questionId,serverAt:t,result:'success',requestId:'SERVER_VALIDATED_REQUEST_ID'},'Khi admin thực hiện một thay đổi được backend kiểm tra.', 'Backend append; admin theo quyền đọc.');
record('reportJobs','reportJobs/{jobId}',{requestedBy:'REAL_ADMIN_UID',reportType:'learning_activity',filters:{fromDate:'2026-10-01',toDate:'2026-10-24'},status:'queued',createdAt:t,snapshotAt:t},'Khi admin yêu cầu báo cáo; chỉ thêm storagePath khi file tạo xong.', 'Admin được cấp quyền tải file, không dùng public URL chứa dữ liệu riêng.');
record('systemStatus','systemStatus/{serviceId}',{status:'operational',checkedAt:t},'Chỉ ghi sau khi kiểm tra dịch vụ thật; không seed trạng thái hoạt động giả.', 'Backend monitor ghi; admin đọc.');
record('operations','operations/{operationId}',{type:'battle_settlement',sourceId:'battle_001',requestId:'SERVER_VALIDATED_REQUEST_ID',status:'pending',attempts:0,createdAt:t},'Điều phối thao tác có retry; cần transaction/lease và phục hồi.', 'Backend only.');
record('outbox','outbox/{eventId}',{type:'practice_completed',sourceId:'attempt_001',uid,status:'pending',attempts:0,createdAt:t},'Sự kiện cần cập nhật view/thống kê/thông báo theo cách chống trùng.', 'Backend only.');
record('battleInvites','battleInvites/{uid}/{inviteId}',{fromUid:other,roomId:'battle_001',status:'pending',createdAt:t,expiresAt:t+600000},'Tùy chọn: chỉ tạo nếu làm luồng lời mời trong app.');
record('moderationReports','moderationReports/{reportId}',{reporterUid:uid,roomId:'battle_001',reason:'Nội dung do người dùng gửi',status:'open',createdAt:t},'Tùy chọn: chỉ tạo nếu xác nhận luồng tố cáo.');
record('moderationActions','moderationActions/{actionId}',{reportId:'report_001',actorUid:'REAL_ADMIN_UID',action:'reviewed',createdAt:t},'Tùy chọn: chỉ tạo nếu xác nhận luồng xử lý tố cáo.', 'Backend ghi sau kiểm tra quyền admin.');

fs.writeFileSync(path.join(folder,'runtime-examples.reference.json'),JSON.stringify({
  documentType:'REFERENCE_ONLY_DO_NOT_IMPORT',
  notes:[
    'Các record là ví dụ độc lập tại các thời điểm khác nhau, không phải một snapshot database nhất quán để chạy thử.',
    'Không import file này. AUTH_UID_A/B và REAL_ADMIN_UID phải thay bằng UID thật khi backend tạo record.',
    'Không có mật khẩu hoặc tài khoản Auth thật. RTDB không tạo tài khoản đăng nhập chỉ bằng thêm users.',
    'Timestamp/ngày/ID là ví dụ cố định. Backend phải dùng thời gian server và ID thật.',
    'Không dùng {uid}/{roomId} làm key thật. Các trường optional chưa có giá trị phải được bỏ qua, không cần ghi null.',
    'Nhánh động xuất hiện khi có record; object rỗng không được RTDB giữ như bảng SQL.',
  ], records:examples,
},null,2)+'\n','utf8');
console.log(`Created reference for ${Object.keys(examples).length} runtime roots.`);
