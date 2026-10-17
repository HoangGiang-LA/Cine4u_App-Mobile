package com.englishbattle.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.englishbattle.app.ui.*

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val initial = if (BuildConfig.DEBUG) intent.getStringExtra("screen") ?: "Splash" else "Splash"
        setContent { EnglishBattleTheme { EnglishBattleApp(initial) } }
    }
}
