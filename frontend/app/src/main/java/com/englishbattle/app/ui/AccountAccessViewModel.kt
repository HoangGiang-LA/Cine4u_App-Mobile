package com.englishbattle.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.englishbattle.app.EnglishBattleApplication
import com.englishbattle.app.data.DataMode
import com.englishbattle.app.data.friendlyError
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AccountAccessState(val key: String? = null, val ready: Boolean = false,
    val error: String? = null)

class AccountAccessViewModel(app: Application,
    private val initialize: suspend (DataMode) -> Unit) : AndroidViewModel(app) {
    constructor(app: Application) : this(app, { mode ->
        (app as EnglishBattleApplication).container.game(mode).ensureProfile()
    })
    private val _state = MutableStateFlow(AccountAccessState())
    val state = _state.asStateFlow()
    private var job: Job? = null
    private var mode = DataMode.FIREBASE
    fun connect(mode: DataMode, uid: String) {
        val key = "${mode.name}-$uid"
        if (_state.value.key == key) return
        this.mode = mode
        _state.value = AccountAccessState(key)
        retry()
    }
    fun retry() {
        job?.cancel()
        val key = _state.value.key ?: return
        _state.value = AccountAccessState(key)
        job = viewModelScope.launch {
            try {
                initialize(mode)
                if (_state.value.key == key) _state.value = AccountAccessState(key, ready = true)
            } catch (error: Exception) {
                val message = friendlyError(error)
                if (_state.value.key == key) _state.value = AccountAccessState(key, error = message)
            }
        }
    }
    fun clear() { job?.cancel(); _state.value = AccountAccessState() }
}
