"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, Play, Pause, Check, SkipBack, SkipForward, Video, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { manuals, type ManualVideosResponse, type AdditionalVideoInfo, type PrimaryVideoInfo } from "@/lib/api";

interface VideoOption {
  id: string;
  label: string;
  url: string;
  duration: number;
}

interface VideoDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Callback to close the drawer */
  onOpenChange: (open: boolean) => void;
  /** Video URL to play (primary video) */
  videoUrl: string;
  /** Current timestamp to start at */
  currentTimestamp: number;
  /** Manual ID for frame extraction API */
  manualId: string;
  /** Callback when a frame is selected */
  onFrameSelect: (timestamp: number) => void;
  /** Callback when user confirms frame selection */
  onConfirmFrame: (timestamp: number, videoId?: string) => void;
  /** Callback to open add video dialog */
  onAddVideo?: () => void;
  /** Currently selected video ID (persisted by parent) */
  selectedVideoId?: string;
  /** Callback when video selection changes */
  onVideoChange?: (videoId: string) => void;
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
  onAddVideo,
  selectedVideoId: externalSelectedVideoId,
  onVideoChange,
}: VideoDrawerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(currentTimestamp);
  const [frames, setFrames] = useState<FrameCandidate[]>([]);
  const [loadingFrames, setLoadingFrames] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState("0.5");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingVideo, setDeletingVideo] = useState(false);

  // Video selection state - use external state if provided, otherwise internal
  const [availableVideos, setAvailableVideos] = useState<VideoOption[]>([]);
  const [internalSelectedVideoId, setInternalSelectedVideoId] = useState<string>("primary");
  const selectedVideoId = externalSelectedVideoId ?? internalSelectedVideoId;
  const [activeVideoUrl, setActiveVideoUrl] = useState(videoUrl);
  const [loadingVideos, setLoadingVideos] = useState(false);

  // Track if initial seek has been done and the initial timestamp for frame loading
  const initialSeekDoneRef = useRef(false);
  const initialTimestampRef = useRef(currentTimestamp);

  // Load available videos when drawer opens
  const loadAvailableVideos = useCallback(async () => {
    setLoadingVideos(true);
    try {
      const response = await manuals.listVideos(manualId);
      const videos: VideoOption[] = [];

      // Add primary video
      if (response.primary.exists) {
        videos.push({
          id: "primary",
          label: response.primary.label || "Original Video",
          url: videoUrl,
          duration: response.primary.duration_seconds || 0,
        });
      }

      // Add additional videos
      response.additional.forEach((v) => {
        if (v.exists) {
          videos.push({
            id: v.id,
            label: v.label || v.filename,
            url: manuals.getVideoStreamUrl(manualId, v.id),
            duration: v.duration_seconds || 0,
          });
        }
      });

      setAvailableVideos(videos);
    } catch (error) {
      console.error("Failed to load videos:", error);
      // Fallback to just primary video
      setAvailableVideos([{
        id: "primary",
        label: "Original Video",
        url: videoUrl,
        duration: 0,
      }]);
    } finally {
      setLoadingVideos(false);
    }
  }, [manualId, videoUrl]);

  // Reset state when drawer opens (but preserve video selection)
  useEffect(() => {
    if (open) {
      initialSeekDoneRef.current = false;
      initialTimestampRef.current = currentTimestamp;
      setCurrentTime(currentTimestamp);
      setIsPlaying(false);
      setPlaybackSpeed("0.5");
      // Don't reset video selection - it persists across opens
      loadAvailableVideos();
    }
  }, [open, currentTimestamp, loadAvailableVideos]);

  // Update activeVideoUrl when availableVideos load or selectedVideoId changes
  useEffect(() => {
    if (availableVideos.length > 0) {
      const video = availableVideos.find((v) => v.id === selectedVideoId);
      if (video) {
        setActiveVideoUrl(video.url);
      } else {
        // Fallback to primary if selected video no longer exists
        setActiveVideoUrl(videoUrl);
        setInternalSelectedVideoId("primary");
        onVideoChange?.("primary");
      }
    }
  }, [availableVideos, selectedVideoId, videoUrl, onVideoChange]);

  // Handle video selection change
  const handleVideoChange = useCallback((videoId: string) => {
    const video = availableVideos.find((v) => v.id === videoId);
    if (video) {
      // Update internal state
      setInternalSelectedVideoId(videoId);
      // Notify parent if callback provided (for persistence)
      onVideoChange?.(videoId);
      setActiveVideoUrl(video.url);
      setFrames([]); // Clear frames, will reload for new video
      initialSeekDoneRef.current = false;
      // Reload frames for the new video at current time
      // Note: We pass videoId explicitly, so loadFrames doesn't need to be in deps
      loadFrames(currentTime, videoId);
    }
    // Note: loadFrames is intentionally excluded from deps to avoid infinite loops.
    // When selectedVideoId changes, loadFrames is recreated, which would cause
    // handleVideoChange to be recreated, leading to unnecessary re-renders.
    // Since we pass videoId explicitly to loadFrames, this is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableVideos, currentTime, onVideoChange]);

  // Load frames around a timestamp (with video_id support)
  const loadFrames = useCallback(async (timestamp: number, videoId?: string) => {
    const vid = videoId || selectedVideoId;
    setLoadingFrames(true);
    try {
      const response = await fetch(
        `/api/manuals/${manualId}/frames?timestamp=${timestamp}&window=10&count=15&video_id=${vid}`
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
  }, [manualId, selectedVideoId]);

  // Load frames only when drawer opens (not when clicking thumbnails)
  useEffect(() => {
    if (open && manualId) {
      loadFrames(initialTimestampRef.current, selectedVideoId);
    }
  }, [open, manualId]); // Don't include loadFrames or selectedVideoId to avoid reload loops

  // Clear state when drawer closes
  useEffect(() => {
    if (!open) {
      setFrames([]);
      setIsPlaying(false);
      setShowConfirmDialog(false);
      setAvailableVideos([]);
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
    onConfirmFrame(currentTime, selectedVideoId);
    onOpenChange(false);
  }, [currentTime, selectedVideoId, onConfirmFrame, onOpenChange]);

  // Handle deleting the current video
  const handleDeleteVideo = useCallback(async () => {
    if (selectedVideoId === "primary") return; // Can't delete primary video

    const videoLabel = availableVideos.find((v) => v.id === selectedVideoId)?.label;
    setDeletingVideo(true);
    try {
      await manuals.deleteVideo(manualId, selectedVideoId);
      // Switch back to primary video
      setInternalSelectedVideoId("primary");
      onVideoChange?.("primary");
      // Reload video list
      await loadAvailableVideos();
      setShowDeleteDialog(false);
      toast.success("Video deleted", { description: videoLabel });
    } catch (error) {
      console.error("Failed to delete video:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to delete video", { description: message });
    } finally {
      setDeletingVideo(false);
    }
  }, [selectedVideoId, manualId, onVideoChange, loadAvailableVideos, availableVideos]);

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
      <div className="fixed inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 flex flex-col z-[60]">
        {/* Minimal Header - just title, timestamp, and close */}
        <div className="flex items-center justify-between px-6 py-3 shrink-0 border-b border-white/5">
          <div className="flex items-center gap-6">
            <h2 className="text-white font-semibold text-lg tracking-tight">
              Select Frame
            </h2>
            <div className="flex items-center gap-2 text-white/50 text-sm font-mono">
              <span className="text-emerald-400">{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="default"
              onClick={handleUseFrame}
              className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-900/30 transition-all hover:shadow-emerald-900/50 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              Use This Frame
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Video Player - Main area */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-0">
          <div className="relative max-w-full max-h-full flex items-center justify-center">
            <video
              ref={videoRef}
              src={activeVideoUrl}
              className="max-w-full max-h-[calc(100vh-280px)] object-contain rounded-xl shadow-2xl shadow-black/50 cursor-pointer"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onClick={togglePlay}
              playsInline
            />
          </div>
        </div>

        {/* Bottom Panel - Video Controls, Source, and Frames */}
        <div className="shrink-0 bg-zinc-900/80 backdrop-blur-sm border-t border-white/5">
          {/* Controls Bar - Video controls + Source selector */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/5">
            {/* Left: Playback Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => skipTime(-5)}
                className="text-white/70 hover:text-white hover:bg-white/10 cursor-pointer h-9 w-9"
                title="Back 5 seconds"
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                className="text-white hover:bg-white/10 cursor-pointer h-10 w-10"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => skipTime(5)}
                className="text-white/70 hover:text-white hover:bg-white/10 cursor-pointer h-9 w-9"
                title="Forward 5 seconds"
              >
                <SkipForward className="h-4 w-4" />
              </Button>

              <div className="w-px h-6 bg-white/10 mx-2" />

              {/* Playback Speed */}
              <Select value={playbackSpeed} onValueChange={handleSpeedChange}>
                <SelectTrigger className="w-[90px] h-8 bg-zinc-800 border-zinc-700 text-white/80 hover:bg-zinc-700 cursor-pointer text-sm [&_svg]:text-white/60">
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

              {/* Timeline Slider */}
              <div className="flex items-center gap-3 ml-4">
                <Slider
                  value={[currentTime]}
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="w-[200px]"
                />
                <span className="text-white/60 text-xs font-mono w-16">
                  {formatTime(currentTime)}
                </span>
              </div>
            </div>

            {/* Right: Video Source Selector */}
            <div className="flex items-center gap-3">
              <span className="text-white/40 text-xs uppercase tracking-wider font-medium">
                Source
              </span>

              <Select value={selectedVideoId} onValueChange={handleVideoChange}>
                <SelectTrigger className="min-w-[180px] max-w-[320px] h-9 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 cursor-pointer [&_svg]:text-white/60">
                  <div className="flex items-center gap-2 truncate">
                    <Video className="h-4 w-4 text-white/60 shrink-0" />
                    <span className="truncate"><SelectValue /></span>
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  {availableVideos.map((video) => (
                    <SelectItem key={video.id} value={video.id}>
                      {video.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Delete Video Button - only for non-primary videos */}
              {selectedVideoId !== "primary" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deletingVideo}
                  className="h-9 border-red-900/50 text-red-400 hover:text-red-300 hover:bg-red-950/50 hover:border-red-800 cursor-pointer gap-2 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}

              {/* Add Video Button */}
              {onAddVideo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddVideo}
                  className="h-9 border-dashed border-zinc-600 text-white/70 hover:text-white hover:bg-zinc-800 hover:border-zinc-500 cursor-pointer gap-2 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Video
                </Button>
              )}
            </div>
          </div>

          {/* Frame Thumbnails */}
          <div className="px-6 py-4">
            <div className="h-[120px]">
              <FrameStrip
                frames={frames}
                selectedTimestamp={currentTime}
                onSelect={handleFrameClick}
                loading={loadingFrames}
              />
            </div>
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

      {/* Delete Video Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="z-[110]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Video?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the video{" "}
              <span className="font-medium">
                {availableVideos.find((v) => v.id === selectedVideoId)?.label}
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingVideo}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVideo}
              disabled={deletingVideo}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deletingVideo ? "Deleting..." : "Delete Video"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default VideoDrawer;
