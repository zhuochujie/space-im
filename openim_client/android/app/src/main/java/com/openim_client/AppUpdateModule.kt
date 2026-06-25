package com.openim_client

import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class AppUpdateModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "SpaceAppUpdate"

  @ReactMethod
  fun getVersion(promise: Promise) {
    try {
      val packageInfo = reactContext.packageManager.getPackageInfo(reactContext.packageName, 0)
      val result = Arguments.createMap()
      result.putString("versionName", packageInfo.versionName ?: "")
      val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        packageInfo.longVersionCode
      } else {
        @Suppress("DEPRECATION")
        packageInfo.versionCode.toLong()
      }
      result.putDouble("versionCode", versionCode.toDouble())
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("VERSION_READ_FAILED", "Failed to read app version", error)
    }
  }

  @ReactMethod
  fun installApk(path: String, promise: Promise) {
    try {
      val apkFile = File(path.removePrefix("file://"))
      if (!apkFile.exists()) {
        promise.reject("APK_NOT_FOUND", "APK file does not exist")
        return
      }

      val uri: Uri = FileProvider.getUriForFile(
        reactContext,
        "${reactContext.packageName}.fileprovider",
        apkFile,
      )
      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, "application/vnd.android.package-archive")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      (reactContext.currentActivity ?: reactContext).startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("APK_INSTALL_FAILED", "Failed to open APK installer", error)
    }
  }
}
