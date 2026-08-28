import { useEffect, useRef } from "react";
import type { SpecialViewProps } from "../types";
import type { MediaConfig } from "./config";

export function MediaView({ config }: SpecialViewProps<MediaConfig>) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !config.autoplay) return;
    void video.play().catch(() => undefined);
  }, [config.autoplay, config.source]);

  if (!config.source) {
    return (
      <div className="flex h-full w-full items-center justify-center border border-dashed border-white/25 bg-black/80 font-mono text-[16px] uppercase tracking-[0.18em] text-white/35">
        Choose media
      </div>
    );
  }

  const style = { width: "100%", height: "100%", objectFit: config.fit } as const;
  if (config.mediaType === "image") {
    return <img src={config.source} alt="" draggable={false} style={style} />;
  }

  return (
    <video
      ref={videoRef}
      src={config.source}
      autoPlay={config.autoplay}
      loop={config.loop}
      muted={config.muted}
      playsInline
      preload="auto"
      style={style}
    />
  );
}
