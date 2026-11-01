package com.englishbattle.app

import android.app.Application
import androidx.lifecycle.ViewModelStore
import androidx.test.platform.app.InstrumentationRegistry
import com.englishbattle.app.data.*
import com.englishbattle.app.ui.ReportingViewModel
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import org.junit.After
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

internal fun reportData(period: String = "week"): StudyStatistics {
    val metric = StudyMetric(130, 1300, 975, 180000, 4, emptyList())
    return StudyStatistics(period, "2026-11-04", "2026-11-02", "2026-11-09", "2026-10-26", "2026-11-02",
        metric, metric, (0..6).map { StudyDay(LocalDate.parse("2026-11-02").plusDays(it.toLong()).toString(), metric) }, null, 3)
}

class ReportingFlowTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val store = ViewModelStore()
    private lateinit var model: ReportingViewModel
    private fun create(repo: CommunityRepository) = instrumentation.runOnMainSync {
        model = ReportingViewModel(instrumentation.targetContext.applicationContext as Application, repo)
        store.put("reporting", model)
    }
    @After fun cleanUp() = instrumentation.runOnMainSync { if (::model.isInitialized) model.clear(); store.clear() }

    @Test fun switchingPeriodsIgnoresAnOlderNonCancellableResponse() = runBlocking {
        val old = CompletableDeferred<StudyStatistics>(); val started = CompletableDeferred<Unit>()
        val repo = CommunityRepository()
        repo.stats = { if (it == "week") { started.complete(Unit); withContext(NonCancellable) { old.await() } } else reportData("month") }
        create(repo)
        instrumentation.runOnMainSync { model.loadStatistics("week") }; withTimeout(5000) { started.await() }
        instrumentation.runOnMainSync { model.loadStatistics("month") }
        withTimeout(5000) { model.statistics.first { it.data?.period == "month" } }
        old.complete(reportData()); instrumentation.waitForIdleSync()
        assertEquals("month", model.statistics.value.data!!.period)
    }
    @Test fun historyLoadsMoreOnceAndPreservesAlreadyLoadedEntries() = runBlocking {
        val repo = CommunityRepository(); val cursors = mutableListOf<String?>()
        repo.past = { _, cursor -> cursors.add(cursor); HistoryPage(listOf(QuizResult(if (cursor == null) "a" else "b", QuizMode.PRACTICE, 1, 10, 1)), if (cursor == null) "next" else null) }
        create(repo)
        instrumentation.runOnMainSync { model.loadHistory("learning") }
        withTimeout(5000) { model.history.first { it.data != null } }
        instrumentation.runOnMainSync { model.loadHistory(more = true); model.loadHistory(more = true) }
        withTimeout(5000) { model.history.first { it.data?.entries?.size == 2 } }
        assertEquals(listOf(null, "next"), cursors)
    }
    @Test fun aLedgerPagingFailureKeepsDataAndRetryRefreshesFromTheBeginning() = runBlocking {
        val repo = CommunityRepository(); var loads = 0
        repo.ledger = { cursor -> if (cursor != null) throw UserFacingException("Page expired")
            loads++; LedgerPage(listOf(LedgerEntry("entry$loads", "Grant", 1, 1000)), "next") }
        create(repo)
        instrumentation.runOnMainSync { model.loadLedger() }; withTimeout(5000) { model.ledger.first { it.data != null } }
        instrumentation.runOnMainSync { model.loadLedger(true) }; withTimeout(5000) { model.ledger.first { it.error != null } }
        assertEquals("entry1", model.ledger.value.data!!.entries.single().id)
        instrumentation.runOnMainSync { model.loadLedger() }; withTimeout(5000) { model.ledger.first { it.data?.entries?.firstOrNull()?.id == "entry2" } }
        assertEquals(1, model.ledger.value.data!!.entries.size)
    }
    @Test fun clearingAnAccountCannotPublishItsLateHistoryIntoAnotherSession() = runBlocking {
        val repo = CommunityRepository(); val old = CompletableDeferred<HistoryPage>(); val started = CompletableDeferred<Unit>()
        repo.past = { _, _ -> started.complete(Unit); withContext(NonCancellable) { old.await() } }
        create(repo)
        instrumentation.runOnMainSync { model.loadHistory("battle") }; withTimeout(5000) { started.await() }
        instrumentation.runOnMainSync { model.connect() }
        old.complete(HistoryPage(listOf(QuizResult("old-account", QuizMode.BATTLE, 1, 10, 0))))
        instrumentation.waitForIdleSync(); assertNull(model.history.value.data)
    }
}
