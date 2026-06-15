//Firebase Realtime Database

#if defined(ESP32)
  #include <WiFi.h>
#elif defined(ESP8266)
  #include <ESP8266WiFi.h>
#endif

#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
#include "DHT.h"

// ================= PENGATURAN WIFI & FIREBASE =================
#define WIFI_SSID "oths"
#define WIFI_PASSWORD "12345678"

#define API_KEY "AIzaSyBj6bhAq584TStUQDuP-Ee0rBuxnbjgyoA"
#define DATABASE_URL "https://dane-27e94-default-rtdb.firebaseio.com"
#define USER_EMAIL "8030230031@student.unama.ac.id"
#define USER_PASSWORD "UtEBoa3KBGy_LiW"

// ================= KONFIGURASI PIN & HARDWARE =================
#if defined(ESP32)
  #define RELAY1 5
  #define RELAY2 18
  #define RELAY3 19
  #define RELAY4 23
  #define DHTPIN 4
#elif defined(ESP8266)
  #define RELAY1 5  // D1
  #define RELAY2 4  // D2
  #define RELAY3 0  // D3
  #define RELAY4 2  // D4
  #define DHTPIN 14 // D5
#endif

#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// ================= LOGIKA RELAY (ACTIVE LOW) =================
#define RELAY_ON LOW
#define RELAY_OFF HIGH

// ================= OBJEK FIREBASE =================
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// ================= VARIABEL TIMER =================
unsigned long previousMillisDHT = 0;
unsigned long previousMillisFirebase = 0;

const long intervalDHT = 5000;       // Baca DHT tiap 5 detik
const long intervalFirebase = 200;   // DIPERCEPAT: Cek Firebase tiap 200ms agar variasi dari web tidak terlewat

void setup() {
  Serial.begin(115200);
  
  // Inisialisasi Pin Relay
  pinMode(RELAY1, OUTPUT);
  pinMode(RELAY2, OUTPUT);
  pinMode(RELAY3, OUTPUT);
  pinMode(RELAY4, OUTPUT);
  
  // Matikan semua relay di awal
  matikanSemuaRelay();

  dht.begin();

  // Koneksi WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Koneksi ke Wi-Fi");
  
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }

  Serial.println("\nTerhubung ke Wi-Fi!");

  // Konfigurasi Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  config.token_status_callback = tokenStatusCallback;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  unsigned long currentMillis = millis();

  // ================= BACA SENSOR DHT =================
  if (currentMillis - previousMillisDHT >= intervalDHT) {
    previousMillisDHT = currentMillis;

    float h = dht.readHumidity();
    float t = dht.readTemperature();

    if (!isnan(h) && !isnan(t)) {

      Serial.printf("Suhu: %.2f C | Kelembapan: %.2f %%\n", t, h);

      if (Firebase.ready()) {
        Firebase.RTDB.setFloat(&fbdo, "/IoT/Suhu", t);
        Firebase.RTDB.setFloat(&fbdo, "/IoT/Kelembapan", h);
      }

    } else {
      Serial.println("Gagal membaca sensor DHT!");
    }
  }

  // ================= CEK STATUS RELAY DARI FIREBASE =================
  if (currentMillis - previousMillisFirebase >= intervalFirebase) {

    previousMillisFirebase = currentMillis;

    if (Firebase.ready()) {

      bool r1 = false;
      bool r2 = false;
      bool r3 = false;
      bool r4 = false;

      // Membaca status relay
      if (Firebase.RTDB.getBool(&fbdo, "/IoT/Relay1")) r1 = fbdo.boolData();
      if (Firebase.RTDB.getBool(&fbdo, "/IoT/Relay2")) r2 = fbdo.boolData();
      if (Firebase.RTDB.getBool(&fbdo, "/IoT/Relay3")) r3 = fbdo.boolData();
      if (Firebase.RTDB.getBool(&fbdo, "/IoT/Relay4")) r4 = fbdo.boolData();

      // Menjalankan relay sesuai status di database
      digitalWrite(RELAY1, r1 ? RELAY_ON : RELAY_OFF);
      digitalWrite(RELAY2, r2 ? RELAY_ON : RELAY_OFF);
      digitalWrite(RELAY3, r3 ? RELAY_ON : RELAY_OFF);
      digitalWrite(RELAY4, r4 ? RELAY_ON : RELAY_OFF);
    }
  }
}

// ================= FUNGSI BANTUAN =================
void matikanSemuaRelay() {
  digitalWrite(RELAY1, RELAY_OFF);
  digitalWrite(RELAY2, RELAY_OFF);
  digitalWrite(RELAY3, RELAY_OFF);
  digitalWrite(RELAY4, RELAY_OFF);
}
