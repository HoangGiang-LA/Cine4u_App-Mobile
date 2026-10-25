package com.englishbattle.app

import android.graphics.Bitmap
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.key
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModelProvider
import androidx.test.platform.app.InstrumentationRegistry
import com.englishbattle.app.data.DemoContent
import com.englishbattle.app.ui.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import java.io.File

class FrontendTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    @Before fun prepare() {
        compose.runOnUiThread {
            ViewModelProvider(compose.activity)[AuthViewModel::class.java].signOut()
            compose.activity.getSharedPreferences("english_battle_pending", 0).edit().clear().commit()
            compose.activity.setContent { key("test-start") { EnglishBattleTheme { EnglishBattleApp("Login") } } }
        }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Welcome Back!").fetchSemanticsNodes().isNotEmpty() }
    }
    private fun demo() {
        compose.onNodeWithText("Khám phá bản mô phỏng").performScrollTo().performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Học theo cách của bạn").fetchSemanticsNodes().isNotEmpty() }
    }
    @Test fun authValidationNeverEntersHomeWithoutAuthentication() {
        compose.onNodeWithText("Đăng nhập", substring = false).performScrollTo().performClick()
        compose.onNodeWithText("Vui lòng nhập email hợp lệ.").assertExists()
        compose.onNodeWithText("Email", substring = false).performTextInput("invalid")
        compose.onNodeWithText("Đăng nhập", substring = false).performScrollTo().performClick()
        compose.onNodeWithText("Học theo cách của bạn").assertDoesNotExist()
        screenshot("auth-validation")
    }
    @Test fun practiceSubmissionResultAndReview() {
        demo()
        compose.onNodeWithText("Luyện tập", substring = false).performScrollTo().performClick()
        compose.onNodeWithText("Từ vựng", substring = false).performScrollTo().performClick()
        compose.onNodeWithText("Đời sống hằng ngày", substring = false).performScrollTo().performClick()
        compose.onNodeWithText("Bắt đầu", substring = false).performScrollTo().performClick()
        val play = ViewModelProvider(compose.activity)[PlayViewModel::class.java]
        val content = DemoContent(compose.activity)
        compose.waitUntil(10_000) { play.attempt.value.data?.current != null }
        repeat(10) { index ->
            compose.waitUntil(10_000) { play.attempt.value.data?.index == index && !play.busy.value }
            val q = play.attempt.value.data!!.current!!
            val correct = q.options.first { it.id == content.answers.getValue(q.id).first }
            compose.onNodeWithText(correct.text, substring = false).performScrollTo().performClick()
            compose.onNodeWithText("Gửi đáp án", substring = false).performScrollTo().performClick()
            compose.waitUntil(10_000) { play.attempt.value.data?.receipt != null && !play.busy.value }
            if (index == 0) screenshot("quiz-feedback")
            compose.onNodeWithText(if (index == 9) "Xem kết quả" else "Câu tiếp theo", substring = false).performScrollTo().performClick()
        }
        compose.waitUntil(10_000) { play.result.value.data != null }
        compose.onNodeWithText("10/10").assertExists()
        screenshot("practice-result")
        compose.onNodeWithText("Xem đáp án").performScrollTo().performClick()
        compose.onNodeWithText("CÂU 1").assertExists()
        screenshot("review")
        // Starting another attempt must not navigate back to the cached previous result.
        val previousId = play.attempt.value.data!!.id
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithText("Luyện tập").performScrollTo().performClick()
        compose.onNodeWithText("Từ vựng", substring = false).performScrollTo().performClick()
        compose.onNodeWithText("Đời sống hằng ngày", substring = false).performScrollTo().performClick()
        compose.onNodeWithText("Bắt đầu", substring = false).performScrollTo().performClick()
        compose.waitUntil(10_000) { play.attempt.value.data?.let { it.id != previousId && it.status == "active" } == true && !play.busy.value }
        compose.onNodeWithText("Câu 1/10").assertExists()
        compose.runOnUiThread { play.leave() }
    }
    @Test fun demoLogoutClearsNavigationAndProtectedState() {
        demo()
        compose.onNodeWithText("Hồ sơ", substring = false).performClick()
        compose.onNodeWithText("Cài đặt", substring = false).performScrollTo().performClick()
        compose.onNodeWithText("Đăng xuất").performScrollTo().performClick()
        compose.onAllNodesWithText("Đăng xuất", substring = false).onLast().performClick()
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Welcome Back!").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Chính sách bảo mật").assertDoesNotExist()
    }
    @Test fun screensFitSmallPhoneWithLargeText() {
        demo()
        listOf("Home", "Practice", "Vocabulary", "Test", "Challenge", "Battle", "PrivateRoom", "History", "Leaderboard", "Profile", "Progress", "Wallet", "Achievements", "Notifications", "Settings").forEach { route ->
            compose.runOnUiThread {
                compose.activity.setContent { key(route) {
                    val density = LocalDensity.current
                    CompositionLocalProvider(LocalDensity provides Density(density.density, 1.3f)) {
                        Box(Modifier.requiredSize(320.dp, 640.dp)) { EnglishBattleTheme { EnglishBattleApp(route, startInDemo = true) } }
                    }
                } }
            }
            compose.waitForIdle()
            screenshot("compact-$route")
        }
    }
    @Test fun captureDesignScreensAtNormalSize() {
        demo()
        listOf("Home", "Challenge", "Practice", "Vocabulary", "Grammar", "Listening", "Reading", "Test", "Battle", "PrivateRoom", "History", "Leaderboard", "Progress", "Profile", "Achievements", "Notifications", "Settings", "Wallet").forEach { route ->
            compose.runOnUiThread {
                compose.activity.setContent { key("design-$route") { EnglishBattleTheme { EnglishBattleApp(route, startInDemo = true) } } }
            }
            compose.waitForIdle()
            screenshot("design-$route")
        }
    }
    @Test fun captureAuthDesignScreens() {
        listOf("Splash", "Login", "Register", "Forgot").forEach { route ->
            compose.runOnUiThread {
                compose.activity.setContent { key("auth-design-$route") { EnglishBattleTheme { EnglishBattleApp(route) } } }
            }
            compose.waitForIdle()
            screenshot("design-$route")
        }
    }
    @Test fun battleMatchingLeaveAndRematchKeepWorkingWithDesignLayout() {
        demo()
        compose.onAllNodesWithText("Thi đấu", substring = false).onFirst().performScrollTo().performClick()
        compose.onNodeWithText("Thi đấu nhanh").performScrollTo().performClick()
        val play = ViewModelProvider(compose.activity)[PlayViewModel::class.java]
        compose.waitUntil(15_000) { play.ticket.value.data?.status == "matched" && !play.busy.value }
        screenshot("design-Matching")
        compose.onNodeWithText("Vào trận đấu").performScrollTo().performClick()
        compose.waitUntil(10_000) { play.attempt.value.data?.mode == com.englishbattle.app.data.QuizMode.BATTLE && !play.busy.value }
        screenshot("design-BattleQuiz")
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithText("Xác nhận rời phiên").performClick()
        compose.waitUntil(10_000) { play.result.value.data?.outcome == "left" && !play.busy.value }
        screenshot("design-BattleResult")
        compose.onNodeWithText("↻  Đấu lại").performScrollTo().performClick()
        compose.waitUntil(15_000) { play.ticket.value.data?.status == "matched" && !play.busy.value }
        compose.onNodeWithText("Hủy tìm trận").performScrollTo().performClick()
        compose.onAllNodesWithText("Hủy tìm trận").onLast().performClick()
        compose.waitUntil(10_000) { !play.hasPendingMatch && !play.busy.value }
    }
    private fun screenshot(name: String) {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val folder = File(context.getExternalFilesDir(null), "screenshots").apply { mkdirs() }
        compose.onRoot().captureToImage().asAndroidBitmap().let { bitmap ->
            File(folder, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
    }
}
