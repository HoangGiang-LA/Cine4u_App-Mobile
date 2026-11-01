package com.englishbattle.app

import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import com.englishbattle.app.data.*
import com.englishbattle.app.ui.EnglishBattleTheme
import com.englishbattle.app.ui.QuizScreen
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicLong

/** UI-only tests; Firebase sessions and stored user data are untouched. */
class QuizTimeoutScreenTest {
    @get:Rule val compose = createComposeRule()
    private val question = QuizQuestion("timeout-q", "v1", "vocabulary", "topic", "Choose an answer",
        listOf(AnswerOption("a", "First choice"), AnswerOption("b", "Second choice")))

    @Test fun choosingImmediatelySavesAndTimeoutRequestsServerGrading() = checkTimeout("b")
    @Test fun noSelectionAlsoResolvesAtTimeout() = checkTimeout(null)

    private fun checkTimeout(option: String?) {
        val clock = AtomicLong(1000)
        val saved = CopyOnWriteArrayList<String>()
        val submitted = CopyOnWriteArrayList<String?>()
        val state = mutableStateOf(AttemptState("timeout", QuizMode.PRACTICE, "topic", listOf(question), 0, 31000))
        compose.setContent {
            EnglishBattleTheme {
                QuizScreen(LoadState(state.value), false, null, "timeout-test", clock::get, {}, { answer ->
                    submitted.add(answer)
                    state.value = state.value.copy(receipts = listOf(AnswerReceipt(question.id, option, option != null)))
                }, {}, {}, {}, saveSelection = saved::add)
            }
        }
        if (option != null) {
            compose.onNodeWithText("Second choice").performScrollTo().performClick()
            compose.runOnIdle { assertEquals(listOf(option), saved.toList()); assertTrue(submitted.isEmpty()) }
        }
        clock.set(31000)
        compose.waitUntil(5000) { submitted.isNotEmpty() }
        compose.runOnIdle {
            // The server resolves its persisted draft at the deadline.
            assertEquals(listOf<String?>(null), submitted.toList())
            if (option == null) assertTrue(saved.isEmpty())
        }
        compose.onNodeWithText("Xem kết quả").performScrollTo().assertIsDisplayed()
    }

    @Test fun resumingRestoresAnUnconfirmedSelection() {
        val a = AttemptState("resume", QuizMode.PRACTICE, "topic", listOf(question), 0, 31000,
            selectedOptionId = "b")
        var submitted: String? = null
        compose.setContent {
            EnglishBattleTheme {
                QuizScreen(LoadState(a), false, null, "timeout-test", { 1000 }, {}, { submitted = it }, {}, {}, {})
            }
        }
        compose.onNodeWithText("Gửi đáp án").performScrollTo().assertIsEnabled().performClick()
        compose.runOnIdle { assertEquals("b", submitted) }
    }
}
