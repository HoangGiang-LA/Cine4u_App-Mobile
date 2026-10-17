package com.englishbattle.app.ui

import android.content.Context
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import com.englishbattle.app.R

@Composable fun ProfileScreen(name: String, email: String, go: (Route) -> Unit, save: (String,String) -> Unit) {
    var edit by rememberSaveable { mutableStateOf(false) }
    var newName by rememberSaveable(name) { mutableStateOf(name) }
    var newEmail by rememberSaveable(email) { mutableStateOf(email) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),verticalArrangement=Arrangement.spacedBy(20.dp)) {
        Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(14.dp)) {
            Art(R.drawable.figma_09,Modifier.size(70.dp).clip(CircleShape))
            Column(Modifier.weight(1f)) { Text(name,style=MaterialTheme.typography.headlineMedium); Small("Hồ sơ của tôi") }
            Pill("Lv. 12")
        }
        Panel { Stats(listOf("1,284" to "Rating","37" to "Wins","4" to "Losses")) }
        Secondary("Chỉnh sửa hồ sơ") { edit=true }
        Title("Thông tin cá nhân")
        Panel {
            ProfileInfo(Icons.Outlined.PersonOutline,"Tên hiển thị",name)
            HorizontalDivider(color=Line)
            ProfileInfo(Icons.Outlined.Email,"Địa chỉ email",email)
            HorizontalDivider(color=Line)
            ProfileInfo(Icons.Outlined.CalendarMonth,"Ngày tham gia","12 tháng 8, 2026")
        }
        MenuRow("Tiến độ của tôi","Theo dõi hành trình học tập",Icons.Outlined.BarChart) { go(Route.Progress) }
        MenuRow("Thành tích","2 huy hiệu đã mở khóa",Icons.Outlined.EmojiEvents) { go(Route.Achievements) }
        MenuRow("Thông báo","3 thông báo chưa đọc",Icons.Outlined.NotificationsNone) { go(Route.Notifications) }
        MenuRow("Cài đặt",icon=Icons.Outlined.Settings) { go(Route.Settings) }
    }
    if(edit) AlertDialog(onDismissRequest={edit=false},title={Text("Chỉnh sửa hồ sơ")},text={
        Column(verticalArrangement=Arrangement.spacedBy(12.dp)) {
            AuthField(newName,{newName=it},"Tên hiển thị",Icons.Outlined.PersonOutline)
            AuthField(newEmail,{newEmail=it},"Email",Icons.Outlined.Email)
        }
    },confirmButton={TextButton({save(newName.trim(),newEmail.trim());edit=false},enabled=newName.isNotBlank() && android.util.Patterns.EMAIL_ADDRESS.matcher(newEmail.trim()).matches()) {Text("Lưu")}},dismissButton={TextButton({edit=false}){Text("Hủy")}})
}
@Composable private fun ProfileInfo(icon: androidx.compose.ui.graphics.vector.ImageVector,label:String,value:String) {
    Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
        IconTile(icon,Purple,Lavender,38.dp)
        Column { Small(label);Text(value,fontSize=14.sp) }
    }
}

@Composable fun NotificationsScreen(back:()->Unit,go:(Route)->Unit) {
    var unread by rememberSaveable { mutableStateOf(listOf(0,1,2)) }
    val titles=listOf("Huy hiệu mới!","Quà đang chờ bạn","Đến giờ luyện tập","Chuỗi bất bại!","Thử thách mới","Bạn đã lên hạng!","Phần thưởng tuần")
    val descriptions=listOf("Bạn đã mở khóa ‘Chiến thắng đầu tiên’! Tiếp tục tỏa sáng nhé!","Bạn nhận được 50 xu từ thử thách hôm nay. Đừng quên nhận nhé!","Dành 5 phút để từ vựng và kỹ năng của bạn tiến bộ nào!","3 trận thắng liên tiếp! Hãy giữ ‘Chuỗi bất bại’ đầy thuyết phục.","Thử sức với đối thủ mới và chinh phục thêm nhiều từ mới.","Chúc mừng! Bạn đã vào top 30 bảng xếp hạng tuần này.","Bạn nhận được phần thưởng từ bảng xếp hạng tuần.")
    val icons=listOf(Icons.Outlined.EmojiEvents,Icons.Outlined.CardGiftcard,Icons.Outlined.NotificationsNone,Icons.Outlined.LocalFireDepartment,Icons.Outlined.SportsEsports,Icons.Outlined.WorkspacePremium,Icons.Outlined.CardGiftcard)
    val destinations=listOf(Route.Achievements,Route.Challenge,Route.Practice,Route.Achievements,Route.Battle,Route.Leaderboard,Route.Leaderboard)
    Screen("Thông báo",back) {
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically) {
            Text("Cập nhật của bạn",fontWeight=FontWeight.Bold)
            TextButton({unread=emptyList()}) { Pill("${unread.size} chưa đọc") }
        }
        titles.forEachIndexed { i,title ->
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(if(i in unread) Blue.copy(alpha=.3f) else Color.Transparent)
                .clickable { unread=unread-i;go(destinations[i]) }.padding(12.dp),horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                IconTile(icons[i],if(i==0) Color(0xFFB89A3F) else if(i==3) Green else Purple,if(i==0) Yellow else if(i==3) Mint else Lavender,38.dp)
                Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(6.dp)) {
                    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) { Text(title,fontWeight=FontWeight.Bold,fontSize=14.sp); Small(if(i<3) "${i+2} giờ trước" else "Hôm qua") }
                    Small(descriptions[i])
                }
            }
            HorizontalDivider(color=Line)
        }
    }
}

@Composable fun SettingsScreen(back:()->Unit,logout:()->Unit,message:(String)->Unit) {
    val prefs=LocalContext.current.getSharedPreferences("english_battle_ui",Context.MODE_PRIVATE)
    var notifications by rememberSaveable { mutableStateOf(prefs.getBoolean("notifications",true)) }
    var sound by rememberSaveable { mutableFloatStateOf(prefs.getFloat("sound",.7f)) }
    var soundDialog by rememberSaveable { mutableStateOf(false) }
    var logoutDialog by rememberSaveable { mutableStateOf(false) }
    Screen("Cài đặt",back) {
        Panel {
            SettingRow("Âm thanh",Icons.Outlined.VolumeUp) { soundDialog=true }
            Row(verticalAlignment=Alignment.CenterVertically) {
                IconTile(Icons.Outlined.NotificationsNone,Muted,Canvas,38.dp)
                Text("Thông báo",Modifier.weight(1f).padding(start=12.dp),fontWeight=FontWeight.Bold)
                Switch(notifications,{notifications=it;prefs.edit().putBoolean("notifications",it).apply()})
            }
            SettingRow("Ngôn ngữ",Icons.Outlined.Translate) { message("Ngôn ngữ hiện tại: Tiếng Việt. Nội dung bài học: Tiếng Anh.") }
            SettingRow("Giao diện",Icons.Outlined.Palette) { message("Giao diện sáng theo bản thiết kế English Battle. Kích thước nội dung tự điều chỉnh theo màn hình Android.") }
            SettingRow("Về ứng dụng",Icons.Outlined.Info) { message("English Battle 1.0.0\nHọc tiếng Anh mỗi ngày.\n\nBản frontend chạy với dữ liệu mẫu. Trận đấu và bảng xếp hạng hiện là minh họa, chưa kết nối máy chủ.") }
            SettingRow("Chính sách bảo mật",Icons.Outlined.Shield) { message("Bản giao diện này chỉ lưu tên hiển thị, email và tùy chọn trên thiết bị. Không gửi dữ liệu lên máy chủ và không lưu mật khẩu. Chính sách cho bản phát hành chính thức cần được bổ sung khi tích hợp backend.") }
        }
        Spacer(Modifier.height(110.dp))
        TextButton({logoutDialog=true},Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Color.White)) {
            Icon(Icons.Outlined.Logout,null,tint=Color(0xFFCA7788));Spacer(Modifier.width(12.dp));Text("Đăng xuất",color=Color(0xFFCA7788))
        }
    }
    if(soundDialog) AlertDialog(onDismissRequest={soundDialog=false},title={Text("Âm thanh")},text={Column { Text("Âm lượng bài nghe: ${(sound*100).toInt()}%");Slider(sound,{sound=it;prefs.edit().putFloat("sound",it).apply()}) }},confirmButton={TextButton({soundDialog=false}){Text("Xong")}})
    if(logoutDialog) AlertDialog(onDismissRequest={logoutDialog=false},title={Text("Đăng xuất?")},text={Text("Bạn có thể quay lại đăng nhập bất cứ lúc nào.")},confirmButton={TextButton(logout){Text("Đăng xuất")}},dismissButton={TextButton({logoutDialog=false}){Text("Hủy")}})
}
@Composable private fun SettingRow(title:String,icon:androidx.compose.ui.graphics.vector.ImageVector,click:()->Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick=click).padding(vertical=8.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
        IconTile(icon,Muted,Canvas,38.dp);Text(title,Modifier.weight(1f),fontWeight=FontWeight.Bold);Text("›",color=Muted,fontSize=22.sp)
    }
}
