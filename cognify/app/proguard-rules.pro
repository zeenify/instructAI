# Retrofit
-keepattributes Signature
-keepattributes *Annotation*
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# Gson
-keep class com.instructai.cognify.data.remote.dto.** { *; }
-keepclassmembers class com.instructai.cognify.data.remote.dto.** { *; }

# Room
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *

# MediaPipe on-device LLM (Local AI) — native bridge classes must not be stripped
-keep class com.google.mediapipe.** { *; }
-keep class com.google.protobuf.** { *; }
-dontwarn com.google.mediapipe.**

# PDFBox Android: the JPX (JPEG2000) filter has an optional dependency on
# gemalto jp2, which is not bundled. PDF parsing here is plain text/PDF 1.x.
-dontwarn com.gemalto.jp2.**
