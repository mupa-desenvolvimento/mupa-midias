import { forwardRef } from "react";

interface Props {
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export const CameraFeed = forwardRef<HTMLVideoElement, Props>(
  ({ canvasRef }, ref) => {
    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-border">
        <video
          ref={ref}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      </div>
    );
  }
);
CameraFeed.displayName = "CameraFeed";
