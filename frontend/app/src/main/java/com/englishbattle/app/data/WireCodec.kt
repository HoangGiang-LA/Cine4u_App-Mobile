package com.englishbattle.app.data

import org.json.JSONArray
import org.json.JSONObject

internal fun JSONObject.items(key: String): List<JSONObject> = optJSONArray(key)?.let { a ->
    (0 until a.length()).map { a.getJSONObject(it) }
} ?: emptyList()
internal fun JSONObject.stringMap(key: String): Map<String, Int> = optJSONObject(key)?.let { o ->
    o.keys().asSequence().associateWith { o.getInt(it) }
} ?: emptyMap()
internal fun JSONObject.nullableString(key: String): String? = if (isNull(key) || !has(key)) null else getString(key)

object WireCodec {
    fun question(o: JSONObject): QuizQuestion {
        val q = QuizQuestion(o.getString("id"), o.getString("version"), o.getString("categoryId"),
            o.optString("topicId"), o.getString("prompt"), o.items("options").map {
                AnswerOption(it.getString("id"), it.getString("text"))
            }, o.optString("passage"), o.optString("audioText"))
        require(q.id.isNotBlank() && q.options.size >= 2 && q.options.map { it.id }.distinct().size == q.options.size)
        return q
    }
    fun questionJson(q: QuizQuestion) = JSONObject().put("id", q.id).put("version", q.version)
        .put("categoryId", q.categoryId).put("topicId", q.topicId).put("prompt", q.prompt)
        .put("passage", q.passage).put("audioText", q.audioText)
        .put("options", JSONArray(q.options.map { JSONObject().put("id", it.id).put("text", it.text) }))
    fun result(o: JSONObject) = QuizResult(o.getString("attemptId"), QuizMode.valueOf(o.getString("mode")),
        o.getInt("correct"), o.getInt("total"), o.getInt("coins"), o.optInt("ratingDelta"),
        o.optString("outcome", "completed"), o.optString("opponentName"), o.optInt("opponentCorrect"),
        o.items("reviews").map { QuestionReview(question(it.getJSONObject("question")),
            it.nullableString("pickedId"), it.getString("correctId"), it.getString("explanation")) }, o.optLong("completedAt")).also {
                require(it.total > 0 && it.correct in 0..it.total && it.coins >= 0)
            }
    fun resultJson(r: QuizResult) = JSONObject().put("attemptId", r.attemptId).put("mode", r.mode.name)
        .put("correct", r.correct).put("total", r.total).put("coins", r.coins).put("ratingDelta", r.ratingDelta)
        .put("outcome", r.outcome).put("opponentName", r.opponentName).put("opponentCorrect", r.opponentCorrect)
        .put("completedAt", r.completedAt).put("reviews", JSONArray(r.reviews.map {
            JSONObject().put("question", questionJson(it.question)).put("pickedId", it.pickedId ?: JSONObject.NULL)
                .put("correctId", it.correctId).put("explanation", it.explanation)
        }))
    fun attempt(o: JSONObject): AttemptState {
        val a = AttemptState(o.getString("id"), QuizMode.valueOf(o.getString("mode")), o.optString("topicId"),
            o.items("questions").map(::question), o.getInt("index"), o.getLong("deadlineAt"),
            o.items("receipts").map { AnswerReceipt(it.getString("questionId"), it.nullableString("optionId"),
                if (it.isNull("correct") || !it.has("correct")) null else it.getBoolean("correct")) },
            o.optString("status", "active"), o.optString("opponentName"),
            o.optJSONObject("result")?.let(::result),
            if (o.has("reconnectDeadlineAt") && !o.isNull("reconnectDeadlineAt")) o.getLong("reconnectDeadlineAt") else null,
            o.nullableString("selectedOptionId"))
        require(a.id.isNotBlank() && (a.result != null || a.status != "active" || a.index in a.questions.indices))
        require(a.questions.map { it.id }.distinct().size == a.questions.size)
        return a
    }
    fun attemptJson(a: AttemptState) = JSONObject().put("id", a.id).put("mode", a.mode.name).put("topicId", a.topicId)
        .put("questions", JSONArray(a.questions.map(::questionJson))).put("index", a.index).put("deadlineAt", a.deadlineAt)
        .put("receipts", JSONArray(a.receipts.map { JSONObject().put("questionId", it.questionId)
            .put("optionId", it.optionId ?: JSONObject.NULL).put("correct", it.correct ?: JSONObject.NULL) }))
        .put("status", a.status).put("opponentName", a.opponentName).put("result", a.result?.let(::resultJson) ?: JSONObject.NULL)
        .put("reconnectDeadlineAt", a.reconnectDeadlineAt ?: JSONObject.NULL)
        .put("selectedOptionId", a.selectedOptionId ?: JSONObject.NULL)
    fun dashboard(o: JSONObject) = Dashboard(o.getInt("rating"), o.getInt("coins"), o.optInt("wins"),
        o.optInt("losses"), o.optInt("draws"), o.optInt("streak"), o.stringMap("progress"),
        o.optJSONObject("daily")?.let { DailyStatus(it.optString("status", "available"), it.nullableString("attemptId")) } ?: DailyStatus(),
        o.items("history").map(::result), o.items("achievements").map {
            Achievement(it.getString("id"), it.getString("title"), it.getString("description"), it.getBoolean("unlocked"),
                it.optInt("progress", o.stringMap("progress")[it.getString("id").removePrefix("practice_20_")] ?: 0),
                it.optInt("threshold", GameRules.PRACTICE_TARGET))
        }, o.items("notifications").map { AppNotification(it.getString("id"), it.getString("title"),
            it.getString("body"), it.getString("destination"), it.getBoolean("read"), it.getLong("createdAt")) },
        o.items("ledger").map { LedgerEntry(it.getString("id"), it.getString("label"), it.getInt("delta"), it.getLong("createdAt")) },
        o.items("skills").map { SkillStat(it.getString("id"), it.getString("name"), it.getInt("answered"), it.getInt("correct")) })
    fun ticket(o: JSONObject) = MatchTicket(o.getString("id"), o.getString("status"), o.optString("opponentName"),
        o.nullableString("attemptId"), o.nullableString("roomCode"))
    fun leaderboard(o: JSONObject): LeaderboardPage {
        fun entry(e: JSONObject) = LeaderboardEntry(e.getString("uid"), e.getString("name"), e.getInt("rank"), e.getInt("rating"))
        return LeaderboardPage(o.getString("title"), o.items("entries").map(::entry), o.optJSONObject("self")?.let(::entry), o.nullableString("nextCursor"))
    }
}
