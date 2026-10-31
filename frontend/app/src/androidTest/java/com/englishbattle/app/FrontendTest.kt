package com.englishbattle.app

import android.graphics.Bitmap
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import com.englishbattle.app.ui.*
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

/** Isolated authentication screens: no Firebase session or account is changed. */
class FrontendTest {
    @get:Rule val compose = createComposeRule()

    @Test fun loginValidationDoesNotSubmitAnInvalidEmail() {
        val submissions = mutableListOf<String>()
        compose.setContent {
            EnglishBattleTheme {
                AuthScreen(Route.Login, AuthState(initializing = false), {}, {},
                    { _, _, email, _ -> submissions.add(email) }, {}, {})
            }
        }
        compose.onNodeWithText("Đăng nhập", substring = false).performScrollTo().performClick()
        compose.onNodeWithText("Vui lòng nhập email hợp lệ.").assertExists()
        compose.onNodeWithText("Email", substring = false).performTextInput("invalid")
        compose.onNodeWithText("Đăng nhập", substring = false).performScrollTo().performClick()
        compose.runOnIdle { assertTrue(submissions.isEmpty()) }
        screenshot("auth-validation")
    }

    @Test fun captureAuthDesignScreens() {
        val route = mutableStateOf(Route.Splash)
        compose.setContent {
            EnglishBattleTheme {
                if (route.value == Route.Splash) SplashScreen {}
                else AuthScreen(route.value, AuthState(initializing = false), {}, {},
                    { _, _, _, _ -> }, {}, {})
            }
        }
        listOf(Route.Splash, Route.Login, Route.Register, Route.Forgot).forEach { screen ->
            compose.runOnIdle { route.value = screen }
            compose.waitForIdle()
            screenshot("design-${screen.name}")
        }
    }

    private fun screenshot(name: String) {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        File(context.getExternalFilesDir(null), "$name.png").outputStream().use {
            compose.onRoot().captureToImage().asAndroidBitmap().compress(Bitmap.CompressFormat.PNG, 100, it)
        }
    }
}
