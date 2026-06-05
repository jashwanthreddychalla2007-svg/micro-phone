package com.esp32audiomonitor.legalmicstreamer;

import android.Manifest;
import android.app.Activity;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final int MIC_PERMISSION_REQUEST = 10;
    private static final String TEST_DEVICE_URL = "https://esp32-audio-monitor.onrender.com/test-device.html";
    private static final String DASHBOARD_URL = "https://esp32-audio-monitor.onrender.com";
    private static final String PREFS_NAME = "legal_mic_streamer";
    private static final String PREF_DEVICE_TOKEN = "device_token";

    private WebView webView;
    private PermissionRequest pendingWebPermission;
    private SharedPreferences prefs;
    private EditText tokenInput;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        showConsentScreen();
    }

    private void showConsentScreen() {
        ScrollView scrollView = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(36, 42, 36, 36);
        scrollView.addView(root);

        TextView title = new TextView(this);
        title.setText("Legal Mic Streamer");
        title.setTextSize(28);
        title.setTextColor(0xFF17201C);
        title.setTypeface(Typeface.DEFAULT_BOLD);

        TextView body = new TextView(this);
        body.setText(
            "This app turns this phone into a visible, consent-based microphone test device for your ESP32 Audio Monitor dashboard.\n\n" +
            "Audio is streamed only after:\n" +
            "1. You read this notice.\n" +
            "2. You grant microphone permission.\n" +
            "3. You press START on the visible streaming page.\n\n" +
            "Legal guidelines:\n" +
            "- Do not use this app for hidden listening.\n" +
            "- Do not record or stream people without consent.\n" +
            "- Keep this app visible while streaming.\n" +
            "- Stop streaming when monitoring is no longer needed.\n\n" +
            "The app has no boot auto-start receiver, no hidden background service, and no silent microphone start."
        );
        body.setTextSize(16);
        body.setTextColor(0xFF48534F);
        body.setPadding(0, 24, 0, 24);

        tokenInput = new EditText(this);
        tokenInput.setHint("Paste Render DEVICE_TOKEN");
        tokenInput.setSingleLine(true);
        tokenInput.setText(prefs.getString(PREF_DEVICE_TOKEN, ""));
        tokenInput.setTextSize(15);

        Button streamerButton = new Button(this);
        streamerButton.setText("I CONSENT - OPEN MIC STREAMER");
        streamerButton.setOnClickListener(view -> requestMicAndOpenStreamer());

        Button dashboardButton = new Button(this);
        dashboardButton.setText("OPEN DASHBOARD ONLY");
        dashboardButton.setOnClickListener(view -> openWebPage(DASHBOARD_URL, false));

        root.addView(title);
        root.addView(body);
        root.addView(tokenInput);
        root.addView(streamerButton);
        root.addView(dashboardButton);
        setContentView(scrollView);
    }

    private void requestMicAndOpenStreamer() {
        String token = tokenInput.getText().toString().trim();
        if (token.isEmpty()) {
            Toast.makeText(this, "Paste the DEVICE_TOKEN first.", Toast.LENGTH_LONG).show();
            return;
        }
        prefs.edit().putString(PREF_DEVICE_TOKEN, token).apply();

        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC_PERMISSION_REQUEST);
            return;
        }
        openWebPage(TEST_DEVICE_URL, true);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == MIC_PERMISSION_REQUEST
            && grantResults.length > 0
            && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            if (pendingWebPermission != null) {
                pendingWebPermission.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                pendingWebPermission = null;
            } else {
                openWebPage(TEST_DEVICE_URL, true);
            }
        } else {
            showConsentScreen();
        }
    }

    private void openWebPage(String url, boolean injectDeviceToken) {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);

        TextView banner = new TextView(this);
        banner.setText(injectDeviceToken
            ? "VISIBLE MIC STREAMER - user controlled, stop when finished"
            : "DASHBOARD VIEW - no microphone streaming from this screen");
        banner.setTextSize(13);
        banner.setTypeface(Typeface.DEFAULT_BOLD);
        banner.setTextColor(0xFFFFFFFF);
        banner.setPadding(18, 14, 18, 14);
        banner.setBackgroundColor(injectDeviceToken ? 0xFF18865A : 0xFF236B8E);

        Button stopButton = new Button(this);
        stopButton.setText(injectDeviceToken ? "STOP AND RETURN" : "RETURN");
        stopButton.setOnClickListener(view -> {
            destroyWebView();
            showConsentScreen();
        });

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String pageUrl) {
                if (injectDeviceToken) {
                    injectSavedDeviceToken();
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                } else {
                    pendingWebPermission = request;
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC_PERMISSION_REQUEST);
                }
            }
        });

        root.addView(banner);
        root.addView(stopButton);
        root.addView(webView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            0,
            1
        ));

        setContentView(root);
        webView.loadUrl(url);
    }

    private void injectSavedDeviceToken() {
        String token = prefs.getString(PREF_DEVICE_TOKEN, "");
        String escapedToken = jsString(token);
        webView.evaluateJavascript(
            "(() => {" +
            "const input = document.getElementById('deviceTokenInput');" +
            "if (input) input.value = " + escapedToken + ";" +
            "})()",
            null
        );
    }

    private String jsString(String value) {
        return "'" + value
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\n", "\\n")
            .replace("\r", "\\r") + "'";
    }

    private void destroyWebView() {
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
    }

    @Override
    protected void onDestroy() {
        destroyWebView();
        super.onDestroy();
    }
}
