package com.englishbattle.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.englishbattle.app.data.LoadState
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable fun LoadingPanel(text: String = "Đang tải...") {
    Panel { CircularProgressIndicator(Modifier.size(28.dp), color = Purple); Text(text) }
}
@Composable fun ErrorPanel(message: String, retry: () -> Unit) {
    Panel(color = Rose) { Text(message); Secondary("Thử lại", onClick = retry) }
}
@Composable fun EmptyPanel(text: String) { Panel { Text(text, color = Muted) } }
@Composable fun <T> DataContent(state: LoadState<T>, retry: () -> Unit, content: @Composable (T) -> Unit) {
    if (state.loading) LoadingPanel()
    state.error?.let { ErrorPanel(it, retry) }
    val value = state.data
    if (value != null) content(value)
}
fun dateLabel(timestamp: Long): String = if (timestamp <= 0) "" else DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")
    .withZone(ZoneId.of("Asia/Ho_Chi_Minh")).format(Instant.ofEpochMilli(timestamp))
fun signed(value: Int) = if (value > 0) "+$value" else value.toString()
