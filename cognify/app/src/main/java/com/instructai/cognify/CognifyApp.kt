package com.instructai.cognify

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import androidx.work.WorkManager
import com.instructai.cognify.data.remote.ServerResolver
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class CognifyApp : Application(), Configuration.Provider {

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    @Inject
    lateinit var serverResolver: ServerResolver

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        PDFBoxResourceLoader.init(this)
        // Probe local dev server; fall back to the deployed backend automatically.
        serverResolver.resolveInBackground()
        // Force WorkManager initialization at startup so force-stop recovery
        // (which cancels pending work) runs at launch, not at first enqueue.
        WorkManager.getInstance(this)
    }
}
