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

@Composable fun BattleScreen(state: com.englishbattle.app.data.LoadState<com.englishbattle.app.data.Dashboard>,
    busy: Boolean, back: () -> Unit, play: (String) -> Unit, history: () -> Unit, privateRoom: () -> Unit) {
    Screen("Thi đấu", back, action = { IconButton(history) { Icon(Icons.Outlined.History, "Lịch sử thi đấu", tint = Muted) } }) {
        Panel(color = Yellow) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Small("♜ Điểm cup", color = Color(0xFFAC985D))
                    Text(state.data?.rating?.toString() ?: "—", fontSize = 40.sp, fontWeight = FontWeight.ExtraBold)
                    Small("Sẵn sàng tỏa sáng!")
                }
                Art(R.drawable.mascot_trophy, Modifier.size(120.dp))
            }
            HorizontalDivider(color = Color(0xFFEEDFAD))
            val d = state.data
            Stats(listOf(d?.let { (it.wins + it.losses + it.draws).toString() }.orEmpty().ifBlank { "—" } to "Trận đấu",
                (d?.wins?.toString() ?: "—") to "Thắng", (d?.losses?.toString() ?: "—") to "Thua"))
        }
        Title("Chọn chế độ chơi")
        ModeRow("Thi đấu nhanh", "Ghép đối thủ, vào trận ngay!", Icons.Outlined.Bolt, Lavender) { if (!busy) play("quick") }
        ModeRow("Thi đấu theo ngày", "Thử thách mới mỗi ngày", Icons.Outlined.CalendarMonth, Blue) { if (!busy) play("daily") }
        ModeRow("Phòng riêng", "Tạo phòng, rủ bạn cùng chơi", Icons.Outlined.MeetingRoom, Mint) { if (!busy) privateRoom() }
        Small("Mỗi trận đấu, thêm một bước tiến!", Modifier.fillMaxWidth().wrapContentWidth())
    }
}
@Composable private fun ModeRow(title: String, subtitle: String, icon: androidx.compose.ui.graphics.vector.ImageVector, color: Color, click: () -> Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(color).clickable(onClick = click).padding(18.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
        IconTile(icon, Purple, Color.White.copy(alpha = .35f))
        Column(Modifier.weight(1f)) { Text(title, fontWeight = FontWeight.Bold); Small(subtitle) }
        Text("›", color = Muted, fontSize = 22.sp)
    }
}
@Composable fun PrivateRoomScreen(busy: Boolean, back: () -> Unit, create: () -> Unit, join: (String) -> Unit) {
    var code by rememberSaveable { mutableStateOf("") }
    var error by rememberSaveable { mutableStateOf<String?>(null) }
    Screen("Phòng riêng", back) {
        Panel { Text("Tạo phòng và chia sẻ mã với bạn bè."); Primary("Tạo phòng", enabled = !busy, onClick = create) }
        Title("Tham gia phòng")
        AuthField(code, { code = it.uppercase(java.util.Locale.ROOT).filter(Char::isLetterOrDigit).take(6); error = null }, "Mã phòng 6 ký tự", Icons.Outlined.MeetingRoom, enabled = !busy)
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Primary("Vào phòng", enabled = !busy) {
            if (!code.matches(Regex("[A-Z0-9]{6}"))) error = "Mã phòng cần đúng 6 chữ hoặc số." else join(code)
        }
    }
}

@Composable fun MatchingScreen(state: com.englishbattle.app.data.LoadState<com.englishbattle.app.data.MatchTicket>, busy: Boolean,
    error: String?, demo: Boolean, cancel: () -> Unit, start: () -> Unit, retry: () -> Unit, back: () -> Unit) {
    var confirmCancel by rememberSaveable { mutableStateOf(false) }
    androidx.activity.compose.BackHandler { confirmCancel = true }
    Screen("Thi đấu", { confirmCancel = true }) {
        val t = state.data
        Spacer(Modifier.height(40.dp))
        Box(Modifier.fillMaxWidth().height(230.dp), contentAlignment = Alignment.Center) {
            repeat(3) { i -> Box(Modifier.size((140 + i * 35).dp).border(1.dp, Line, CircleShape)) }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) { MascotFace(false, Modifier.size(85.dp)); Small("Bạn") }
                Text("VS", color = Purple, fontWeight = FontWeight.ExtraBold)
                Column(horizontalAlignment = Alignment.CenterHorizontally) { MascotFace(true, Modifier.size(85.dp)); Small(if (t?.status == "matched") t.opponentName else "Đối thủ") }
            }
        }
        Text(when (t?.status) { "matched" -> "Đã tìm thấy đối thủ"; "cancelled" -> "Đã hủy tìm trận";
            "expired" -> "Yêu cầu đã hết hạn"; "failed" -> "Chưa tìm được đối thủ"; else -> "Đang tìm đối thủ..." }, Modifier.fillMaxWidth(), style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
        Text("Sẵn sàng cho một thử thách mới nào!", Modifier.fillMaxWidth(), color = Muted, textAlign = TextAlign.Center)
        t?.roomCode?.let { Panel(color = Mint) { Text("Mã phòng: $it", style = MaterialTheme.typography.headlineMedium) } }
        if (t?.status == "matched") {
            Text(t.opponentName)
            Primary("Vào trận đấu", enabled = !busy, onClick = start)
        }
        if (busy || state.loading || t?.status in listOf("searching", "waiting")) LinearProgressIndicator(Modifier.fillMaxWidth())
        error?.let { ErrorPanel(it, retry) }
        if (t?.status in listOf("cancelled", "failed", "expired")) Secondary("Về sảnh", onClick = back)
        else Secondary("Hủy tìm trận") { if (!busy) confirmCancel = true }
        Spacer(Modifier.height(40.dp))
        Panel(color = Blue) { Text("♧  Mẹo nhỏ: Tập trung đọc kỹ câu hỏi!", fontSize = 12.sp, color = Color(0xFF7390AA)) }
        if (demo) Small("Trận đấu và đối thủ ở chế độ này được mô phỏng trên thiết bị.")
    }
    if (confirmCancel) AlertDialog(onDismissRequest = { confirmCancel = false }, title = { Text("Hủy yêu cầu tìm trận?") },
        text = { Text("Nếu trận đã bắt đầu, máy chủ sẽ xử lý theo trạng thái hiện tại của trận.") },
        confirmButton = { TextButton({ confirmCancel = false; cancel() }, enabled = !busy) { Text("Hủy tìm trận") } },
        dismissButton = { TextButton({ confirmCancel = false }) { Text("Tiếp tục chờ") } })
}

@Composable fun HistoryScreen(state: com.englishbattle.app.data.LoadState<com.englishbattle.app.data.Dashboard>, back: () -> Unit,
    retry: () -> Unit, result: (String) -> Unit, learning: Boolean = false) {
    val avatars = listOf(R.drawable.figma_13, R.drawable.figma_14, R.drawable.figma_15, R.drawable.figma_16)
    Screen(if (learning) "Lịch sử học tập" else "Lịch sử thi đấu", back) {
        DataContent(state, retry) { d ->
            val history = d.history.filter { (it.mode == com.englishbattle.app.data.QuizMode.BATTLE) != learning }
            if (history.isEmpty()) EmptyPanel("Chưa có hoạt động trong mục này.")
            history.forEachIndexed { i, r ->
                val color = when (r.outcome) { "win", "completed" -> Green; "draw" -> Purple; else -> Color(0xFFD07483) }
                val title = if (learning) r.mode.title else when (r.outcome) { "win" -> "Thắng"; "draw" -> "Hòa"; else -> "Thua" }
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable { result(r.attemptId) }.padding(vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Art(avatars[i % avatars.size], Modifier.size(50.dp).clip(CircleShape))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(title, fontWeight = FontWeight.ExtraBold, color = color, fontSize = 20.sp)
                        Small(dateLabel(r.completedAt))
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(if (learning) "${r.correct}/${r.total}" else "${r.correct} - ${r.opponentCorrect}", fontWeight = FontWeight.Bold)
                        Small(if (learning) "${signed(r.coins)} xu" else signed(r.ratingDelta), color = color)
                    }
                }
                HorizontalDivider(color = Line)
            }
        }
    }
}
