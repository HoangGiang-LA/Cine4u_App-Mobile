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
                    if (page.entries.isEmpty()) EmptyPanel("Chưa có người chơi trên bảng xếp hạng.")
                    else Row(Modifier.fillMaxWidth().heightIn(min = 240.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf(2, 1, 3).forEach { rank ->
                            val entry = page.entries.find { it.rank == rank }
                            if (entry == null) Spacer(Modifier.weight(1f)) else Podium(entry, Modifier.weight(1f))
                        }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Thứ hạng hiện tại", fontWeight = FontWeight.Bold)
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
                            val target = item.threshold.coerceAtLeast(1)
                            val completed = item.progress.coerceIn(0, target)
                            Progress(completed.toFloat() / target)
                            Small("$completed / $target", color = Purple)
                        }
                    }
                }
            } }
        }
    }
}
@Composable fun WalletScreen(state: LoadState<Dashboard>, ledger: LoadState<LedgerPage>, back: () -> Unit, retry: () -> Unit, more: () -> Unit) {
    Screen("Ví xu", back) {
        DataContent(state, retry) { d ->
            Panel(color = Yellow) { Title("${d.coins} xu"); Small("Xu tích lũy từ hoạt động hợp lệ. Chức năng đổi thưởng chưa được mở.") }
            Title("Lịch sử xu")
            DataContent(ledger, retry) { page ->
                if (page.entries.isEmpty()) EmptyPanel("Chưa có giao dịch xu.")
                page.entries.forEach { item -> Panel { Text(item.label); Text("${signed(item.delta)} xu", color = Green); Small(dateLabel(item.createdAt)) } }
                if (page.nextCursor != null) Primary("Xem thêm giao dịch", enabled = !ledger.loading, onClick = more)
            }
        }
    }
}
