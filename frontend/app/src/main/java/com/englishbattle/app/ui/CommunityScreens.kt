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

@Composable fun LeaderboardScreen(back: () -> Unit) {
    var period by rememberSaveable { mutableIntStateOf(0) }
    Column(Modifier.fillMaxSize()) {
    Box(Modifier.weight(1f)) {
    Screen("Bảng xếp hạng", back) {
        Segments(listOf("Tuần", "Tháng"), period) { period = it }
        Small(if(period == 0) "05 - 11 Th10  ·  Còn 5 ngày" else "Tháng 10  ·  Còn 21 ngày", Modifier.fillMaxWidth().wrapContentWidth())
        Row(Modifier.fillMaxWidth().height(240.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Podium("Minh Anh", if(period == 0) "8,550" else "23,550", 2, R.drawable.figma_17, Modifier.weight(1f))
            Podium("Hoàng Nam", if(period == 0) "12,450" else "34,450", 1, R.drawable.figma_18, Modifier.weight(1f))
            Podium("Thảo Vy", if(period == 0) "8,220" else "21,220", 3, R.drawable.figma_19, Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("Đường đua ${if(period == 0) "tuần" else "tháng"} này", fontWeight = FontWeight.Bold); Small("128 người chơi") }
        val names = listOf("Đức Huy", "Ngọc Linh", "Quang Minh", "Bảo Trân", "Tuấn Kiệt", "Hà Phương")
        val avatars = listOf(R.drawable.figma_20,R.drawable.figma_21,R.drawable.figma_22,R.drawable.figma_23,R.drawable.figma_24,R.drawable.figma_25)
        names.forEachIndexed { i, name ->
            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Small("${i+4}")
                Art(avatars[i], Modifier.size(38.dp).clip(CircleShape))
                Text(name, Modifier.weight(1f), fontWeight = FontWeight.Bold, fontSize = 14.sp)
                Column(horizontalAlignment = Alignment.End) { Text("${8760-i*220 + period*10000}", color = Purple, fontWeight = FontWeight.Bold); Small("điểm") }
            }
            HorizontalDivider(color = Line)
        }
    }
    }
        Row(Modifier.padding(horizontal = 24.dp, vertical = 8.dp).fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Purple).padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("27", color = Color.White, fontWeight = FontWeight.Bold)
            Art(R.drawable.figma_09, Modifier.size(40.dp).clip(CircleShape))
            Column(Modifier.weight(1f)) { Text("Khánh An (Bạn)", color = Color.White, fontWeight = FontWeight.Bold); Small("Tiếp tục bứt phá nhé!", color = Color.White.copy(alpha=.75f)) }
            Text("3,240", color = Color.White, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable private fun Podium(name: String, points: String, rank: Int, avatar: Int, modifier: Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
        if(rank == 1) Text("♛", color = Color(0xFFE8B64B), fontSize = 28.sp)
        Art(avatar, Modifier.size(if(rank == 1) 76.dp else 56.dp).border(3.dp, if(rank == 1) Color(0xFFF0CA77) else Lavender, CircleShape).padding(4.dp).clip(CircleShape))
        Text(name, fontWeight = FontWeight.ExtraBold, fontSize = 12.sp, textAlign = TextAlign.Center)
        Text("$points điểm", color = Purple, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        Box(Modifier.fillMaxWidth().height(if(rank==1) 62.dp else if(rank==2) 42.dp else 30.dp).clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp))
            .background(if(rank==1) Purple else Color(0xFFD9C7F7)), contentAlignment = Alignment.Center) {
            Text("$rank", color = if(rank==1) Color.White else Purple, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
        }
    }
}

@Composable fun ProgressScreen(back: () -> Unit) {
    var period by rememberSaveable { mutableIntStateOf(0) }
    Screen("Tiến độ của tôi", back) {
        Segments(listOf("Tuần", "Tháng"), period) { period = it }
        Panel {
            Small("ĐỘ CHÍNH XÁC")
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(if(period == 0) "78%" else "82%", fontSize = 42.sp, fontWeight = FontWeight.ExtraBold)
                Pill("↗ +12%", Green, Mint)
            }
            Small("so với ${if(period==0) "tuần" else "tháng"} trước")
            Spacer(Modifier.height(4.dp))
            Text("Hoạt động mỗi ngày", fontWeight = FontWeight.Bold)
            val heights = if(period == 0) listOf(.28f,.46f,.33f,.61f,.51f,.76f,.56f) else listOf(.4f,.63f,.54f,.87f)
            Row(Modifier.fillMaxWidth().height(155.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.Bottom) {
                heights.forEachIndexed { i, value ->
                    Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                        if(i == heights.lastIndex-1) Small("55", color = Purple)
                        Box(Modifier.fillMaxWidth().height(125.dp * value).clip(RoundedCornerShape(topStart=6.dp,topEnd=6.dp))
                            .background(if(i == heights.lastIndex-1) Purple else Color(0xFFDDCEF6)))
                        Small(if(period==0) listOf("T2","T3","T4","T5","T6","T7","CN")[i] else "T${i+1}", Modifier.padding(top=6.dp))
                    }
                }
            }
        }
        Column { Title("Tiến bộ từng kỹ năng"); Small("Mỗi ngày một bước, bạn đang làm rất tốt!") }
        Panel {
            listOf(.85f,.72f,.68f,.8f).forEachIndexed { i,value ->
                Row(verticalAlignment=Alignment.CenterVertically, horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                    IconTile(skillIcons[i],skillTints[i],skillColors[i],36.dp)
                    Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement=Arrangement.SpaceBetween) { Text(skillNames[i], fontSize=14.sp); Small("${(value*100).toInt()}%",color=skillTints[i]) }
                        Progress(value, skillTints[i])
                    }
                }
                if(i<3) Spacer(Modifier.height(8.dp))
            }
        }
    }
}

@Composable fun AchievementsScreen(back: () -> Unit) {
    val titles=listOf("Chiến thắng đầu tiên","Chuỗi bất bại","Ngôi sao đang lên","Không ngừng thử sức","Bậc thầy chiến thắng","Thử thách gia")
    val descriptions=listOf("Giành chiến thắng đầu tiên.","Thắng 3 trận liên tiếp.","Giành chiến thắng 10 trận.","Hoàn thành 20 trận đấu.","Giành chiến thắng trong 50 trận.","Hoàn thành 7 thử thách mỗi ngày.")
    val icons=listOf(Icons.Outlined.EmojiEvents,Icons.Outlined.LocalFireDepartment,Icons.Outlined.StarOutline,Icons.Outlined.SportsEsports,Icons.Outlined.WorkspacePremium,Icons.Outlined.Bolt)
    Screen("Thành tích", back) {
        Panel(color=Lavender) {
            Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(14.dp)) {
                IconTile(Icons.Outlined.EmojiEvents,Color.White,Purple,58.dp)
                Column { Small("BỘ SƯU TẬP CỦA BẠN",color=Purple); Title("2 / 6 huy hiệu") }
            }
            Progress(2/6f)
            Small("Mỗi trận đấu, một bước gần vinh quang!",color=Purple)
        }
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) { Text("Hành trình của bạn",fontWeight=FontWeight.Bold); Small("6 thành tích") }
        titles.forEachIndexed { i,title ->
            Panel {
                Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(14.dp)) {
                    IconTile(icons[i],if(i==0) Color(0xFFCCA83D) else if(i==1) Green else Muted,if(i==0) Yellow else if(i==1) Mint else Line,58.dp)
                    Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(4.dp)) {
                        Text(title,fontWeight=FontWeight.Bold,color=if(i<2) Ink else Muted)
                        Small(descriptions[i])
                        if(i<2) Small("Đã mở khóa",color=if(i==0) Color(0xFFAE9038) else Green)
                        else { Progress(if(i==2) .4f else if(i==3) .6f else .12f); Small(if(i==2) "4 / 10 trận" else if(i==3) "12 / 20 trận" else "Tiếp tục cố gắng!",color=Purple) }
                    }
                }
            }
        }
    }
}
