#include <WiFi.h>
#include <WebSocketsClient.h>
#include "driver/i2s.h"

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* WS_HOST = "YOUR_SERVER_IP_OR_DOMAIN";
const uint16_t WS_PORT = 8090;
const bool WS_USE_TLS = false;
const char* DEVICE_TOKEN = "change-this-device-token";

const int I2S_WS_PIN = 25;
const int I2S_SCK_PIN = 26;
const int I2S_SD_PIN = 22;
const int SAMPLE_RATE = 16000;
const int SAMPLES_PER_FRAME = 512;
const int STATUS_LED_PIN = 2;

WebSocketsClient webSocket;
bool micEnabled = false;
unsigned long lastHeartbeatMs = 0;
int32_t rawAudioFrame[SAMPLES_PER_FRAME];
int16_t pcmAudioFrame[SAMPLES_PER_FRAME];

void setupI2S() {
  i2s_config_t i2sConfig = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 4,
    .dma_buf_len = 512,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };

  i2s_pin_config_t pinConfig = {
    .bck_io_num = I2S_SCK_PIN,
    .ws_io_num = I2S_WS_PIN,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_SD_PIN
  };

  i2s_driver_install(I2S_NUM_0, &i2sConfig, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pinConfig);
  i2s_zero_dma_buffer(I2S_NUM_0);
  Serial.println("I2S microphone ready.");
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  Serial.println();
  Serial.print("Wi-Fi connected. ESP32 IP: ");
  Serial.println(WiFi.localIP());
}

void sendHeartbeat() {
  String payload = "{\"type\":\"heartbeat\",\"micOn\":";
  payload += micEnabled ? "true" : "false";
  payload += "}";
  webSocket.sendTXT(payload);
}

void handleWebSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_CONNECTED) {
    Serial.println("WebSocket connected.");
    sendHeartbeat();
    return;
  }

  if (type == WStype_DISCONNECTED) {
    Serial.println("WebSocket disconnected.");
    micEnabled = false;
    return;
  }

  if (type == WStype_TEXT) {
    String message = String((char*)payload).substring(0, length);
    if (message.indexOf("\"type\":\"mic\"") >= 0) {
      micEnabled = message.indexOf("\"enabled\":true") >= 0;
      Serial.println(micEnabled ? "MIC ON command received." : "MIC OFF command received.");
      sendHeartbeat();
    }
  }
}

void setupWebSocket() {
  String path = "/device?token=";
  path += DEVICE_TOKEN;

  if (WS_USE_TLS) {
    webSocket.beginSSL(WS_HOST, WS_PORT, path);
    Serial.println("Connecting to secure WebSocket.");
  } else {
    webSocket.begin(WS_HOST, WS_PORT, path);
    Serial.println("Connecting to local WebSocket.");
  }

  webSocket.onEvent(handleWebSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println("ESP32 audio monitor starting...");
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);
  connectWiFi();
  setupI2S();
  setupWebSocket();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  webSocket.loop();

  if (millis() - lastHeartbeatMs > 5000) {
    sendHeartbeat();
    lastHeartbeatMs = millis();
  }

  if (!micEnabled || !webSocket.isConnected()) {
    digitalWrite(STATUS_LED_PIN, webSocket.isConnected() ? HIGH : LOW);
    delay(10);
    return;
  }

  size_t bytesRead = 0;
  i2s_read(I2S_NUM_0, rawAudioFrame, sizeof(rawAudioFrame), &bytesRead, 20 / portTICK_PERIOD_MS);

  if (bytesRead > 0) {
    int samplesRead = bytesRead / sizeof(int32_t);
    for (int i = 0; i < samplesRead; i++) {
      pcmAudioFrame[i] = (int16_t)(rawAudioFrame[i] >> 16);
    }
    webSocket.sendBIN((uint8_t*)pcmAudioFrame, samplesRead * sizeof(int16_t));
  }
}
