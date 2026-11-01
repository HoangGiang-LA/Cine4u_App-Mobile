package com.englishbattle.app

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import com.englishbattle.app.data.*
import com.englishbattle.app.ui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class CommunityScreenTest {
    @get:Rule val compose = createComposeRule()
    @Test fun leaderboardShowsSelfOutsideTheLoadedPageAndCanLoadMore() {
        var more = 0
        val page = LeaderboardPage("Rating tích lũy hiện tại", listOf(LeaderboardEntry("p", "First player", 1, 100)),
            LeaderboardEntry("self", "Your name", 78, 0), "cursor")
        compose.setContent { EnglishBattleTheme { LeaderboardScreen(LoadState(page), "week", {}, {}, { more++ }) } }
        compose.onNodeWithText("Your name").assertIsDisplayed()
        compose.onNodeWithText("78").assertIsDisplayed()
        compose.onNodeWithText("Xem thêm").performScrollTo().performClick()
        compose.runOnIdle { assertEquals(1, more) }
    }
    @Test fun inboxDisplaysTheAccountUnreadCountAndProvidesLoadMoreAndMarkAll() {
        val page = NotificationPage(listOf(AppNotification("one", "One", "Body", "Achievements", false, 1000)), 80, 80, "cursor")
        var all = 0; var more = 0
        compose.setContent { EnglishBattleTheme { NotificationsFeedScreen(LoadState(page), {}, {}, {}, { all++ }, { more++ }, {}) } }
        compose.onNodeWithText("80 chưa đọc").performScrollTo().performClick()
        compose.onNodeWithText("Xem thêm thông báo").performScrollTo().performClick()
        compose.runOnIdle { assertEquals(1, all); assertEquals(1, more) }
    }
    @Test fun aPagingErrorKeepsTheAlreadyLoadedNotificationsVisible() {
        val page = NotificationPage(listOf(AppNotification("one", "Existing notification", "Body", "History", true, 1000)), 0, 1)
        compose.setContent { EnglishBattleTheme { NotificationsFeedScreen(LoadState(page, error = "Network error"), {}, {}, {}, {}, {}, {}) } }
        compose.onNodeWithText("Network error").assertExists()
        compose.onNodeWithText("Existing notification").performScrollTo().assertIsDisplayed()
    }
}
