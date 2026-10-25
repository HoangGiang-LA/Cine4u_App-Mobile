
# Firebase Realtime Database Structure

Design status: data design and local seed prepared; backend not implemented. Updated 2026-10-25 from confirmed user requirements. Existing cloud data has not yet been compared with a current export.
See [the detailed database analysis](PHAN-TICH-DATABASE.md) for fields, access boundaries, queries and remaining decisions.

Static data deliverable: [english-battle.seed.json](english-battle.seed.json), with 250 starter questions and confirmed configuration.
Runtime record examples: [runtime-examples.reference.json](runtime-examples.reference.json), reference only; never import this file.
Follow [HUONG-DAN-NHAP.md](HUONG-DAN-NHAP.md) for initial import and starter assumptions. Backend and Rules are not implemented by these data files.

## Confirmed Business Rules
- No Premium, subscriptions, payments, revenue, XP or levels.
- Rating starts at 0 and cannot be negative.
- Battle win: +5 rating and +5 coins.
- Battle loss: new rating = max(0, old rating - 2), no coins.
- Equal correct-answer counts: draw, no rating change and no coins; no speed tie-breaker.
- Practice completion: +1 coin; test completion: +2 coins; daily challenge completion: +2 coins.
- Coins are recorded in a wallet and ledger; coin redemption is out of scope for now.
- Every question in battle, practice, test and daily challenge has a 30-second server-controlled deadline.
- Each battle uses one randomly selected set of 10 questions shared by both players, with fixed question versions.
- Tests and daily challenges also use random questions. Practice uses random questions from the selected skill.
- Question counts: battle 10, practice 10, test 20, daily challenge 5. Backend enforces the configured count for each mode.
- Daily challenge participation is limited to one attempt per user per day, not just one reward. The unique slot is `userDailyChallenges/{uid}/{dateKey}` across devices and challenge IDs.
- Confirmed participation policy: consume the daily slot when the server successfully starts the attempt; reopening resumes the same eligible attempt without resetting its questions or deadlines. Abandoning does not grant another attempt that day. Determine dateKey using server time and a shared timezone (proposed Asia/Ho_Chi_Minh).
- More correct answers wins. A player who explicitly leaves an ongoing battle loses; the remaining player wins with the normal rewards.
- Unexpected disconnection/app closure allows 30 seconds to reconnect; after that the disconnected player loses. A settled result cannot be reopened.
- If both players have exceeded their 30-second reconnect deadlines before final settlement: draw, no rating change, no coins. Server must serialize competing terminal events; settled results remain immutable.
- Daily learning challenges expire at the next 00:00 in Asia/Ho_Chi_Minh. Expired attempts return abandoned with zero coins; the new day has a separate slot. Each question deadline is capped at that midnight.
- Week and month tabs use the same current cumulative rating ranking of all players. No period rating reset or activity-based participant filter. The implementation default is rating descending, UID ascending, with consistent snapshot pagination.
- Phase one supports quick battle only. Daily battle and private-room UI/contracts are retained for later development.
- Idioms & Phrases belongs to Vocabulary, not a fifth skill.
- Practice progress 0/20 counts completed practice attempts for that practice item. A new completed attempt counts even when repeating the item. At 20, unlock its achievement once.
- Retried submissions must not duplicate progress, rating changes or coin rewards.

## BE 1: User & Learning
- users
- userPrivate, accountAccess, adminProfiles, userSettings, userDevices
- categories
- topics (Idioms & Phrases is under Vocabulary)
- lessons
- lessonQuestions, contentAssets
- questions
- questionVersions
- questionAnswers
- quizTemplates (random selection, per-question 30-second limit)
- practiceAttempts
- attemptQuestions, attemptAnswers, attemptReviews
- learningProgress
- userActivityDaily, userSkillStats, userStreaks
- dailyChallenges
- userDailyChallenges/{uid}/{dateKey} (single daily attempt, challengeId, status and reward linkage)

## BE 2: Battle & Realtime
- presence
- matchmakingQueue
- activeBattles, privateRoomCodes
- dailyBattleEvents, dailyBattleEntries
- battleRooms
- battleQuestionSets (one shared set per room)
- battleRounds (shared round timing), battlePayloads
- battleConnections (30-second reconnect deadline)
- battleSubmissions
- battleResults
- battleHistory
- battleReviews, battleLogs
- userStats (rating, wins, losses, draws; no XP/level)
- ratingLedger (before, after and actual delta, including the zero floor)
- leaderboardPeriods, leaderboardRanks
- leaderboards
- achievements
- userAchievements

## Shared
- wallets, coinLedger, rewardGrants
- notifications
- notificationCounts, adminNotifications
- activityEvents, activeUserSets, analytics
- adminViews, lookupIndexes, adminAuditLogs
- reportJobs, appConfig, systemStatus
- operations, outbox

Optional only if their UI flows are confirmed: battleInvites, moderationReports, moderationActions.

## Security Requirements
1. Users can only modify their permitted profile fields through authenticated Auth/API operations; the proposed client Rules deny all direct writes.
2. Correct answers must not be readable by regular clients.
3. Battle scores and results are server-controlled.
4. Administrative operations require verified admin access.
5. Database rules must deny unauthorized access.
6. Clients must not write authoritative rating, wallet balance, rewards or completion counters.
7. Shared battle questions must not expose hidden answers or the opponent's uncommitted answers.
8. Finalization and reward application must tolerate concurrent requests and retries without duplicate effects.

## Remaining Design Decisions
- Question-pool scope for tests, daily challenges and battles (the seed currently defaults to all published skills).
- Resolution if both players explicitly leave, server outages, and ordering of simultaneous terminal events. Both players exceeding reconnect grace is already confirmed above.
- Daily battle event schedule/attempt limits for a later phase, authentication scope beyond the implemented email/password flow and other details listed in the analysis.
- Proposed, not yet confirmed: no repeated question within one attempt; shared round start/deadline and question order; question timers keep running during reconnect grace; practice display caps at 20/20 while the lifetime completion count continues.

## Integration artifacts

See [pre-backend handoff](../../frontend/docs/PRE-BACKEND-HANDOFF.md), [machine-readable contracts](../../frontend/contracts/README.md) and [local verification](../../frontend/verification/README.md). The proposed Rules are tested only on the demo emulator, require server-provisioned accountAccess and have not been deployed. Root database.rules.json is unchanged. Newly added seed settings require a selective migration later; never re-import the root of an existing database.
