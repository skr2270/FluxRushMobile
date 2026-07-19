# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# React Native Sound keep rules
-keep class com.zmxv.RNSound.** { *; }

# React Native Haptic Feedback keep rules
-keep class com.mklich.org.reactnative.hapticfeedback.** { *; }

# Shopify React Native Skia keep rules
-keep class com.shopify.reactnative.skia.** { *; }

# React Native Vision Camera keep rules
-keep class com.mrousavy.camera.** { *; }

# React Native Worklets Core keep rules
-keep class com.margelo.worklets.** { *; }

# Keep all classes with native methods
-keepclasseswithmembernames class * {
    native <methods>;
}
