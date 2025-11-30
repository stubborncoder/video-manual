"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, Play, Pause, Check, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { FrameStrip, type FrameCandidate } from "./FrameStrip";

interface VideoDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Callback to close the drawer */
  onOpenChange: (open: boolean) => void;
  /** Video URL to play */
  videoUrl: string;
  /** Current timestamp to start at */
  currentTimestamp: number;
  /** Manual ID for frame extraction API */
  manualId: string;
  /** Callback when a frame is selected */
  onFrameSelect: (timestamp: number) => void;
  /** Callback when user confirms frame selection */
  onConfirmFrame: (timestamp: number) => void;
}

const PLAYBACK_SPEEDS = [
  { value: "0.25", label: "0.25x" },
  { value: "0.5", label: "0.5x" },
  { value: "0.75", label: "0.75x" },
  { value: "1", label: "1x" },
  { value: "1.5", label: "1.5x" },
  { value: "2", label: "2x" },
];

/**
 * Full-screen overlay for video playback and frame selection.
 * Shows video paused at current frame, with thumbnails at bottom.
 * User can browse thumbnails or play/pause video to find exact frame.
 */
export function VideoDrawer({
  open,
  onOpenChange,
  videoUrl,
  currentTimestamp,
  manualId,
  onFrameSelect,
  onConfirmFrame,
}: VideoDrawerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(currentTimestamp);
  const [frames, setFrames] = useState<FrameCandidate[]>([]);
  const [loadingFrames, setLoadingFrames] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState("0.5");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Track if initial seek has been done and the initial timestamp for frame loading
  const initialSeekDoneRef = useRef(false);
  const initialTimestampRef = useRef(currentTimestamp);

  // Reset state when drawer opens
  useEffect(() => {
    if (open) {
      initialSeekDoneRef.current = false;
      initialTimestampRef.current = currentTimestamp;
      setCurrentTime(currentTimestamp);
      setIsPlaying(false);
      setPlaybackSpeed("0.5");
    }
  }, [open, currentTimestamp]);

  // Load frames around the initial timestamp (only when drawer opens)
  const loadFrames = useCallback(async (timestamp: number) => {
    setLoadingFrames(true);
    try {
      const response = await fetch(
        `/api/manuals/${manualId}/frames?timestamp=${timestamp}&window=10&count=15`
      );
      if (response.ok) {
        const data = await response.json();
        setFrames(data.frames || []);
      } else {
        console.error("Failed to load frames:", response.status);
      }
    } catch (error) {
      console.error("Failed to load frames:", error);
    } finally {
      setLoadingFrames(false);
    }
  }, [manualId]);

  // Load frames only when drawer opens (not when clicking thumbnails)
  useEffect(() => {
    if (open && manualId) {
      loadFrames(initialTimestampRef.current);
    }
  }, [open, manualId, loadFrames]);

  // Clear state when drawer closes
  useEffect(() => {
    if (!open) {
      setFrames([]);
      setIsPlaying(false);
      setShowConfirmDialog(false);
    }
  }, [open]);

  // Handle video metadata loaded - do initial seek here when video is ready
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      // Set initial playback speed
      videoRef.current.playbackRate = parseFloat(playbackSpeed);
      // Only do initial seek once per drawer open
      if (!initialSeekDoneRef.current) {
        console.log("[VideoDrawer] Initial seek to:", currentTimestamp);
        videoRef.current.currentTime = currentTimestamp;
        setCurrentTime(currentTimestamp);
        initialSeekDoneRef.current = true;
      }
    }
  }, [currentTimestamp, playbackSpeed]);

  // Handle video time update
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  // Handle play/pause
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  // Handle playback speed change
  const handleSpeedChange = useCallback((speed: string) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = parseFloat(speed);
    }
  }, []);

  // Handle seek via slider
  const handleSeek = useCallback((value: number[]) => {
    const newTime = value[0];
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  // Handle frame selection from strip (just seek video, don't reload frames)
  const handleFrameClick = useCallback((timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      videoRef.current.pause();
      setCurrentTime(timestamp);
      setIsPlaying(false);
    }
    onFrameSelect(timestamp);
  }, [onFrameSelect]);

  // Handle clicking "Use This Frame" - show confirmation dialog
  const handleUseFrame = useCallback(() => {
    // Pause video first
    if (videoRef.current && isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    setShowConfirmDialog(true);
  }, [isPlaying]);

  // Handle confirming the frame replacement
  const handleConfirmReplace = useCallback(() => {
    setShowConfirmDialog(false);
    onConfirmFrame(currentTime);
    onOpenChange(false);
  }, [currentTime, onConfirmFrame, onOpenChange]);

  // Skip forward/backward
  const skipTime = useCallback((seconds: number) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, [duration]);

  // Format time as MM:SS.ms
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts if dialog is open
      if (showConfirmDialog) return;

      if (e.key === "Escape") {
        onOpenChange(false);
      } else if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        skipTime(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        skipTime(1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleUseFrame();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, togglePlay, skipTime, handleUseFrame, onOpenChange, showConfirmDialog]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/95 flex flex-col z-[60]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-black/50 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-white font-medium text-lg">
              Select Frame
            </span>
            <span className="text-white/60 text-sm">
              Current: {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="default"
              onClick={handleUseFrame}
              className="gap-2 bg-green-600 hover:bg-green-500 text-white font-medium shadow-lg"
            >
              <Check className="h-5 w-5" />
              Use This Frame
            </Button>
            <Button
              variant="ghost"
              size="default"
              onClick={() => onOpenChange(false)}
              className="text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Video Player - Main area */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0">
          <div className="relative max-w-full max-h-full flex items-center justify-center">
            <video
              ref={videoRef}
              src={videoUrl}
              className="max-w-full max-h-[calc(100vh-280px)] object-contain rounded-lg"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onClick={togglePlay}
              playsInline
            />

            {/* Play/Pause overlay on click */}
            {!isPlaying && (
              <div
                className="absolute inset-0 flex items-center justify-center cursor-pointer"
                onClick={togglePlay}
              >
                <div className="bg-black/40 rounded-full p-6">
                  <Play className="h-16 w-16 text-white" />
                </div>
              </div>
            )}
          </div>

          {/* Video Controls */}
          <div className="w-full max-w-4xl mt-4 px-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => skipTime(-5)}
                className="text-white hover:bg-white/20"
                title="Back 5 seconds"
              >
                <SkipBack className="h-5 w-5" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={togglePlay}
                className="text-white hover:bg-white/20"
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => skipTime(5)}
                className="text-white hover:bg-white/20"
                title="Forward 5 seconds"
              >
                <SkipForward className="h-5 w-5" />
              </Button>

              {/* Playback Speed Selector */}
              <Select value={playbackSpeed} onValueChange={handleSpeedChange}>
                <SelectTrigger className="w-[80px] h-8 bg-white/20 border-white/30 text-white hover:bg-white/30 cursor-pointer [&_svg]:text-white [&_svg]:opacity-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  {PLAYBACK_SPEEDS.map((speed) => (
                    <SelectItem key={speed.value} value={speed.value}>
                      {speed.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Slider
                value={[currentTime]}
                min={0}
                max={duration || 100}
                step={0.1}
                onValueChange={handleSeek}
                className="flex-1"
              />

              <span className="text-white/80 text-sm font-mono w-24 text-right">
                {formatTime(currentTime)}
              </span>
            </div>

            <p className="text-center text-white/50 text-xs mt-2">
              Play video or click thumbnails below • Space to play/pause • Arrow keys to skip • Enter to confirm
            </p>
          </div>
        </div>

        {/* Frame Strip - Bottom */}
        <div className="shrink-0 bg-black/50 border-t border-white/10 p-4">
          <div className="text-sm font-medium mb-2 text-white/60">
            {loadingFrames ? "Loading frames..." : "Click a thumbnail to jump to that frame"}
          </div>
          <div className="h-[130px]">
            <FrameStrip
              frames={frames}
              selectedTimestamp={currentTime}
              onSelect={handleFrameClick}
              loading={loadingFrames}
            />
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="z-[110]">
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Image?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace the current screenshot with the frame at{" "}
              <span className="font-mono font-medium">{formatTime(currentTime)}</span>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReplace}>
              Replace Image
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default VideoDrawer;
