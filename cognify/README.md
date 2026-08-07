# Cognify

Android companion app for InstructAI — spaced-repetition review of course material, with offline on-device TTS voices.

## Stack

- Kotlin 2.0.21, Jetpack Compose (Material 3), AGP 8.7.3 (JDK 17, compileSdk 35, minSdk 26)
- Room (local SQLite), Retrofit/OkHttp (Laravel backend API), Hilt (DI)
- Media3 ExoPlayer (playback), WorkManager (TTS clip jobs)
- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (offline TTS: Kokoro, Pocket, ZipVoice, Supertonic)

## Prerequisites

- Android Studio (or JDK 17 + Android SDK 35)
- Backend running: the app connects to the InstructAI Laravel API (see `API_BASE_URL` below)

## Setup

```powershell
# 1. Restore gitignored sherpa-onnx files (Java API + native .so libs, ~30 MB download)
powershell -ExecutionPolicy Bypass -File scripts\setup-sherpa.ps1

# 2. Build / install
.\gradlew.bat assembleDebug            # or open the folder in Android Studio
```

`sherpa-onnx` sources and binaries are deliberately gitignored (`app/src/main/java/com/k2fsa/`, `app/src/main/jniLibs/`) to keep the repo lean. Run `setup-sherpa.ps1` after every fresh clone; use `-Version vX.Y.Z` to pin a different release (defaults to `v1.13.4`, the minimum for Supertonic support).

## Configuration

- **API base URL**: defaults to `http://192.168.1.252/api/`. Override per build in `cognify/gradle.properties`:
  ```properties
  apiBaseUrl=http://10.0.2.2/api/
  ```
- **Google Sign-In**: configure your web client ID in `app/src/main/res/values/strings.xml` (`google_web_client_id`).

## Notes

- TTS models are downloaded at runtime to the app's internal storage (see `PrototypeTtsEngine`); the model files are not shipped in the APK.
- Voice clone reference WAVs referenced by the Voice Lab are user-provided, not committed.
