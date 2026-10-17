package com.englishbattle.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.*
import com.englishbattle.app.R

@Composable fun HomeScreen(name: String, go: (Route) -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Art(R.drawable.figma_02, Modifier.size(46.dp).clip(CircleShape).clickable { go(Route.Profile) }, "Hồ sơ")
            Column(Modifier.weight(1f)) {
                Text("Xin chào, $name! 👋", fontWeight = FontWeight.ExtraBold, fontSize = 17.sp)
                Small("Cùng học điều mới nào!")
            }
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) { Pill("♧ Lv. 12"); Pill("★ 1,200", Color(0xFFA27B20), Yellow) }
        }
        Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(Color(0xFFFFE5BA)).clickable { go(Route.Challenge) }.padding(18.dp)) {
            Column(Modifier.fillMaxWidth(.66f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("QUÀ MỖI NGÀY", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF976B31))
                Text("Thử thách hôm nay", style = MaterialTheme.typography.titleLarge, color = Color(0xFF71502B))
                Small("Hoàn thành 1 câu hỏi, nhận ngay\nhộp bất ngờ!", color = Color(0xFF997449))
                Button({ go(Route.Challenge) }, shape = RoundedCornerShape(12.dp), contentPadding = PaddingValues(horizontal = 13.dp, vertical = 8.dp)) {
                    Text("Mở thử thách  →", fontSize = 12.sp, color = Color.White)
                }
            }
            Column(Modifier.align(Alignment.TopEnd), horizontalAlignment = Alignment.End) {
                Pill("⚡ +50 XP", Color(0xFF906821), Color(0xFFFFF4DC))
                Art(R.drawable.figma_03, Modifier.size(105.dp).padding(top = 16.dp))
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Title("Học theo cách của bạn"); Text("✧", color = Purple, fontSize = 24.sp) }
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            HomeCard("Thi đấu", "Thách đấu cùng bạn bè", "1 đấu 1", R.drawable.figma_04, Lavender, Modifier.weight(1f)) { go(Route.Battle) }
            HomeCard("Luyện tập", "Giỏi hơn mỗi ngày", "+20 XP", R.drawable.figma_05, Color(0xFFDEF3D7), Modifier.weight(1f)) { go(Route.Practice) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            HomeCard("Bài kiểm tra", "Khám phá năng lực của bạn", "10 câu", R.drawable.figma_06, Color(0xFFDCEEFF), Modifier.weight(1f)) { go(Route.Quiz) }
            HomeCard("Xếp hạng", "Chinh phục bảng vàng", "Top 100", R.drawable.figma_07, Yellow, Modifier.weight(1f)) { go(Route.Leaderboard) }
        }
    }
}

@Composable private fun HomeCard(title: String, subtitle: String, badge: String, art: Int, bg: Color, modifier: Modifier, click: () -> Unit) {
    Column(modifier.clip(RoundedCornerShape(24.dp)).background(bg).clickable(onClick = click).padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Pill(badge, Ink.copy(alpha = .6f), Color.White.copy(alpha = .55f))
        Art(art, Modifier.fillMaxWidth().height(78.dp))
        Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp)
        Text(subtitle, fontSize = 10.sp, color = Ink.copy(alpha = .6f))
    }
}

@Composable fun ChallengeScreen(back: () -> Unit, start: () -> Unit) {
    Screen("Thử thách hôm nay", back) {
        Art(R.drawable.figma_08, Modifier.fillMaxWidth().aspectRatio(1.25f).clip(RoundedCornerShape(25.dp)), scale = androidx.compose.ui.layout.ContentScale.Crop)
        Text("Chuỗi ngày luyện tập", Modifier.fillMaxWidth(), style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
        Text("Chỉ 5 phút mỗi ngày,\nđể tiến bộ hơn hôm qua.", Modifier.fillMaxWidth(), color = Muted, textAlign = TextAlign.Center)
        Primary("Bắt đầu", onClick = start)
        Panel {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("Tuần của bạn", fontWeight = FontWeight.Bold); Small("2 ngày liên tiếp", color = Purple) }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                listOf("T2", "T3", "T4", "T5", "T6", "T7", "CN").forEachIndexed { i, day ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(Modifier.size(31.dp).clip(CircleShape).background(if (i == 2) Purple else Color.Transparent), contentAlignment = Alignment.Center) {
                            Icon(Icons.Outlined.LocalFireDepartment, null, Modifier.size(25.dp), tint = if(i == 2) Color.White else if(i < 2) Color(0xFFF4CB8E) else Line)
                        }
                        Small(day)
                    }
                }
            }
        }
    }
}

val skillNames = listOf("Từ vựng", "Ngữ pháp", "Nghe", "Đọc hiểu")
val skillIcons = listOf(Icons.Outlined.Spellcheck, Icons.Outlined.Extension, Icons.Outlined.Headphones, Icons.Outlined.MenuBook)
val skillColors = listOf(Lavender, Peach, Mint, Blue)
val skillTints = listOf(Purple, Color(0xFFD9A258), Color(0xFF69A47C), Color(0xFF77A4CD))

@Composable fun PracticeScreen(back: () -> Unit, choose: (String) -> Unit) {
    Screen("Luyện tập", back) {
        Small("Chọn kỹ năng bạn muốn luyện", Modifier.fillMaxWidth().wrapContentWidth())
        Spacer(Modifier.height(8.dp))
        for (row in 0..1) Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            for (col in 0..1) {
                val i = row * 2 + col
                Column(Modifier.weight(1f).clip(RoundedCornerShape(25.dp)).background(skillColors[i]).clickable { choose(skillNames[i]) }
                    .padding(vertical = 24.dp, horizontal = 12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(15.dp)) {
                    IconTile(skillIcons[i], skillTints[i], skillTints[i].copy(alpha = .13f), 64.dp)
                    Text(skillNames[i], style = MaterialTheme.typography.titleMedium)
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Art(R.drawable.mascot_reading, Modifier.fillMaxWidth().height(150.dp))
        Text("Luyện tập mỗi ngày\nđể trở nên mạnh hơn!", Modifier.fillMaxWidth(), fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
    }
}

@Composable fun TopicsScreen(category: String, back: () -> Unit, choose: (String) -> Unit) {
    val titles = when(category) {
        "Ngữ pháp" -> listOf("Thì (Tenses)", "Giới từ (Prepositions)", "Mạo từ (Articles)", "Danh từ (Nouns)", "Động từ (Verbs)", "Tính từ (Adjectives)")
        "Nghe" -> listOf("Hội thoại hằng ngày", "Du lịch", "Công việc", "Giáo dục", "Ăn uống", "Sức khỏe")
        "Đọc hiểu" -> listOf("Đời sống hằng ngày", "Du lịch", "Khoa học & Công nghệ", "Giáo dục", "Văn hóa & Xã hội", "Sức khỏe")
        else -> listOf("Đời sống hằng ngày", "Du lịch", "Công việc", "Ăn uống", "Học tập", "Sức khỏe")
    }
    val icons: List<ImageVector> = if (category == "Ngữ pháp") listOf(Icons.Outlined.Schedule, Icons.Outlined.Widgets, Icons.Outlined.AlternateEmail, Icons.Outlined.People, Icons.Outlined.Bolt, Icons.Outlined.AutoAwesome)
        else listOf(if(category == "Nghe") Icons.Outlined.ChatBubbleOutline else Icons.Outlined.Home, Icons.Outlined.Flight, Icons.Outlined.WorkOutline, Icons.Outlined.MenuBook, Icons.Outlined.Restaurant, Icons.Outlined.HealthAndSafety)
    val colors = listOf(Lavender, Blue, Peach, Rose, Mint, Rose)
    val tints = listOf(Purple, Color(0xFF7BA5C8), Color(0xFFD4A256), Color(0xFFCE9988), Color(0xFF71A580), Color(0xFFC284A0))
    Screen(if(category == "Nghe") "Luyện nghe" else category, back) {
        Small("Chọn chủ đề bạn muốn ${if(category == "Nghe") "luyện nghe" else if(category == "Đọc hiểu") "luyện đọc" else "học"}", Modifier.fillMaxWidth().wrapContentWidth())
        Spacer(Modifier.height(4.dp))
        titles.forEachIndexed { i, title -> MenuRow(title, "0/20", icons[i], tints[i], colors[i]) { choose(title) } }
    }
}
