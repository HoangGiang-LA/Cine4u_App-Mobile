package com.englishbattle.app.ui

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.unit.sp
import com.englishbattle.app.R

val Purple = Color(0xFF7C4DDF)
val Lavender = Color(0xFFEEE6FC)
val Ink = Color(0xFF242535)
val Muted = Color(0xFF9795A5)
val Canvas = Color(0xFFF8F7FD)
val Green = Color(0xFF2F9069)
val Mint = Color(0xFFE5F3EA)
val Blue = Color(0xFFE6F1FE)
val Peach = Color(0xFFFFF0DC)
val Rose = Color(0xFFFBE9EE)
val Yellow = Color(0xFFFFF4CA)
val Line = Color(0xFFECEAF2)
@OptIn(ExperimentalTextApi::class)
val Nunito = FontFamily(listOf(400, 500, 600, 700, 800, 900).map { weight ->
    Font(R.font.nunito, weight = FontWeight(weight),
        variationSettings = FontVariation.Settings(FontVariation.weight(weight)))
})

@Composable fun EnglishBattleTheme(content: @Composable () -> Unit) {
    val base = Typography()
    fun TextStyle.nunito() = copy(fontFamily = Nunito, color = Ink)
    MaterialTheme(
        colorScheme = lightColorScheme(primary = Purple, onPrimary = Color.White,
            background = Canvas, surface = Color.White, onSurface = Ink,
            onBackground = Ink, secondary = Green, outline = Line),
        typography = Typography(
            displayLarge = base.displayLarge.nunito(),
            headlineLarge = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.ExtraBold, fontSize = 30.sp, color = Ink),
            headlineMedium = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.ExtraBold, fontSize = 25.sp, color = Ink),
            titleLarge = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.ExtraBold, fontSize = 21.sp, color = Ink),
            titleMedium = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Bold, fontSize = 17.sp, color = Ink),
            bodyLarge = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Normal, fontSize = 16.sp, color = Ink),
            bodyMedium = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Normal, fontSize = 14.sp, color = Ink),
            bodySmall = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Normal, fontSize = 12.sp, color = Muted),
            labelLarge = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Ink),
            labelMedium = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = Ink),
            labelSmall = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.SemiBold, fontSize = 10.sp, color = Muted)
        ), content = content
    )
}

