package com.englishbattle.app

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import com.englishbattle.app.data.*
import com.englishbattle.app.ui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class ReportingScreenTest {
    @get:Rule val compose = createComposeRule()
    @Test fun progressShowsAllPeriodQuestionsAndMinutesWithUnknownCoverage() {
        compose.setContent { EnglishBattleTheme { ProgressScreen(LoadState(reportData()), Dashboard(), null, "week", {}, {}) } }
        compose.onNodeWithText("75%").assertExists()
        compose.onNodeWithText("Hoạt động mỗi ngày · Phút học").assertExists()
        compose.onNodeWithText("Thời gian học: 3 phút 0 giây").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("130 phiên · 1300 câu · Chuỗi học 3 ngày").assertExists()
        compose.onNodeWithText("4 phiên cũ chưa có thời lượng, chưa cộng vào phút học.").assertExists()
    }
    @Test fun historyShowsUnknownLegacyTimeAndProvidesLoadMore() {
        var more = 0
        val page = HistoryPage(listOf(QuizResult("old", QuizMode.PRACTICE, 7, 10, 1)), "next")
        compose.setContent { EnglishBattleTheme { HistoryScreen(LoadState(page), {}, {}, {}, true, { more++ }) } }
        compose.onNodeWithText("Chưa có dữ liệu").assertExists()
        compose.onNodeWithText("Xem thêm lịch sử").performScrollTo().performClick()
        compose.runOnIdle { assertEquals(1, more) }
    }
    @Test fun walletKeepsItsBalanceWhenLoadingMoreFails() {
        val page = LedgerPage(listOf(LedgerEntry("one", "Existing transaction", 1, 1000)), "next")
        compose.setContent { EnglishBattleTheme { WalletScreen(LoadState(Dashboard(coins = 42)), LoadState(page, error = "Network error"), {}, {}, {}) } }
        compose.onNodeWithText("42 xu").assertExists()
        compose.onNodeWithText("Network error").assertExists()
        compose.onNodeWithText("Existing transaction").performScrollTo().assertIsDisplayed()
    }
}
