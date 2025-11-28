"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Upload, Play, Trash2, Video, Loader2, Eye, Wand2 } from "lucide-react";
import { videos, type VideoInfo, type UploadProgress } from "@/lib/api";
import { useVideoProcessing } from "@/hooks/useWebSocket";
import { ProcessingProgress } from "@/components/processing/ProcessingProgress";

function getVideoStreamUrl(videoName: string): string {
  return `/api/videos/${encodeURIComponent(videoName)}/stream`;
}

export default function VideosPage() {
  const [videoList, setVideoList] = useState<VideoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoInfo | null>(null);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [outputLanguage, setOutputLanguage] = useState("English");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>("");

  const { state: processingState, startProcessing, reset } = useVideoProcessing();

  useEffect(() => {
    loadVideos();
  }, []);

  async function loadVideos() {
    try {
      const res = await videos.list();
      setVideoList(res.videos);
    } catch (e) {
      console.error("Failed to load videos:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadFileName(file.name);
    setUploadProgress({ loaded: 0, total: file.size, percent: 0 });

    try {
      await videos.upload(file, (progress) => {
        setUploadProgress(progress);
      });
      toast.success("Video uploaded", { description: file.name });
      await loadVideos();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed";
      toast.error("Upload failed", { description: message });
    } finally {
      setUploading(false);
      setUploadProgress(null);
      setUploadFileName("");
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleDelete(videoName: string) {
    try {
      await videos.delete(videoName);
      toast.success("Video deleted", { description: videoName });
      await loadVideos();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Delete failed";
      toast.error("Delete failed", { description: message });
    }
  }

  async function handleProcess() {
    if (!selectedVideo) return;

    try {
      await startProcessing({
        video_path: selectedVideo.path,
        output_language: outputLanguage,
        use_scene_detection: true,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Processing failed";
      toast.error("Processing failed", { description: message });
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Videos</h1>
          <p className="text-muted-foreground">
            Manage and process your videos
          </p>
        </div>

        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            accept="video/*"
            className="hidden"
            disabled={uploading}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Video
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Upload Progress */}
      {uploading && uploadProgress && (
        <Card>
          <CardContent className="py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate font-medium">{uploadFileName}</span>
                <span className="text-muted-foreground">
                  {uploadProgress.percent}%
                </span>
              </div>
              <Progress value={uploadProgress.percent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {formatFileSize(uploadProgress.loaded)} / {formatFileSize(uploadProgress.total)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading videos...
        </div>
      ) : videoList.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Video className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No videos found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a video to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {videoList.map((video) => (
            <Card key={video.name} className="overflow-hidden">
              {/* Video Preview */}
              <div className="relative aspect-video bg-muted">
                <video
                  src={getVideoStreamUrl(video.name)}
                  className="w-full h-full object-cover"
                  muted
                  preload="metadata"
                  onMouseEnter={(e) => e.currentTarget.play()}
                  onMouseLeave={(e) => {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = 0;
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => {
                      setSelectedVideo(video);
                      setPreviewDialogOpen(true);
                    }}
                  >
                    <Eye className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <CardContent className="p-4">
                <div className="mb-3">
                  <p className="font-medium truncate" title={video.name}>
                    {video.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(video.size_bytes)}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Dialog
                    open={processDialogOpen && selectedVideo?.name === video.name}
                    onOpenChange={(open) => {
                      setProcessDialogOpen(open);
                      if (open) {
                        setSelectedVideo(video);
                        reset();
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button size="sm" className="flex-1">
                        <Wand2 className="mr-2 h-4 w-4" />
                        Process
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>Process Video</DialogTitle>
                      </DialogHeader>

                      {processingState.status === "idle" ? (
                        <div className="space-y-4">
                          {/* Video Preview in Process Dialog */}
                          <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                            <video
                              src={getVideoStreamUrl(video.name)}
                              className="w-full h-full object-contain"
                              controls
                              preload="metadata"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{video.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatFileSize(video.size_bytes)}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Output Language</Label>
                            <Input
                              value={outputLanguage}
                              onChange={(e) => setOutputLanguage(e.target.value)}
                              placeholder="English"
                            />
                          </div>

                          <Button onClick={handleProcess} className="w-full">
                            <Wand2 className="mr-2 h-4 w-4" />
                            Generate Manual
                          </Button>
                        </div>
                      ) : (
                        <ProcessingProgress state={processingState} />
                      )}
                    </DialogContent>
                  </Dialog>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(video.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Video Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedVideo?.name}</DialogTitle>
          </DialogHeader>
          {selectedVideo && (
            <div className="space-y-4">
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  src={getVideoStreamUrl(selectedVideo.name)}
                  className="w-full h-full"
                  controls
                  autoPlay
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedVideo.size_bytes)}
                </p>
                <Button
                  onClick={() => {
                    setPreviewDialogOpen(false);
                    setProcessDialogOpen(true);
                  }}
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  Process this Video
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
