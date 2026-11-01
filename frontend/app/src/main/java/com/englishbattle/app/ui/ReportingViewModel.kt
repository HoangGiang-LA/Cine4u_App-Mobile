package com.englishbattle.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.englishbattle.app.EnglishBattleApplication
import com.englishbattle.app.data.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

class ReportingViewModel(app: Application, private val repository: GameRepository) : AndroidViewModel(app) {
    constructor(app: Application) : this(app, (app as EnglishBattleApplication).container.game)
    private var scope = CoroutineScope(viewModelScope.coroutineContext + SupervisorJob(viewModelScope.coroutineContext[Job]))
    private val _statistics = MutableStateFlow(LoadState<StudyStatistics>())
    val statistics = _statistics.asStateFlow()
    private val _history = MutableStateFlow(LoadState<HistoryPage>())
    val history = _history.asStateFlow()
    private val _ledger = MutableStateFlow(LoadState<LedgerPage>())
    val ledger = _ledger.asStateFlow()
    var period = "week"; private set
    var kind = "learning"; private set
    private var statsGeneration = 0
    private var historyGeneration = 0
    private var ledgerGeneration = 0
    private var statsJob: Job? = null
    private var historyJob: Job? = null
    private var ledgerJob: Job? = null
    fun connect() { clear(); scope = CoroutineScope(viewModelScope.coroutineContext + SupervisorJob(viewModelScope.coroutineContext[Job])) }
    fun clear() {
        statsGeneration++; historyGeneration++; ledgerGeneration++; scope.cancel()
        _statistics.value = LoadState(); _history.value = LoadState(); _ledger.value = LoadState()
    }
    fun loadStatistics(period: String = this.period) {
        this.period = period
        val generation = ++statsGeneration
        statsJob?.cancel(); _statistics.value = LoadState(loading = true)
        statsJob = scope.launch {
            try { val data = repository.statistics(period); if (generation == statsGeneration) _statistics.value = LoadState(data) }
            catch (e: Exception) { val error = friendlyError(e); if (generation == statsGeneration) _statistics.value = LoadState(error = error) }
        }
    }
    fun loadHistory(kind: String = this.kind, more: Boolean = false) {
        if (more && (_history.value.loading || kind != this.kind || _history.value.data?.nextCursor == null)) return
        this.kind = kind
        val generation = ++historyGeneration
        historyJob?.cancel()
        val previous = if (more) _history.value.data else null
        _history.value = LoadState(previous, loading = true)
        historyJob = scope.launch {
            try {
                val page = repository.history(kind, previous?.nextCursor)
                if (generation == historyGeneration) _history.value = LoadState(if (previous == null) page else page.copy(
                    entries = (previous.entries + page.entries).distinctBy { it.attemptId }))
            } catch (e: Exception) { val error = friendlyError(e); if (generation == historyGeneration) _history.value = LoadState(previous, error = error) }
        }
    }
    fun loadLedger(more: Boolean = false) {
        if (more && (_ledger.value.loading || _ledger.value.data?.nextCursor == null)) return
        val generation = ++ledgerGeneration
        ledgerJob?.cancel()
        val previous = if (more) _ledger.value.data else null
        _ledger.value = LoadState(previous, loading = true)
        ledgerJob = scope.launch {
            try {
                val page = repository.coinLedger(previous?.nextCursor)
                if (generation == ledgerGeneration) _ledger.value = LoadState(if (previous == null) page else page.copy(
                    entries = (previous.entries + page.entries).distinctBy { it.id }))
            } catch (e: Exception) { val error = friendlyError(e); if (generation == ledgerGeneration) _ledger.value = LoadState(previous, error = error) }
        }
    }
}
