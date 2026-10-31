package com.englishbattle.app

import android.app.Application
import androidx.lifecycle.ViewModelStore
import androidx.test.platform.app.InstrumentationRegistry
import com.englishbattle.app.data.UserFacingException
import com.englishbattle.app.ui.AccountAccessViewModel
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Assert.*
import org.junit.Test

class AccountAccessViewModelTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val store = ViewModelStore()
    private lateinit var viewModel: AccountAccessViewModel
    private fun connect(initialize: suspend () -> Unit) {
        instrumentation.runOnMainSync {
            viewModel = AccountAccessViewModel(instrumentation.targetContext.applicationContext as Application, initialize)
            store.put("access", viewModel)
            viewModel.connect("new-user")
        }
    }
    @After fun cleanUp() {
        instrumentation.runOnMainSync { if (::viewModel.isInitialized) viewModel.clear(); store.clear() }
    }
    @Test fun waitsForProvisioningBeforeAllowingDataAccess() = runBlocking {
        val gate = CompletableDeferred<Unit>()
        connect { gate.await() }
        assertFalse(viewModel.state.value.ready)
        gate.complete(Unit)
        val ready = withTimeout(5_000) { viewModel.state.first { it.ready } }
        assertEquals("FIREBASE-new-user", ready.key)
    }
    @Test fun provisioningFailureCanBeRetriedWithoutRegisteringAgain() = runBlocking {
        var attempts = 0
        connect { if (++attempts == 1) throw UserFacingException("Server unavailable") }
        val failed = withTimeout(5_000) { viewModel.state.first { it.error != null } }
        assertFalse(failed.ready)
        instrumentation.runOnMainSync { viewModel.retry() }
        withTimeout(5_000) { viewModel.state.first { it.ready } }
        assertEquals(2, attempts)
    }
    @Test fun signOutClearsPendingAccessAndPreventsLateSessionRestoration() = runBlocking {
        val gate = CompletableDeferred<Unit>()
        connect { gate.await() }
        instrumentation.runOnMainSync { viewModel.clear() }
        gate.complete(Unit)
        instrumentation.runOnMainSync {
            assertNull(viewModel.state.value.key)
            assertFalse(viewModel.state.value.ready)
        }
    }
}
