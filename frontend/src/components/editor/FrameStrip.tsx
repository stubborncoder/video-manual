"use client";

import { useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FrameCandidate {
  timestamp: number;
  url: string;
}

interface FrameStripProps {
  /** Array of frame candidates to display */
  frames: FrameCandidate[];
  /** Currently selected timestamp */
  selectedTimestamp: number;
  /** Callback when a frame is clicked */
  onSelect: (timestamp: number) => void;
  /** Whether frames are loading */
  loading?: boolean;
}

/**
 * Horizontal scrollable strip of video frame thumbnails.
 * Used for selecting a specific frame when replacing screenshots.
 */
export function FrameStrip({
  frames,
  selectedTimestamp,
  onSelect,
  loading = false,
}: FrameStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Scroll selected frame into view
  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [selectedTimestamp]);

  // Format timestamp as MM:SS.ms
  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Extracting frames...</span>
        </div>
      </div>
    );
  }

  if (frames.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg">
        <span className="text-muted-foreground">No frames available</span>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-2 h-full scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
    >
      {frames.map((frame) => {
        const isSelected = Math.abs(frame.timestamp - selectedTimestamp) < 0.1;
        return (
          <button
            key={frame.timestamp}
            ref={isSelected ? selectedRef : undefined}
            onClick={() => onSelect(frame.timestamp)}
            className={cn(
              "shrink-0 flex flex-col items-center gap-1 p-1 rounded-lg transition-all",
              "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50",
              isSelected && "ring-2 ring-primary bg-primary/10"
            )}
          >
            <div
              className={cn(
                "w-[160px] h-[100px] bg-muted rounded overflow-hidden",
                isSelected && "ring-2 ring-primary"
              )}
            >
              <img
                src={frame.url}
                alt={`Frame at ${formatTimestamp(frame.timestamp)}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <span
              className={cn(
                "text-xs font-mono",
                isSelected ? "text-primary font-medium" : "text-muted-foreground"
              )}
            >
              {formatTimestamp(frame.timestamp)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default FrameStrip;
