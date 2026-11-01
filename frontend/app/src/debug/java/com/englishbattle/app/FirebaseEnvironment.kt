package com.englishbattle.app

import android.app.Application
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.functions.FirebaseFunctions

/** Called before any repository: all three services use the same demo project. */
object FirebaseEnvironment {
    private const val projectId = "demo-englishbattle"
    val databaseUrl: String = if (BuildConfig.USE_FIREBASE_EMULATORS)
        "https://$projectId-default-rtdb.firebaseio.com"
    else "https://englishbattleapp-8d764-default-rtdb.asia-southeast1.firebasedatabase.app"

    fun configure(application: Application) {
        if (!BuildConfig.USE_FIREBASE_EMULATORS) return
        // FirebaseInitProvider creates the default app from google-services.json.
        // Replace it before repositories access any Auth, Database or Functions SDK.
        FirebaseApp.getApps(application).firstOrNull { it.name == FirebaseApp.DEFAULT_APP_NAME }?.delete()
        val app = FirebaseApp.initializeApp(application, FirebaseOptions.Builder()
            .setProjectId(projectId)
            .setApplicationId("1:1234567890:android:emulator")
            // Installations validates the key's shape even against local services.
            // This deliberately fake value cannot authenticate a live project.
            .setApiKey("A" + "0".repeat(38))
            .setDatabaseUrl(databaseUrl)
            .build())
        FirebaseAuth.getInstance(app).useEmulator("10.0.2.2", 9099)
        FirebaseDatabase.getInstance(app, databaseUrl).useEmulator("10.0.2.2", 9000)
        FirebaseFunctions.getInstance(app, "asia-southeast1").useEmulator("10.0.2.2", 5001)
    }
}
