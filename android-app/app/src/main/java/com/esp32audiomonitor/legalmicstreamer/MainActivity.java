package com.esp32audiomonitor.legalmicstreamer;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final int MIC_PERMISSION_REQUEST = 10;
    private static final String TEST_DEVICE_URL = "https://esp32-audio-monitor.onrender.com/test-device.html";

    private WebView webView;
    private PermissionRequest pendingWebPermission;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showConsentScreen();
    }

    private void showConsentScreen() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(36, 42, 36, 36);

        TextView title = new TextView(this);
        title.setText("Legal Mic Streamer");
        title.setTextSize(28);
        title.setTextColor(0xFF17201C);

        TextView body = new TextView(this);
        body.setText(
            "This app streams microphone audio only after you give permission and press START on the visible test-device page.\n\n" +
            "Legal guidelines:\n" +
            "- Do not use this app for hidden listening.\n" +
            "- Do not record or stream people without consent.\n" +
            "- Keep the app screen visible while streaming.\n" +
            "- Stop streaming when monitoring is no longer needed.\n\n" +
            "Press Continue only if you understand and consent."
        );
        body.setTextSize(16);
        body.setTextColor(0xFF48534F);
        body.setPadding(0, 24, 0, 24);

        Button continueButton = new Button(this);
        continueButton.setText("I CONSENT - CONTINUE");
        continueButton.setOnClickListener(view -> requestMicAndOpenStreamer());

        root.addView(title);
        root.addView(body);
        root.addView(continueButton);
        setContentView(root);
    }

    private void requestMicAndOpenStreamer() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC_PERMISSION_REQUEST);
            return;
        }
        openStreamer();
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
                openStreamer();
            }
        } else {
            showConsentScreen();
        }
    }

    private void openStreamer() {
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        webView.setWebViewClient(new WebViewClient());
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

        setContentView(webView);
        webView.loadUrl(TEST_DEVICE_URL);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}

