package com.englishbattle.app.data

import android.content.Context
import com.englishbattle.app.BuildConfig
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

// Instantiated only by the explicit debug demo entry. No live user data is written here.
class DemoContent(context: Context) : CatalogRepository {
    init { check(BuildConfig.DEBUG) }
    private val root = JSONObject(context.assets.open("demo-content.json").bufferedReader().use { it.readText() })
    val catalog = Catalog(root.items("categories").map { Category(it.getString("id"), it.getString("name"), it.getInt("order")) }.sortedBy { it.order },
        root.items("topics").map { Topic(it.getString("id"), it.getString("categoryId"), it.getString("title"), it.getInt("order"), it.getInt("target")) }.sortedBy { it.order })
    val questions = root.items("questions").map(WireCodec::question)
    val answers = root.items("questions").associate { it.getString("id") to (it.getString("correctId") to it.getString("explanation")) }
    override fun observe() = flowOf(catalog)
}

class DemoGameRepository(context: Context, private val content: DemoContent,
    prefsName: String = "english_battle_demo_v2", private val now: () -> Long = System::currentTimeMillis) : GameRepository {
    private val prefs = context.getSharedPreferences(prefsName, Context.MODE_PRIVATE)
    private val mutex = Mutex()
    private val state = runCatching { JSONObject(prefs.getString("state", "{}")!!) }.getOrDefault(JSONObject())
    private fun group(key: String): JSONObject = state.optJSONObject(key) ?: JSONObject().also { state.put(key, it) }
    private fun save() { prefs.edit().putString("state", state.toString()).apply() }
    private fun today() = java.time.Instant.ofEpochMilli(now()).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate().toString()
    private fun dailyEndsAt(id: String): Long? {
        group("dailyExpiry").optLong(id).takeIf { it > 0 }?.let { return it }
        val date = group("daily").keys().asSequence().firstOrNull { group("daily").optString(it) == id } ?: return null
        return LocalDate.parse(date).plusDays(1).atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant().toEpochMilli()
    }
    private fun read(id: String): AttemptState {
        val a = group("attempts").optJSONObject(id)?.let(WireCodec::attempt)
            ?: throw UserFacingException("Không tìm thấy phiên này. Hãy quay lại danh sách.")
        if (a.mode == QuizMode.DAILY && a.status == "active" && dailyEndsAt(id)?.let { now() >= it } == true)
            return complete(a, true)
        return a
    }
    private fun store(a: AttemptState): AttemptState { group("attempts").put(a.id, WireCodec.attemptJson(a)); save(); return a }
    private fun uid() = UUID.randomUUID().toString()
    override suspend fun ensureProfile() = Unit
    override suspend fun dashboard(): Dashboard = mutex.withLock {
        group("daily").keys().asSequence().map { group("daily").getString(it) }.toList().forEach { read(it) }
        val history = group("results").keys().asSequence().map { WireCodec.result(group("results").getJSONObject(it)) }.sortedByDescending { it.completedAt }.toList()
        val progress = group("progress").keys().asSequence().associateWith { group("progress").getInt(it) }
        val daily = group("daily").optString(today()).takeIf { it.isNotBlank() }?.let { id ->
            DailyStatus(read(id).status, id)
        } ?: DailyStatus()
        val unlocked = content.catalog.topics.filter { (progress[it.id] ?: 0) >= it.target }
        val notifications = unlocked.map { AppNotification("achievement-${it.id}", "Mở khóa thành tích", "Bạn đã hoàn thành ${it.title} ${it.target} lần.", "Achievements", group("read").optBoolean("achievement-${it.id}"), group("achievementTimes").optLong(it.id)) }
        val completedDates = history.filter { it.outcome !in listOf("abandoned", "left") }.map {
            java.time.Instant.ofEpochMilli(it.completedAt).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate()
        }.toSet()
        var day = LocalDate.parse(today())
        if (day !in completedDates) day = day.minusDays(1)
        var streak = 0
        while (day in completedDates) { streak++; day = day.minusDays(1) }
        Dashboard(state.optInt("rating"), state.optInt("coins"), history.count { it.outcome == "win" },
            history.count { it.outcome in listOf("loss", "left") }, history.count { it.outcome == "draw" }, streak, progress, daily, history,
            content.catalog.topics.map { Achievement(it.id, it.title, "Hoàn thành ${it.target} lần luyện tập", it in unlocked) }, notifications,
            history.filter { it.coins > 0 }.map { LedgerEntry(it.attemptId, it.mode.title, it.coins, it.completedAt) },
            content.catalog.categories.map { c ->
                val reviews = history.flatMap { it.reviews }.filter { it.question.categoryId == c.id }
                SkillStat(c.id, c.name, reviews.size, reviews.count { it.pickedId == it.correctId })
            })
    }
    private fun create(mode: QuizMode, topicId: String?, requestId: String): AttemptState {
        group("requests").nullableString(requestId)?.let { return read(it) }
        if (mode == QuizMode.DAILY) group("daily").optString(today()).takeIf { it.isNotBlank() }?.let { return read(it) }
        val pool = content.questions.filter { mode != QuizMode.PRACTICE || it.topicId == topicId }
        if (pool.size < mode.count) throw UserFacingException("Chủ đề chưa đủ câu hỏi để bắt đầu.")
        val id = uid()
        val endsAt = if (mode == QuizMode.DAILY) GameRules.nextMidnight(now()).also { group("dailyExpiry").put(id, it) } else null
        val a = AttemptState(id, mode, topicId.orEmpty(), pool.shuffled().take(mode.count), 0,
            GameRules.questionDeadline(now(), endsAt),
            opponentName = if (mode == QuizMode.BATTLE) "Đối thủ mô phỏng" else "")
        group("requests").put(requestId, a.id)
        if (mode == QuizMode.DAILY) group("daily").put(today(), a.id)
        return store(a)
    }
    override suspend fun start(mode: QuizMode, topicId: String?, requestId: String): AttemptState = mutex.withLock { create(mode, topicId, requestId) }
    override suspend fun resume(attemptId: String): AttemptState = mutex.withLock { read(attemptId) }
    override suspend fun submit(attemptId: String, questionId: String, optionId: String?, requestId: String): AttemptState = mutex.withLock {
        val a = read(attemptId)
        if (a.status != "active" || a.receipts.any { it.questionId == questionId }) return@withLock a
        val q = a.current ?: return@withLock a
        if (questionId != q.id) throw UserFacingException("Câu hỏi đã thay đổi. Vui lòng tải lại phiên.")
        if (optionId != null && q.options.none { it.id == optionId }) throw UserFacingException("Lựa chọn không hợp lệ.")
        val pick = optionId.takeIf { now() < a.deadlineAt }
        store(a.copy(receipts = a.receipts + AnswerReceipt(q.id, pick,
            if (a.mode == QuizMode.BATTLE) null else pick == content.answers.getValue(q.id).first)))
    }
    override suspend fun advance(attemptId: String, requestId: String): AttemptState = mutex.withLock {
        var a = read(attemptId)
        if (a.status != "active") return@withLock a
        val requestKey = "$attemptId/$requestId"
        if (group("advanceRequests").optBoolean(requestKey)) return@withLock a
        if (a.receipt == null) {
            if (now() < a.deadlineAt) throw UserFacingException("Hãy gửi đáp án trước khi tiếp tục.")
            a = a.copy(receipts = a.receipts + AnswerReceipt(a.current!!.id, null, false))
        }
        group("advanceRequests").put(requestKey, true)
        if (a.index + 1 < a.questions.size) store(a.copy(index = a.index + 1,
            deadlineAt = GameRules.questionDeadline(now(), if (a.mode == QuizMode.DAILY) dailyEndsAt(a.id) else null)))
        else complete(a, false)
    }
    private fun complete(a: AttemptState, leaving: Boolean): AttemptState {
        if (a.result != null) return a
        val reviews = a.questions.map { q -> QuestionReview(q, a.receipts.find { it.questionId == q.id }?.optionId,
            content.answers.getValue(q.id).first, content.answers.getValue(q.id).second) }
        val correct = reviews.count { it.pickedId == it.correctId }
        val opponentCorrect = if (a.mode == QuizMode.BATTLE) 6 else 0
        val outcome = when {
            leaving && a.mode == QuizMode.BATTLE -> "left"
            leaving -> "abandoned"
            a.mode != QuizMode.BATTLE -> "completed"
            correct > opponentCorrect -> "win"
            correct < opponentCorrect -> "loss"
            else -> "draw"
        }
        val rating = state.optInt("rating")
        val delta = when (outcome) { "win" -> 5; "loss", "left" -> GameRules.ratingAfterLoss(rating) - rating; else -> 0 }
        val coins = if (leaving) 0 else if (a.mode != QuizMode.BATTLE || outcome == "win") a.mode.coins else 0
        val result = QuizResult(a.id, a.mode, correct, a.questions.size, coins, delta, outcome,
            a.opponentName, opponentCorrect, reviews, now())
        // Finalization is persisted once; retries return the same immutable result.
        group("results").put(a.id, WireCodec.resultJson(result))
        state.put("rating", rating + delta).put("coins", state.optInt("coins") + coins)
        if (!leaving && a.mode == QuizMode.PRACTICE) {
            val count = group("progress").optInt(a.topicId) + 1
            group("progress").put(a.topicId, count)
            val target = content.catalog.topics.find { it.id == a.topicId }?.target ?: GameRules.PRACTICE_TARGET
            if (count == target) group("achievementTimes").put(a.topicId, now())
        }
        return store(a.copy(status = if (leaving) "abandoned" else "completed", result = result))
    }
    override suspend fun leave(attemptId: String, requestId: String): AttemptState = mutex.withLock { complete(read(attemptId), true) }
    override suspend fun findMatch(kind: String, code: String?, requestId: String): MatchTicket = mutex.withLock {
        group("matchRequests").nullableString(requestId)?.let { return@withLock ticket(it) }
        if (kind == "join" && !code.orEmpty().matches(Regex("[A-Z0-9]{6}"))) throw UserFacingException("Mã phòng gồm 6 chữ hoặc số.")
        val id = uid()
        val roomCode = if (kind == "create") (100000..999999).random().toString() else code
        group("tickets").put(id, JSONObject().put("createdAt", now()).put("kind", kind)
            .put("roomCode", roomCode ?: JSONObject.NULL).put("status", "searching"))
        group("matchRequests").put(requestId, id)
        save()
        ticket(id)
    }
    private fun ticket(id: String): MatchTicket {
        val t = group("tickets").optJSONObject(id) ?: throw UserFacingException("Yêu cầu tìm trận không còn tồn tại.")
        if (t.getString("status") == "cancelled") return MatchTicket(id, "cancelled")
        if (now() - t.getLong("createdAt") < 2000) return MatchTicket(id, "searching", roomCode = t.nullableString("roomCode"))
        val attemptId = t.nullableString("attemptId") ?: create(QuizMode.BATTLE, null, "ticket-$id").id.also { t.put("attemptId", it); save() }
        return MatchTicket(id, "matched", "Đối thủ mô phỏng", attemptId, t.nullableString("roomCode"))
    }
    override suspend fun matchStatus(ticketId: String): MatchTicket = mutex.withLock { ticket(ticketId) }
    override suspend fun cancelMatch(ticketId: String) { mutex.withLock {
        val t = group("tickets").optJSONObject(ticketId) ?: return@withLock
        t.nullableString("attemptId")?.let { complete(read(it), true) }
        t.put("status", "cancelled"); save()
    } }
    override suspend fun leaderboard(period: String, cursor: String?): LeaderboardPage {
        val d = dashboard()
        val names = listOf("Hoàng Nam", "Minh Anh", "Thảo Vy", "Đức Huy", "Ngọc Linh", "Quang Minh", "Bảo Trân", "Tuấn Kiệt", "Hà Phương")
        val ratings = listOf(12450, 8550, 8220, 8100, 7880, 7660, 7440, 7220, 7000)
        val participants = names.mapIndexed { i, name -> LeaderboardEntry("demo-player-$i", name, 0, ratings[i]) } + LeaderboardEntry("demo-local", "Bạn (mô phỏng)", 0, d.rating)
        val entries = participants.sortedWith(compareByDescending<LeaderboardEntry> { it.rating }.thenBy { it.uid }).mapIndexed { i, entry -> entry.copy(rank = i + 1) }
        val self = entries.first { it.uid == "demo-local" }
        return LeaderboardPage(if (period == "week") "Tuần này · dữ liệu mô phỏng" else "Tháng này · dữ liệu mô phỏng", entries, self)
    }
    override suspend fun markRead(ids: List<String>) { mutex.withLock { ids.forEach { group("read").put(it, true) }; save() } }
    override suspend fun historyDetail(attemptId: String): QuizResult = mutex.withLock {
        group("results").optJSONObject(attemptId)?.let(WireCodec::result) ?: throw UserFacingException("Chưa có kết quả của phiên này.")
    }
}
