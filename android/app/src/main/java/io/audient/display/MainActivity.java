package io.audient.display;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.os.Build;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import android.Manifest;
import android.content.pm.PackageManager;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import io.audient.display.player.NativeVideoPlayerPlugin;

public class MainActivity extends BridgeActivity {
  private void enableImmersiveMode() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      final WindowInsetsController controller = getWindow().getInsetsController();
      if (controller != null) {
        controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
        controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
      }
    } else {
      final View decorView = getWindow().getDecorView();
      if (decorView == null) return;
      int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_FULLSCREEN
        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
      decorView.setSystemUiVisibility(flags);
    }
  }
  
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    registerPlugin(NativeVideoPlayerPlugin.class);

    getWindow().addFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    enableImmersiveMode();

    // Request Camera Permission if not granted
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, 1);
    }

    WebView webView = getBridge().getWebView();
    if (webView != null) {
      webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
      WebSettings settings = webView.getSettings();
      settings.setMediaPlaybackRequiresUserGesture(false);
      settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
      settings.setUseWideViewPort(true);
      settings.setLoadWithOverviewMode(false);
      settings.setSupportZoom(false);
      settings.setBuiltInZoomControls(false);
      settings.setDisplayZoomControls(false);
      settings.setTextZoom(100);

      try {
        ViewGroup.LayoutParams lp = webView.getLayoutParams();
        if (lp == null) {
          webView.setLayoutParams(new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
          ));
        } else {
          lp.width = ViewGroup.LayoutParams.MATCH_PARENT;
          lp.height = ViewGroup.LayoutParams.MATCH_PARENT;
          webView.setLayoutParams(lp);
        }
        webView.setPadding(0, 0, 0, 0);
        webView.setInitialScale(100);
        webView.requestLayout();
      } catch (Exception e) {
        Log.w("MainActivity", "Failed to force WebView layout/scale", e);
      }
      
      webView.setOnSystemUiVisibilityChangeListener(new View.OnSystemUiVisibilityChangeListener() {
        @Override
        public void onSystemUiVisibilityChange(int visibility) {
          enableImmersiveMode();
        }
      });
    }
  }
  
  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) {
      enableImmersiveMode();
    }
  }
}
