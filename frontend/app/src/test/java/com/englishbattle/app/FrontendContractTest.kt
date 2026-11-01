package com.englishbattle.app

import com.englishbattle.app.data.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class FrontendContractTest {
    private val q = QuizQuestion("q1", "v1", "grammar", "grammar_tenses", "Choose", listOf(AnswerOption("a", "A"), AnswerOption("b", "B")))
    @Test fun publicQuestionWirePayloadDoesNotExposeAnswer() {
        val json = WireCodec.questionJson(q)
        assertFalse(json.has("correctId")); assertFalse(json.has("explanation"))
        assertEquals(q, WireCodec.question(json))
    }
    @Test fun pendingAnswerAndResultSurviveRoundTripWithoutUsingOptionIndex() {
        val result = QuizResult("attempt1", QuizMode.TEST, 1, 20, 2, reviews = listOf(QuestionReview(q, "b", "a", "Explanation")))
        val a = AttemptState("attempt1", QuizMode.TEST, "grammar_tenses", listOf(q), 0, 1000,
            listOf(AnswerReceipt("q1", "b", false)), "completed", result = result)
        assertEquals(a, WireCodec.attempt(WireCodec.attemptJson(a)))
    }
    @Test fun invalidCurrentQuestionIsRejectedRatherThanCrashingTheQuizScreen() {
        val json = WireCodec.attemptJson(AttemptState("a", QuizMode.PRACTICE, "t", listOf(q), 0, 1000)).put("index", 5)
        assertThrows(IllegalArgumentException::class.java) { WireCodec.attempt(json) }
    }
    @Test fun duplicateOptionIdsAreRejected() {
        val json = WireCodec.questionJson(q.copy(options = listOf(AnswerOption("same", "A"), AnswerOption("same", "B"))))
        assertThrows(IllegalArgumentException::class.java) { WireCodec.question(json) }
    }
    @Test fun deadlineUsesWallTimeAndDoesNotResetWhenUiResumes() {
        assertEquals(30, remainingSeconds(30_000, 0))
        assertEquals(1, remainingSeconds(30_000, 29_999))
        assertEquals(0, remainingSeconds(30_000, 30_000))
        assertEquals(0, remainingSeconds(30_000, 100_000))
    }
    @Test fun ratingCannotBecomeNegativeAtTheFloor() {
        assertEquals(0, GameRules.ratingAfterLoss(0))
        assertEquals(0, GameRules.ratingAfterLoss(1))
        assertEquals(3, GameRules.ratingAfterLoss(5))
    }
    @Test fun dailyDeadlineStopsAtVietnamMidnightInsteadOfStartingAnotherThirtySeconds() {
        val nearMidnight = java.time.ZonedDateTime.of(2026, 10, 25, 23, 59, 50, 0,
            java.time.ZoneId.of("Asia/Ho_Chi_Minh")).toInstant().toEpochMilli()
        val cutoff = GameRules.nextMidnight(nearMidnight)
        assertEquals(10_000L, cutoff - nearMidnight)
        assertEquals(cutoff, GameRules.questionDeadline(nearMidnight, cutoff))
        assertEquals(nearMidnight + 30_000, GameRules.questionDeadline(nearMidnight))
    }
    @Test fun nullableAnswerMeansTimedOutRatherThanOptionZero() {
        val result = QuizResult("a", QuizMode.DAILY, 0, 5, 2, reviews = listOf(QuestionReview(q, null, "a", "Explanation")))
        assertNull(WireCodec.result(WireCodec.resultJson(result)).reviews.single().pickedId)
    }
    @Test fun battleAchievementUsesServerProgressAndThreshold() {
        val dashboard = WireCodec.dashboard(JSONObject("""{"rating":5,"coins":5,"achievements":[
            {"id":"ten_wins","title":"Ten wins","description":"Win ten battles","unlocked":false,"progress":7,"threshold":10}]}"""))
        assertEquals(7, dashboard.achievements.single().progress)
        assertEquals(10, dashboard.achievements.single().threshold)
    }
    @Test fun legacyPracticeAchievementStillReadsExistingTopicProgress() {
        val dashboard = WireCodec.dashboard(JSONObject("""{"rating":0,"coins":0,"progress":{"grammar_tenses":9},"achievements":[
            {"id":"practice_20_grammar_tenses","title":"Practice","description":"Complete twenty","unlocked":false}]}"""))
        assertEquals(9, dashboard.achievements.single().progress)
        assertEquals(20, dashboard.achievements.single().threshold)
    }
}
