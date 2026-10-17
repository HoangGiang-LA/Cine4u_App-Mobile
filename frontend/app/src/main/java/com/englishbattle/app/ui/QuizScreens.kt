package com.englishbattle.app.ui

import android.speech.tts.TextToSpeech
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.*
import com.englishbattle.app.R
import com.englishbattle.app.data.QuizData
import kotlinx.coroutines.delay
import java.util.Locale

@Composable fun QuizScreen(category: String, topic: String, battle: Boolean, back: () -> Unit, finish: (List<Int>) -> Unit) {
    val questions = remember(category) { QuizData.questions(category) }
    var index by rememberSaveable { mutableIntStateOf(0) }
    var picks by rememberSaveable { mutableStateOf(listOf<Int>()) }
    var selected by rememberSaveable { mutableIntStateOf(-1) }
    var seconds by rememberSaveable { mutableIntStateOf(30) }
    var quit by rememberSaveable { mutableStateOf(false) }
    val q = questions[index]
    val context = LocalContext.current
    var ttsReady by remember { mutableStateOf(false) }
    val speech = remember { TextToSpeech(context) { ttsReady = it == TextToSpeech.SUCCESS } }
    var speechError by remember { mutableStateOf(false) }
    DisposableEffect(speech) { onDispose { speech.stop(); speech.shutdown() } }
    LaunchedEffect(index, selected, quit) {
        if(selected == -1 && !quit) {
            while(seconds > 0) { delay(1000); seconds-- }
            selected = -2
        }
    }
    androidx.activity.compose.BackHandler { quit = true }
    Screen(if(battle) "" else category, { quit = true }, action = {
        Text("00:${seconds.toString().padStart(2, '0')}", Modifier.padding(end = 8.dp), color = Color(0xFFD7738C), fontSize = 12.sp)
    }) {
        if(battle) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                FighterCard("You", picks.zip(questions).count { it.first == it.second.correct } * 100, false, Modifier.weight(1f))
                Small("VS")
                FighterCard("Maya", index * 70, true, Modifier.weight(1f))
            }
        }
        Progress((index + 1) / 10f)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Small(if (battle) "QUESTION ${index + 1} OF 10" else "Câu ${index + 1}/10"); Small(topic) }
        Small(if(category == "Nghe") "Nghe và chọn đáp án đúng" else if(category == "Đọc hiểu") "Đọc đoạn văn và trả lời câu hỏi" else "Chọn một đáp án đúng")
        if(category == "Nghe") {
            Panel(color = Blue) {
                IconButton({
                    if(ttsReady && speech.setLanguage(Locale.US) >= TextToSpeech.LANG_AVAILABLE) {
                        val volume = context.getSharedPreferences("english_battle_ui", android.content.Context.MODE_PRIVATE).getFloat("sound", .7f)
                        val params = android.os.Bundle().apply { putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume) }
                        speech.speak(q.prompt, TextToSpeech.QUEUE_FLUSH, params, "question-$index")
                    } else speechError = true
                }, Modifier.align(Alignment.CenterHorizontally).size(76.dp).clip(CircleShape).background(Color.White)) {
                    Icon(Icons.Outlined.VolumeUp, "Nghe câu hỏi", Modifier.size(40.dp), tint = Purple)
                }
                Text("Nhấn để nghe", Modifier.fillMaxWidth(), textAlign = TextAlign.Center, color = Purple)
                if (speechError) Text("Thiết bị chưa có giọng tiếng Anh. Nội dung: ${q.prompt}", style = MaterialTheme.typography.bodySmall)
            }
        } else Text(q.prompt, style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(4.dp))
        q.options.forEachIndexed { i, answer ->
            val correct = selected != -1 && i == q.correct
            val wrong = selected == i && i != q.correct
            val color = if (correct) Green else if (wrong) Color(0xFFC9687B) else Ink
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                .background(if(correct) Mint else if(wrong) Rose else Color.White)
                .border(1.dp, if(correct) Green.copy(alpha=.4f) else if(wrong) Color(0xFFE6A8B5) else Line, RoundedCornerShape(16.dp))
                .clickable(enabled = selected == -1) { selected = i }
                .padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("${'A'+i}.", color = color, fontWeight = FontWeight.Bold)
                Text(answer, Modifier.weight(1f), color = color, fontWeight = if(correct) FontWeight.Bold else FontWeight.Normal)
                if(correct) Icon(Icons.Outlined.CheckCircle, null, Modifier.size(20.dp), tint = Green)
                if(wrong) Icon(Icons.Outlined.Cancel, null, Modifier.size(20.dp), tint = color)
            }
        }
        if(selected != -1) {
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(if(selected == q.correct) "Chính xác!" else if(selected == -2) "Hết thời gian" else "Chưa chính xác", color = if(selected == q.correct) Green else Color(0xFFC9687B), fontWeight = FontWeight.Bold)
                Small(q.explanation)
            }
        }
        Spacer(Modifier.height(12.dp))
        Primary(if(index == 9) "Xem kết quả" else "Câu tiếp theo", enabled = selected != -1) {
            val all = picks + selected
            if(index == 9) finish(all) else { picks = all; index++; selected = -1; seconds = 30; speech.stop(); speechError = false }
        }
    }
    if(quit) AlertDialog(onDismissRequest = { quit = false }, title = { Text("Rời bài học?") },
        text = { Text("Tiến độ bài hiện tại sẽ không được lưu.") },
        confirmButton = { TextButton(back) { Text("Rời bài học") } }, dismissButton = { TextButton({ quit = false }) { Text("Tiếp tục học") } })
}

@Composable fun FighterCard(name: String, points: Int, cat: Boolean, modifier: Modifier) {
    Column(modifier.clip(RoundedCornerShape(20.dp)).background(if(cat) Rose else Blue).padding(14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        MascotFace(cat, Modifier.size(66.dp))
        Text(name, fontWeight = FontWeight.Bold)
        Text("$points pts", color = if(cat) Color(0xFFD77E8C) else Color(0xFF5880DA), fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
    }
}

@Composable fun ResultScreen(score: Int, battle: Boolean, back: () -> Unit, review: () -> Unit, again: () -> Unit) {
    val won = score >= 7
    Screen(if(battle) "Kết quả trận đấu" else "Hoàn thành!", back) {
        Art(if(battle) R.drawable.mascot_winner else R.drawable.mascot_happy, Modifier.fillMaxWidth().height(if(battle) 195.dp else 170.dp))
        if(battle) Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { Pill(if(won) "Bạn đã thắng!" else "Cố gắng lần sau!", Color.White, Color(0xFFEC53A2)) }
        Text(if(battle) "$score - 7" else "$score/10", Modifier.fillMaxWidth(), color = Green, fontSize = 48.sp, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.Center)
        Text(if(battle) "Bạn                 Maya" else if(score >= 7) "Làm tốt lắm!" else "Tiếp tục luyện tập nhé!", Modifier.fillMaxWidth(), color = Muted, textAlign = TextAlign.Center)
        if(battle) {
            Panel { Stats(listOf((if(won) "+28" else "-15") to "Rating", "+20" to "XP", "+100" to "Gold")) }
            Primary("↻  Đấu lại", onClick = again)
            Secondary("▣  Xem đáp án", onClick = review)
        } else {
            Panel {
                Text("✓  Độ chính xác: ${score * 10}%", color = Green)
                Text("⚡  Hoàn thành 10 câu hỏi", color = Purple)
            }
            Title("Kỹ năng")
            listOf("Từ vựng" to .7f, "Ngữ pháp" to .8f, "Nghe" to .5f, "Đọc hiểu" to .8f).forEach { (label, value) ->
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(label); Small("${(value*100).toInt()}%", color = Purple) }
                    Progress(value)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) { Secondary("Xem đáp án", Modifier.weight(1f), review); Primary("Luyện tập", Modifier.weight(1f), onClick = again) }
        }
    }
}

@Composable fun ReviewScreen(category: String, answers: List<Int>, back: () -> Unit) {
    Screen("Xem đáp án", back) {
        QuizData.questions(category).forEachIndexed { i, q ->
            Panel {
                Small("CÂU ${i+1}", color = Purple)
                Text(q.prompt, fontWeight = FontWeight.Bold)
                Text("Đáp án: ${q.options[q.correct]}", color = Green)
                answers.getOrNull(i)?.let { picked -> if(picked != q.correct) Text("Bạn chọn: ${q.options.getOrNull(picked) ?: "Hết thời gian"}", color = Color(0xFFC9687B)) }
                Small(q.explanation)
            }
        }
    }
}
