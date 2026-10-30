package com.englishbattle.app.data

import com.englishbattle.app.BuildConfig
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class BackendException(val code: Code, val details: JSONObject? = null) : Exception(code.name) {
    enum class Code { UNAUTHENTICATED, PERMISSION_DENIED, INVALID_ARGUMENT, FAILED_PRECONDITION,
        NOT_FOUND, UNIMPLEMENTED, ALREADY_EXISTS, UNAVAILABLE, DEADLINE_EXCEEDED, INTERNAL }
}

class BackendClient(private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val baseUrl: String = BuildConfig.BACKEND_BASE_URL) {
    suspend fun call(method: String, data: Map<String, Any?>): JSONObject = withContext(Dispatchers.IO) {
        if (baseUrl.isBlank()) throw UserFacingException("Máy chủ ứng dụng chưa được cấu hình.")
        val url = URL("${baseUrl.trimEnd('/')}/api/$method")
        if (url.protocol != "https" && !(BuildConfig.DEBUG && url.protocol == "http")) {
            throw UserFacingException("Máy chủ ứng dụng cần sử dụng HTTPS.")
        }
        val user = auth.currentUser ?: throw BackendException(BackendException.Code.UNAUTHENTICATED)
        for (attempt in 0..1) {
            val token = user.getIdToken(attempt == 1).await().token
                ?: throw BackendException(BackendException.Code.UNAUTHENTICATED)
            val connection = url.openConnection() as HttpURLConnection
            try {
                connection.requestMethod = "POST"
                connection.instanceFollowRedirects = false
                connection.connectTimeout = 10_000
                connection.readTimeout = 20_000
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.setRequestProperty("Authorization", "Bearer $token")
                connection.outputStream.use { it.write(JSONObject().put("data", JSONObject(data)).toString().toByteArray(Charsets.UTF_8)) }
                val status = connection.responseCode
                if (status == 401 && attempt == 0) continue
                val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                val response = runCatching { JSONObject(body) }.getOrNull()
                if (status in 200..299) return@withContext response?.optJSONObject("result")
                    ?: throw UserFacingException("Máy chủ trả về dữ liệu không hợp lệ.")
                val error = response?.optJSONObject("error")
                val fallback = when (status) { 401 -> BackendException.Code.UNAUTHENTICATED; 403 -> BackendException.Code.PERMISSION_DENIED; 404 -> BackendException.Code.NOT_FOUND; else -> BackendException.Code.UNAVAILABLE }
                val code = runCatching { BackendException.Code.valueOf(error?.optString("status").orEmpty()) }.getOrDefault(fallback)
                if (code == BackendException.Code.UNAUTHENTICATED && auth.currentUser?.uid == user.uid) auth.signOut()
                throw BackendException(code, error?.optJSONObject("details"))
            } finally { connection.disconnect() }
        }
        throw BackendException(BackendException.Code.UNAUTHENTICATED)
    }
}
