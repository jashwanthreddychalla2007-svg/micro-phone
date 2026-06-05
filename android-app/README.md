# Legal Mic Streamer Android App

This is a consent-based Android wrapper for:

```text
https://esp32-audio-monitor.onrender.com/test-device.html
```

The app:

- Shows legal consent text before opening the streamer.
- Requests Android microphone permission.
- Saves the device token locally on the phone.
- Injects the saved token into the visible streaming page.
- Provides a native Stop/Return button.
- Includes a visible green banner while the microphone streaming page is open.
- Keeps the streaming page visible.
- Requires the user to press `START LAPTOP MIC`.
- Does not run a hidden background microphone service.
- Does not secretly record audio.
- Does not auto-start after reboot.

## Build APK

1. Install Android Studio.
2. Open this folder:

```text
android-app
```

3. Let Android Studio sync Gradle.
4. Click:

```text
Build -> Build Bundle(s) / APK(s) -> Build APK(s)
```

5. APK output will be under:

```text
app/build/outputs/apk/debug/
```

## Use

1. Install APK on Android phone.
2. Open app.
3. Read consent text.
4. Press `I CONSENT - CONTINUE`.
5. Allow microphone permission.
6. Press `START LAPTOP MIC`.
7. Open dashboard from another device and listen.

## Safety Properties

- No `RECEIVE_BOOT_COMPLETED` permission.
- No background `Service`.
- No foreground microphone service.
- No hidden launcher behavior.
- No microphone use until Android permission is granted and the visible web page Start button is pressed.
