package com.englishbattle.app

import com.englishbattle.app.data.*
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class AttemptCompletionTest {
    private fun waiting(mode: QuizMode) = AttemptState(
        "attempt-${mode.name}", mode, "topic", emptyList(), mode.count - 1, 0,
        status = "waiting"
    )

    private fun result(attempt: AttemptState, outcome: String = "completed") = QuizResult(
        attempt.id, attempt.mode, 0, attempt.mode.count,
        if (outcome == "completed") attempt.mode.coins else 0, outcome = outcome
    )

    @Test fun lastQuestionFetchesTheSavedResultForPracticeTestAndDaily() = runBlocking {
        for (mode in listOf(QuizMode.PRACTICE, QuizMode.TEST, QuizMode.DAILY)) {
            val attempt = waiting(mode)
            val saved = result(attempt)
            val requests = mutableListOf<String>()
            val completed = completeWaitingAttempt(attempt) { id -> requests += id; saved }
            assertEquals(listOf(attempt.id), requests)
            assertEquals("completed", completed.status)
            assertSame(saved, completed.result)
        }
    }

    @Test fun interruptedCompletionCanRetryWithoutLosingTheWaitingAttempt() = runBlocking {
        val attempt = waiting(QuizMode.PRACTICE)
        var requests = 0
        val loader: suspend (String) -> QuizResult = {
            requests++
            if (requests == 1) throw IOException("Connection interrupted")
            result(attempt)
        }
        try {
            completeWaitingAttempt(attempt, loader)
            fail("A failed result request must remain retryable")
        } catch (_: IOException) {
            assertEquals("waiting", attempt.status)
            assertNull(attempt.result)
        }
        val resumed = completeWaitingAttempt(attempt, loader)
        assertEquals("completed", resumed.status)
        assertEquals(attempt.id, resumed.result?.attemptId)
        assertEquals(2, requests)
    }

    @Test fun anExpiredDailyResultRetainsTheServerAbandonedOutcome() = runBlocking {
        val attempt = waiting(QuizMode.DAILY)
        val completed = completeWaitingAttempt(attempt) { result(attempt, "abandoned") }
        assertEquals("abandoned", completed.status)
        assertEquals(0, completed.result?.coins)
    }

    @Test fun activeAndAlreadyCompletedAttemptsDoNotFetchAnotherResult() = runBlocking {
        val pending = waiting(QuizMode.TEST)
        val states = listOf(pending.copy(status = "active"),
            pending.copy(status = "completed", result = result(pending)))
        for (attempt in states) {
            val unchanged = completeWaitingAttempt(attempt) { error("Unexpected result request") }
            assertSame(attempt, unchanged)
        }
    }

    @Test fun waitingForAnOpponentDoesNotFinalizeABattle() = runBlocking {
        val attempt = waiting(QuizMode.BATTLE)
        assertSame(attempt, completeWaitingAttempt(attempt) { error("Battle is still waiting") })
    }
}
