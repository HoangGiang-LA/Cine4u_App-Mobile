package com.englishbattle.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.englishbattle.app.data.*
import java.util.Locale

fun studyTimeLabel(ms: Long?): String = ms?.let { "${it / 60_000} phút ${(it / 1000) % 60} giây" } ?: "Chưa có dữ liệu"

@Composable fun ProgressScreen(state: LoadState<StudyStatistics>, dashboard: Dashboard?, catalog: Catalog?,
    period: String, back: () -> Unit, select: (String) -> Unit) {
    Screen("Tiến độ của tôi", back) {
        Segments(listOf("Tuần", "Tháng"), if (period == "week") 0 else 1) { select(if (it == 0) "week" else "month") }
        DataContent(state, { select(period) }) { data ->
            val current = data.current
            val accuracy = if (current.answered > 0) current.correct * 100 / current.answered else null
            Panel {
                Small("ĐỘ CHÍNH XÁC")
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(accuracy?.let { "$it%" } ?: "—", fontSize = 42.sp, fontWeight = FontWeight.ExtraBold)
                    data.accuracyDelta?.let { Pill(String.format(Locale.ROOT, "%+.1f đ%%", it), Green, Mint) }
                }
                Small(if (data.accuracyDelta != null) "so với ${if (period == "week") "tuần" else "tháng"} trước" else "Chưa đủ dữ liệu để so sánh kỳ trước")
                Text("Hoạt động mỗi ngày · Phút học", fontWeight = FontWeight.Bold)
                val groups = if (period == "week") data.days.map { listOf(it) } else data.days.chunked(7)
                val values = groups.map { days -> days.sumOf { it.metric.durationMs } / 60000.0 }
                val maximum = (values.maxOrNull() ?: 0.0).coerceAtLeast(1.0)
                Row(Modifier.fillMaxWidth().height(170.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Bottom) {
                    values.forEachIndexed { i, value -> Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                        if (value > 0) Small(String.format(Locale.ROOT, "%.1f", value), color = Purple)
                        Box(Modifier.fillMaxWidth().height((125 * value / maximum).toFloat().coerceAtLeast(2f).dp)
                            .clip(RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp)).background(Color(0xFFDDCEF6)))
                        Small(if (period == "week") listOf("T2", "T3", "T4", "T5", "T6", "T7", "CN")[i]
                            else "${i * 7 + 1}–${(i * 7 + 7).coerceAtMost(data.days.size)}", Modifier.padding(top = 6.dp))
                    } }
                }
                Small("Thời gian học: ${studyTimeLabel(current.durationMs)}", color = Purple)
                Small("${current.sessions} phiên · ${current.answered} câu · Chuỗi học ${data.streak} ngày")
                if (current.unknownDurationSessions > 0) Small("${current.unknownDurationSessions} phiên cũ chưa có thời lượng, chưa cộng vào phút học.")
            }
            Title("Tiến bộ từng kỹ năng")
            Panel {
                skillIds.forEachIndexed { i, id ->
                    val skill = current.skills.find { it.id == id }
                    val value = if (skill != null && skill.answered > 0) skill.correct.toFloat() / skill.answered else 0f
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        IconTile(skillIcons[i], skillTints[i], skillColors[i], 36.dp)
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(skillNames[i], fontSize = 14.sp)
                                Small(if (skill != null && skill.answered > 0) "${(value * 100).toInt()}%" else "—", color = skillTints[i])
                            }
                            Progress(value, skillTints[i])
                        }
                    }
                    if (i < 3) Spacer(Modifier.height(8.dp))
                }
            }
            val progress = dashboard?.progress.orEmpty()
            val topics = catalog?.topics.orEmpty().filter { (progress[it.id] ?: 0) > 0 }
            if (topics.isNotEmpty()) {
                Title("Tiến độ luyện tập")
                topics.forEach { topic -> Panel { Text(topic.title); Small("${(progress[topic.id] ?: 0).coerceAtMost(topic.target)}/${topic.target}") } }
            }
        }
    }
}
