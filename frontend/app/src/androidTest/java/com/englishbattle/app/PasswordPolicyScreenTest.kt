package com.englishbattle.app

import android.graphics.Bitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import com.englishbattle.app.data.PasswordPolicy
import com.englishbattle.app.ui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File

/** Isolated UI: no Firebase account creation or changes to the user's saved session. */
class PasswordPolicyScreenTest {
    @get:Rule val compose = createComposeRule()
    private val submissions = mutableListOf<String>()

    private fun show(route: Route) {
        compose.setContent {
            EnglishBattleTheme {
                AuthScreen(route, AuthState(initializing = false), {}, {},
                    { _, _, _, password -> submissions.add(password) }, {}, {}, null)
            }
        }
    }

    @Test fun weakPasswordShowsImmediateInlineErrorAndCannotRegister() {
        show(Route.Register)
        compose.onNodeWithText("Tên hiển thị").performTextInput("Test Learner")
        compose.onNodeWithText("Email").performTextInput("learner@example.com")
        compose.onNodeWithText("Mật khẩu", substring = false).performTextInput("abcdefgh")
        compose.onNodeWithText(PasswordPolicy.MESSAGE).assertExists()
        compose.onAllNodes(hasSetTextAction())[2]
            .assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Error))
        compose.onNodeWithText("Nhập lại mật khẩu").performTextInput("abcdefgh")
        compose.onNodeWithText("Đăng ký", substring = false).performScrollTo().performClick()
        compose.onAllNodesWithText(PasswordPolicy.MESSAGE).assertCountEquals(1)
        compose.runOnIdle { assertTrue(submissions.isEmpty()) }

        compose.onAllNodes(hasSetTextAction())[0].performScrollTo()
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        File(context.getExternalFilesDir(null), "password-policy.png").outputStream().use {
            compose.onRoot().captureToImage().asAndroidBitmap().compress(Bitmap.CompressFormat.PNG, 100, it)
        }
    }

    @Test fun correctedPasswordStillRequiresConfirmationThenRegisters() {
        show(Route.Register)
        compose.onNodeWithText("Tên hiển thị").performTextInput("Test Learner")
        compose.onNodeWithText("Email").performTextInput("learner@example.com")
        compose.onNodeWithText("Mật khẩu", substring = false).performTextInput("abcdefgh")
        compose.onAllNodes(hasSetTextAction())[2].performTextReplacement("ABCDEF1!")
        compose.onNodeWithText(PasswordPolicy.MESSAGE).assertDoesNotExist()
        compose.onNodeWithText("Đăng ký", substring = false).performScrollTo().performClick()
        compose.onNodeWithText("Mật khẩu nhập lại chưa khớp.").assertExists()
        compose.runOnIdle { assertTrue(submissions.isEmpty()) }
        compose.onNodeWithText("Nhập lại mật khẩu").performScrollTo().performTextInput("ABCDEF1!")
        compose.onNodeWithText("Đăng ký", substring = false).performScrollTo().performClick()
        compose.runOnIdle { assertEquals(listOf("ABCDEF1!"), submissions) }
    }

    @Test fun existingPasswordCanStillBeUsedToSignIn() {
        show(Route.Login)
        compose.onNodeWithText("Email").performTextInput("learner@example.com")
        compose.onNodeWithText("Mật khẩu", substring = false).performTextInput("old123")
        compose.onNodeWithText(PasswordPolicy.MESSAGE).assertDoesNotExist()
        compose.onNodeWithText("Đăng nhập", substring = false).performScrollTo().performClick()
        compose.runOnIdle { assertEquals(listOf("old123"), submissions) }
    }
}
