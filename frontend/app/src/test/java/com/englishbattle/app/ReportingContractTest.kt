package com.englishbattle.app

import com.englishbattle.app.data.*
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

class ReportingContractTest {
    private fun metric() = JSONObject().put("sessions", 130).put("answered", 1300).put("correct", 975)
        .put("durationMs", 180000).put("unknownDurationSessions", 4).put("skills", JSONObject())
    private fun statistics() = JSONObject().put("period", "week").put("timeZone", "Asia/Ho_Chi_Minh")
        .put("today", "2026-11-04").put("from", "2026-11-02").put("to", "2026-11-09")
        .put("previousFrom", "2026-10-26").put("previousTo", "2026-11-02")
        .put("current", metric()).put("previous", metric()).put("accuracyDelta", JSONObject.NULL).put("streak", 3)
        .put("days", JSONArray((0..6).map { metric().put("date", LocalDate.parse("2026-11-02").plusDays(it.toLong()).toString()) }))

    @Test fun completePeriodMetricsAndUnknownCoverageComeFromServer() {
        val s = WireCodec.statistics(statistics())
        assertEquals(130, s.current.sessions); assertEquals(1300, s.current.answered)
        assertEquals(975, s.current.correct); assertEquals(180000L, s.current.durationMs)
        assertEquals(4, s.current.unknownDurationSessions); assertNull(s.accuracyDelta)
        assertEquals(7, s.days.size)
    }
    @Test fun resultDurationRoundTripsWhileOldResultsRemainUnknown() {
        val old = QuizResult("attempt", QuizMode.PRACTICE, 7, 10, 1)
        assertNull(WireCodec.result(WireCodec.resultJson(old)).durationMs)
        assertEquals(50000L, WireCodec.result(WireCodec.resultJson(old.copy(durationMs = 50000))).durationMs)
        assertEquals(0L, WireCodec.result(WireCodec.resultJson(old.copy(durationMs = 0))).durationMs)
    }
    @Test fun invalidMetricsAndMissingCalendarDaysAreRejected() {
        val raw = statistics(); raw.getJSONObject("current").put("correct", 1301)
        assertThrows(IllegalArgumentException::class.java) { WireCodec.statistics(raw) }
        val missing = statistics(); missing.getJSONArray("days").getJSONObject(1).put("date", "2026-11-02")
        assertThrows(IllegalArgumentException::class.java) { WireCodec.statistics(missing) }
    }
    @Test fun historyRejectsDuplicatesAndAnswersInListPayload() {
        val entry = WireCodec.resultJson(QuizResult("one", QuizMode.PRACTICE, 7, 10, 1, completedAt = 1000))
        val raw = JSONObject().put("entries", JSONArray(listOf(entry, entry))).put("nextCursor", "cursor")
        assertThrows(IllegalArgumentException::class.java) { WireCodec.historyPage(raw) }
    }
    @Test fun ledgerKeepsServerOrderingAndSignedDeltas() {
        val raw = JSONObject().put("entries", JSONArray(listOf(
            JSONObject().put("id", "10").put("label", "First").put("delta", -1).put("createdAt", 1000),
            JSONObject().put("id", "2").put("label", "Second").put("delta", 2).put("createdAt", 1000))))
            .put("nextCursor", "next")
        val page = WireCodec.ledgerPage(raw)
        assertEquals(listOf("10", "2"), page.entries.map { it.id }); assertEquals(-1, page.entries[0].delta)
        assertEquals("next", page.nextCursor)
    }
}
