import { Capacitor, registerPlugin } from "@capacitor/core";

type PreloadParams = { url: string };

export interface NativeVideoPlayerAPI {
  preload(options: PreloadParams): Promise<any>;
  play(): Promise<any>;
  stop(): Promise<any>;
}

export const NativeVideoPlayer: NativeVideoPlayerAPI =
  Capacitor.isNativePlatform()
    ? registerPlugin<NativeVideoPlayerAPI>("NativeVideoPlayer")
    : {
        async preload() {},
        async play() {},
        async stop() {},
      };
