package com.englishbattle.app.ui

import androidx.annotation.DrawableRes
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.*

@Composable fun Art(@DrawableRes id: Int, modifier: Modifier = Modifier, description: String? = null,
                    scale: ContentScale = ContentScale.Fit) {
    Image(painterResource(id), description, modifier, contentScale = scale)
}

@Composable fun Title(text: String, modifier: Modifier = Modifier) {
    Text(text, modifier, style = MaterialTheme.typography.titleLarge)
}
@Composable fun Small(text: String, modifier: Modifier = Modifier, color: Color = Muted) {
    Text(text, modifier, color = color, style = MaterialTheme.typography.bodySmall)
}
@Composable fun Pill(text: String, color: Color = Purple, background: Color = Lavender) {
    Text(text, Modifier.clip(RoundedCornerShape(50)).background(background).padding(horizontal = 10.dp, vertical = 5.dp),
        color = color, style = MaterialTheme.typography.labelSmall)
}
@Composable fun Primary(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    Button(onClick, modifier.fillMaxWidth().heightIn(min = 54.dp), enabled = enabled,
        shape = RoundedCornerShape(15.dp), contentPadding = PaddingValues(16.dp)) {
        Text(text, color = Color.White, fontWeight = FontWeight.Bold)
    }
}
@Composable fun Secondary(text: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    OutlinedButton(onClick, modifier.fillMaxWidth().heightIn(min = 50.dp), shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Purple.copy(alpha = .4f))) { Text(text, color = Purple) }
}
@Composable fun TopBar(title: String, back: () -> Unit, action: @Composable RowScope.() -> Unit = {}) {
    Row(Modifier.fillMaxWidth().heightIn(min = 64.dp), verticalAlignment = Alignment.CenterVertically) {
        IconButton(back) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Quay lại", Modifier.size(22.dp)) }
        Text(title, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
        Row(Modifier.widthIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically, content = action)
    }
}
@Composable fun Screen(title: String, back: () -> Unit, action: @Composable RowScope.() -> Unit = {},
                       content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize()) {
        TopBar(title, back, action)
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 24.dp).padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp), content = content)
    }
}
@Composable fun Panel(modifier: Modifier = Modifier, color: Color = Color.White,
                      content: @Composable ColumnScope.() -> Unit) {
    Column(modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp)).background(color).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
}
@Composable fun IconTile(icon: ImageVector, tint: Color = Purple, bg: Color = Lavender, size: Dp = 46.dp) {
    Box(Modifier.size(size).clip(RoundedCornerShape(14.dp)).background(bg), contentAlignment = Alignment.Center) {
        Icon(icon, null, Modifier.size(size * .52f), tint = tint)
    }
}
@Composable fun MenuRow(title: String, subtitle: String? = null, icon: ImageVector,
                        tint: Color = Purple, bg: Color = Lavender, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Color.White)
        .border(1.dp, Line.copy(alpha = .6f), RoundedCornerShape(18.dp)).clickable(onClick = onClick).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        IconTile(icon, tint, bg)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
            subtitle?.let { Small(it) }
        }
        Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, Modifier.size(20.dp), tint = Muted)
    }
}
@Composable fun Progress(value: Float, color: Color = Purple, modifier: Modifier = Modifier) {
    LinearProgressIndicator(progress = { value.coerceIn(0f, 1f) }, modifier.fillMaxWidth().height(6.dp).clip(CircleShape),
        color = color, trackColor = Line, drawStopIndicator = {})
}
@Composable fun Stats(values: List<Pair<String, String>>, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
        values.forEachIndexed { i, (value, label) ->
            if (i > 0) Box(Modifier.height(36.dp).width(1.dp).background(Line))
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(value, style = MaterialTheme.typography.titleLarge)
                Small(label)
            }
        }
    }
}
@Composable fun Segments(options: List<String>, selected: Int, onSelect: (Int) -> Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Lavender).padding(4.dp)) {
        options.forEachIndexed { i, label ->
            Box(Modifier.weight(1f).clip(RoundedCornerShape(9.dp))
                .background(if (selected == i) Purple else Color.Transparent)
                .clickable { onSelect(i) }.padding(vertical = 11.dp), contentAlignment = Alignment.Center) {
                Text(label, color = if (selected == i) Color.White else Muted, fontWeight = FontWeight.Bold)
            }
        }
    }
}
