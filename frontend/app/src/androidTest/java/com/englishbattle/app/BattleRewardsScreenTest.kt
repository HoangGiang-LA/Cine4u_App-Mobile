package com.englishbattle.app

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import com.englishbattle.app.data.*
import com.englishbattle.app.ui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/** Presentation tests use local objects and never make Firebase requests. */
class BattleRewardsScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test fun lockedBattleAchievementDisplaysItsOwnProgressTarget() {
        val d = Dashboard(achievements = listOf(Achievement("ten_wins", "Ten wins", "Win ten battles", false, 9, 10)))
        compose.setContent { EnglishBattleTheme { AchievementsScreen(LoadState(d), {}, {}) } }
        compose.onNodeWithText("9 / 10").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("0 / 20").assertDoesNotExist()
    }

    @Test fun unlockedStreakAchievementRemainsUnlockedAfterCurrentStreakResets() {
        val d = Dashboard(streak = 0, achievements = listOf(
            Achievement("three_win_streak", "Three wins", "Win three consecutive battles", true, 3, 3)))
        compose.setContent { EnglishBattleTheme { AchievementsScreen(LoadState(d), {}, {}) } }
        compose.onNodeWithText("Đã mở khóa").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("1 / 1 huy hiệu").assertExists()
    }

    @Test fun achievementNotificationMarksOnlyItsOwnIdAndOpensAchievements() {
        val d = Dashboard(notifications = listOf(AppNotification("battle_achievement_test", "Mở khóa thành tích",
            "Bạn đã mở khóa thành tích đầu tiên.", "Achievements", false, 1000)))
        val reads = mutableListOf<List<String>>()
        var destination: String? = null
        compose.setContent {
            EnglishBattleTheme {
                NotificationsScreen(LoadState(d), {}, {}, reads::add) { destination = it }
            }
        }
        compose.onNodeWithText("Mở khóa thành tích").performScrollTo().performClick()
        compose.runOnIdle {
            assertEquals(listOf(listOf("battle_achievement_test")), reads)
            assertEquals("Achievements", destination)
        }
    }
}
