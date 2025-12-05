"use client";

import { Suspense, useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Eye, Trash2, FileText, Image as ImageIcon, FolderKanban, Plus, X, Tag, Loader2, Video, AlertCircle, ArrowUpRight, Pencil, Check, ChevronsUpDown, Globe, ChevronDown, Wand2, Download, FileDown, ClipboardCheck, Users, Target, History, Clock, MoreHorizontal, HelpCircle, Expand } from "lucide-react";
import { manuals, manualProject, projects, type ManualSummary, type ManualDetail, type ProjectSummary, type ManualEvaluation } from "@/lib/api";
import { useVideoProcessing } from "@/hooks/useWebSocket";
import { ProcessingProgress } from "@/components/processing/ProcessingProgress";
import { SUPPORTED_LANGUAGES, getScoreColorByRaw, getScoreColorByPercentage, getScoreLevel, SCORE_LEVEL_DESCRIPTIONS } from "@/lib/constants";

// Extended manual info with additional data
interface ManualWithProject extends ManualSummary {
  project_name?: string;
  tags?: string[];
}

function ManualsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [manualList, setManualList] = useState<ManualWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedManual, setSelectedManual] = useState<ManualDetail | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingLanguage, setViewingLanguage] = useState<string>("en");
  const [viewingManualId, setViewingManualId] = useState<string | null>(null);

  // Project data
  const [projectList, setProjectList] = useState<ProjectSummary[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  // Tag filter state
  const [tagFilterOpen, setTagFilterOpen] = useState(false);

  // Initialize filter state from URL params
  const filterProjectId = searchParams.get("project") || "__all__";
  const filterTags = useMemo(() => {
    const tagsParam = searchParams.get("tags");
    return tagsParam ? tagsParam.split(",").filter(Boolean) : [];
  }, [searchParams]);

  // Update URL when filters change
  const updateFilters = useCallback(
    (projectId: string, tags: string[]) => {
      const params = new URLSearchParams();
      if (projectId !== "__all__") {
        params.set("project", projectId);
      }
      if (tags.length > 0) {
        params.set("tags", tags.join(","));
      }
      const queryString = params.toString();
      router.replace(queryString ? `?${queryString}` : "/dashboard/manuals", { scroll: false });
    },
    [router]
  );

  const setFilterProjectId = useCallback(
    (projectId: string) => {
      updateFilters(projectId, filterTags);
    },
    [updateFilters, filterTags]
  );

  const setFilterTags = useCallback(
    (tagsOrUpdater: string[] | ((prev: string[]) => string[])) => {
      const newTags = typeof tagsOrUpdater === "function" ? tagsOrUpdater(filterTags) : tagsOrUpdater;
      updateFilters(filterProjectId, newTags);
    },
    [updateFilters, filterProjectId, filterTags]
  );

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

  // Evaluation state
  const [evaluateDialogOpen, setEvaluateDialogOpen] = useState(false);
  const [manualToEvaluate, setManualToEvaluate] = useState<ManualWithProject | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<ManualEvaluation | null>(null);
  const [storedEvaluations, setStoredEvaluations] = useState<Array<{
    version: string;
    language: string;
    overall_score: number;
    evaluated_at: string;
    stored_at: string;
  }>>([]);
  const [loadingStoredEval, setLoadingStoredEval] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [availableVersions, setAvailableVersions] = useState<Array<{
    version: string;
    is_current: boolean;
    created_at: string;
  }>>([]);

  // Evaluation state for view sheet
  const [viewingEvaluation, setViewingEvaluation] = useState<ManualEvaluation | null>(null);
  const [loadingViewEval, setLoadingViewEval] = useState(false);

  // Export loading state (tracks which manual/format is exporting)
  const [exportingManual, setExportingManual] = useState<string | null>(null);

  // Abort controller ref for cancelling in-flight evaluation requests
  const evalAbortControllerRef = useRef<AbortController | null>(null);

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
      setViewingEvaluation(null);
      setViewDialogOpen(true);

      // Load evaluation for this manual/language in background
      loadViewingEvaluation(manualId, language);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load manual";
      toast.error("Load failed", { description: message });
    }
  }

  async function loadViewingEvaluation(manualId: string, language: string) {
    // Cancel any in-flight request to prevent race conditions
    if (evalAbortControllerRef.current) {
      evalAbortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    evalAbortControllerRef.current = abortController;

    // Clear stale data immediately
    setViewingEvaluation(null);
    setLoadingViewEval(true);

    try {
      // Check if aborted before each async operation
      if (abortController.signal.aborted) return;

      // Get the current version first
      const versionsRes = await manuals.listVersions(manualId);

      if (abortController.signal.aborted) return;

      const currentVersion = versionsRes.current_version;

      // Try to load evaluation for current version and language
      const evaluation = await manuals.getEvaluation(manualId, currentVersion, language);

      if (abortController.signal.aborted) return;

      setViewingEvaluation(evaluation);
    } catch (e) {
      // Ignore abort errors, but handle other errors
      if (e instanceof Error && e.name === 'AbortError') return;
      // No evaluation found - that's ok
      setViewingEvaluation(null);
    } finally {
      // Only update loading state if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setLoadingViewEval(false);
      }
    }
  }

  async function handleLanguageChange(language: string) {
    if (!viewingManualId) return;
    try {
      const manual = await manuals.get(viewingManualId, language);
      setSelectedManual(manual);
      setViewingLanguage(language);

      // Also reload evaluation for the new language
      loadViewingEvaluation(viewingManualId, language);
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
    // Prevent multiple exports of the same manual simultaneously
    if (exportingManual === manual.id) return;

    setExportingManual(manual.id);
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
    } finally {
      setExportingManual(null);
    }
  }

  // Evaluate manual
  async function openEvaluateDialog(manual: ManualWithProject, preferredLanguage?: string) {
    setManualToEvaluate(manual);
    setEvaluationResult(null);
    setStoredEvaluations([]);
    setAvailableVersions([]);

    // Initialize selected language - use preferred if provided and valid, else first available
    const defaultLanguage = preferredLanguage && manual.languages.includes(preferredLanguage)
      ? preferredLanguage
      : manual.languages[0] || "en";
    setSelectedLanguage(defaultLanguage);
    setSelectedVersion(""); // Will be set after fetching versions

    setEvaluateDialogOpen(true);
    setLoadingStoredEval(true);

    try {
      // Fetch versions and evaluations in parallel
      const [versionsRes, evalsRes] = await Promise.all([
        manuals.listVersions(manual.id),
        manuals.listEvaluations(manual.id),
      ]);

      // Set available versions
      setAvailableVersions(versionsRes.versions);
      setSelectedVersion(versionsRes.current_version);

      // Set stored evaluations
      setStoredEvaluations(evalsRes.evaluations);

      // If there's a stored evaluation for current version and language, load it
      const latestEval = evalsRes.evaluations.find(
        e => e.language === defaultLanguage && e.version === versionsRes.current_version
      );
      if (latestEval) {
        const stored = await manuals.getEvaluation(manual.id, latestEval.version, defaultLanguage);
        setEvaluationResult(stored);
      }
    } catch (e) {
      console.log("Error loading evaluation data:", e);
    } finally {
      setLoadingStoredEval(false);
    }
  }

  async function handleEvaluate() {
    if (!manualToEvaluate) return;

    setEvaluating(true);
    try {
      const result = await manuals.evaluate(manualToEvaluate.id, selectedLanguage);
      setEvaluationResult(result);
      toast.success("Evaluation complete and saved");

      // Refresh stored evaluations list
      const res = await manuals.listEvaluations(manualToEvaluate.id);
      setStoredEvaluations(res.evaluations);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Evaluation failed";
      toast.error("Evaluation failed", { description: message });
    } finally {
      setEvaluating(false);
    }
  }

  async function loadStoredEvaluation(version: string, language: string) {
    if (!manualToEvaluate) return;

    setLoadingStoredEval(true);
    try {
      const stored = await manuals.getEvaluation(manualToEvaluate.id, version, language);
      setEvaluationResult(stored);
      // Update selected values to match loaded evaluation
      setSelectedLanguage(language);
      setSelectedVersion(version);
    } catch (e) {
      toast.error("Failed to load evaluation");
    } finally {
      setLoadingStoredEval(false);
    }
  }

  // Collect unique tags from all manuals
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    manualList.forEach((m) => m.tags?.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [manualList]);

  // Build edit URL with filter params preserved
  const getEditUrl = useCallback(
    (manualId: string) => {
      const params = new URLSearchParams();
      if (filterProjectId !== "__all__") {
        params.set("project", filterProjectId);
      }
      if (filterTags.length > 0) {
        params.set("tags", filterTags.join(","));
      }
      const queryString = params.toString();
      return queryString
        ? `/dashboard/manuals/${manualId}/edit?${queryString}`
        : `/dashboard/manuals/${manualId}/edit`;
    },
    [filterProjectId, filterTags]
  );

  // Get selected project name for display
  const selectedProjectName = filterProjectId === "__all__"
    ? "All Projects"
    : projectList.find((p) => p.id === filterProjectId)?.name || "Select project";

  // Filter manuals by project and tags
  const filteredManuals = useMemo(() => {
    let result = manualList;

    // Filter by project
    if (filterProjectId !== "__all__") {
      result = result.filter((m) => m.project_id === filterProjectId);
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

              {/* Export loading overlay */}
              {exportingManual === manual.id && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm font-medium">Exporting...</span>
                  </div>
                </div>
              )}

              <CardHeader className="pb-0 relative">
                <div className="flex items-start justify-between gap-2">
                  {/* Editorial title with serif font */}
                  <CardTitle className="font-display text-lg tracking-tight leading-tight line-clamp-2 flex-1">
                    {manual.title || manual.id}
                  </CardTitle>
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

                {/* Target Audience & Objective */}
                {(manual.target_audience || manual.target_objective) && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                    {manual.target_audience && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="h-3 w-3 shrink-0" />
                        <span className="truncate">{manual.target_audience}</span>
                      </div>
                    )}
                    {manual.target_objective && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Target className="h-3 w-3 shrink-0" />
                        <span className="truncate">{manual.target_objective}</span>
                      </div>
                    )}
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

                {/* Actions - clean two-button layout */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleView(manual.id, manual.languages[0] || "en")}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Manual
                  </Button>
                  <Link href={getEditUrl(manual.id)} className="contents">
                    <Button size="sm" variant="outline" title="Edit manual content">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        title="More actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        {exportingManual === manual.id ? "Exporting..." : "Export"}
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => handleExport(manual, "pdf")}
                        disabled={exportingManual === manual.id}
                      >
                        {exportingManual === manual.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FileDown className="mr-2 h-4 w-4" />
                        )}
                        Export as PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExport(manual, "word")}
                        disabled={exportingManual === manual.id}
                      >
                        {exportingManual === manual.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FileDown className="mr-2 h-4 w-4" />
                        )}
                        Export as Word
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExport(manual, "html")}
                        disabled={exportingManual === manual.id}
                      >
                        {exportingManual === manual.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FileDown className="mr-2 h-4 w-4" />
                        )}
                        Export as HTML
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Generate</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => openGenerateDialog(manual)}>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Add Language
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEvaluateDialog(manual)}>
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        Evaluate Quality
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Organize</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => openAssignDialog(manual)}>
                        <FolderKanban className="mr-2 h-4 w-4" />
                        Assign to Project
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openTagsDialog(manual)}>
                        <Tag className="mr-2 h-4 w-4" />
                        Manage Tags
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => openDeleteDialog(manual)}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Manual
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                          {SUPPORTED_LANGUAGES[viewingLanguage] || viewingLanguage.toUpperCase()}
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
                            {SUPPORTED_LANGUAGES[lang] || lang.toUpperCase()}
                            {lang === viewingLanguage && (
                              <Check className="ml-auto h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })()}

                {/* Evaluation Score Card */}
                <div className="ml-auto">
                  {loadingViewEval ? (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-muted/30">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : viewingEvaluation ? (
                    <button
                      onClick={() => {
                        const manual = manualList.find((m) => m.id === selectedManual.id);
                        if (manual) {
                          setViewDialogOpen(false);
                          openEvaluateDialog(manual, viewingLanguage);
                        }
                      }}
                      className="group flex flex-col items-center px-5 py-3 rounded-lg border bg-muted/30 cursor-pointer transition-all duration-200 hover:border-primary/50 hover:bg-muted/50 active:scale-[0.98]"
                      title="Click to view full evaluation details"
                    >
                      {/* Card Header */}
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Eval Score</span>
                      {/* Score Display */}
                      <div className="flex items-baseline gap-0.5">
                        <span className={`text-3xl font-bold ${getScoreColorByRaw(viewingEvaluation.overall_score).text}`}>
                          {viewingEvaluation.overall_score}
                        </span>
                        <span className="text-lg text-muted-foreground">/10</span>
                      </div>
                      {/* View action hint */}
                      <span className="text-xs text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-primary transition-colors">
                        View Details
                        <Eye className="h-3 w-3" />
                      </span>
                    </button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const manual = manualList.find((m) => m.id === selectedManual.id);
                        if (manual) {
                          setViewDialogOpen(false);
                          openEvaluateDialog(manual, viewingLanguage);
                        }
                      }}
                      className="gap-2"
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      Evaluate Quality
                    </Button>
                  )}
                </div>
              </div>
            )}
          </SheetHeader>

          {selectedManual && (
            <div className="flex-1 overflow-y-auto p-6">
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
                            className="rounded-lg border shadow-sm max-w-full mx-auto"
                            style={{ maxHeight: '70vh' }}
                            onLoad={(e) => {
                              const img = e.currentTarget;
                              const isPortrait = img.naturalHeight > img.naturalWidth;
                              if (isPortrait) {
                                // Portrait: limit width to ~40% so it doesn't dominate
                                img.style.maxWidth = '40%';
                              }
                            }}
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

      {/* Evaluate Manual Dialog */}
      <Dialog open={evaluateDialogOpen} onOpenChange={setEvaluateDialogOpen}>
        <DialogContent className="max-w-[1100px] max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Manual Evaluation
            </DialogTitle>
          </DialogHeader>

          {/* Manual Info Header */}
          <div className="p-4 bg-muted rounded-lg space-y-3 shrink-0">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="font-medium">{manualToEvaluate?.id}</p>
              <div className="flex items-center gap-3">
                {/* Language Selector */}
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      {manualToEvaluate?.languages.map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {SUPPORTED_LANGUAGES[lang] || lang.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Version Selector */}
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                    <SelectTrigger className="w-[160px] h-8">
                      <SelectValue placeholder="Version" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVersions.map((v) => (
                        <SelectItem key={v.version} value={v.version}>
                          v{v.version} {v.is_current && "(current)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Target Audience & Objective */}
            {(manualToEvaluate?.target_audience || manualToEvaluate?.target_objective) && (
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 border-t text-sm">
                {manualToEvaluate?.target_audience && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <div className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors">
                        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">Audience:</span>
                        <span className="line-clamp-1">{manualToEvaluate.target_audience}</span>
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" align="start" className="w-96 p-0">
                      <div className="p-3 border-b">
                        <p className="font-medium text-sm flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Target Audience
                        </p>
                      </div>
                      <div className="max-h-48 overflow-y-auto p-3">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{manualToEvaluate.target_audience}</p>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                {manualToEvaluate?.target_objective && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <div className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors">
                        <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">Objective:</span>
                        <span className="line-clamp-1">{manualToEvaluate.target_objective}</span>
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" align="start" className="w-96 p-0">
                      <div className="p-3 border-b">
                        <p className="font-medium text-sm flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Target Objective
                        </p>
                      </div>
                      <div className="max-h-48 overflow-y-auto p-3">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{manualToEvaluate.target_objective}</p>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}
          </div>

          {/* Two Column Layout */}
          <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
            {/* Left Column - Main Content */}
            <div className="flex-[2] overflow-y-auto pr-2 space-y-6">

            {/* Evaluation Results */}
            {evaluationResult ? (
              <div className="space-y-6">
                {/* Version & Date Info */}
                {(evaluationResult as ManualEvaluation & { version?: string; stored_at?: string }).version && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
                    <span className="flex items-center gap-2">
                      <History className="h-3.5 w-3.5" />
                      Version {(evaluationResult as ManualEvaluation & { version?: string }).version}
                    </span>
                    <span className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(evaluationResult.evaluated_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}

                {/* Overall Score - Hero */}
                <div className="text-center p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border">
                  <p className="text-5xl font-bold text-primary mb-1">
                    {evaluationResult.overall_score}
                    <span className="text-2xl text-muted-foreground font-normal">/{evaluationResult.score_range?.max || 10}</span>
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-sm text-muted-foreground">Overall Score</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs text-left">
                        <p className="font-semibold mb-1">Scoring Guide</p>
                        <ul className="space-y-0.5 text-xs">
                          <li><span className="text-green-500">8-10:</span> Excellent - Professional quality</li>
                          <li><span className="text-yellow-500">6-7:</span> Good - Minor improvements possible</li>
                          <li><span className="text-orange-500">4-5:</span> Fair - Needs improvement</li>
                          <li><span className="text-red-500">1-3:</span> Poor - Major revisions needed</li>
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className={`text-sm font-medium mt-1 ${getScoreColorByRaw(evaluationResult.overall_score).text}`}>
                    {SCORE_LEVEL_DESCRIPTIONS[getScoreLevel(evaluationResult.overall_score)]}
                  </p>
                </div>

                {/* Summary */}
                <div className="p-4 bg-muted/50 rounded-lg border-l-4 border-primary">
                  <p className="text-sm leading-relaxed">{evaluationResult.summary}</p>
                </div>

                {/* Score Breakdown - Visual Progress Bars */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Score Breakdown</h3>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-sm text-left">
                        <p className="font-semibold mb-2">Evaluation Categories</p>
                        <ul className="space-y-1.5 text-xs">
                          <li><span className="font-medium">Objective Alignment:</span> How well the manual helps achieve its stated goal</li>
                          <li><span className="font-medium">Audience Appropriateness:</span> Language and depth match the target audience</li>
                          <li><span className="font-medium">General Usability:</span> Ease of use for general readers (when no target set)</li>
                          <li><span className="font-medium">Clarity & Completeness:</span> Instructions are clear with no missing steps</li>
                          <li><span className="font-medium">Technical Accuracy:</span> UI elements and actions correctly described</li>
                          <li><span className="font-medium">Structure & Flow:</span> Well-organized with logical progression</li>
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Score Item Component - includes context-dependent and always-present categories */}
                  {[
                    // Context-dependent categories (only one set will be present)
                    { key: 'objective_alignment', label: 'Objective Alignment', data: evaluationResult.objective_alignment },
                    { key: 'audience_appropriateness', label: 'Audience Appropriateness', data: evaluationResult.audience_appropriateness },
                    { key: 'general_usability', label: 'General Usability', data: evaluationResult.general_usability },
                    // Always-present categories
                    { key: 'clarity_and_completeness', label: 'Clarity & Completeness', data: evaluationResult.clarity_and_completeness },
                    { key: 'technical_accuracy', label: 'Technical Accuracy', data: evaluationResult.technical_accuracy },
                    { key: 'structure_and_flow', label: 'Structure & Flow', data: evaluationResult.structure_and_flow },
                  ].filter((item): item is { key: string; label: string; data: { score: number; explanation: string } } => !!item.data).map(({ key, label, data }) => {
                    const score = data.score;
                    const maxScore = evaluationResult.score_range?.max || 10;
                    const percentage = (score / maxScore) * 100;

                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">{label}</span>
                          <span className="text-sm font-bold">{score}/{maxScore}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getScoreColorByPercentage(percentage)} transition-all duration-500`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        {data.explanation && (
                          <p className="text-xs text-muted-foreground leading-relaxed">{data.explanation}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Strengths */}
                {evaluationResult.strengths && evaluationResult.strengths.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-green-600 dark:text-green-400 flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      Strengths
                    </h3>
                    <ul className="space-y-2">
                      {evaluationResult.strengths.map((strength, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-3 p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                          <span className="text-green-500 font-bold shrink-0">{idx + 1}.</span>
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Areas for Improvement */}
                {evaluationResult.areas_for_improvement && evaluationResult.areas_for_improvement.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Areas for Improvement
                    </h3>
                    <ul className="space-y-2">
                      {evaluationResult.areas_for_improvement.map((improvement, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-3 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                          <span className="text-amber-500 font-bold shrink-0">{idx + 1}.</span>
                          {improvement}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendations */}
                {evaluationResult.recommendations && evaluationResult.recommendations.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Recommendations
                    </h3>
                    <ul className="space-y-2">
                      {evaluationResult.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-3 p-2 rounded-lg bg-blue-500/5 border border-blue-500/20">
                          <span className="text-blue-500 font-bold shrink-0">{idx + 1}.</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              /* No evaluation yet - show start button */
              <div className="text-center py-12">
                <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-6">
                  Evaluate this manual against its target audience and objective using AI analysis.
                </p>
                <Button onClick={handleEvaluate} disabled={evaluating || loadingStoredEval} size="lg">
                  {evaluating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing Manual...
                    </>
                  ) : loadingStoredEval ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="mr-2 h-4 w-4" />
                      Start New Evaluation
                    </>
                  )}
                </Button>
              </div>
            )}
            </div>

            {/* Right Column - Evaluation History Sidebar */}
            <div className="w-[280px] shrink-0 border-l pl-4 overflow-y-auto">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2 mb-4 sticky top-0 bg-background py-2">
                <History className="h-4 w-4" />
                Evaluation History
              </h3>
              {storedEvaluations.length > 0 ? (
                <div className="space-y-2">
                  {storedEvaluations.map((evalItem, idx) => (
                    <button
                      key={idx}
                      onClick={() => loadStoredEvaluation(evalItem.version, evalItem.language)}
                      disabled={loadingStoredEval}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                        selectedVersion === evalItem.version && selectedLanguage === evalItem.language
                          ? 'bg-primary/10 border-primary/50'
                          : 'bg-muted/30 hover:bg-muted/60'
                      }`}
                    >
                      <div className={`text-lg font-bold shrink-0 ${
                        evalItem.overall_score >= 8 ? 'text-green-500' :
                        evalItem.overall_score >= 6 ? 'text-yellow-500' :
                        evalItem.overall_score >= 4 ? 'text-orange-500' : 'text-red-500'
                      }`}>
                        {evalItem.overall_score}/10
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">v{evalItem.version}</p>
                          <Badge variant="outline" className="text-[10px] font-mono uppercase shrink-0">
                            {evalItem.language}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3 shrink-0" />
                          {new Date(evalItem.evaluated_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No previous evaluations
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t pt-4 mt-4">
            <Button variant="outline" onClick={() => setEvaluateDialogOpen(false)}>
              {evaluationResult ? "Close" : "Cancel"}
            </Button>
            {evaluationResult && (
              <Button onClick={handleEvaluate} disabled={evaluating} variant="secondary">
                {evaluating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Re-evaluating...
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Re-evaluate
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Loading fallback for Suspense
function ManualsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Manuals</h1>
        <p className="text-muted-foreground">View and manage your generated manuals</p>
      </div>
      <div className="text-center py-8 text-muted-foreground">Loading manuals...</div>
    </div>
  );
}

// Main export wrapped in Suspense
export default function ManualsPage() {
  return (
    <Suspense fallback={<ManualsLoading />}>
      <ManualsPageContent />
    </Suspense>
  );
}
