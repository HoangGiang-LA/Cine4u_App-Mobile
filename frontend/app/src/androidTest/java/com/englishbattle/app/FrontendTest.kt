package com.englishbattle.app

import android.content.Intent
import android.graphics.Bitmap
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Rule
import org.junit.Test
import java.io.File
import com.englishbattle.app.ui.EnglishBattleApp
import com.englishbattle.app.ui.EnglishBattleTheme

class FrontendTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Test fun loginValidationAndPracticeFlow() {
        compose.onNodeWithText("Bắt đầu  ›").performScrollTo().performClick()
        compose.onNodeWithText("Đăng nhập", useUnmergedTree = true).performScrollTo().performClick()
        compose.onNodeWithText("Vui lòng nhập email hoặc số điện thoại hợp lệ.").assertExists()
        compose.onNodeWithText("Email hoặc số điện thoại").performTextInput("demo@example.com")
        compose.onNodeWithText("Mật khẩu", substring = false).performTextInput("demo123")
        compose.onNodeWithText("Đăng nhập", useUnmergedTree = true).performScrollTo().performClick()
        compose.onNodeWithText("Học theo cách của bạn").assertExists()
        screenshot("home")
        compose.onNodeWithText("Luyện tập", substring = false).performScrollTo().performClick()
        screenshot("practice")
        compose.onNodeWithText("Ngữ pháp", substring = false).performClick()
        compose.onNodeWithText("Thì (Tenses)").performClick()
        compose.onNodeWithText("went", substring = false).performClick()
        compose.onNodeWithText("Chính xác!").assertExists()
        screenshot("quiz-feedback")
        compose.onNodeWithText("Câu tiếp theo").performScrollTo().performClick()
        compose.onNodeWithText("He ___ reading a book now.").assertExists()
        listOf("is", "since", "any", "an", "went", "is", "since", "any", "an").forEachIndexed { index, answer ->
            compose.onNodeWithText(answer, substring = false).performScrollTo().performClick()
            compose.onNodeWithText(if(index == 8) "Xem kết quả" else "Câu tiếp theo").performScrollTo().performClick()
        }
        compose.onNodeWithText("10/10").assertExists()
        screenshot("perfect-result")
    }

    @Test fun compactPhoneWithLargeText() {
        listOf("Home", "Practice", "Profile", "Settings", "Leaderboard").forEach { route ->
            compose.runOnUiThread {
                compose.activity.setContent {
                    androidx.compose.runtime.key(route) {
                        val density = androidx.compose.ui.platform.LocalDensity.current
                        androidx.compose.runtime.CompositionLocalProvider(
                            androidx.compose.ui.platform.LocalDensity provides androidx.compose.ui.unit.Density(density.density, 1.3f)
                        ) {
                            androidx.compose.foundation.layout.Box(androidx.compose.ui.Modifier.requiredSize(320.dp, 640.dp)) {
                                EnglishBattleTheme { EnglishBattleApp(route) }
                            }
                        }
                    }
                }
            }
            compose.waitForIdle()
            screenshot("compact-$route")
        }
    }

    @Test fun renderAllScreens() {
        val screens = listOf("Splash","Login","Register","Forgot","Home","Challenge","Practice","Vocabulary","Grammar",
            "Listening","Reading","Quiz","PracticeResult","Battle","Matching","BattleQuiz","BattleResult","History",
            "Leaderboard","Progress","Profile","Achievements","Notifications","Settings","Review")
        screens.forEach { route ->
            compose.runOnUiThread {
                compose.activity.setContent { androidx.compose.runtime.key(route) { EnglishBattleTheme { EnglishBattleApp(route) } } }
            }
            compose.waitForIdle()
            screenshot(route.lowercase())
        }
    }

    private fun screenshot(name: String) {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val folder = File(context.getExternalFilesDir(null), "screenshots").apply { mkdirs() }
        compose.onRoot().captureToImage().asAndroidBitmap().let { bitmap ->
            File(folder, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG,100,it) }
        }
    }
}
