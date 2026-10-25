package com.englishbattle.app

import android.app.Application
import com.englishbattle.app.data.*
import com.google.firebase.database.FirebaseDatabase

class EnglishBattleApplication : Application() {
    val container by lazy { AppContainer(this) }
}
class AppContainer(val app: Application) {
    val auth: AuthRepository by lazy { FirebaseAuthRepository() }
    val clock = ServerClock()
    private val liveCatalog by lazy { FirebaseCatalogRepository(FirebaseDatabase.getInstance(
        "https://englishbattleapp-8d764-default-rtdb.asia-southeast1.firebasedatabase.app")) }
    private val liveGame by lazy { FirebaseGameRepository(clock) }
    private val demoContent by lazy { DemoContent(app) }
    private val demoGame by lazy { DemoGameRepository(app, demoContent) }
    fun catalog(mode: DataMode): CatalogRepository = if (mode == DataMode.DEMO) demoContent else liveCatalog
    fun game(mode: DataMode): GameRepository = if (mode == DataMode.DEMO) demoGame else liveGame
}
