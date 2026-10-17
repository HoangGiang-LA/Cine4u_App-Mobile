package com.englishbattle.app.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.*
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.*
import com.englishbattle.app.R

@Composable fun SplashScreen(start: () -> Unit) {
    BoxWithConstraints(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFFB8E3F9), Color(0xFFF2FBFF))))) {
        val screenHeight = maxHeight
        androidx.compose.foundation.Canvas(Modifier.fillMaxSize()) {
            fun cloud(x: Float, y: Float, r: Float) {
                drawCircle(Color.White.copy(alpha = .55f), r, androidx.compose.ui.geometry.Offset(x, y))
                drawCircle(Color.White.copy(alpha = .55f), r * .75f, androidx.compose.ui.geometry.Offset(x + r, y + r * .3f))
                drawCircle(Color.White.copy(alpha = .55f), r * .7f, androidx.compose.ui.geometry.Offset(x - r, y + r * .3f))
            }
            cloud(size.width * .9f, size.height * .12f, 25.dp.toPx())
            cloud(size.width * .05f, size.height * .46f, 20.dp.toPx())
            cloud(size.width * .93f, size.height * .65f, 24.dp.toPx())
        }
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Spacer(Modifier.height((screenHeight * .12f).coerceAtMost(90.dp)))
            Art(R.drawable.brand_logo, Modifier.fillMaxWidth(.82f).height(180.dp), "English Battle. Learn, Challenge, Improve.")
            Spacer(Modifier.height((screenHeight * .1f).coerceAtMost(80.dp)))
            Art(R.drawable.splash_friends, Modifier.fillMaxWidth().height(210.dp))
            Spacer(Modifier.height(16.dp))
            Primary("Bắt đầu  ›", Modifier.widthIn(max = 290.dp), onClick = start)
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable fun AuthField(value: String, change: (String) -> Unit, placeholder: String, icon: ImageVector, password: Boolean = false) {
    var visible by rememberSaveable { mutableStateOf(false) }
    OutlinedTextField(value, change, Modifier.fillMaxWidth(), placeholder = { Text(placeholder, color = Muted, fontSize = 14.sp) },
        singleLine = true, leadingIcon = { Icon(icon, null, Modifier.size(20.dp), tint = Muted) },
        trailingIcon = if (password) { { IconButton({ visible = !visible }) {
            Icon(if (visible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility, if (visible) "Ẩn mật khẩu" else "Hiện mật khẩu", tint = Muted)
        } } } else null,
        visualTransformation = if (password && !visible) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else if (placeholder.contains("Email")) KeyboardType.Email else KeyboardType.Text),
        shape = RoundedCornerShape(14.dp), colors = OutlinedTextFieldDefaults.colors(
            unfocusedBorderColor = Line, unfocusedContainerColor = Color(0xFFF6F5F9), focusedContainerColor = Color.White))
}

@Composable fun AuthScreen(route: Route, go: (Route) -> Unit, back: () -> Unit,
                          onLogin: (String, String) -> Unit, showMessage: (String) -> Unit) {
    var user by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var confirm by rememberSaveable { mutableStateOf("") }
    var error by rememberSaveable { mutableStateOf("") }
    val login = route == Route.Login
    val forgot = route == Route.Forgot
    Column(Modifier.fillMaxSize().background(Color.White).verticalScroll(rememberScrollState()).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        if (!login) TopBar("", back)
        if (login) {
            Spacer(Modifier.height(24.dp))
            MascotFace(false, Modifier.size(146.dp).padding(8.dp))
            Text("Welcome Back!", style = MaterialTheme.typography.headlineLarge)
            Small("Học tiếng Anh mỗi ngày")
            Spacer(Modifier.height(48.dp))
        } else {
            Spacer(Modifier.height(if (forgot) 100.dp else 20.dp))
            Text(if (forgot) "Quên mật khẩu?" else "Tạo tài khoản", Modifier.fillMaxWidth(), style = MaterialTheme.typography.headlineLarge)
            Small(if (forgot) "Nhập email của bạn để nhận mã đặt\nlại mật khẩu" else "Tham gia cộng đồng học tập!", Modifier.fillMaxWidth())
            Spacer(Modifier.height(32.dp))
        }
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (!login && !forgot) AuthField(user, { user = it }, "Tên hiển thị", Icons.Outlined.PersonOutline)
            AuthField(email, { email = it; error = "" }, if (login) "Email hoặc số điện thoại" else "Email", Icons.Outlined.Email)
            if (!forgot) AuthField(password, { password = it; error = "" }, "Mật khẩu", Icons.Outlined.Lock, true)
            if (!login && !forgot) AuthField(confirm, { confirm = it }, "Nhập lại mật khẩu", Icons.Outlined.Lock, true)
        }
        if (login) TextButton({ go(Route.Forgot) }, Modifier.align(Alignment.End)) { Text("Quên mật khẩu?", color = Purple, fontSize = 12.sp) }
        if (error.isNotBlank()) Text(error, Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
        Spacer(Modifier.height(if (login || forgot) 16.dp else 56.dp))
        Primary(if (forgot) "Gửi mã" else if (login) "Đăng nhập" else "Đăng ký") {
            val validEmail = android.util.Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches()
            val validPhone = email.trim().matches(Regex("[+0-9][0-9 ]{8,14}"))
            error = when {
                !validEmail && !(login && validPhone) -> "Vui lòng nhập email${if(login) " hoặc số điện thoại" else ""} hợp lệ."
                !forgot && password.length < 6 -> "Mật khẩu cần ít nhất 6 ký tự."
                !login && !forgot && user.isBlank() -> "Vui lòng nhập tên hiển thị."
                !login && !forgot && password != confirm -> "Mật khẩu nhập lại chưa khớp."
                else -> ""
            }
            if (error.isBlank()) {
                if (forgot) showMessage("Giao diện khôi phục mật khẩu đã sẵn sàng. Chức năng gửi mã email cần kết nối dịch vụ xác thực; chưa có email nào được gửi.")
                else onLogin(user, email.trim())
            }
        }
        if (login) {
            Spacer(Modifier.height(12.dp))
            OutlinedButton({ showMessage("Đăng nhập Google cần cấu hình Firebase hoặc Google OAuth. Để xem giao diện, nhập email và mật khẩu bất kỳ từ 6 ký tự vào biểu mẫu đăng nhập.") },
                Modifier.fillMaxWidth().heightIn(min = 50.dp), shape = RoundedCornerShape(14.dp), border = BorderStroke(1.dp, Line)) {
                Text("G", color = Color(0xFF4285F4), fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
                Spacer(Modifier.width(12.dp)); Text("Đăng nhập với Google", color = Ink)
            }
        }
        Spacer(Modifier.height(if(forgot) 120.dp else 32.dp))
        TextButton({ if (login) go(Route.Register) else back() }) {
            Text(if (forgot) "Quay lại Đăng nhập" else if (login) "Chưa có tài khoản? Đăng ký" else "Đã có tài khoản? Đăng nhập", color = Purple, fontSize = 12.sp, textAlign = TextAlign.Center)
        }
    }
}
