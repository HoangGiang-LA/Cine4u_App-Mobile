package com.englishbattle.app

import androidx.test.platform.app.InstrumentationRegistry
import com.englishbattle.app.data.*
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.util.UUID

class DemoRepositoryTest {
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext
    private lateinit var content: DemoContent
    private lateinit var repo: DemoGameRepository
    private lateinit var name: String
    private var now = 1_792_846_800_000L
    @Before fun setup() {
        name = "test-demo-${UUID.randomUUID()}"
        content = DemoContent(context)
        repo = DemoGameRepository(context, content, name) { now }
    }
    private suspend fun finish(mode: QuizMode, correctCount: Int): AttemptState {
        var a = repo.start(mode, if (mode == QuizMode.PRACTICE) "vocabulary_daily_life" else null, UUID.randomUUID().toString())
        for (i in a.questions.indices) {
            val q = a.current!!
            val answer = content.answers.getValue(q.id).first
            val pick = if (i < correctCount) answer else q.options.first { it.id != answer }.id
            a = repo.submit(a.id, q.id, pick, "answer-$i")
            a = repo.advance(a.id, "advance-$i")
        }
        return a
    }
    @Test fun seedHasDistinctQuestionsAndStableOptionIdsForEveryTopic() {
        assertEquals(4, content.catalog.categories.size)
        assertEquals(25, content.catalog.topics.size)
        assertEquals(250, content.questions.size)
        assertEquals(250, content.questions.map { it.id }.distinct().size)
        content.catalog.topics.forEach { t -> assertEquals(10, content.questions.count { it.topicId == t.id }) }
        content.questions.forEach { q -> assertTrue(q.options.any { it.id == content.answers.getValue(q.id).first }) }
    }
    @Test fun completionAndRetriedFinalizationOnlyGrantOneReward() = runBlocking {
        val a = finish(QuizMode.PRACTICE, 10)
        assertEquals(10, a.result!!.correct)
        repo.advance(a.id, "again"); repo.leave(a.id, "leave-after-completion")
        val d = repo.dashboard()
        assertEquals(1, d.coins)
        assertEquals(1, d.progress["vocabulary_daily_life"])
        assertEquals(1, d.history.size)
    }
    @Test fun dailySlotIsConsumedAtStartAndSurvivesAbandonAndRestart() = runBlocking {
        val a = repo.start(QuizMode.DAILY, null, "first")
        repo.leave(a.id, "leave")
        repo = DemoGameRepository(context, content, name) { now }
        assertEquals(a.id, repo.start(QuizMode.DAILY, null, "second").id)
        assertEquals("abandoned", repo.dashboard().daily.status)
        now += 86_400_000
        assertNotEquals(a.id, repo.start(QuizMode.DAILY, null, "tomorrow").id)
    }
    @Test fun resumeDoesNotResetDeadlineAndLateAnswerIsNotAccepted() = runBlocking {
        val a = repo.start(QuizMode.TEST, null, "first")
        now = a.deadlineAt
        repo = DemoGameRepository(context, content, name) { now }
        assertEquals(a.deadlineAt, repo.resume(a.id).deadlineAt)
        val q = a.current!!
        val late = repo.submit(a.id, q.id, content.answers.getValue(q.id).first, "late")
        assertNull(late.receipt!!.optionId)
    }
    @Test fun dailyExpiresAtMidnightWithoutRewardAndNewDayHasItsOwnSlot() = runBlocking {
        now = java.time.ZonedDateTime.of(2026, 10, 25, 23, 59, 50, 0,
            java.time.ZoneId.of("Asia/Ho_Chi_Minh")).toInstant().toEpochMilli()
        val a = repo.start(QuizMode.DAILY, null, "before-midnight")
        val midnight = GameRules.nextMidnight(now)
        assertEquals(midnight, a.deadlineAt)
        val q = a.current!!
        repo.submit(a.id, q.id, content.answers.getValue(q.id).first, "first-answer")
        now = midnight
        repo = DemoGameRepository(context, content, name) { now }
        val expired = repo.resume(a.id)
        assertEquals("abandoned", expired.status)
        assertEquals(0, expired.result!!.coins)
        repo.advance(a.id, "late-advance")
        assertEquals(0, repo.dashboard().coins)
        assertEquals("available", repo.dashboard().daily.status)
        val nextDay = repo.start(QuizMode.DAILY, null, "new-day")
        assertNotEquals(a.id, nextDay.id)
        assertEquals(nextDay.id, repo.start(QuizMode.DAILY, null, "retry-new-day").id)
    }
    @Test fun weekAndMonthShareTheSameCurrentRatingRanking() = runBlocking {
        val week = repo.leaderboard("week", null)
        val month = repo.leaderboard("month", null)
        assertEquals(week.entries, month.entries)
        assertEquals(week.self, month.self)
    }
    @Test fun drawAndRatingFloorDoNotGrantBattleCoins() = runBlocking {
        assertEquals("draw", finish(QuizMode.BATTLE, 6).result!!.outcome)
        assertEquals(0, repo.dashboard().coins)
        assertEquals("loss", finish(QuizMode.BATTLE, 0).result!!.outcome)
        assertEquals(0, repo.dashboard().rating)
        finish(QuizMode.BATTLE, 10)
        assertEquals(5, repo.dashboard().rating)
        assertEquals(5, repo.dashboard().coins)
        finish(QuizMode.BATTLE, 0)
        assertEquals(3, repo.dashboard().rating)
    }
    @Test fun duplicateStartSubmitAdvanceAndMatchCancellationAreIdempotent() = runBlocking {
        val a = repo.start(QuizMode.PRACTICE, "grammar_tenses", "start")
        assertEquals(a.id, repo.start(QuizMode.PRACTICE, "grammar_tenses", "start").id)
        val q = a.current!!
        val first = repo.submit(a.id, q.id, q.options.first().id, "submit")
        assertEquals(first, repo.submit(a.id, q.id, q.options.last().id, "retry"))
        repo.advance(a.id, "next")
        assertEquals(1, repo.advance(a.id, "next").index)
        val t = repo.findMatch("create", null, "find")
        assertEquals(t.id, repo.findMatch("create", null, "find").id)
        now += 3000
        val matched = repo.matchStatus(t.id)
        assertNotNull(matched.attemptId)
        repo.cancelMatch(t.id)
        assertEquals("cancelled", repo.matchStatus(t.id).status)
        assertEquals("left", repo.historyDetail(matched.attemptId!!).outcome)
    }
}
