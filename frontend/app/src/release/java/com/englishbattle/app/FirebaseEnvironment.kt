package com.englishbattle.app

import android.app.Application

/** Release keeps the existing Firebase configuration and never uses emulators. */
object FirebaseEnvironment {
    const val databaseUrl = "https://englishbattleapp-8d764-default-rtdb.asia-southeast1.firebasedatabase.app"
    fun configure(@Suppress("UNUSED_PARAMETER") application: Application) = Unit
}
