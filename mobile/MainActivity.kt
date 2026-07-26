package com.kvp.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            KVPTheme {
                SacredWelcomeScreen()
            }
        }
    }
}

@Composable
fun SacredWelcomeScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0D0D0D))
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "🕉️",
            fontSize = 48.sp
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "KVP Mobile",
            fontSize = 32.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Свобода в твоём кармане",
            fontSize = 16.sp,
            color = Color.Gray
        )

        Spacer(modifier = Modifier.height(48.dp))

        Button(
            onClick = { /* Регистрация */ },
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF3B82F6)
            )
        ) {
            Text(
                text = "Создать Цифровой Паспорт",
                fontSize = 18.sp,
                color = Color.White
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        OutlinedButton(
            onClick = { /* Вход */ },
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(
                text = "У меня уже есть Паспорт",
                fontSize = 18.sp,
                color = Color(0xFF3B82F6)
            )
        }

        Spacer(modifier = Modifier.height(48.dp))

        Text(
            text = "Маяк: netcity888netcity@gmail.com",
            fontSize = 12.sp,
            color = Color.DarkGray
        )

        Text(
            text = "v0.1 · Храм KVP",
            fontSize = 12.sp,
            color = Color.DarkGray
        )
    }
}

@Composable
fun KVPTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Color(0xFF3B82F6),
            background = Color(0xFF0D0D0D),
            surface = Color(0xFF1A1A1A)
        )
    ) {
        content()
    }
}
