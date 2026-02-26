"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface YouTubePlayerProps {
  videoId: string;
  onReady?: (player: YT.Player) => void;
  onTimeUpdate?: (currentTime: number) => void;
}

let apiLoaded = false;
let apiLoading = false;
const apiReadyCallbacks: (() => void)[] = [];

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (apiLoaded && window.YT?.Player) {
      resolve();
      return;
    }

    apiReadyCallbacks.push(resolve);

    if (apiLoading) return;
    apiLoading = true;

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      apiLoaded = true;
      apiReadyCallbacks.forEach((cb) => cb());
      apiReadyCallbacks.length = 0;
    };
  });
}

export function YouTubePlayer({
  videoId,
  onReady,
  onTimeUpdate,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const playerElementId = useRef(
    `yt-player-${Math.random().toString(36).slice(2, 9)}`
  );

  const startTimeTracking = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (playerRef.current && onTimeUpdate) {
        try {
          onTimeUpdate(playerRef.current.getCurrentTime());
        } catch {
          // Player might be destroyed
        }
      }
    }, 250);
  }, [onTimeUpdate]);

  useEffect(() => {
    let destroyed = false;

    async function init() {
      await loadYouTubeAPI();
      if (destroyed || !containerRef.current) return;

      // Create a div for the player inside the container
      const playerDiv = document.createElement("div");
      playerDiv.id = playerElementId.current;
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(playerDiv);

      playerRef.current = new window.YT.Player(playerElementId.current, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            if (destroyed) return;
            setIsLoading(false);
            onReady?.(event.target);
            startTimeTracking();
          },
          onStateChange: (event) => {
            if (event.data === 1) {
              // Playing
              startTimeTracking();
            }
          },
        },
      });
    }

    init();

    return () => {
      destroyed = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignore destroy errors
        }
        playerRef.current = null;
      }
    };
  }, [videoId, onReady, startTimeTracking]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-black aspect-video">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      )}
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
