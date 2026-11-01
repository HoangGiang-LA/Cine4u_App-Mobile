package com.englishbattle.app

import android.app.Application
import androidx.lifecycle.ViewModelStore
import androidx.test.platform.app.InstrumentationRegistry
import com.englishbattle.app.data.*
import com.englishbattle.app.ui.UserDataViewModel
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import org.junit.After
import org.junit.Assert.*
import org.junit.Test

class CommunityFlowTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val store = ViewModelStore()
    private lateinit var model: UserDataViewModel
    private fun create(repo: CommunityRepository) = instrumentation.runOnMainSync {
        model = UserDataViewModel(instrumentation.targetContext.applicationContext as Application, repo)
        store.put("community", model)
    }
    @After fun cleanUp() = instrumentation.runOnMainSync { if (::model.isInitialized) model.clear(); store.clear() }
    private suspend fun boardReady() = withTimeout(5000) { model.board.first { !it.loading && it.data != null } }.data!!
    private suspend fun inboxReady() = withTimeout(5000) { model.notifications.first { !it.loading && it.data != null } }.data!!

    @Test fun rankingAppendsPagesAndKeepsTheServerSelfRank() = runBlocking {
        val repo = CommunityRepository()
        val seen = mutableListOf<String?>()
        val self = LeaderboardEntry("self", "Self", 78, 0)
        repo.board = { _, cursor ->
            seen.add(cursor)
            LeaderboardPage("Current", listOf(LeaderboardEntry(if (cursor == null) "a" else "b", "Player", if (cursor == null) 1 else 2, 10)), self,
                if (cursor == null) "next" else null)
        }
        create(repo)
        instrumentation.runOnMainSync { model.loadBoard("week") }
        boardReady()
        instrumentation.runOnMainSync { model.loadBoard("week", true); model.loadBoard("week", true) }
        val page = boardReady()
        assertEquals(listOf("a", "b"), page.entries.map { it.uid })
        assertEquals(self, page.self)
        assertEquals(listOf(null, "next"), seen)
    }

    @Test fun changingTabsIgnoresAResponseFromTheCancelledTab() = runBlocking {
        val repo = CommunityRepository()
        val old = CompletableDeferred<LeaderboardPage>()
        val started = CompletableDeferred<Unit>()
        repo.board = { period, _ ->
            if (period == "week") { started.complete(Unit); withContext(NonCancellable) { old.await() } }
            else LeaderboardPage("Month", listOf(LeaderboardEntry("new", "New", 1, 10)))
        }
        create(repo)
        instrumentation.runOnMainSync { model.loadBoard("week") }
        withTimeout(5000) { started.await() }
        instrumentation.runOnMainSync { model.loadBoard("month") }
        boardReady()
        old.complete(LeaderboardPage("Old", listOf(LeaderboardEntry("old", "Old", 1, 10))))
        instrumentation.waitForIdleSync()
        assertEquals("month", model.period)
        assertEquals("new", model.board.value.data!!.entries.single().uid)
    }

    @Test fun aReadAcknowledgementCannotBeUndoneByAnOlderLoadMoreResponse() = runBlocking {
        val repo = CommunityRepository()
        val stale = CompletableDeferred<NotificationPage>()
        val started = CompletableDeferred<Unit>()
        val n = AppNotification("one", "One", "Body", "Achievements", false, 1000)
        repo.feed = { cursor -> if (cursor == null) NotificationPage(listOf(n), 30, 30, "next") else {
            started.complete(Unit); withContext(NonCancellable) { stale.await() }
        } }
        create(repo)
        instrumentation.runOnMainSync { model.loadNotifications() }
        inboxReady()
        instrumentation.runOnMainSync { model.loadNotifications(true) }
        withTimeout(5000) { started.await() }
        instrumentation.runOnMainSync { model.markRead(listOf("one")) }
        withTimeout(5000) { model.notifications.first { it.data?.entries?.firstOrNull()?.read == true } }
        stale.complete(NotificationPage(listOf(n.copy(id = "two")), 30, 30))
        instrumentation.waitForIdleSync()
        assertEquals(listOf("one"), model.notifications.value.data!!.entries.map { it.id })
        assertTrue(model.notifications.value.data!!.entries.single().read)
        assertEquals(29, model.notifications.value.data!!.unreadCount)
    }

    @Test fun markAllUsesTheWholeAccountCountWhilePreservingLoadedItems() = runBlocking {
        val repo = CommunityRepository()
        val n = AppNotification("one", "One", "Body", "History", false, 1000)
        repo.feed = { NotificationPage(listOf(n), 80, 80, "next") }
        create(repo)
        instrumentation.runOnMainSync { model.loadNotifications() }
        inboxReady()
        instrumentation.runOnMainSync { model.markAllRead() }
        val page = withTimeout(5000) { model.notifications.first { it.data?.unreadCount == 0 } }.data!!
        assertEquals(1, repo.allCalls)
        assertTrue(page.entries.single().read)
        assertEquals("next", page.nextCursor)
    }

    @Test fun failedMoreKeepsTheOldSnapshotAndRetryStartsANewOne() = runBlocking {
        val repo = CommunityRepository()
        var first = 0
        val seen = mutableListOf<String?>()
        repo.board = { _, cursor ->
            seen.add(cursor)
            if (cursor != null) throw UserFacingException("Page expired")
            first++
            LeaderboardPage("Current", listOf(LeaderboardEntry("p$first", "Player", 1, 10)), nextCursor = "next")
        }
        create(repo)
        instrumentation.runOnMainSync { model.loadBoard("week") }; boardReady()
        instrumentation.runOnMainSync { model.loadBoard("week", true) }
        withTimeout(5000) { model.board.first { it.error != null } }
        assertEquals("p1", model.board.value.data!!.entries.single().uid)
        instrumentation.runOnMainSync { model.loadBoard("week") }
        assertEquals("p2", boardReady().entries.single().uid)
        assertEquals(listOf(null, "next", null), seen)
    }
}

internal class CommunityRepository : GameRepository {
    var stats: suspend (String) -> StudyStatistics = { error("Unused") }
    var past: suspend (String, String?) -> HistoryPage = { _, _ -> error("Unused") }
    var ledger: suspend (String?) -> LedgerPage = { error("Unused") }
    override suspend fun statistics(period: String) = stats(period)
    override suspend fun history(kind: String, cursor: String?) = past(kind, cursor)
    override suspend fun coinLedger(cursor: String?) = ledger(cursor)
    var board: suspend (String, String?) -> LeaderboardPage = { _, _ -> LeaderboardPage("Current", emptyList()) }
    var feed: suspend (String?) -> NotificationPage = { NotificationPage(emptyList(), 0, 0) }
    var unread = 30
    var allCalls = 0
    override suspend fun leaderboard(period: String, cursor: String?) = board(period, cursor)
    override suspend fun notifications(cursor: String?) = feed(cursor)
    override suspend fun markRead(ids: List<String>) { unread -= ids.size }
    override suspend fun markAllNotificationsRead() { unread = 0; allCalls++ }
    override suspend fun dashboard() = Dashboard(unreadNotificationCount = unread)
    override suspend fun ensureProfile(): Unit = error("Unused")
    override suspend fun start(mode: QuizMode, topicId: String?, requestId: String): AttemptState = error("Unused")
    override suspend fun resume(attemptId: String): AttemptState = error("Unused")
    override suspend fun submit(attemptId: String, questionId: String, optionId: String?, requestId: String): AttemptState = error("Unused")
    override suspend fun saveSelection(attemptId: String, questionId: String, optionId: String, requestId: String): Unit = error("Unused")
    override suspend fun advance(attemptId: String, requestId: String, expectedIndex: Int?): AttemptState = error("Unused")
    override suspend fun leave(attemptId: String, requestId: String): AttemptState = error("Unused")
    override suspend fun findMatch(kind: String, code: String?, requestId: String): MatchTicket = error("Unused")
    override suspend fun matchStatus(ticketId: String): MatchTicket = error("Unused")
    override suspend fun cancelMatch(ticketId: String): AttemptState? = error("Unused")
    override suspend fun historyDetail(attemptId: String): QuizResult = error("Unused")
}
