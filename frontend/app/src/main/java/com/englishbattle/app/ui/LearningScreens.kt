package com.englishbattle.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.*
import com.englishbattle.app.R
import com.englishbattle.app.data.*

@Composable fun HomeScreen(name: String, dashboard: LoadState<Dashboard>, active: AttemptState?, hasPending: Boolean,
    hasMatch: Boolean, go: (Route) -> Unit, resume: () -> Unit, retry: () -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Art(R.drawable.figma_02, Modifier.size(46.dp).clip(CircleShape).clickable { go(Route.Profile) }, "Hồ sơ")
            Column(Modifier.weight(1f)) {
                Text("Xin chào, $name! 👋", fontWeight = FontWeight.ExtraBold, fontSize = 17.sp)
                Small("Cùng học điều mới nào!")
            }
            Box(Modifier.clickable { go(Route.Wallet) }) { Pill("★ ${dashboard.data?.coins?.toString() ?: "—"}", Color(0xFFA27B20), Yellow) }
        }
        if (dashboard.loading && dashboard.data == null) LinearProgressIndicator(Modifier.fillMaxWidth(), color = Purple)
        dashboard.error?.let { ErrorPanel(it, retry) }
        if (hasPending) Panel(color = Mint) {
            Small("${active?.mode?.title ?: "Phiên"} đang dở", color = Green)
            Secondary("Tiếp tục phiên đang dở", onClick = resume)
        }
        if (hasMatch) Secondary("Mở yêu cầu tìm trận") { go(Route.Matching) }
        Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(Color(0xFFFFE5BA)).clickable { go(Route.Challenge) }.padding(18.dp)) {
            Column(Modifier.fillMaxWidth(.68f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("QUÀ MỖI NGÀY", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF976B31))
                Text("Thử thách hôm nay", style = MaterialTheme.typography.titleLarge, color = Color(0xFF71502B))
                Small("Hoàn thành 5 câu hỏi, nhận ngay\n2 xu mỗi ngày!", color = Color(0xFF997449))
                Button({ go(Route.Challenge) }, shape = RoundedCornerShape(12.dp), contentPadding = PaddingValues(horizontal = 13.dp, vertical = 8.dp)) {
                    Text("Mở thử thách  →", fontSize = 12.sp, color = Color.White)
                }
            }
            Art(R.drawable.figma_03, Modifier.align(Alignment.CenterEnd).size(94.dp).padding(top = 20.dp))
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Title("Học theo cách của bạn"); Text("✧", color = Purple, fontSize = 24.sp) }
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            HomeCard("Thi đấu", "Thách đấu cùng bạn bè", "1 đấu 1", R.drawable.figma_04, Lavender, Modifier.weight(1f)) { go(Route.Battle) }
            HomeCard("Luyện tập", "Giỏi hơn mỗi ngày", null, R.drawable.figma_05, Color(0xFFDEF3D7), Modifier.weight(1f)) { go(Route.Practice) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            HomeCard("Bài kiểm tra", "Khám phá năng lực của bạn", "20 câu", R.drawable.figma_06, Color(0xFFDCEEFF), Modifier.weight(1f)) { go(Route.Test) }
            HomeCard("Xếp hạng", "Chinh phục bảng vàng", "Top 100", R.drawable.figma_07, Yellow, Modifier.weight(1f)) { go(Route.Leaderboard) }
        }
    }
}
@Composable private fun HomeCard(title: String, subtitle: String, badge: String?, art: Int, bg: Color, modifier: Modifier, click: () -> Unit) {
    Column(modifier.clip(RoundedCornerShape(24.dp)).background(bg).clickable(onClick = click).padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
        if (badge != null) Pill(badge, Ink.copy(alpha = .6f), Color.White.copy(alpha = .55f)) else Spacer(Modifier.height(24.dp))
        Art(art, Modifier.fillMaxWidth().height(78.dp))
        Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp)
        Text(subtitle, fontSize = 10.sp, color = Ink.copy(alpha = .6f))
    }
}

val skillNames = listOf("Từ vựng", "Ngữ pháp", "Nghe", "Đọc hiểu")
val skillIds = listOf("vocabulary", "grammar", "listening", "reading")
val skillIcons = listOf(Icons.Outlined.Spellcheck, Icons.Outlined.Extension, Icons.Outlined.Headphones, Icons.Outlined.MenuBook)
val skillColors = listOf(Lavender, Peach, Mint, Blue)
val skillTints = listOf(Purple, Color(0xFFD9A258), Color(0xFF69A47C), Color(0xFF77A4CD))
fun skillIcon(id: String) = skillIcons[skillIds.indexOf(id).coerceAtLeast(0)]

@Composable fun PracticeScreen(state: LoadState<Catalog>, back: () -> Unit, retry: () -> Unit, choose: (Category) -> Unit) {
    Screen("Luyện tập", back) {
        Small("Chọn kỹ năng bạn muốn luyện", Modifier.fillMaxWidth().wrapContentWidth())
        Spacer(Modifier.height(8.dp))
        DataContent(state, retry) { catalog ->
            if (catalog.categories.isEmpty()) EmptyPanel("Chưa có kỹ năng được xuất bản.")
            catalog.categories.chunked(2).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    row.forEach { c ->
                        val i = skillIds.indexOf(c.id).coerceAtLeast(0)
                        Column(Modifier.weight(1f).clip(RoundedCornerShape(25.dp)).background(skillColors[i]).clickable { choose(c) }
                            .padding(vertical = 24.dp, horizontal = 12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(15.dp)) {
                            IconTile(skillIcons[i], skillTints[i], skillTints[i].copy(alpha = .13f), 64.dp)
                            Text(c.name, style = MaterialTheme.typography.titleMedium)
                        }
                    }
                    if (row.size == 1) Spacer(Modifier.weight(1f))
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Art(R.drawable.mascot_reading, Modifier.fillMaxWidth().height(150.dp))
        Text("Luyện tập mỗi ngày\nđể trở nên mạnh hơn!", Modifier.fillMaxWidth(), fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
    }
}
@Composable fun TopicsScreen(categoryId: String, state: LoadState<Catalog>, dashboard: Dashboard?, back: () -> Unit,
    retry: () -> Unit, choose: (Topic) -> Unit) {
    val colors = listOf(Lavender, Blue, Peach, Rose, Mint, Rose)
    val tints = listOf(Purple, Color(0xFF7BA5C8), Color(0xFFD4A256), Color(0xFFCE9988), Color(0xFF71A580), Color(0xFFC284A0))
    val icons: List<ImageVector> = if (categoryId == "grammar") listOf(Icons.Outlined.Schedule, Icons.Outlined.Widgets, Icons.Outlined.AlternateEmail, Icons.Outlined.People, Icons.Outlined.Bolt, Icons.Outlined.AutoAwesome)
        else listOf(if (categoryId == "listening") Icons.Outlined.ChatBubbleOutline else Icons.Outlined.Home, Icons.Outlined.Flight, Icons.Outlined.WorkOutline, Icons.Outlined.MenuBook, Icons.Outlined.Restaurant, Icons.Outlined.HealthAndSafety, Icons.Outlined.Translate)
    Screen(if (categoryId == "listening") "Luyện nghe" else state.data?.categories?.find { it.id == categoryId }?.name ?: "Chủ đề", back) {
        Small("Chọn chủ đề bạn muốn ${if (categoryId == "listening") "luyện nghe" else if (categoryId == "reading") "luyện đọc" else "học"}", Modifier.fillMaxWidth().wrapContentWidth())
        Spacer(Modifier.height(4.dp))
        DataContent(state, retry) { catalog ->
            val topics = catalog.topics.filter { it.categoryId == categoryId }
            if (topics.isEmpty()) EmptyPanel("Chưa có chủ đề được xuất bản trong kỹ năng này.")
            topics.forEachIndexed { i, t ->
                val count = dashboard?.progress?.get(t.id) ?: if (dashboard != null) 0 else null
                MenuRow(t.title, "${count?.coerceAtMost(t.target)?.toString() ?: "—"}/${t.target}", icons[i % icons.size], tints[i % tints.size], colors[i % colors.size]) { choose(t) }
            }
        }
    }
}
@Composable fun AttemptIntroScreen(mode: QuizMode, topic: Topic?, state: LoadState<Dashboard>, busy: Boolean,
    back: () -> Unit, retry: () -> Unit, start: () -> Unit, resume: (String) -> Unit) {
    Screen(mode.title, back) {
        if (mode == QuizMode.DAILY) {
            Art(R.drawable.figma_08, Modifier.fillMaxWidth().aspectRatio(1.25f).clip(RoundedCornerShape(25.dp)), scale = androidx.compose.ui.layout.ContentScale.Crop)
            Text("Chuỗi ngày luyện tập", Modifier.fillMaxWidth(), style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
            Text("Chỉ 5 phút mỗi ngày,\nđể tiến bộ hơn hôm qua.", Modifier.fillMaxWidth(), color = Muted, textAlign = TextAlign.Center)
            DataContent(state, retry) { d ->
                when (d.daily.status) {
                    "available" -> Primary("Bắt đầu", enabled = !busy, onClick = start)
                    "active", "waiting" -> Primary("Tiếp tục thử thách", enabled = !busy) { d.daily.attemptId?.let(resume) }
                    "completed" -> EmptyPanel("Bạn đã hoàn thành thử thách hôm nay. Hãy quay lại vào ngày mai.")
                    else -> EmptyPanel("Bạn đã dùng lượt hôm nay. Hãy quay lại vào ngày mai.")
                }
                WeekStreak(d)
            }
            Small("5 câu · 30 giây/câu · Hoàn thành +2 xu · Một lượt/ngày", Modifier.fillMaxWidth().wrapContentWidth())
        } else {
            Art(if (mode == QuizMode.TEST) R.drawable.figma_06 else R.drawable.mascot_reading, Modifier.fillMaxWidth().height(190.dp))
            Text(topic?.title ?: mode.title, Modifier.fillMaxWidth(), style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
            Panel {
                Text("${mode.count} câu hỏi · ${GameRules.QUESTION_SECONDS} giây/câu")
                Small("Hoàn thành hợp lệ: +${mode.coins} xu. Đồng hồ tiếp tục chạy khi chuyển ứng dụng.")
            }
            Primary(if (busy) "Đang bắt đầu..." else "Bắt đầu", enabled = !busy, onClick = start)
        }
    }
}
@Composable private fun WeekStreak(d: Dashboard) {
    val today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"))
    val monday = today.minusDays((today.dayOfWeek.value - 1).toLong())
    val learned = d.studyDates.map { java.time.LocalDate.parse(it) }.toSet()
    Panel {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("Tuần của bạn", fontWeight = FontWeight.Bold); Small("${d.studyStreak} ngày liên tiếp", color = Purple) }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            listOf("T2", "T3", "T4", "T5", "T6", "T7", "CN").forEachIndexed { i, day ->
                val date = monday.plusDays(i.toLong())
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.size(31.dp).clip(CircleShape).background(if (date == today) Purple else Color.Transparent), contentAlignment = Alignment.Center) {
                        Icon(Icons.Outlined.LocalFireDepartment, null, Modifier.size(25.dp), tint = if (date == today) Color.White else if (date in learned) Color(0xFFF4CB8E) else Line)
                    }
                    Small(day)
                }
            }
        }
    }
}
