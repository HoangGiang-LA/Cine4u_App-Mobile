package com.englishbattle.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.ViewModelStore
import androidx.test.platform.app.InstrumentationRegistry
import com.englishbattle.app.data.*
import com.englishbattle.app.ui.PlayViewModel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

/** Exercises real polling in the ViewModel without making Firebase requests. */
class PlayBattleFlowTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val app get() = instrumentation.targetContext.applicationContext as Application
    private val uid = "battle-flow-test-${UUID.randomUUID()}"
    private val store = ViewModelStore()
    private lateinit var model: PlayViewModel

    @After fun cleanUp() {
        instrumentation.runOnMainSync {
            if (::model.isInitialized) model.clear()
            store.clear()
            val prefs = app.getSharedPreferences("english_battle_pending", Context.MODE_PRIVATE)
            prefs.edit().also { edit -> prefs.all.keys.filter { it.contains(uid) }.forEach(edit::remove) }.commit()
        }
    }

    @Test fun cancellingAsMatchIsAssignedContinuesPollingUntilTheSavedResultArrives() = runBlocking {
        val game = BattleFlowRepository(matched = true)
        begin(game)
        instrumentation.runOnMainSync { model.cancelMatch() }
        val result = withTimeout(7_000) { model.result.first { it.data != null } }.data!!
        assertEquals(game.result, result)
        assertEquals(1, game.resumeCalls)
        assertNull(model.activeId)
        assertFalse(model.hasPendingMatch)
        assertNull(model.error.value)
    }

    @Test fun cancellingAnUnmatchedSearchClearsTheTicketWithoutCreatingAnAttempt() = runBlocking {
        val game = BattleFlowRepository(matched = false)
        begin(game)
        instrumentation.runOnMainSync { model.cancelMatch() }
        withTimeout(3_000) { model.busy.first { !it } }
        assertNull(model.ticket.value.data)
        assertNull(model.attempt.value.data)
        assertNull(model.activeId)
        assertFalse(model.hasPendingMatch)
        assertEquals(0, game.resumeCalls)
    }

    private suspend fun begin(game: GameRepository) {
        instrumentation.runOnMainSync {
            model = PlayViewModel(app, game)
            store.put("play", model)
            model.connect(uid)
            model.find("quick")
        }
        withTimeout(3_000) { model.ticket.first { it.data != null } }
        withTimeout(3_000) { model.busy.first { !it } }
    }
}

private class BattleFlowRepository(private val matched: Boolean) : GameRepository {
    override suspend fun statistics(period: String): StudyStatistics = error("Unused")
    override suspend fun history(kind: String, cursor: String?): HistoryPage = error("Unused")
    override suspend fun coinLedger(cursor: String?): LedgerPage = error("Unused")
    override suspend fun notifications(cursor: String?): NotificationPage = error("Unused")
    override suspend fun markAllNotificationsRead(): Unit = error("Unused")
    val result = QuizResult("battle_flow", QuizMode.BATTLE, 0, 10, 0, outcome = "draw")
    private val waiting = AttemptState("battle_flow", QuizMode.BATTLE, "", emptyList(), 0, 30000, status = "waiting")
    var resumeCalls = 0
    override suspend fun findMatch(kind: String, code: String?, requestId: String) = MatchTicket("ticket_flow", "searching")
    override suspend fun cancelMatch(ticketId: String) = if (matched) waiting else null
    override suspend fun resume(attemptId: String): AttemptState {
        resumeCalls++
        return waiting.copy(status = "completed", result = result)
    }
    override suspend fun matchStatus(ticketId: String): MatchTicket = error("Unexpected ticket polling")
    override suspend fun dashboard(): Dashboard = error("Unused")
    override suspend fun ensureProfile(): Unit = error("Unused")
    override suspend fun start(mode: QuizMode, topicId: String?, requestId: String): AttemptState = error("Unused")
    override suspend fun submit(attemptId: String, questionId: String, optionId: String?, requestId: String): AttemptState = error("Unused")
    override suspend fun saveSelection(attemptId: String, questionId: String, optionId: String, requestId: String): Unit = error("Unused")
    override suspend fun advance(attemptId: String, requestId: String, expectedIndex: Int?): AttemptState = error("Unused")
    override suspend fun leave(attemptId: String, requestId: String): AttemptState = error("Unused")
    override suspend fun leaderboard(period: String, cursor: String?): LeaderboardPage = error("Unused")
    override suspend fun markRead(ids: List<String>): Unit = error("Unused")
    override suspend fun historyDetail(attemptId: String): QuizResult = error("Unused")
}
