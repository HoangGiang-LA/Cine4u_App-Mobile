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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.*
import com.englishbattle.app.R
import kotlinx.coroutines.delay

@Composable fun MascotFace(cat: Boolean, modifier: Modifier = Modifier) {
    androidx.compose.foundation.Canvas(modifier) {
        val w=size.width; val h=size.height
        val fur=if(cat) Color(0xFFB1A0D2) else Color(0xFFF1BA70)
        val outline=if(cat) Color(0xFF7E709D) else Color(0xFFB68552)
        val ears=Path().apply { moveTo(w*.13f,h*.48f); lineTo(w*.12f,h*.05f); lineTo(w*.4f,h*.25f); lineTo(w*.6f,h*.25f); lineTo(w*.88f,h*.05f); lineTo(w*.87f,h*.5f); close() }
        drawPath(ears,fur);drawPath(ears,outline,style=Stroke(w*.025f))
        drawOval(fur,Offset(w*.08f,h*.2f),Size(w*.84f,h*.73f))
        drawOval(outline,Offset(w*.08f,h*.2f),Size(w*.84f,h*.73f),style=Stroke(w*.025f))
        drawOval(Color(0xFFFFF5DE),Offset(w*.19f,h*.51f),Size(w*.63f,h*.38f))
        drawCircle(Color(0xFF654937),w*.04f,Offset(w*.34f,h*.52f));drawCircle(Color(0xFF654937),w*.04f,Offset(w*.67f,h*.52f))
        drawOval(Color(0xFF6E503D),Offset(w*.44f,h*.60f),Size(w*.13f,h*.07f))
        drawCircle(Color(0xFFF59F9B),w*.065f,Offset(w*.23f,h*.66f));drawCircle(Color(0xFFF59F9B),w*.065f,Offset(w*.78f,h*.66f))
        val mouth=Path().apply { moveTo(w*.5f,h*.65f); quadraticBezierTo(w*.51f,h*.79f,w*.39f,h*.73f); moveTo(w*.5f,h*.65f); quadraticBezierTo(w*.51f,h*.79f,w*.62f,h*.73f) }
        drawPath(mouth,Color(0xFF6E503D),style=Stroke(w*.022f))
    }
}

@Composable fun BattleScreen(back: () -> Unit, play: (Int) -> Unit, history: () -> Unit) {
    Screen("Thi đấu", back, action = { IconButton(history) { Icon(Icons.Outlined.History, "Lịch sử thi đấu", tint = Muted) } }) {
        Panel(color = Yellow) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) { Small("♜ Điểm cup", color = Color(0xFFAC985D)); Text("1,284", fontSize = 40.sp, fontWeight = FontWeight.ExtraBold); Small("Sẵn sàng tỏa sáng!") }
                Art(R.drawable.mascot_trophy, Modifier.size(120.dp))
            }
            HorizontalDivider(color = Color(0xFFEEDFAD))
            Stats(listOf("37" to "Trận đấu", "22" to "Thắng", "4" to "Thua"))
        }
        Title("Chọn chế độ chơi")
        ModeRow("Thi đấu nhanh", "Ghép đối thủ, vào trận ngay!", Icons.Outlined.Bolt, Lavender) { play(0) }
        ModeRow("Thi đấu theo ngày", "Thử thách mới mỗi ngày", Icons.Outlined.CalendarMonth, Blue) { play(1) }
        ModeRow("Phòng riêng", "Tạo phòng, rủ bạn cùng chơi", Icons.Outlined.MeetingRoom, Mint) { play(2) }
        Small("Mỗi trận đấu, thêm một bước tiến!", Modifier.fillMaxWidth().wrapContentWidth())
    }
}
@Composable private fun ModeRow(title: String, subtitle: String, icon: androidx.compose.ui.graphics.vector.ImageVector, color: Color, click: () -> Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(color).clickable(onClick=click).padding(18.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
        IconTile(icon, Purple, Color.White.copy(alpha=.35f))
        Column(Modifier.weight(1f)) { Text(title, fontWeight=FontWeight.Bold); Small(subtitle) }
        Text("›", color = Muted, fontSize = 22.sp)
    }
}

@Composable fun MatchingScreen(cancel: () -> Unit, start: () -> Unit) {
    var found by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(Unit) { delay(2500); found = true }
    Screen("Thi đấu", cancel) {
        Spacer(Modifier.height(40.dp))
        Box(Modifier.fillMaxWidth().height(230.dp), contentAlignment = Alignment.Center) {
            repeat(3) { i -> Box(Modifier.size((140+i*35).dp).border(1.dp, Line, CircleShape)) }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) { MascotFace(false, Modifier.size(85.dp)); Small("Bạn") }
                Text("VS", color = Purple, fontWeight = FontWeight.ExtraBold)
                Column(horizontalAlignment = Alignment.CenterHorizontally) { MascotFace(true, Modifier.size(85.dp)); Small(if(found) "Maya" else "Đối thủ") }
            }
        }
        Text(if(found) "Đã tìm thấy đối thủ!" else "Đang tìm đối thủ...", Modifier.fillMaxWidth(), style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
        Text("Sẵn sàng cho một thử thách mới nào!", Modifier.fillMaxWidth(), color = Muted, textAlign = TextAlign.Center)
        if(found) Primary("Bắt đầu trận đấu", onClick = start) else LinearProgressIndicator(Modifier.fillMaxWidth(), color = Purple, trackColor = Lavender)
        Secondary("Hủy tìm kiếm", onClick = cancel)
        Spacer(Modifier.height(40.dp))
        Panel(color = Blue) { Text("♧  Mẹo nhỏ: Tập trung 15 giây để đọc kỹ câu hỏi!", fontSize = 12.sp, color = Color(0xFF7390AA)) }
    }
}

@Composable fun HistoryScreen(back: () -> Unit, result: () -> Unit) {
    val scores = listOf("8 - 7", "6 - 9", "9 - 5", "7 - 6", "7 - 8", "10 - 6", "5 - 7", "8 - 6")
    val avatars = listOf(R.drawable.figma_13, R.drawable.figma_14, R.drawable.figma_15, R.drawable.figma_16)
    Screen("Lịch sử thi đấu", back) {
        scores.forEachIndexed { i, score ->
            val win = i !in listOf(1,4,6)
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable(onClick=result).padding(vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Art(avatars[i%4], Modifier.size(50.dp).clip(CircleShape))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) { Text(if(win) "Thắng" else "Thua", fontWeight = FontWeight.ExtraBold, color = if(win) Green else Color(0xFFD07483), fontSize = 20.sp); Small(if(i<3) "Hôm nay ${21-i}:15" else "Hôm qua ${18-i}:30") }
                Column(horizontalAlignment = Alignment.End) { Text(score, fontWeight = FontWeight.Bold); Small(if(win) "+28" else "-15", color = if(win) Green else Color(0xFFD07483)) }
            }
            HorizontalDivider(color = Line)
        }
    }
}
