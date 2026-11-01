package com.englishbattle.app.data

import kotlin.math.ceil

enum class QuizMode(val title: String, val count: Int, val coins: Int) {
    PRACTICE("Luyện tập", 10, 1), TEST("Bài kiểm tra", 20, 2),
    DAILY("Thử thách hôm nay", 5, 2), BATTLE("Thi đấu", 10, 5)
}
object GameRules {
    const val QUESTION_SECONDS = 30
    const val RECONNECT_SECONDS = 30
    const val PRACTICE_TARGET = 20
    fun nextMidnight(epochMs: Long): Long = java.time.Instant.ofEpochMilli(epochMs)
        .atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate().plusDays(1)
        .atStartOfDay(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).toInstant().toEpochMilli()
    fun questionDeadline(epochMs: Long, dailyEndsAt: Long? = null): Long =
        minOf(epochMs + QUESTION_SECONDS * 1000L, dailyEndsAt ?: Long.MAX_VALUE)
    fun ratingAfterLoss(rating: Int) = (rating - 2).coerceAtLeast(0)
}
data class UserIdentity(val uid: String, val name: String, val email: String, val joinedAt: Long)
data class Category(val id: String, val name: String, val order: Int)
data class Topic(val id: String, val categoryId: String, val title: String, val order: Int, val target: Int = 20)
data class Catalog(val categories: List<Category> = emptyList(), val topics: List<Topic> = emptyList())
data class AnswerOption(val id: String, val text: String)
// The live question payload deliberately has no correct answer or explanation.
data class QuizQuestion(val id: String, val version: String, val categoryId: String,
    val topicId: String, val prompt: String, val options: List<AnswerOption>,
    val passage: String = "", val audioText: String = "")
data class AnswerReceipt(val questionId: String, val optionId: String?, val correct: Boolean? = null)
data class QuestionReview(val question: QuizQuestion, val pickedId: String?, val correctId: String, val explanation: String)
data class QuizResult(val attemptId: String, val mode: QuizMode, val correct: Int, val total: Int,
    val coins: Int, val ratingDelta: Int = 0, val outcome: String = "completed",
    val opponentName: String = "", val opponentCorrect: Int = 0,
    val reviews: List<QuestionReview> = emptyList(), val completedAt: Long = 0L)
data class AttemptState(val id: String, val mode: QuizMode, val topicId: String,
    val questions: List<QuizQuestion>, val index: Int, val deadlineAt: Long,
    val receipts: List<AnswerReceipt> = emptyList(), val status: String = "active",
    val opponentName: String = "", val result: QuizResult? = null,
    val reconnectDeadlineAt: Long? = null, val selectedOptionId: String? = null) {
    val current get() = questions.getOrNull(index)
    val receipt get() = current?.let { q -> receipts.find { it.questionId == q.id } }
}
data class Achievement(val id: String, val title: String, val description: String, val unlocked: Boolean,
    val progress: Int = 0, val threshold: Int = GameRules.PRACTICE_TARGET)
data class AppNotification(val id: String, val title: String, val body: String, val destination: String, val read: Boolean, val createdAt: Long)
data class LedgerEntry(val id: String, val label: String, val delta: Int, val createdAt: Long)
data class SkillStat(val id: String, val name: String, val answered: Int, val correct: Int)
data class DailyStatus(val status: String = "available", val attemptId: String? = null)
data class Dashboard(val rating: Int = 0, val coins: Int = 0, val wins: Int = 0, val losses: Int = 0,
    val draws: Int = 0, val streak: Int = 0, val progress: Map<String, Int> = emptyMap(),
    val daily: DailyStatus = DailyStatus(), val history: List<QuizResult> = emptyList(),
    val achievements: List<Achievement> = emptyList(), val notifications: List<AppNotification> = emptyList(),
    val ledger: List<LedgerEntry> = emptyList(), val skills: List<SkillStat> = emptyList())
data class LeaderboardEntry(val uid: String, val name: String, val rank: Int, val rating: Int)
data class LeaderboardPage(val title: String, val entries: List<LeaderboardEntry>,
    val self: LeaderboardEntry? = null, val nextCursor: String? = null)
data class MatchTicket(val id: String, val status: String, val opponentName: String = "",
    val attemptId: String? = null, val roomCode: String? = null)
data class LoadState<T>(val data: T? = null, val loading: Boolean = false, val error: String? = null)

fun remainingSeconds(deadlineAt: Long, now: Long): Int = ceil((deadlineAt - now) / 1000.0).toInt().coerceAtLeast(0)
class UserFacingException(message: String) : Exception(message)
