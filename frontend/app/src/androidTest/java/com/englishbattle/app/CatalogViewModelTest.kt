package com.englishbattle.app

import android.app.Application
import androidx.lifecycle.ViewModelStore
import androidx.test.platform.app.InstrumentationRegistry
import com.englishbattle.app.data.*
import com.englishbattle.app.ui.CatalogViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Assert.*
import org.junit.Test

class CatalogViewModelTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val store = ViewModelStore()
    private lateinit var viewModel: CatalogViewModel
    private val denied = "Tài khoản chưa được cấp quyền xem nội dung. Vui lòng thử lại sau."
    private val catalog = Catalog(categories = listOf(Category("vocabulary", "Từ vựng", 0)))

    private fun connect(repository: CatalogRepository) {
        instrumentation.runOnMainSync {
            viewModel = CatalogViewModel(instrumentation.targetContext.applicationContext as Application) { repository }
            store.put("catalog", viewModel)
            viewModel.connect(DataMode.FIREBASE)
        }
    }

    @After fun cleanUp() {
        instrumentation.runOnMainSync {
            if (::viewModel.isInitialized) viewModel.clear()
            store.clear()
        }
    }

    @Test fun permissionDeniedIsDisplayedAndRetryCanLoadContent() = runBlocking {
        var attempts = 0
        connect(object : CatalogRepository {
            override fun observe() = if (++attempts == 1) callbackFlow<Catalog> {
                close(UserFacingException(denied))
            } else flowOf(catalog)
        })

        val failure = withTimeout(5_000) { viewModel.state.first { it.error != null } }
        assertEquals(denied, failure.error)
        assertFalse(failure.loading)

        instrumentation.runOnMainSync { viewModel.retry() }
        val recovered = withTimeout(5_000) { viewModel.state.first { it.data == catalog } }
        assertNull(recovered.error)
        assertFalse(recovered.loading)
        assertEquals(2, attempts)
    }

    @Test fun listenerFailureAfterFirstSnapshotIsDisplayedWithoutCrashing() = runBlocking {
        val snapshots = Channel<Catalog>(Channel.UNLIMITED)
        connect(object : CatalogRepository {
            override fun observe() = snapshots.receiveAsFlow()
        })
        try {
            snapshots.send(catalog)
            withTimeout(5_000) { viewModel.state.first { it.data == catalog } }

            snapshots.close(UserFacingException(denied))
            val failure = withTimeout(5_000) { viewModel.state.first { it.error != null } }
            assertEquals(denied, failure.error)
            assertFalse(failure.loading)
        } finally {
            snapshots.cancel()
        }
    }
}
