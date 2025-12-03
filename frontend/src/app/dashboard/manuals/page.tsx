"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, Trash2, FileText, Image as ImageIcon, FolderKanban, Plus, X, Tag, Loader2, Video, AlertCircle, ArrowUpRight, Pencil, Check, ChevronsUpDown, Globe, ChevronDown, Wand2, Download, FileDown } from "lucide-react";
import { manuals, manualProject, projects, type ManualSummary, type ManualDetail, type ProjectSummary } from "@/lib/api";
import { useVideoProcessing } from "@/hooks/useWebSocket";
import { ProcessingProgress } from "@/components/processing/ProcessingProgress";

// Extended manual info with additional data
interface ManualWithProject extends ManualSummary {
  project_name?: string;
  tags?: string[];
}

export default function ManualsPage() {
  const [manualList, setManualList] = useState<ManualWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedManual, setSelectedManual] = useState<ManualDetail | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingLanguage, setViewingLanguage] = useState<string>("en");
  const [viewingManualId, setViewingManualId] = useState<string | null>(null);

  // Project data
  const [projectList, setProjectList] = useState<ProjectSummary[]>([]);
  const [filterProjectId, setFilterProjectId] = useState<string>("__all__");
  const [filterOpen, setFilterOpen] = useState(false);

  // Tag filter state
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [tagFilterOpen, setTagFilterOpen] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [manualToDelete, setManualToDelete] = useState<ManualWithProject | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Assign to project dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [manualToAssign, setManualToAssign] = useState<ManualWithProject | null>(null);
  const [assignProjectId, setAssignProjectId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  // Tags management state
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [manualForTags, setManualForTags] = useState<ManualWithProject | null>(null);
  const [manualTags, setManualTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  // Generate language state
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [manualToGenerate, setManualToGenerate] = useState<ManualWithProject | null>(null);
  const [generateLanguage, setGenerateLanguage] = useState("English");
  const [overrideWarningOpen, setOverrideWarningOpen] = useState(false);
  const { state: processingState, startProcessing, reset: resetProcessing } = useVideoProcessing();

  useEffect(() => {
    loadManuals();
    loadProjects();
  }, []);

  async function loadManuals() {
    try {
      const res = await manuals.list();
      const projectsRes = await projects.list();

      // Create a map for project names
      const projectMap = new Map<string, string>();
      projectsRes.projects.forEach((p) => projectMap.set(p.id, p.name));

      // Backend now returns source_video and project_id directly
      const manualsWithProjects: ManualWithProject[] = res.manuals.map((m) => ({
        ...m,
        project_name: m.project_id ? projectMap.get(m.project_id) : undefined,
        tags: [],
      }));

      // Fetch tags for each manual
      for (const manual of manualsWithProjects) {
        try {
          const tagsRes = await manuals.getTags(manual.id);
          manual.tags = tagsRes.tags;
        } catch {
          manual.tags = [];
        }
      }

      setManualList(manualsWithProjects);
    } catch (e) {
      console.error("Failed to load manuals:", e);
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

  async function handleView(manualId: string, language: string) {
    try {
      const manual = await manuals.get(manualId, language);
      setSelectedManual(manual);
      setViewingManualId(manualId);
      setViewingLanguage(language);
      setViewDialogOpen(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load manual";
      toast.error("Load failed", { description: message });
    }
  }

  async function handleLanguageChange(language: string) {
    if (!viewingManualId) return;
    try {
      const manual = await manuals.get(viewingManualId, language);
      setSelectedManual(manual);
      setViewingLanguage(language);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load language";
      toast.error("Load failed", { description: message });
    }
  }

  function openDeleteDialog(manual: ManualWithProject) {
    setManualToDelete(manual);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!manualToDelete) return;

    setDeleting(true);
    try {
      await manuals.delete(manualToDelete.id);
      toast.success("Manual moved to trash", { description: manualToDelete.id });
      setDeleteDialogOpen(false);
      setManualToDelete(null);
      await loadManuals();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Delete failed";
      toast.error("Delete failed", { description: message });
    } finally {
      setDeleting(false);
    }
  }

  function openAssignDialog(manual: ManualWithProject) {
    setManualToAssign(manual);
    setAssignProjectId(manual.project_id || "");
    setAssignDialogOpen(true);
  }

  async function handleAssignToProject() {
    if (!manualToAssign || !assignProjectId) return;

    setAssigning(true);
    try {
      await manualProject.assign(manualToAssign.id, assignProjectId);
      toast.success("Manual assigned to project");
      setAssignDialogOpen(false);
      setManualToAssign(null);
      await loadManuals();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Assignment failed";
      toast.error("Assignment failed", { description: message });
    } finally {
      setAssigning(false);
    }
  }

  async function handleRemoveFromProject(manual: ManualWithProject) {
    try {
      await manualProject.remove(manual.id);
      toast.success("Manual removed from project");
      await loadManuals();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Remove failed";
      toast.error("Remove failed", { description: message });
    }
  }

  async function openTagsDialog(manual: ManualWithProject) {
    setManualForTags(manual);
    setManualTags(manual.tags || []);
    setNewTag("");
    setTagsDialogOpen(true);
  }

  async function handleAddTag() {
    if (!manualForTags || !newTag.trim()) return;

    try {
      await manuals.addTags(manualForTags.id, [newTag.trim()]);
      setManualTags([...manualTags, newTag.trim()]);
      setNewTag("");
      // Update local manual list
      setManualList((prev) =>
        prev.map((m) =>
          m.id === manualForTags.id ? { ...m, tags: [...(m.tags || []), newTag.trim()] } : m
        )
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to add tag";
      toast.error("Error", { description: message });
    }
  }

  async function handleRemoveTag(tag: string) {
    if (!manualForTags) return;

    try {
      await manuals.removeTag(manualForTags.id, tag);
      setManualTags(manualTags.filter((t) => t !== tag));
      // Update local manual list
      setManualList((prev) =>
        prev.map((m) =>
          m.id === manualForTags.id ? { ...m, tags: (m.tags || []).filter((t) => t !== tag) } : m
        )
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to remove tag";
      toast.error("Error", { description: message });
    }
  }

  // Generate language functions
  function openGenerateDialog(manual: ManualWithProject) {
    setManualToGenerate(manual);
    setGenerateLanguage("English");
    resetProcessing();
    setGenerateDialogOpen(true);
  }

  // Language code mapping (simplified - backend handles full mapping)
  function getLanguageCode(language: string): string {
    const map: Record<string, string> = {
      english: "en", spanish: "es", french: "fr", german: "de",
      italian: "it", portuguese: "pt", dutch: "nl", russian: "ru",
      chinese: "zh", japanese: "ja", korean: "ko", arabic: "ar",
    };
    return map[language.toLowerCase()] || language.toLowerCase().slice(0, 2);
  }

  async function handleGenerate() {
    if (!manualToGenerate) return;

    // Check if language already exists
    const langCode = getLanguageCode(generateLanguage);
    const existingLangs = manualToGenerate.languages || [];
    if (existingLangs.includes(langCode)) {
      setOverrideWarningOpen(true);
      return;
    }

    await startGeneration();
  }

  async function startGeneration() {
    if (!manualToGenerate) return;

    setOverrideWarningOpen(false);

    try {
      await startProcessing({
        manual_id: manualToGenerate.id,
        output_language: generateLanguage,
        use_scene_detection: true,
      });
      // Reload manuals after completion
      await loadManuals();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Generation failed";
      toast.error("Generation failed", { description: message });
    }
  }

  // Export manual
  async function handleExport(manual: ManualWithProject, format: "pdf" | "word" | "html") {
    try {
      const language = manual.languages[0] || "en";
      const result = await manuals.export(manual.id, format, language);

      // Trigger automatic download
      const link = document.createElement('a');
      link.href = result.download_url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported as ${format.toUpperCase()}`, {
        description: `${result.filename} (${(result.size_bytes / 1024).toFixed(1)} KB)`
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Export failed";
      toast.error("Export failed", { description: message });
    }
  }

  // Collect unique tags from all manuals
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    manualList.forEach((m) => m.tags?.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [manualList]);

  // Get selected project name for display
  const selectedProjectName = filterProjectId === "__all__"
    ? "All Projects"
    : filterProjectId === "__unassigned__"
    ? "Unassigned"
    : projectList.find((p) => p.id === filterProjectId)?.name || "Select project";

  // Filter manuals by project and tags
  const filteredManuals = useMemo(() => {
    let result = manualList;

    // Filter by project
    if (filterProjectId !== "__all__") {
      if (filterProjectId === "__unassigned__") {
        result = result.filter((m) => !m.project_id);
      } else {
        result = result.filter((m) => m.project_id === filterProjectId);
      }
    }

    // Filter by tags (AND logic - must have all selected tags)
    if (filterTags.length > 0) {
      result = result.filter((m) =>
        filterTags.every((tag) => m.tags?.includes(tag))
      );
    }

    return result;
  }, [manualList, filterProjectId, filterTags]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manuals</h1>
          <p className="text-muted-foreground">
            View and manage your generated manuals
          </p>
        </div>

        {/* Filters */}
        {manualList.length > 0 && (
          <div className="flex items-center gap-2">
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
                      <CommandItem
                        value="__unassigned__"
                        onSelect={() => {
                          setFilterProjectId("__unassigned__");
                          setFilterOpen(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${filterProjectId === "__unassigned__" ? "opacity-100" : "opacity-0"}`}
                        />
                        Unassigned
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

            {/* Tag Filter - Multi-select */}
            {allTags.length > 0 && (
              <Popover open={tagFilterOpen} onOpenChange={setTagFilterOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={tagFilterOpen}
                    className="w-[160px] justify-between"
                  >
                    <Tag className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {filterTags.length === 0
                        ? "All Tags"
                        : `${filterTags.length} tag${filterTags.length > 1 ? "s" : ""}`}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder="Search tags..." />
                    <CommandList>
                      <CommandEmpty>No tags found.</CommandEmpty>
                      <CommandGroup>
                        {filterTags.length > 0 && (
                          <CommandItem
                            onSelect={() => setFilterTags([])}
                            className="text-muted-foreground"
                          >
                            <X className="mr-2 h-4 w-4" />
                            Clear all
                          </CommandItem>
                        )}
                        {allTags.map((tag) => {
                          const isSelected = filterTags.includes(tag);
                          return (
                            <CommandItem
                              key={tag}
                              value={tag}
                              onSelect={() => {
                                setFilterTags((prev) =>
                                  isSelected
                                    ? prev.filter((t) => t !== tag)
                                    : [...prev, tag]
                                );
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`}
                              />
                              {tag}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading manuals...
        </div>
      ) : manualList.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No manuals found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Process a video to generate your first manual
            </p>
            <Link href="/dashboard/videos">
              <Button className="mt-4">Go to Videos</Button>
            </Link>
          </CardContent>
        </Card>
      ) : filteredManuals.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No manuals match this filter</p>
            <Button variant="outline" className="mt-4" onClick={() => { setFilterProjectId("__all__"); setFilterTags([]); }}>
              Show All
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredManuals.map((manual) => (
            <Card
              key={manual.id}
              className="
                group relative overflow-hidden flex flex-col
                transition-all duration-300 ease-out
                hover:shadow-lg hover:-translate-y-1
                hover:border-primary/30
              "
            >
              {/* Subtle gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

              <CardHeader className="pb-0 relative">
                <div className="flex items-start justify-between gap-2">
                  {/* Editorial title with serif font */}
                  <CardTitle className="font-display text-lg tracking-tight leading-tight truncate flex-1">
                    {manual.id}
                  </CardTitle>

                  {/* Edit button - reveals on hover */}
                  <Link href={`/dashboard/manuals/${manual.id}/edit`}>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit manual"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>

                {/* Source, Project & Languages info */}
                <div className="space-y-1.5 mt-2">
                  {/* Source video info */}
                  {manual.source_video && (
                    <Link
                      href="/dashboard/videos"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group/link"
                    >
                      <Video className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{manual.source_video.name}</span>
                      {!manual.source_video.exists && (
                        <Badge variant="destructive" className="text-xs px-1.5 py-0">
                          <AlertCircle className="h-3 w-3 mr-0.5" />
                          deleted
                        </Badge>
                      )}
                    </Link>
                  )}

                  {/* Project info */}
                  {manual.project_name && manual.project_id && (
                    <Link
                      href="/dashboard/projects"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      <FolderKanban className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate">{manual.project_name}</span>
                      <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  )}

                  {/* Languages */}
                  <div className="flex items-center gap-1.5">
                    {(manual.languages.length > 0 ? manual.languages : ["en"]).map((lang) => (
                      <Badge key={lang} variant="outline" className="text-xs px-1.5 py-0 font-mono uppercase">
                        {lang}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="relative flex-1 flex flex-col">
                {/* Screenshots row */}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <ImageIcon className="h-4 w-4" />
                  <span className="font-medium text-foreground">{manual.screenshot_count}</span>
                  <span>screenshots</span>
                </div>

                {/* Tags */}
                {manual.tags && manual.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {manual.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Spacer to push actions to bottom */}
                <div className="flex-1 min-h-4" />

                {/* Created date - subtle */}
                {manual.created_at && (
                  <p className="text-xs text-muted-foreground/60 mb-3">
                    {new Date(manual.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                )}

                {/* Actions - always at bottom */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleView(manual.id, manual.languages[0] || "en")}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Manual
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        title="Export manual"
                        className="opacity-70 hover:opacity-100 transition-opacity"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExport(manual, "pdf")}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Export as PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport(manual, "word")}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Export as Word
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport(manual, "html")}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Export as HTML
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openGenerateDialog(manual)}
                    title="Generate in another language"
                    className="opacity-70 hover:opacity-100 transition-opacity"
                  >
                    <Wand2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openAssignDialog(manual)}
                    title="Assign to project"
                    className="opacity-70 hover:opacity-100 transition-opacity"
                  >
                    <FolderKanban className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openTagsDialog(manual)}
                    title="Manage tags"
                    className="opacity-70 hover:opacity-100 transition-opacity"
                  >
                    <Tag className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openDeleteDialog(manual)}
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

      {/* View Manual Sheet (Slide-over panel) */}
      <Sheet open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <SheetContent side="right" fullPage className="p-0 flex flex-col overflow-hidden">
          {/* Fixed Header */}
          <SheetHeader className="border-b p-6 pr-14 space-y-0 shrink-0">
            <SheetTitle className="text-2xl font-bold">{selectedManual?.id}</SheetTitle>

            {/* Source info in header */}
            {selectedManual && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-2">
                {manualList.find((m) => m.id === selectedManual.id)?.source_video && (
                  <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md">
                    <Video className="h-4 w-4" />
                    {manualList.find((m) => m.id === selectedManual.id)?.source_video?.name}
                  </span>
                )}
                {manualList.find((m) => m.id === selectedManual.id)?.project_name && (
                  <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md">
                    <FolderKanban className="h-4 w-4" />
                    {manualList.find((m) => m.id === selectedManual.id)?.project_name}
                  </span>
                )}
                <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md">
                  <ImageIcon className="h-4 w-4" />
                  {selectedManual.screenshots.length} screenshots
                </span>

                {/* Language Switcher */}
                {(() => {
                  const currentManual = manualList.find((m) => m.id === selectedManual.id);
                  if (!currentManual || currentManual.languages.length <= 1) return null;
                  return (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-md hover:bg-primary/20 transition-colors">
                          <Globe className="h-4 w-4" />
                          {viewingLanguage.toUpperCase()}
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {currentManual.languages.map((lang) => (
                          <DropdownMenuItem
                            key={lang}
                            onClick={() => handleLanguageChange(lang)}
                            className={`cursor-pointer ${lang === viewingLanguage ? "bg-accent" : ""}`}
                          >
                            <Globe className="mr-2 h-4 w-4" />
                            {lang.toUpperCase()}
                            {lang === viewingLanguage && (
                              <Check className="ml-auto h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })()}
              </div>
            )}
          </SheetHeader>

          {selectedManual && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <Tabs defaultValue="content" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-6 pt-4 border-b">
                  <TabsList className="shrink-0 mb-4 w-fit">
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="screenshots">
                    Screenshots ({selectedManual.screenshots.length})
                  </TabsTrigger>
                </TabsList>
                </div>

                <TabsContent value="content" className="flex-1 overflow-y-auto mt-0 p-6">
                  <div className="prose prose-base dark:prose-invert max-w-none pb-8">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        img: ({ src, alt }) => {
                          // Transform markdown image references to API URLs
                          const srcStr = typeof src === "string" ? src : "";
                          const filename = srcStr.split("/").pop() || srcStr;
                          const apiUrl = `/api/manuals/${selectedManual.id}/screenshots/${filename}`;
                          return (
                            <span className="block my-6">
                              <img
                                src={apiUrl}
                                alt={alt || "Screenshot"}
                                className="rounded-lg border shadow-sm w-full"
                              />
                              {alt && (
                                <span className="block text-center text-sm text-muted-foreground mt-2">
                                  {alt}
                                </span>
                              )}
                            </span>
                          );
                        },
                        h1: ({ children }) => (
                          <h1 className="text-3xl font-bold mt-8 mb-4 first:mt-0 pb-2 border-b">{children}</h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-2xl font-semibold mt-8 mb-4">{children}</h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-xl font-medium mt-6 mb-3">{children}</h3>
                        ),
                        h4: ({ children }) => (
                          <h4 className="text-lg font-medium mt-4 mb-2">{children}</h4>
                        ),
                        p: ({ children }) => (
                          <p className="my-4 leading-7 text-foreground/90">{children}</p>
                        ),
                        ul: ({ children }) => (
                          <ul className="my-4 ml-6 list-disc space-y-2">{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="my-4 ml-6 list-decimal space-y-2">{children}</ol>
                        ),
                        li: ({ children }) => (
                          <li className="leading-7">{children}</li>
                        ),
                        code: ({ children, className }) => {
                          const isInline = !className;
                          return isInline ? (
                            <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
                          ) : (
                            <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-4">
                              <code className="text-sm font-mono">{children}</code>
                            </pre>
                          );
                        },
                        pre: ({ children }) => <>{children}</>,
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-primary/50 bg-muted/50 pl-4 pr-4 py-3 my-4 italic rounded-r-lg">
                            {children}
                          </blockquote>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold text-foreground">{children}</strong>
                        ),
                        hr: () => <hr className="my-8 border-border" />,
                        table: ({ children }) => (
                          <div className="my-4 overflow-x-auto">
                            <table className="w-full border-collapse border border-border rounded-lg">{children}</table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th className="border border-border bg-muted px-4 py-2 text-left font-semibold">{children}</th>
                        ),
                        td: ({ children }) => (
                          <td className="border border-border px-4 py-2">{children}</td>
                        ),
                      }}
                    >
                      {selectedManual.content}
                    </ReactMarkdown>
                  </div>
                </TabsContent>

                <TabsContent value="screenshots" className="flex-1 overflow-y-auto mt-0 p-6">
                  <div className="grid grid-cols-1 gap-6 pb-8">
                    {selectedManual.screenshots.map((screenshot, idx) => (
                      <div key={idx} className="border rounded-lg overflow-hidden shadow-sm">
                        <img
                          src={`/api/manuals/${selectedManual.id}/screenshots/${screenshot.split("/").pop()}`}
                          alt={`Screenshot ${idx + 1}`}
                          className="w-full"
                        />
                        <div className="px-4 py-3 text-sm text-muted-foreground bg-muted/50 flex items-center justify-between">
                          <span className="font-medium">Step {idx + 1}</span>
                          <span className="text-xs">{screenshot.split("/").pop()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Manual?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{manualToDelete?.id}</strong>?
              The manual will be moved to trash and can be recovered within 30 days.
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
                  Delete Manual
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign to Project Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5" />
              Assign to Project
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Assign <strong>{manualToAssign?.id}</strong> to a project
            </p>
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={assignProjectId} onValueChange={setAssignProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projectList.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                      {project.is_default && " (default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {manualToAssign?.project_id && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-2">
                  Currently in: <strong>{manualToAssign.project_name}</strong>
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleRemoveFromProject(manualToAssign);
                    setAssignDialogOpen(false);
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Remove from current project
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignToProject} disabled={assigning || !assignProjectId}>
              {assigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tags Management Dialog */}
      <Dialog open={tagsDialogOpen} onOpenChange={setTagsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Manage Tags
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tags for <strong>{manualForTags?.id}</strong>
            </p>

            {/* Current Tags */}
            <div className="flex flex-wrap gap-2">
              {manualTags.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tags yet</p>
              ) : (
                manualTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>

            {/* Add New Tag */}
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="New tag"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <Button onClick={handleAddTag} disabled={!newTag.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagsDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Language Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={(open) => {
        if (!open && processingState.status === "processing") return; // Prevent closing while processing
        setGenerateDialogOpen(open);
        if (!open) resetProcessing();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Generate Language
            </DialogTitle>
          </DialogHeader>

          {processingState.status === "idle" ? (
            <div className="space-y-4">
              {/* Manual Info */}
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{manualToGenerate?.id}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  {manualToGenerate?.source_video && (
                    <span className="flex items-center gap-1.5">
                      <Video className="h-4 w-4" />
                      {manualToGenerate.source_video.name}
                    </span>
                  )}
                  {manualToGenerate?.project_name && (
                    <span className="flex items-center gap-1.5">
                      <FolderKanban className="h-4 w-4" />
                      {manualToGenerate.project_name}
                    </span>
                  )}
                </div>
                {/* Existing languages */}
                {manualToGenerate?.languages && manualToGenerate.languages.length > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs text-muted-foreground">Existing:</span>
                    {manualToGenerate.languages.map((lang) => (
                      <Badge key={lang} variant="outline" className="text-xs font-mono uppercase">
                        {lang}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Output Language</Label>
                  <Input
                    value={generateLanguage}
                    onChange={(e) => setGenerateLanguage(e.target.value)}
                    placeholder="English"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Project</Label>
                  <Input
                    value={manualToGenerate?.project_name || "Default Project"}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              <Button onClick={handleGenerate} className="w-full">
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Manual
              </Button>
            </div>
          ) : (
            <ProcessingProgress state={processingState} />
          )}
        </DialogContent>
      </Dialog>

      {/* Override Warning Dialog */}
      <AlertDialog open={overrideWarningOpen} onOpenChange={setOverrideWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Language Already Exists
            </AlertDialogTitle>
            <AlertDialogDescription>
              A manual in <strong>{generateLanguage}</strong> already exists for this manual.
              Regenerating will replace the existing version. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={startGeneration}>
              Override Existing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
