package com.instructai.cognify.di

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import com.instructai.cognify.BuildConfig
import com.instructai.cognify.data.remote.ApiService
import com.instructai.cognify.data.remote.AuthInterceptor
import com.instructai.cognify.data.remote.TokenManager
import com.instructai.cognify.data.remote.ai.GeminiApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Qualifier
import javax.inject.Singleton

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class GeminiOkHttp

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class GeminiRetrofit

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideAuthInterceptor(tokenManager: TokenManager): AuthInterceptor {
        return AuthInterceptor(tokenManager)
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(authInterceptor: AuthInterceptor, tokenManager: TokenManager): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor { chain ->
                val original = chain.request()
                val base = tokenManager.serverUrl.toHttpUrlOrNull()
                if (base == null) {
                    chain.proceed(original)
                } else {
                    val url = original.url.newBuilder()
                        .scheme(base.scheme)
                        .host(base.host)
                        .port(base.port)
                        .build()
                    var builder = original.newBuilder().url(url)
                    if (isLanHost(base.host)) {
                        builder = builder.header("Host", "instructai.test")
                    }
                    chain.proceed(builder.build())
                }
            }
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(180, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    private fun isLanHost(host: String): Boolean {
        return host == "localhost" ||
            host == "127.0.0.1" ||
            host.startsWith("192.168.") ||
            host.startsWith("10.") ||
            host.matches(Regex("^172\\.(1[6-9]|2[0-9]|3[01])\\."))
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideApiService(retrofit: Retrofit): ApiService {
        return retrofit.create(ApiService::class.java)
    }

    @Provides
    @Singleton
    @GeminiOkHttp
    fun provideGeminiOkHttpClient(): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.HEADERS
        }
        return OkHttpClient.Builder()
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    @GeminiRetrofit
    fun provideGeminiRetrofit(@GeminiOkHttp client: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl("https://generativelanguage.googleapis.com/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideGeminiApi(@GeminiRetrofit retrofit: Retrofit): GeminiApi {
        return retrofit.create(GeminiApi::class.java)
    }
}
