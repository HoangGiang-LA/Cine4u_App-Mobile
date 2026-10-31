package com.englishbattle.app.ui

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.englishbattle.app.BuildConfig
import com.englishbattle.app.EnglishBattleApplication
import com.englishbattle.app.data.*
import com.google.firebase.functions.FirebaseFunctionsException
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.UUID

data class AuthState(val user: UserIdentity? = null, val mode: DataMode = DataMode.FIREBASE,
    val busy: Boolean = false, val initializing: Boolean = true, val error: String? = null, val message: String? = null)
class AuthViewModel(app: Application) : AndroidViewModel(app) {
    private val container = (app as EnglishBattleApplication).container
    private val prefs = app.getSharedPreferences("english_battle_session", Context.MODE_PRIVATE)
    private val _state = MutableStateFlow(AuthState())
    val state = _state.asStateFlow()
    private var latestFirebaseUser: UserIdentity? = null
    private fun demoIdentity() = UserIdentity("demo-local", prefs.getString("demoName", "Bạn học thử")!!, "demo@example.com", prefs.getLong("demoJoined", System.currentTimeMillis()))
    init {
        if (BuildConfig.DEBUG && prefs.getBoolean("demo", false)) _state.value = AuthState(demoIdentity(), DataMode.DEMO, initializing = false)
        viewModelScope.launch { container.auth.users.collect { user ->
            latestFirebaseUser = user
            if (_state.value.mode == DataMode.FIREBASE && !(_state.value.busy && _state.value.user == null)) _state.update { it.copy(user = user, initializing = false) }
        } }
    }
    private fun action(block: suspend () -> Unit) {
        if (_state.value.busy) return
        _state.update { it.copy(busy = true, error = null, message = null) }
        viewModelScope.launch {
            try { block() } catch (e: Exception) { _state.update { it.copy(error = friendlyError(e)) } }
            finally { _state.update { it.copy(busy = false, user = if (it.mode == DataMode.FIREBASE) latestFirebaseUser else it.user) } }
        }
    }
    fun submit(register: Boolean, name: String, email: String, password: String) = action {
        if (register) container.auth.signUp(name.trim(), email.trim(), password) else container.auth.signIn(email.trim(), password)
    }
    fun reset(email: String) = action {
        container.auth.resetPassword(email.trim())
        _state.update { it.copy(message = "Nếu email có tài khoản phù hợp, bạn sẽ nhận được liên kết đặt lại mật khẩu. Hãy kiểm tra cả thư rác.") }
    }
    fun updateName(name: String) = action {
        if (_state.value.mode == DataMode.DEMO) {
            prefs.edit().putString("demoName", name.trim()).apply()
            _state.update { it.copy(user = demoIdentity(), message = "Đã lưu tên trong bản mô phỏng.") }
        } else {
            container.auth.updateName(name.trim())
            _state.update { it.copy(message = "Đã cập nhật tên tài khoản.") }
        }
    }
    fun changeEmail(email: String, password: String) = action {
        if (_state.value.mode == DataMode.DEMO) throw UserFacingException("Đổi email chỉ áp dụng cho tài khoản Firebase thật.")
        container.auth.changeEmail(email.trim(), password)
        _state.update { it.copy(message = "Đã gửi liên kết xác nhận đến email mới. Sau khi xác nhận, hãy đăng nhập lại bằng email mới.") }
    }
    fun dismiss() { _state.update { it.copy(error = null, message = null) } }
    fun enterDemo() {
        if (!BuildConfig.DEBUG || _state.value.busy) return
        prefs.edit().putBoolean("demo", true).apply()
        if (!prefs.contains("demoJoined")) prefs.edit().putLong("demoJoined", System.currentTimeMillis()).apply()
        _state.value = AuthState(demoIdentity(), DataMode.DEMO, initializing = false)
    }
    fun signOut() {
        if (_state.value.busy) return
        prefs.edit().putBoolean("demo", false).apply()
        container.auth.signOut()
        _state.value = AuthState(initializing = false)
    }
}

class CatalogViewModel(app: Application, private val catalogRepository: (DataMode) -> CatalogRepository) : AndroidViewModel(app) {
    constructor(app: Application) : this(app, { mode -> (app as EnglishBattleApplication).container.catalog(mode) })
    private val _state = MutableStateFlow(LoadState<Catalog>())
    val state = _state.asStateFlow()
    private var job: Job? = null
    private var mode = DataMode.FIREBASE
    fun connect(mode: DataMode) { this.mode = mode; _state.value = LoadState(); retry() }
    fun clear() { job?.cancel(); _state.value = LoadState() }
    fun retry() {
        job?.cancel()
        _state.value = LoadState(loading = true)
        job = viewModelScope.launch {
            try {
                supervisorScope {
                    val stream = catalogRepository(mode).observe().produceIn(this)
                    try {
                        _state.value = LoadState(data = withTimeout(15_000) { stream.receive() })
                        for (data in stream) _state.value = LoadState(data)
                    } finally { stream.cancel() }
                }
            } catch (e: Exception) { _state.value = LoadState(error = friendlyError(e)) }
        }
    }
}

class UserDataViewModel(app: Application) : AndroidViewModel(app) {
    private val container = (app as EnglishBattleApplication).container
    private var mode = DataMode.FIREBASE
    private var scope = CoroutineScope(viewModelScope.coroutineContext + SupervisorJob(viewModelScope.coroutineContext[Job]))
    private val _dashboard = MutableStateFlow(LoadState<Dashboard>())
    val dashboard = _dashboard.asStateFlow()
    private val _board = MutableStateFlow(LoadState<LeaderboardPage>())
    val board = _board.asStateFlow()
    private val _message = MutableStateFlow<String?>(null)
    val message = _message.asStateFlow()
    private var dashboardJob: Job? = null
    private var boardJob: Job? = null
    var period = "week"; private set
    fun connect(mode: DataMode) {
        clear(); this.mode = mode
        scope = CoroutineScope(viewModelScope.coroutineContext + SupervisorJob(viewModelScope.coroutineContext[Job]))
        refresh(); loadBoard("week")
    }
    fun clear() { scope.cancel(); _dashboard.value = LoadState(); _board.value = LoadState(); _message.value = null }
    fun refresh() {
        dashboardJob?.cancel()
        _dashboard.update { it.copy(loading = true, error = null) }
        dashboardJob = scope.launch {
            try {
                val repo = container.game(mode)
                _dashboard.value = LoadState(repo.dashboard())
            } catch (e: Exception) { _dashboard.update { it.copy(loading = false, error = friendlyError(e)) } }
        }
    }
    fun loadBoard(period: String, more: Boolean = false) {
        if (more && _board.value.loading) return
        boardJob?.cancel(); this.period = period
        val previous = if (more) _board.value.data else null
        _board.value = LoadState(previous, loading = true)
        boardJob = scope.launch {
            try {
                val page = container.game(mode).leaderboard(period, previous?.nextCursor)
                _board.value = LoadState(if (previous == null) page else page.copy(entries = (previous.entries + page.entries).distinctBy { it.uid }))
            } catch (e: Exception) { _board.value = LoadState(previous, error = friendlyError(e)) }
        }
    }
    fun markRead(ids: List<String>) {
        if (ids.isEmpty()) return
        scope.launch {
            try { container.game(mode).markRead(ids); refresh() }
            catch (e: Exception) { _message.value = friendlyError(e) }
        }
    }
    fun dismiss() { _message.value = null }
}

class PlayViewModel(app: Application) : AndroidViewModel(app) {
    private val container = (app as EnglishBattleApplication).container
    private val prefs = app.getSharedPreferences("english_battle_pending", Context.MODE_PRIVATE)
    private var scope = CoroutineScope(viewModelScope.coroutineContext + SupervisorJob(viewModelScope.coroutineContext[Job]))
    private var mode = DataMode.FIREBASE
    private var key = ""
    private var foreground = true
    private var generation = 0
    private val gate = Mutex()
    private var operation: Job? = null
    private var poll: Job? = null
    private var lastStart: Pair<QuizMode, String?>? = null
    private var lastFind: Pair<String, String?>? = null
    private val _attempt = MutableStateFlow(LoadState<AttemptState>())
    val attempt = _attempt.asStateFlow()
    private val _ticket = MutableStateFlow(LoadState<MatchTicket>())
    val ticket = _ticket.asStateFlow()
    private val _result = MutableStateFlow(LoadState<QuizResult>())
    val result = _result.asStateFlow()
    private val _busy = MutableStateFlow(false)
    val busy = _busy.asStateFlow()
    private val _error = MutableStateFlow<String?>(null)
    val error = _error.asStateFlow()
    val activeId get() = prefs.getString("active-$key", null)
    val hasPendingStart get() = prefs.contains("start-mode-$key")
    val hasPendingMatch get() = prefs.contains("ticket-$key") || prefs.contains("find-kind-$key")
    fun now() = if (mode == DataMode.DEMO) System.currentTimeMillis() else container.clock.now()
    fun connect(mode: DataMode, uid: String) {
        clear(); this.mode = mode; key = "${mode.name}-$uid"
        scope = CoroutineScope(viewModelScope.coroutineContext + SupervisorJob(viewModelScope.coroutineContext[Job]))
        val pendingTicket = prefs.getString("ticket-$key", null)
        if (pendingTicket != null) {
            _ticket.value = LoadState(loading = true)
            run { acceptTicket(container.game(mode).matchStatus(pendingTicket)); beginPoll() }
        } else if (activeId != null || hasPendingStart) resume()
    }
    fun clear() {
        generation++
        scope.cancel(); _attempt.value = LoadState(); _ticket.value = LoadState(); _result.value = LoadState()
        _busy.value = false; _error.value = null
        lastStart = null; lastFind = null
    }
    private fun run(block: suspend () -> Unit) {
        if (_busy.value) return
        val sessionGeneration = generation
        _busy.value = true; _error.value = null
        operation = scope.launch {
            try { gate.withLock { block() } } catch (e: Exception) { val message = friendlyError(e); if (sessionGeneration == generation) _error.value = message }
            finally { if (sessionGeneration == generation) { _busy.value = false; _attempt.update { it.copy(loading = false) }; _ticket.update { it.copy(loading = false) } } }
        }
    }
    private fun acceptTicket(t: MatchTicket) {
        _ticket.value = LoadState(t)
        if (t.status in listOf("cancelled", "expired", "failed")) prefs.edit().remove("ticket-$key").apply()
    }
    private fun definitiveFailure(e: Exception) = e is FirebaseFunctionsException && e.code in listOf(
        FirebaseFunctionsException.Code.INVALID_ARGUMENT, FirebaseFunctionsException.Code.FAILED_PRECONDITION,
        FirebaseFunctionsException.Code.PERMISSION_DENIED, FirebaseFunctionsException.Code.NOT_FOUND,
        FirebaseFunctionsException.Code.UNIMPLEMENTED, FirebaseFunctionsException.Code.ALREADY_EXISTS)
    private fun accept(a: AttemptState) {
        _attempt.value = LoadState(a)
        if (a.status == "active" || a.status == "waiting") prefs.edit().putString("active-$key", a.id).apply()
        else prefs.edit().remove("active-$key").apply()
        a.result?.let { _result.value = LoadState(it) }
        beginPoll()
    }
    fun start(quizMode: QuizMode, topicId: String? = null) = run {
        _attempt.value = LoadState(loading = true)
        _result.value = LoadState()
        if (activeId != null) throw UserFacingException("Bạn có bài hoặc trận đang dở. Hãy tiếp tục hoặc kết thúc phiên đó trước.")
        if (hasPendingMatch) throw UserFacingException("Bạn đang có yêu cầu tìm trận. Hãy mở lại yêu cầu đó trước.")
        val pendingMode = prefs.getString("start-mode-$key", null)
        if (pendingMode != null && (quizMode.name != pendingMode || topicId != prefs.getString("start-topic-$key", null)))
            throw UserFacingException("Bạn có yêu cầu bắt đầu bài đang chờ. Hãy tiếp tục yêu cầu đó trước.")
        lastStart = quizMode to topicId
        val signature = "${quizMode.name}-${topicId.orEmpty()}"
        val requestId = prefs.getString("start-$key-$signature", null) ?: UUID.randomUUID().toString().also {
            prefs.edit().putString("start-$key-$signature", it).apply()
        }
        prefs.edit().putString("start-mode-$key", quizMode.name).putString("start-topic-$key", topicId).apply()
        try {
            accept(container.game(mode).start(quizMode, topicId, requestId))
            prefs.edit().remove("start-$key-$signature").remove("start-mode-$key").remove("start-topic-$key").apply()
        } catch (e: Exception) {
            if (definitiveFailure(e)) prefs.edit().remove("start-$key-$signature").remove("start-mode-$key").remove("start-topic-$key").apply()
            throw e
        }
    }
    fun resume(id: String? = activeId) {
        if (id == null) {
            val pendingMode = prefs.getString("start-mode-$key", null)
            val request = pendingMode?.let { QuizMode.valueOf(it) to prefs.getString("start-topic-$key", null) } ?: lastStart ?: return
            start(request.first, request.second); return
        }
        run { accept(container.game(mode).resume(id)) }
    }
    fun submit(optionId: String?) = run {
        val a = _attempt.value.data ?: return@run
        val q = a.current ?: return@run
        if (a.receipt != null || a.status != "active") return@run
        accept(container.game(mode).submit(a.id, q.id, optionId, "answer-${a.id}-${q.id}"))
    }
    fun advance() = run {
        val a = _attempt.value.data ?: return@run
        accept(container.game(mode).advance(a.id, "advance-${a.id}-${a.index}"))
    }
    fun leave() = run {
        val a = _attempt.value.data ?: return@run
        accept(container.game(mode).leave(a.id, "leave-${a.id}"))
    }
    fun find(kind: String, code: String? = null) = run {
        if (activeId != null || hasPendingStart || prefs.contains("ticket-$key")) throw UserFacingException("Bạn đang có phiên hoặc yêu cầu tìm trận. Hãy mở lại phiên đó.")
        val pendingKind = prefs.getString("find-kind-$key", null)
        if (pendingKind != null && (kind != pendingKind || code != prefs.getString("find-code-$key", null))) throw UserFacingException("Hãy mở lại yêu cầu tìm trận đang chờ trước.")
        lastFind = kind to code
        val signature = "$kind-${code.orEmpty()}"
        val request = prefs.getString("find-$key-$signature", null) ?: UUID.randomUUID().toString().also { prefs.edit().putString("find-$key-$signature", it).apply() }
        prefs.edit().putString("find-kind-$key", kind).putString("find-code-$key", code).apply()
        _ticket.value = LoadState(loading = true)
        try {
            val t = container.game(mode).findMatch(kind, code, request)
            prefs.edit().putString("ticket-$key", t.id).remove("find-$key-$signature").remove("find-kind-$key").remove("find-code-$key").apply()
            acceptTicket(t); beginPoll()
        } catch (e: Exception) {
            if (definitiveFailure(e)) prefs.edit().remove("find-$key-$signature").remove("find-kind-$key").remove("find-code-$key").apply()
            throw e
        }
    }
    fun retryMatch() {
        val id = _ticket.value.data?.id ?: prefs.getString("ticket-$key", null)
        if (id == null) {
            val kind = prefs.getString("find-kind-$key", null)
            val request = kind?.let { it to prefs.getString("find-code-$key", null) } ?: lastFind ?: return
            find(request.first, request.second); return
        }
        run { acceptTicket(container.game(mode).matchStatus(id)); beginPoll() }
    }
    fun enterMatch() = run {
        val t = _ticket.value.data ?: return@run
        val id = t.attemptId ?: return@run
        accept(container.game(mode).resume(id))
        prefs.edit().remove("ticket-$key").apply(); _ticket.value = LoadState()
    }
    fun cancelMatch() = run {
        var id = _ticket.value.data?.id ?: prefs.getString("ticket-$key", null)
        if (id == null) {
            val kind = prefs.getString("find-kind-$key", null) ?: return@run
            val code = prefs.getString("find-code-$key", null)
            val signature = "$kind-${code.orEmpty()}"
            val request = prefs.getString("find-$key-$signature", null) ?: return@run
            val t = container.game(mode).findMatch(kind, code, request)
            prefs.edit().putString("ticket-$key", t.id).remove("find-kind-$key").remove("find-code-$key").remove("find-$key-$signature").apply()
            id = t.id
        }
        container.game(mode).cancelMatch(id)
        prefs.edit().remove("ticket-$key").apply(); _ticket.value = LoadState(); poll?.cancel()
    }
    fun viewResult(id: String) = run {
        _result.value = LoadState(loading = true)
        try { _result.value = LoadState(container.game(mode).historyDetail(id)) }
        catch (e: Exception) { _result.value = LoadState(error = friendlyError(e)) }
    }
    fun setForeground(value: Boolean) { foreground = value; if (!value) poll?.cancel() else { if (activeId != null) resume(); beginPoll() } }
    private fun beginPoll() {
        poll?.cancel()
        if (!foreground) return
        val matching = _ticket.value.data?.status in listOf("searching", "waiting")
        val battle = _attempt.value.data?.let { it.mode == QuizMode.BATTLE && it.status in listOf("active", "waiting") } == true
        if (!matching && !battle) return
        poll = scope.launch {
            while (isActive) {
                delay(3000)
                if (_busy.value) continue
                try {
                    gate.withLock {
                    if (_busy.value) return@withLock
                    if (matching) {
                        val t = container.game(mode).matchStatus(_ticket.value.data!!.id)
                        acceptTicket(t)
                    } else {
                        val a = container.game(mode).resume(_attempt.value.data!!.id)
                        _attempt.value = LoadState(a)
                        if (a.result != null) accept(a)
                    }
                    _error.value = null
                    }
                    if (matching && _ticket.value.data?.status !in listOf("searching", "waiting")) break
                    if (!matching && _attempt.value.data?.result != null) break
                } catch (e: Exception) { _error.value = friendlyError(e); delay(7000) }
            }
        }
    }
    fun dismiss() { _error.value = null }
}

fun connectionFlow(context: Context): Flow<Boolean> = callbackFlow {
    val cm = context.getSystemService(ConnectivityManager::class.java)
    fun connected() = cm.getNetworkCapabilities(cm.activeNetwork)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true
    val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) { trySend(connected()) }
        override fun onLost(network: Network) { trySend(connected()) }
        override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) { trySend(connected()) }
    }
    cm.registerDefaultNetworkCallback(callback); trySend(connected())
    awaitClose { cm.unregisterNetworkCallback(callback) }
}.distinctUntilChanged()
