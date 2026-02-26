package io.audient.display.player;

import android.net.Uri;
import android.view.SurfaceView;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.Nullable;

import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;

import com.google.android.exoplayer2.ExoPlayer;
import com.google.android.exoplayer2.MediaItem;
import com.google.android.exoplayer2.Player;

@CapacitorPlugin(name = "NativeVideoPlayer")
public class NativeVideoPlayerPlugin extends Plugin {
  private ExoPlayer player;
  private SurfaceView surfaceView;

  @Override
  public void load() {
    super.load();
    ExoPlayer.Builder builder = new ExoPlayer.Builder(getContext());
    player = builder.build();
    player.setRepeatMode(Player.REPEAT_MODE_OFF);
    player.addListener(new Player.Listener() {
      @Override
      public void onPlaybackStateChanged(int state) {
        if (state == Player.STATE_ENDED) {
          JSObject data = new JSObject();
          notifyListeners("ended", data);
        }
      }
    });

    surfaceView = new SurfaceView(getContext());
    surfaceView.setLayoutParams(new FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    ));
    surfaceView.setZOrderOnTop(true);

    getActivity().runOnUiThread(() -> {
      ViewGroup root = (ViewGroup) getBridge().getWebView().getParent();
      if (root != null) {
        root.addView(surfaceView);
      }
      player.setVideoSurfaceView(surfaceView);
    });
  }

  @PluginMethod
  public void preload(PluginCall call) {
    String url = call.getString("url");
    if (url == null || player == null) {
      call.reject("Missing url");
      return;
    }

    MediaItem mediaItem = MediaItem.fromUri(Uri.parse(url));
    player.setMediaItem(mediaItem);
    player.prepare();
    call.resolve(new JSObject().put("status", "preparing"));
  }

  @PluginMethod
  public void play(PluginCall call) {
    if (player == null) {
      call.reject("Player not initialized");
      return;
    }
    player.setPlayWhenReady(true);
    call.resolve(new JSObject().put("status", "playing"));
  }

  @PluginMethod
  public void stop(PluginCall call) {
    if (player != null) {
      player.setPlayWhenReady(false);
      player.stop();
    }
    call.resolve(new JSObject().put("status", "stopped"));
  }

  @Override
  protected void handleOnDestroy() {
    super.handleOnDestroy();
    if (player != null) {
      player.release();
      player = null;
    }
  }
}
