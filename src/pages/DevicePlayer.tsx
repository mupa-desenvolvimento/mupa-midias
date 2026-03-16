import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useDevicePlayerData } from "@/hooks/useDevicePlayerData";
import { useAutoHideControls, useFullscreen, useMediaRotation } from "@/hooks/player";
import {
  MediaRenderer,
  PlayerProgressBar,
  MediaIndicators,
  PlayerControls,
  LoadingScreen,
  ErrorScreen,
  DeviceNotFoundScreen,
  BlockedScreen,
  EmptyContentScreen,
} from "@/components/player-core";

const DevicePlayer = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { data, isLoading, error } = useDevicePlayerData(deviceId);
  const { showControls } = useAutoHideControls();
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const [isPortrait, setIsPortrait] = useState(() => 
    typeof window !== "undefined" ? window.innerHeight > window.innerWidth : false
  );

  useEffect(() => {
    const update = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const mediaItems = data?.overrideMedia
    ? [data.overrideMedia]
    : (data?.mediaItems || []);

  const { currentIndex, goToNext, progressPercent } = useMediaRotation({
    itemsLength: mediaItems.length,
    getDuration: (idx) => {
      const m = mediaItems[idx];
      if (!m) return 10;
      if (m.type === "video") {
        return 0;
      }
      return m.duration || 10;
    },
    getIsVideo: (idx) => mediaItems[idx]?.type === "video",
    enabled: mediaItems.length > 0,
  });

  const activeMedia = mediaItems[currentIndex] || null;
  const isVideo = activeMedia?.type === "video";

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={(error as Error).message} />;
  if (!data?.device) return <DeviceNotFoundScreen identifier={deviceId} />;
  if (data.device.is_blocked) {
    return (
      <BlockedScreen
        message={data.device.blocked_message || undefined}
        deviceName={data.device.name}
      />
    );
  }
  if (mediaItems.length === 0) {
    return <EmptyContentScreen playlistName={data.playlist?.name} />;
  }

  if (!activeMedia) return null;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <div className="absolute inset-0">
        <MediaRenderer
          media={activeMedia}
          mediaUrl={activeMedia.file_url || ""}
          objectFit="fill"
          onEnded={goToNext}
        />
      </div>

      <PlayerControls
        visible={showControls}
        deviceName={data.device.name}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        showBackButton
        backTo="/devices"
      />

      <MediaIndicators
        total={mediaItems.length}
        currentIndex={currentIndex}
        visible={showControls}
      />

      {!isVideo && <PlayerProgressBar progressPercent={progressPercent} />}
    </div>
  );
};

export default DevicePlayer;
