package com.englishbattle.app.ui

import android.content.Context
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.englishbattle.app.data.QuizData

enum class Route { Splash, Login, Register, Forgot, Home, Challenge, Practice, Vocabulary, Grammar,
    Listening, Reading, Quiz, PracticeResult, Battle, Matching, BattleQuiz, BattleResult, History,
    Leaderboard, Progress, Profile, Achievements, Notifications, Settings, Review }

@Composable fun EnglishBattleApp(initial: String = "Splash") {
    val prefs = LocalContext.current.getSharedPreferences("english_battle_ui", Context.MODE_PRIVATE)
    var stack by rememberSaveable { mutableStateOf(listOf(runCatching { Route.valueOf(initial) }.getOrDefault(Route.Splash).name)) }
    val route = Route.valueOf(stack.last())
    var name by rememberSaveable { mutableStateOf(prefs.getString("name", "Tường") ?: "Tường") }
    var email by rememberSaveable { mutableStateOf(prefs.getString("email", "tuong.nguyen@gmail.com") ?: "tuong.nguyen@gmail.com") }
    var category by rememberSaveable { mutableStateOf("Từ vựng") }
    var topic by rememberSaveable { mutableStateOf("Đời sống hằng ngày") }
    var score by rememberSaveable { mutableIntStateOf(8) }
    var answers by rememberSaveable { mutableStateOf(listOf<Int>()) }
    var resultBattle by rememberSaveable { mutableStateOf(false) }
    var quizRun by rememberSaveable { mutableIntStateOf(0) }
    var modal by rememberSaveable { mutableStateOf<String?>(null) }
    fun go(to: Route) { stack = stack + to.name }
    fun root(to: Route) { stack = listOf(to.name) }
    fun back() { if (stack.size > 1) stack = stack.dropLast(1) else root(Route.Home) }
    fun startQuiz(battle: Boolean = false) { quizRun++; answers = emptyList(); score = 0; resultBattle = battle; go(if (battle) Route.BattleQuiz else Route.Quiz) }
    BackHandler(route != Route.Splash && route != Route.Home) { back() }
    val tabs = route in listOf(Route.Home, Route.Challenge, Route.Profile)
    Box(Modifier.fillMaxSize().background(if (route == Route.Splash) Color(0xFFDCF3FE) else Canvas)
        .safeDrawingPadding().imePadding(), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = 600.dp).fillMaxSize()) {
            Box(Modifier.weight(1f)) {
                key(route) {
                    when (route) {
                        Route.Splash -> SplashScreen { root(Route.Login) }
                        Route.Login, Route.Register, Route.Forgot -> AuthScreen(route, ::go, ::back,
                            onLogin = { n, e ->
                                if (n.isNotBlank()) name = n
                                if (e.isNotBlank()) email = e
                                prefs.edit().putString("name", name).putString("email", email).apply()
                                root(Route.Home)
                            }, showMessage = { modal = it })
                        Route.Home -> HomeScreen(name, ::go)
                        Route.Challenge -> ChallengeScreen(::back) { category = "Ngữ pháp"; startQuiz() }
                        Route.Practice -> PracticeScreen(::back) { chosen ->
                            category = chosen
                            go(when (chosen) { "Ngữ pháp" -> Route.Grammar; "Nghe" -> Route.Listening; "Đọc hiểu" -> Route.Reading; else -> Route.Vocabulary })
                        }
                        Route.Vocabulary, Route.Grammar, Route.Listening, Route.Reading -> {
                            val chosen = when(route) { Route.Grammar -> "Ngữ pháp"; Route.Listening -> "Nghe"; Route.Reading -> "Đọc hiểu"; else -> "Từ vựng" }
                            TopicsScreen(chosen, ::back) { selected -> category = chosen; topic = selected; startQuiz() }
                        }
                        Route.Quiz, Route.BattleQuiz -> key(quizRun) {
                            QuizScreen(category, topic, route == Route.BattleQuiz, ::back) { picked ->
                                answers = picked
                                score = picked.zip(QuizData.questions(category)).count { (a, q) -> a == q.correct }
                                resultBattle = route == Route.BattleQuiz
                                go(if (resultBattle) Route.BattleResult else Route.PracticeResult)
                            }
                        }
                        Route.PracticeResult -> ResultScreen(score, false, ::back, { go(Route.Review) }, { root(Route.Practice) })
                        Route.BattleResult -> ResultScreen(score, true, { root(Route.Battle) }, { go(Route.Review) }, { root(Route.Battle); go(Route.Matching) })
                        Route.Review -> ReviewScreen(category, answers, ::back)
                        Route.Battle -> BattleScreen(::back, { mode ->
                            if (mode == 2) modal = "Phòng riêng sẽ cần máy chủ để tạo mã phòng và mời bạn bè. Bạn có thể thử Thi đấu nhanh với đối thủ mẫu."
                            else { category = "Từ vựng"; go(Route.Matching) }
                        }, { go(Route.History) })
                        Route.Matching -> MatchingScreen({ back() }) { startQuiz(true) }
                        Route.History -> HistoryScreen(::back) { score = 8; answers = emptyList(); go(Route.BattleResult) }
                        Route.Leaderboard -> LeaderboardScreen(::back)
                        Route.Progress -> ProgressScreen(::back)
                        Route.Profile -> ProfileScreen(name, email, ::go) { n, e ->
                            name = n; email = e; prefs.edit().putString("name", n).putString("email", e).apply()
                        }
                        Route.Achievements -> AchievementsScreen(::back)
                        Route.Notifications -> NotificationsScreen(::back, ::go)
                        Route.Settings -> SettingsScreen(::back, { root(Route.Login) }, { modal = it })
                    }
                }
            }
            if (tabs) {
                NavigationBar(containerColor = Color.White, tonalElevation = 0.dp, windowInsets = WindowInsets(0), modifier = Modifier.heightIn(min = 72.dp)) {
                    val items = if (route == Route.Challenge)
                        listOf(Triple(Route.Home, "Trang chủ", Icons.Outlined.Home), Triple(Route.Practice, "Học tập", Icons.Outlined.MenuBook),
                            Triple(Route.Challenge, "Thử thách", Icons.Outlined.LocalFireDepartment), Triple(Route.Profile, "Cá nhân", Icons.Outlined.PersonOutline))
                    else listOf(Triple(Route.Home, "Trang chủ", Icons.Outlined.Home), Triple(Route.Battle, "Thi đấu", Icons.Outlined.SportsEsports),
                        Triple(Route.Leaderboard, "Xếp hạng", Icons.Outlined.EmojiEvents), Triple(Route.Profile, "Hồ sơ", Icons.Outlined.PersonOutline))
                    items.forEach { (target, label, icon) ->
                        NavigationBarItem(selected = route == target, onClick = { root(target) },
                            icon = { Icon(icon, null, Modifier.size(22.dp)) },
                            label = { Text(label, fontSize = 10.sp) },
                            colors = NavigationBarItemDefaults.colors(selectedIconColor = Purple, selectedTextColor = Purple,
                                indicatorColor = Lavender, unselectedIconColor = Muted, unselectedTextColor = Muted))
                    }
                }
            }
        }
    }
    modal?.let { message -> AlertDialog(onDismissRequest = { modal = null }, title = { Text("English Battle") },
        text = { Text(message) }, confirmButton = { TextButton({ modal = null }) { Text("Đã hiểu") } }) }
}
