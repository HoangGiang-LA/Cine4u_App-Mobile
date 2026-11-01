package com.englishbattle.app

import androidx.test.platform.app.InstrumentationRegistry
import com.englishbattle.app.data.DataMode
import com.englishbattle.app.data.QuizMode
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.util.UUID

/** Real SDK/Callable smoke test; requires the seeded local stack, never mocks. */
class FirebaseEmulatorSmokeTest {
    @Test fun signsInLoadsCatalogAndCallsBE1Practice() = runBlocking {
        assumeTrue("Enable -PfirebaseEmulators=true", BuildConfig.USE_FIREBASE_EMULATORS)
        assertEquals("demo-englishbattle", FirebaseApp.getInstance().options.projectId)
        val application = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as EnglishBattleApplication
        val container = application.container
        try {
            container.auth.signIn("learner@example.test", "LocalDemo123!")
            assertEquals("local-learner", FirebaseAuth.getInstance().currentUser?.uid)
            val game = container.game(DataMode.FIREBASE)
            game.ensureProfile()
            val catalog = withTimeout(20000) { container.catalog(DataMode.FIREBASE).observe().first() }
            assertTrue(catalog.topics.isNotEmpty())
            game.dashboard()
            val attempt = game.start(QuizMode.PRACTICE, "vocabulary_daily_life", UUID.randomUUID().toString())
            assertEquals(attempt.id, game.resume(attempt.id).id)
            game.leave(attempt.id, UUID.randomUUID().toString())
            assertEquals(attempt.id, game.historyDetail(attempt.id).attemptId)
        } finally { container.auth.signOut() }
    }
}
