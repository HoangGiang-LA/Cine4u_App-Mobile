package com.englishbattle.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.*
import com.englishbattle.app.R
import com.englishbattle.app.data.*
import java.time.*

@Composable fun LeaderboardScreen(state: LoadState<LeaderboardPage>, period: String, back: () -> Unit,
    select: (String) -> Unit, more: () -> Unit) {
    Column(Modifier.fillMaxSize()) {
        Box(Modifier.weight(1f)) {
            Screen("Bảng xếp hạng", back) {
                Segments(listOf("Tuần", "Tháng"), if (period == "week") 0 else 1) { select(if (it == 0) "week" else "month") }
                DataContent(state, { select(period) }) { page ->
                    Small(page.title, Modifier.fillMaxWidth().wrapContentWidth())
                    if (page.entries.isEmpty()) EmptyPanel("Chưa có người chơi trong kỳ này.")
                    else Row(Modifier.fillMaxWidth().heightIn(min = 240.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf(2, 1, 3).forEach { rank ->
                            val entry = page.entries.find { it.rank == rank }
                            if (entry == null) Spacer(Modifier.weight(1f)) else Podium(entry, Modifier.weight(1f))
                        }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Đường đua ${if (period == "week") "tuần" else "tháng"} này", fontWeight = FontWeight.Bold)
                    }
                    page.entries.filter { it.rank > 3 }.forEach { entry ->
                        Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Small(entry.rank.toString())
                            Art(rankAvatar(entry.rank), Modifier.size(38.dp).clip(CircleShape))
                            Text(entry.name, Modifier.weight(1f), fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Column(horizontalAlignment = Alignment.End) { Text(entry.rating.toString(), color = Purple, fontWeight = FontWeight.Bold); Small("điểm") }
                        }
                        HorizontalDivider(color = Line)
                    }
                    if (page.nextCursor != null) Primary("Xem thêm", enabled = !state.loading, onClick = more)
                }
            }
        }
        state.data?.self?.let { self ->
            Row(Modifier.padding(horizontal = 24.dp, vertical = 8.dp).fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Purple).padding(16.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(self.rank.toString(), color = Color.White, fontWeight = FontWeight.Bold)
                Art(R.drawable.figma_09, Modifier.size(40.dp).clip(CircleShape))
                Column(Modifier.weight(1f)) { Text(self.name, color = Color.White, fontWeight = FontWeight.Bold); Small("Tiếp tục bứt phá nhé!", color = Color.White.copy(alpha = .75f)) }
                Text(self.rating.toString(), color = Color.White, fontWeight = FontWeight.Bold)
            }
        }
    }
}
private fun rankAvatar(rank: Int) = listOf(R.drawable.figma_18, R.drawable.figma_17, R.drawable.figma_19, R.drawable.figma_20,
    R.drawable.figma_21, R.drawable.figma_22, R.drawable.figma_23, R.drawable.figma_24, R.drawable.figma_25)[(rank - 1).coerceAtLeast(0) % 9]
@Composable private fun Podium(entry: LeaderboardEntry, modifier: Modifier) {
    val rank = entry.rank
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
        if (rank == 1) Text("♛", color = Color(0xFFE8B64B), fontSize = 28.sp)
        Art(rankAvatar(rank), Modifier.size(if (rank == 1) 76.dp else 56.dp).border(3.dp, if (rank == 1) Color(0xFFF0CA77) else Lavender, CircleShape).padding(4.dp).clip(CircleShape))
        Text(entry.name, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp, textAlign = TextAlign.Center)
        Text("${entry.rating} điểm", color = Purple, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        Box(Modifier.fillMaxWidth().height(if (rank == 1) 62.dp else if (rank == 2) 42.dp else 30.dp)
            .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp)).background(if (rank == 1) Purple else Color(0xFFD9C7F7)), contentAlignment = Alignment.Center) {
            Text(rank.toString(), color = if (rank == 1) Color.White else Purple, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
        }
    }
}

@Composable fun ProgressScreen(state: LoadState<Dashboard>, catalog: Catalog?, back: () -> Unit, retry: () -> Unit) {
    var period by rememberSaveable { mutableIntStateOf(0) }
    Screen("Tiến độ của tôi", back) {
        Segments(listOf("Tuần", "Tháng"), period) { period = it }
        DataContent(state, retry) { d ->
            val zone = ZoneId.of("Asia/Ho_Chi_Minh")
            val today = LocalDate.now(zone)
            val start = if (period == 0) today.minusDays((today.dayOfWeek.value - 1).toLong()) else today.withDayOfMonth(1)
            val next = if (period == 0) start.plusWeeks(1) else start.plusMonths(1)
            val previous = if (period == 0) start.minusWeeks(1) else start.minusMonths(1)
            val all = d.history.filter { it.outcome !in listOf("abandoned", "left") }
            fun date(r: QuizResult) = Instant.ofEpochMilli(r.completedAt).atZone(zone).toLocalDate()
            val current = all.filter { date(it) >= start && date(it) < next }
            val before = all.filter { date(it) >= previous && date(it) < start }
            val count = current.sumOf { it.total }
            val accuracy = if (count > 0) current.sumOf { it.correct } * 100 / count else null
            val beforeTotal = before.sumOf { it.total }
            val beforeAccuracy = if (beforeTotal > 0) before.sumOf { it.correct } * 100 / beforeTotal else null
            Panel {
                Small("ĐỘ CHÍNH XÁC")
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(accuracy?.let { "$it%" } ?: "—", fontSize = 42.sp, fontWeight = FontWeight.ExtraBold)
                    if (accuracy != null && beforeAccuracy != null) Pill("↗ ${signed(accuracy - beforeAccuracy)}%", Green, Mint)
                }
                Small(if (beforeAccuracy != null) "so với ${if (period == 0) "tuần" else "tháng"} trước" else "Chưa có dữ liệu kỳ trước")
                Text("Hoạt động mỗi ngày", fontWeight = FontWeight.Bold)
                val slots = if (period == 0) 7 else (today.lengthOfMonth() + 6) / 7
                val values = (0 until slots).map { i -> current.count {
                    if (period == 0) date(it) == start.plusDays(i.toLong()) else (date(it).dayOfMonth - 1) / 7 == i
                } }
                val maximum = (values.maxOrNull() ?: 0).coerceAtLeast(1)
                Row(Modifier.fillMaxWidth().height(155.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.Bottom) {
                    values.forEachIndexed { i, value -> Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                        if (value > 0) Small(value.toString(), color = Purple)
                        Box(Modifier.fillMaxWidth().height((125f * value / maximum).coerceAtLeast(2f).dp).clip(RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp))
                            .background(if (value == maximum && value > 0) Purple else Color(0xFFDDCEF6)))
                        Small(if (period == 0) listOf("T2", "T3", "T4", "T5", "T6", "T7", "CN")[i] else "T${i + 1}", Modifier.padding(top = 6.dp))
                    } }
                }
                Small("Theo các hoạt động đã tải · Chuỗi học ${d.streak} ngày")
            }
            Column { Title("Tiến bộ từng kỹ năng"); Small("Mỗi ngày một bước, bạn đang làm rất tốt!") }
            Panel {
                skillIds.forEachIndexed { i, id ->
                    val skill = d.skills.find { it.id == id }
                    val value = if (skill != null && skill.answered > 0) skill.correct.toFloat() / skill.answered else 0f
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        IconTile(skillIcons[i], skillTints[i], skillColors[i], 36.dp)
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(skillNames[i], fontSize = 14.sp); Small(if (skill != null && skill.answered > 0) "${(value * 100).toInt()}%" else "—", color = skillTints[i]) }
                            Progress(value, skillTints[i])
                        }
                    }
                    if (i < 3) Spacer(Modifier.height(8.dp))
                }
            }
            if (!catalog?.topics.isNullOrEmpty()) {
                Title("Tiến độ luyện tập")
                catalog?.topics?.filter { (d.progress[it.id] ?: 0) > 0 }?.forEach { topic ->
                    Panel { Text(topic.title); Small("${(d.progress[topic.id] ?: 0).coerceAtMost(topic.target)}/${topic.target}") }
                }
            }
        }
    }
}
@Composable fun AchievementsScreen(state: LoadState<Dashboard>, back: () -> Unit, retry: () -> Unit) {
    val icons = listOf(Icons.Outlined.EmojiEvents, Icons.Outlined.LocalFireDepartment, Icons.Outlined.StarOutline, Icons.Outlined.SportsEsports, Icons.Outlined.WorkspacePremium, Icons.Outlined.Bolt)
    Screen("Thành tích", back) {
        DataContent(state, retry) { d ->
            Panel(color = Lavender) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    IconTile(Icons.Outlined.EmojiEvents, Color.White, Purple, 58.dp)
                    Column { Small("BỘ SƯU TẬP CỦA BẠN", color = Purple); Title("${d.achievements.count { it.unlocked }} / ${d.achievements.size} huy hiệu") }
                }
                Progress(if (d.achievements.isNotEmpty()) d.achievements.count { it.unlocked }.toFloat() / d.achievements.size else 0f)
                Small("Mỗi trận đấu, một bước gần vinh quang!", color = Purple)
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("Hành trình của bạn", fontWeight = FontWeight.Bold); Small("${d.achievements.size} thành tích") }
            if (d.achievements.isEmpty()) EmptyPanel("Chưa có danh sách thành tích.")
            d.achievements.forEachIndexed { i, item -> Panel {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    IconTile(icons[i % icons.size], if (item.unlocked) Green else Muted, if (item.unlocked) Mint else Line, 58.dp)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(item.title, fontWeight = FontWeight.Bold, color = if (item.unlocked) Ink else Muted)
                        Small(item.description)
                        if (item.unlocked) Small("Đã mở khóa", color = Green)
                        else {
                            val completed = d.progress[item.id] ?: 0
                            Progress(completed.toFloat() / GameRules.PRACTICE_TARGET)
                            Small(if (completed > 0) "$completed / 20 lần" else "Tiếp tục cố gắng!", color = Purple)
                        }
                    }
                }
            } }
        }
    }
}
@Composable fun WalletScreen(state: LoadState<Dashboard>, back: () -> Unit, retry: () -> Unit) {
    Screen("Ví xu", back) {
        DataContent(state, retry) { d ->
            Panel(color = Yellow) { Title("${d.coins} xu"); Small("Xu tích lũy từ hoạt động hợp lệ. Chức năng đổi thưởng chưa được mở.") }
            Title("Lịch sử xu")
            if (d.ledger.isEmpty()) EmptyPanel("Chưa có giao dịch xu.")
            d.ledger.forEach { item -> Panel { Text(item.label); Text("${signed(item.delta)} xu", color = Green); Small(dateLabel(item.createdAt)) } }
        }
    }
}
