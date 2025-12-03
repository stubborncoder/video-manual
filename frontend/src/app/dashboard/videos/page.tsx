"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, Video, Loader2, Eye, Wand2, FileText, FolderKanban, AlertTriangle, ArrowUpRight, Check, ChevronsUpDown } from "lucide-react";
import { videos, projects, type VideoInfo, type UploadProgress, type ProjectSummary, type VideoManualInfo } from "@/lib/api";
import { useVideoProcessing } from "@/hooks/useWebSocket";
import { ProcessingProgress } from "@/components/processing/ProcessingProgress";
import { MAX_TARGET_AUDIENCE_LENGTH, MAX_TARGET_OBJECTIVE_LENGTH } from "@/lib/constants";

function getVideoStreamUrl(videoName: string): string {
  return `/api/videos/${encodeURIComponent(videoName)}/stream`;
}

// Extended video info with manual count and projects
interface VideoWithManuals extends VideoInfo {
  manual_count?: number;
  projects?: { id: string; name: string }[];
}

export default function VideosPage() {
  const [videoList, setVideoList] = useState<VideoWithManuals[]>([]);
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

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<VideoInfo | null>(null);
  const [videoManuals, setVideoManuals] = useState<VideoManualInfo[]>([]);
  const [cascadeDelete, setCascadeDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Project selection state for processing
  const [projectList, setProjectList] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("__default__");

  // Target audience and objective for manual generation
  const [targetAudience, setTargetAudience] = useState<string>("");
  const [targetObjective, setTargetObjective] = useState<string>("");
  const [audienceEnabled, setAudienceEnabled] = useState(false);
  const [objectiveEnabled, setObjectiveEnabled] = useState(false);

  // Project filter state
  const [filterProjectId, setFilterProjectId] = useState<string>("__all__");
  const [filterOpen, setFilterOpen] = useState(false);

  const { state: processingState, startProcessing, reset } = useVideoProcessing();

  useEffect(() => {
    loadVideos();
    loadProjects();
  }, []);

  async function loadVideos() {
    try {
      const res = await videos.list();
      const projectsRes = await projects.list();

      // Create a map for project names
      const projectMap = new Map<string, string>();
      projectsRes.projects.forEach((p) => projectMap.set(p.id, p.name));

      // Fetch manual counts and extract project info for each video
      const videosWithManuals = await Promise.all(
        res.videos.map(async (video) => {
          try {
            const manualsRes = await videos.getManuals(video.name);

            // Extract unique projects from manuals
            const projectIds = new Set<string>();
            manualsRes.manuals.forEach((m) => {
              if (m.project_id) projectIds.add(m.project_id);
            });

            const videoProjects = Array.from(projectIds)
              .map((id) => {
                const name = projectMap.get(id);
                return name ? { id, name } : null;
              })
              .filter((p): p is { id: string; name: string } => p !== null);

            return {
              ...video,
              manual_count: manualsRes.manual_count,
              projects: videoProjects,
            };
          } catch {
            return { ...video, manual_count: 0, projects: [] };
          }
        })
      );
      setVideoList(videosWithManuals);
    } catch (e) {
      console.error("Failed to load videos:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadProjects() {
    try {
      const res = await projects.list();
      setProjectList(res.projects);
    } catch (e) {
      console.error("Failed to load projects:", e);
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

  async function openDeleteDialog(video: VideoInfo) {
    setVideoToDelete(video);
    setCascadeDelete(false);
    setDeleteDialogOpen(true);

    // Fetch manuals associated with this video
    try {
      const res = await videos.getManuals(video.name);
      setVideoManuals(res.manuals);
    } catch {
      setVideoManuals([]);
    }
  }

  async function handleDelete() {
    if (!videoToDelete) return;

    setDeleting(true);
    try {
      await videos.delete(videoToDelete.name, cascadeDelete);
      toast.success("Video moved to trash", {
        description: cascadeDelete
          ? `${videoToDelete.name} and ${videoManuals.length} manual(s)`
          : videoToDelete.name,
      });
      setDeleteDialogOpen(false);
      setVideoToDelete(null);
      setVideoManuals([]);
      await loadVideos();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Delete failed";
      toast.error("Delete failed", { description: message });
    } finally {
      setDeleting(false);
    }
  }

  async function handleProcess() {
    if (!selectedVideo) return;

    // Only include if enabled and has content
    const audience = audienceEnabled && targetAudience.trim() ? targetAudience.trim() : undefined;
    const objective = objectiveEnabled && targetObjective.trim() ? targetObjective.trim() : undefined;

    try {
      await startProcessing({
        video_path: selectedVideo.path,
        output_language: outputLanguage,
        use_scene_detection: true,
        project_id: selectedProjectId,
        target_audience: audience,
        target_objective: objective,
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

  // Filter videos by project
  const filteredVideos = filterProjectId === "__all__"
    ? videoList
    : videoList.filter((video) =>
        video.projects?.some((p) => p.id === filterProjectId)
      );

  // Get selected project name for display
  const selectedProjectName = filterProjectId === "__all__"
    ? "All Projects"
    : projectList.find((p) => p.id === filterProjectId)?.name || "Select project";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Videos</h1>
          <p className="text-muted-foreground">
            Manage and process your videos
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Project Filter - Searchable Combobox */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={filterOpen}
                className="w-[200px] justify-between"
              >
                <FolderKanban className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
                <span className="truncate">{selectedProjectName}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
              <Command>
                <CommandInput placeholder="Search projects..." />
                <CommandList>
                  <CommandEmpty>No project found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="__all__"
                      onSelect={() => {
                        setFilterProjectId("__all__");
                        setFilterOpen(false);
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${filterProjectId === "__all__" ? "opacity-100" : "opacity-0"}`}
                      />
                      All Projects
                    </CommandItem>
                    {projectList.map((project) => (
                      <CommandItem
                        key={project.id}
                        value={project.name}
                        onSelect={() => {
                          setFilterProjectId(project.id);
                          setFilterOpen(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${filterProjectId === project.id ? "opacity-100" : "opacity-0"}`}
                        />
                        {project.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

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
      ) : filteredVideos.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Video className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {filterProjectId === "__all__" ? "No videos found" : "No videos in this project"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {filterProjectId === "__all__"
                ? "Upload a video to get started"
                : "Process a video and assign it to this project, or select a different filter"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredVideos.map((video) => (
            <Card
              key={video.name}
              className="
                group overflow-hidden flex flex-col
                transition-all duration-300 ease-out
                hover:shadow-lg hover:-translate-y-1
                hover:border-primary/30
              "
            >
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
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="rounded-full h-12 w-12"
                    onClick={() => {
                      setSelectedVideo(video);
                      setPreviewDialogOpen(true);
                    }}
                  >
                    <Eye className="h-6 w-6" />
                  </Button>
                </div>
                {/* Manual count badge overlay */}
                {video.manual_count !== undefined && video.manual_count > 0 && (
                  <div className="absolute top-3 right-3">
                    <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm">
                      <FileText className="h-3 w-3 mr-1" />
                      {video.manual_count} manual{video.manual_count > 1 ? "s" : ""}
                    </Badge>
                  </div>
                )}
              </div>

              <CardContent className="p-4 flex-1 flex flex-col">
                <div className="flex-1">
                  {/* Title */}
                  <p className="font-display text-lg tracking-tight truncate" title={video.name}>
                    {video.name}
                  </p>

                  {/* Size */}
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(video.size_bytes)}
                  </p>

                  {/* Project badges */}
                  {video.projects && video.projects.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                      {video.projects.map((project) => (
                        <Link href="/dashboard/projects" key={project.id}>
                          <Badge
                            variant="outline"
                            className="text-xs cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-colors gap-1"
                          >
                            <FolderKanban className="h-3 w-3 text-primary" />
                            {project.name}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <Dialog
                    open={processDialogOpen && selectedVideo?.name === video.name}
                    onOpenChange={(open) => {
                      setProcessDialogOpen(open);
                      if (open) {
                        setSelectedVideo(video);
                        setSelectedProjectId("__default__");
                        setTargetAudience("");
                        setTargetObjective("");
                        setAudienceEnabled(false);
                        setObjectiveEnabled(false);
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
                    <DialogContent className="max-w-[95vw] w-[1600px] h-[85vh] p-0 gap-0 overflow-hidden">
                      {processingState.status === "idle" ? (
                        <div className="flex h-full">
                          {/* LEFT: Video Preview - Takes most space */}
                          <div className="flex-[3] bg-black flex flex-col min-w-0">
                            <div className="flex-1 relative">
                              <video
                                src={getVideoStreamUrl(video.name)}
                                className="absolute inset-0 w-full h-full object-contain"
                                controls
                                preload="metadata"
                              />
                            </div>
                            {/* Video info bar */}
                            <div className="bg-black/90 border-t border-white/10 px-6 py-3">
                              <p className="font-display text-white text-sm tracking-tight truncate">
                                {video.name}
                              </p>
                              <p className="text-white/50 text-xs">
                                {formatFileSize(video.size_bytes)}
                              </p>
                            </div>
                          </div>

                          {/* CENTER: Generation Settings */}
                          <div className="w-[280px] border-l bg-background flex flex-col">
                            {/* Header - aligned top */}
                            <div className="px-5 py-4 border-b">
                              <h2 className="text-sm font-semibold">Generate Manual</h2>
                            </div>

                            {/* Content */}
                            <div className="flex-1 p-5 space-y-4">
                              <div className="space-y-2">
                                <Label className="text-xs font-medium">Language</Label>
                                <Input
                                  value={outputLanguage}
                                  onChange={(e) => setOutputLanguage(e.target.value)}
                                  placeholder="English"
                                  className="h-9"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-xs font-medium">Project</Label>
                                <Select
                                  value={selectedProjectId}
                                  onValueChange={setSelectedProjectId}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select project..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {projectList.map((project) => (
                                      <SelectItem key={project.id} value={project.id}>
                                        <div className="flex items-center gap-2">
                                          <FolderKanban className="h-3.5 w-3.5" />
                                          <span className="truncate">{project.name}</span>
                                          {project.is_default && (
                                            <span className="text-[10px] text-muted-foreground">(default)</span>
                                          )}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Footer - Generate button at bottom */}
                            <div className="p-5 border-t">
                              <Button onClick={handleProcess} className="w-full h-10">
                                <Wand2 className="mr-2 h-4 w-4" />
                                Generate
                              </Button>
                            </div>
                          </div>

                          {/* RIGHT: Optional Context Prompts */}
                          <div className="w-[280px] border-l bg-muted/30 flex flex-col">
                            {/* Header - aligned top, same style */}
                            <div className="px-5 py-4 border-b border-border/50">
                              <h2 className="text-sm font-semibold">Optional Context</h2>
                            </div>

                            {/* Content - textareas fill space */}
                            <div className="flex-1 p-5 flex flex-col gap-4">
                              {/* Target Audience */}
                              <div className="flex flex-col flex-1 min-h-0">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id="audience-toggle"
                                      checked={audienceEnabled}
                                      onCheckedChange={(checked) => {
                                        setAudienceEnabled(!!checked);
                                        if (!checked) setTargetAudience("");
                                      }}
                                    />
                                    <Label
                                      htmlFor="audience-toggle"
                                      className="text-xs font-medium cursor-pointer"
                                    >
                                      Target Audience
                                    </Label>
                                  </div>
                                  {audienceEnabled && (
                                    <span className={`text-[10px] ${targetAudience.length > MAX_TARGET_AUDIENCE_LENGTH * 0.9 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                                      {targetAudience.length}/{MAX_TARGET_AUDIENCE_LENGTH}
                                    </span>
                                  )}
                                </div>
                                <textarea
                                  value={targetAudience}
                                  onChange={(e) => setTargetAudience(e.target.value.slice(0, MAX_TARGET_AUDIENCE_LENGTH))}
                                  maxLength={MAX_TARGET_AUDIENCE_LENGTH}
                                  placeholder="Who is this documentation for?&#10;&#10;e.g., New employees unfamiliar with the system, IT administrators with technical background"
                                  disabled={!audienceEnabled}
                                  onClick={() => !audienceEnabled && setAudienceEnabled(true)}
                                  className={`flex-1 w-full rounded-md border px-3 py-2 text-[13px] leading-relaxed ring-offset-background placeholder:text-muted-foreground/70 placeholder:text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none transition-colors ${
                                    !audienceEnabled
                                      ? "bg-muted/50 border-transparent cursor-pointer hover:bg-muted/80"
                                      : "bg-background border-input"
                                  }`}
                                />
                              </div>

                              {/* Objective */}
                              <div className="flex flex-col flex-1 min-h-0">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id="objective-toggle"
                                      checked={objectiveEnabled}
                                      onCheckedChange={(checked) => {
                                        setObjectiveEnabled(!!checked);
                                        if (!checked) setTargetObjective("");
                                      }}
                                    />
                                    <Label
                                      htmlFor="objective-toggle"
                                      className="text-xs font-medium cursor-pointer"
                                    >
                                      Objective
                                    </Label>
                                  </div>
                                  {objectiveEnabled && (
                                    <span className={`text-[10px] ${targetObjective.length > MAX_TARGET_OBJECTIVE_LENGTH * 0.9 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                                      {targetObjective.length}/{MAX_TARGET_OBJECTIVE_LENGTH}
                                    </span>
                                  )}
                                </div>
                                <textarea
                                  value={targetObjective}
                                  onChange={(e) => setTargetObjective(e.target.value.slice(0, MAX_TARGET_OBJECTIVE_LENGTH))}
                                  maxLength={MAX_TARGET_OBJECTIVE_LENGTH}
                                  placeholder="What should readers accomplish?&#10;&#10;e.g., Complete initial setup in under 5 minutes, Troubleshoot common errors independently"
                                  disabled={!objectiveEnabled}
                                  onClick={() => !objectiveEnabled && setObjectiveEnabled(true)}
                                  className={`flex-1 w-full rounded-md border px-3 py-2 text-[13px] leading-relaxed ring-offset-background placeholder:text-muted-foreground/70 placeholder:text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none transition-colors ${
                                    !objectiveEnabled
                                      ? "bg-muted/50 border-transparent cursor-pointer hover:bg-muted/80"
                                      : "bg-background border-input"
                                  }`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-8">
                          <ProcessingProgress state={processingState} />
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openDeleteDialog(video)}
                    className="opacity-60 hover:opacity-100 hover:border-destructive hover:text-destructive transition-all"
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Video?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Are you sure you want to delete <strong>{videoToDelete?.name}</strong>?
                  The video will be moved to trash and can be recovered within 30 days.
                </p>

                {videoManuals.length > 0 && (
                  <div className="rounded-md border p-4 space-y-3">
                    <div className="flex items-center gap-2 text-foreground">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="font-medium">
                        This video has {videoManuals.length} associated manual(s)
                      </span>
                    </div>

                    <div className="text-sm space-y-1 max-h-32 overflow-y-auto">
                      {videoManuals.map((manual) => (
                        <div
                          key={manual.manual_id}
                          className="flex items-center gap-2 py-1"
                        >
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate">{manual.manual_id}</span>
                          {manual.languages.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ({manual.languages.join(", ")})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center space-x-2 pt-2 border-t">
                      <Checkbox
                        id="cascade"
                        checked={cascadeDelete}
                        onCheckedChange={(checked) =>
                          setCascadeDelete(checked === true)
                        }
                      />
                      <label
                        htmlFor="cascade"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Also delete associated manuals
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {cascadeDelete
                    ? `Delete Video & ${videoManuals.length} Manual(s)`
                    : "Delete Video"}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
