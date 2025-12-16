"use client";

import { Suspense, useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
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
import { Eye, Trash2, FileText, Image as ImageIcon, FolderKanban, Plus, X, Tag, Loader2, Video, AlertCircle, ArrowUpRight, Pencil, Check, ChevronsUpDown, Globe, ChevronDown, Wand2, Download, FileDown, ClipboardCheck, Users, Target, History, Clock, MoreHorizontal, HelpCircle, Expand, Copy, ArrowLeft } from "lucide-react";
import { SidebarToggle } from "@/components/layout/SidebarToggle";
import { useSidebar } from "@/components/layout/SidebarContext";
import { manuals, manualProject, projects, type ManualSummary, type ManualDetail, type ProjectSummary, type ManualEvaluation } from "@/lib/api";
import { ExportDialog, type ExportOptions } from "@/components/dialogs/ExportDialog";
import { CloneManualDialog } from "@/components/dialogs/CloneManualDialog";
import { stripSemanticTags } from "@/lib/tag-utils";
import { useVideoProcessing } from "@/hooks/useWebSocket";
import { ProcessingProgress } from "@/components/processing/ProcessingProgress";
import { useJobsStore } from "@/stores/jobsStore";
import { useGuideStore } from "@/stores/guideStore";
import { SUPPORTED_LANGUAGES, getScoreColorByRaw, getScoreColorByPercentage, getScoreLevel, SCORE_LEVEL_DESCRIPTIONS } from "@/lib/constants";

// Extended manual info with additional data
interface ManualWithProject extends ManualSummary {
  project_name?: string;
  project_is_default?: boolean;
  tags?: string[];
}

function ManualsPageContent() {
  const t = useTranslations("manuals");
  const tc = useTranslations("common");
  const tp = useTranslations("projects");
  const locale = useLocale();
  const router = useRouter();
  const { collapsed: sidebarCollapsed } = useSidebar();
  const { setPageContext, close: closeGuidePanel } = useGuideStore();

  // Date locale mapping
  const dateLocale = locale === "es" ? "es-ES" : "en-US";

  // Helper to get translated name for default project
  const getProjectDisplayName = (project: { name: string; is_default?: boolean }) => {
    return project.is_default ? tp("defaultProjectName") : project.name;
  };

  // Helper to get display name for manual's project
  const getManualProjectDisplayName = (manual: ManualWithProject) => {
    if (!manual.project_name) return undefined;
    return manual.project_is_default ? tp("defaultProjectName") : manual.project_name;
  };
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
  const { suppressJob, unsuppressJob, jobs } = useJobsStore();

  // Get set of manual IDs that are currently being processed
  const processingManualIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(jobs).forEach((job) => {
      if ((job.status === "pending" || job.status === "processing") && job.manual_id) {
        ids.add(job.manual_id);
      }
    });
    return ids;
  }, [jobs]);

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

  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [manualToExport, setManualToExport] = useState<ManualWithProject | null>(null);

  // Clone dialog state
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [manualToClone, setManualToClone] = useState<ManualWithProject | null>(null);

  // Abort controller ref for cancelling in-flight evaluation requests
  const evalAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadManuals();
    loadProjects();
  }, []);

  // Suppress job from toast when generate dialog is open (to avoid duplicate UI)
  useEffect(() => {
    const jobId = processingState.jobId;
    if (generateDialogOpen && jobId) {
      suppressJob(jobId);
    }
    return () => {
      // Unsuppress when dialog closes or component unmounts
      if (jobId) {
        unsuppressJob(jobId);
      }
    };
  }, [generateDialogOpen, processingState.jobId, suppressJob, unsuppressJob]);

  async function loadManuals() {
    try {
      const res = await manuals.list();
      const projectsRes = await projects.list();

      // Create a map for project info (name + is_default)
      const projectMap = new Map<string, { name: string; is_default: boolean }>();
      projectsRes.projects.forEach((p) => projectMap.set(p.id, { name: p.name, is_default: p.is_default ?? false }));

      // Backend now returns source_video and project_id directly
      const manualsWithProjects: ManualWithProject[] = res.manuals.map((m) => {
        const projectInfo = m.project_id ? projectMap.get(m.project_id) : undefined;
        return {
          ...m,
          project_name: projectInfo?.name,
          project_is_default: projectInfo?.is_default,
          tags: [],
        };
      });

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

      // Update guide context with manuals data
      const manualsForGuide = manualsWithProjects.map((m) => ({
        id: m.id,
        title: m.title,
        languages: m.languages,
        evaluations: m.evaluations, // { lang: { evaluated: bool, score?: number } }
        tags: m.tags,
        project_name: m.project_name,
        document_format: m.document_format,
      }));
      setPageContext({
        currentPage: "/dashboard/manuals",
        pageTitle: "Manuals",
        availableActions: ["view", "edit", "export", "evaluate", "add_language", "assign_project", "manage_tags", "delete"],
        pageState: {
          manuals: manualsForGuide,
          totalCount: manualsForGuide.length,
        },
      });
    } catch {
      // Failed to load manuals
    } finally {
      setLoading(false);
    }
  }

  async function loadProjects() {
    try {
      const res = await projects.list();
      setProjectList(res.projects);
    } catch {
      // Failed to load projects
    }
  }

  async function handleView(manualId: string, language: string) {
    // Set loading states before opening to prevent flicker
    setViewingEvaluation(null);
    setLoadingViewEval(true);

    try {
      const manual = await manuals.get(manualId, language);
      setSelectedManual(manual);
      setViewingManualId(manualId);
      setViewingLanguage(language);
      setViewDialogOpen(true);

      // Load evaluation for this manual/language in background
      loadViewingEvaluation(manualId, language);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load manual";
      toast.error("Load failed", { description: message });
      setLoadingViewEval(false);
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

    // Ensure loading state is set (may already be set by caller)
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

    // Set loading state before fetching to prevent flicker
    setViewingEvaluation(null);
    setLoadingViewEval(true);

    try {
      const manual = await manuals.get(viewingManualId, language);
      setSelectedManual(manual);
      setViewingLanguage(language);

      // Also reload evaluation for the new language
      loadViewingEvaluation(viewingManualId, language);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load language";
      toast.error("Load failed", { description: message });
      setLoadingViewEval(false);
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
    // Close guide panel so user can focus on generation
    closeGuidePanel();

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

  // Open export dialog
  function openExportDialog(manual: ManualWithProject) {
    setManualToExport(manual);
    setExportDialogOpen(true);
  }

  // Export manual with options
  async function handleExportWithOptions(options: ExportOptions) {
    if (!manualToExport) return;

    const manual = manualToExport;
    setExportingManual(manual.id);
    try {
      const result = await manuals.export(
        manual.id,
        options.format,
        options.language,
        true,
        options.templateName
      );

      // Trigger automatic download
      const link = document.createElement('a');
      link.href = result.download_url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      const templateInfo = options.templateName ? ` using "${options.templateName}" template` : "";
      toast.success(`Exported as ${options.format.toUpperCase()}`, {
        description: `${result.filename} (${(result.size_bytes / 1024).toFixed(1)} KB)${templateInfo}`
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Export failed";
      toast.error("Export failed", { description: message });
      throw e; // Re-throw to let dialog handle it
    } finally {
      setExportingManual(null);
    }
  }

  // Quick export (PDF/HTML without dialog)
  async function handleQuickExport(manual: ManualWithProject, format: "pdf" | "html") {
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

  // Clone manual to different format
  function openCloneDialog(manual: ManualWithProject) {
    setManualToClone(manual);
    setCloneDialogOpen(true);
  }

  function handleCloneSuccess(newManual: ManualSummary) {
    // Add the new manual to the list
    const manualWithProject: ManualWithProject = {
      ...newManual,
      tags: [],
    };
    setManualList((prev) => [manualWithProject, ...prev]);
    toast.success("Manual cloned successfully", {
      description: `Created "${newManual.title}" in ${newManual.document_format} format`,
    });
  }

  // Evaluate manual
  async function openEvaluateDialog(manual: ManualWithProject, preferredLanguage?: string) {
    // Close guide panel so user can focus on evaluation
    closeGuidePanel();

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
    } catch {
      // Failed to load evaluation data
    } finally {
      setLoadingStoredEval(false);
    }
  }

  async function handleEvaluate() {
    if (!manualToEvaluate) return;

    setEvaluating(true);
    try {
      const result = await manuals.evaluate(manualToEvaluate.id, selectedLanguage, locale);
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
    ? t("allProjects")
    : projectList.find((p) => p.id === filterProjectId)?.name || t("selectProject");

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
        <div className="flex gap-3">
          <SidebarToggle className="mt-1.5 shrink-0" />
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground">
              {t("description")}
            </p>
          </div>
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
                  <CommandInput placeholder={t("searchProjects")} />
                  <CommandList>
                    <CommandEmpty>{t("noProjectFound")}</CommandEmpty>
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
                        {t("allProjects")}
                      </CommandItem>
                      {projectList.map((project) => (
                        <CommandItem
                          key={project.id}
                          value={getProjectDisplayName(project)}
                          onSelect={() => {
                            setFilterProjectId(project.id);
                            setFilterOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${filterProjectId === project.id ? "opacity-100" : "opacity-0"}`}
                          />
                          {getProjectDisplayName(project)}
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
                        ? t("allTags")
                        : `${filterTags.length} tag${filterTags.length > 1 ? "s" : ""}`}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder={t("searchTags")} />
                    <CommandList>
                      <CommandEmpty>{t("noTagsFound")}</CommandEmpty>
                      <CommandGroup>
                        {filterTags.length > 0 && (
                          <CommandItem
                            onSelect={() => setFilterTags([])}
                            className="text-muted-foreground"
                          >
                            <X className="mr-2 h-4 w-4" />
                            {t("clearAll")}
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
          {tc("loading")}
        </div>
      ) : manualList.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t("noManuals")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("noManualsDesc")}
            </p>
            <Link href="/dashboard/videos">
              <Button className="mt-4">{t("goToVideos")}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : filteredManuals.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t("noManualsMatchFilter")}</p>
            <Button variant="outline" className="mt-4" onClick={() => { setFilterProjectId("__all__"); setFilterTags([]); }}>
              {t("showAll")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredManuals.map((manual, index) => (
            <Card
              key={manual.id}
              data-guide-id={index === 0 ? "first-manual-card" : `manual-card-${manual.id}`}
              className="
                group relative overflow-hidden flex flex-col
                transition-all duration-300 ease-out
                hover:shadow-lg hover:-translate-y-1
                hover:border-primary/30
              "
            >
              {/* Subtle gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

              {/* Processing overlay */}
              {processingManualIds.has(manual.id) && (
                <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm font-medium">{t("processingInProgress")}</span>
                    <span className="text-xs text-muted-foreground">{t("pleaseWait")}</span>
                  </div>
                </div>
              )}

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
                {/* Editorial title with serif font */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CardTitle className="font-display text-lg tracking-tight leading-tight cursor-default overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                      {manual.title || manual.id}
                    </CardTitle>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-sm">
                    <p className="break-words">{manual.title || manual.id}</p>
                  </TooltipContent>
                </Tooltip>

                {/* Document format badge */}
                {manual.document_format && (
                  <Badge
                    variant="secondary"
                    className="mt-1.5 text-[10px] px-1.5 py-0 font-medium bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    {manual.document_format === "step-manual" && "Step-by-step"}
                    {manual.document_format === "quick-guide" && "Quick Guide"}
                    {manual.document_format === "reference" && "Reference"}
                    {manual.document_format === "summary" && "Summary"}
                    {!["step-manual", "quick-guide", "reference", "summary"].includes(manual.document_format) && manual.document_format}
                  </Badge>
                )}

                {/* Source, Project & Languages info */}
                <div className="space-y-1.5 mt-2 min-w-0">
                  {/* Source video info */}
                  {manual.source_video && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href="/dashboard/videos"
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group/link min-w-0"
                        >
                          <Video className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate min-w-0">{manual.source_video.name}</span>
                          {!manual.source_video.exists && (
                            <Badge variant="destructive" className="text-xs px-1.5 py-0 shrink-0">
                              <AlertCircle className="h-3 w-3 mr-0.5" />
                              deleted
                            </Badge>
                          )}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-sm">
                        <p className="break-all">{manual.source_video.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Project info */}
                  {manual.project_name && manual.project_id && (
                    <Link
                      href="/dashboard/projects"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors min-w-0"
                    >
                      <FolderKanban className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate min-w-0">{getManualProjectDisplayName(manual)}</span>
                      <ArrowUpRight className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  )}

                  {/* Languages with evaluation scores */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(manual.languages.length > 0 ? manual.languages : ["en"]).map((lang) => {
                      const evaluation = manual.evaluations?.[lang];
                      const hasScore = evaluation?.evaluated && evaluation?.score != null;
                      const scoreColors = hasScore ? getScoreColorByRaw(evaluation.score!) : null;

                      return (
                        <div key={lang} className="flex items-center gap-0.5">
                          <Badge variant="outline" className="text-xs px-1.5 py-0 font-mono uppercase rounded-r-none border-r-0">
                            {lang}
                          </Badge>
                          {hasScore && scoreColors ? (
                            <Badge
                              variant="outline"
                              className={`text-xs px-1 py-0 rounded-l-none font-medium border-0 ${scoreColors.bgLight} ${scoreColors.text}`}
                            >
                              {evaluation.score}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs px-1 py-0 rounded-l-none text-muted-foreground">
                              —
                            </Badge>
                          )}
                        </div>
                      );
                    })}
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
                    {new Date(manual.created_at).toLocaleDateString(dateLocale, {
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
                    {t("view")}
                  </Button>
                  <Link href={getEditUrl(manual.id)} className="contents">
                    <Button
                      size="sm"
                      variant="outline"
                      title="Edit manual content"
                      data-guide-id={index === 0 ? "first-manual-edit-btn" : `manual-edit-btn-${manual.id}`}
                    >
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
                        {exportingManual === manual.id ? t("exporting") : t("export")}
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => openExportDialog(manual)}
                        disabled={exportingManual === manual.id}
                      >
                        {exportingManual === manual.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        {t("export")}...
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground">{t("generate")}</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => openGenerateDialog(manual)}>
                        <Wand2 className="mr-2 h-4 w-4" />
                        {t("addLanguage")}
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled className="opacity-60">
                        <Copy className="mr-2 h-4 w-4" />
                        {t("cloneToFormat")}
                        <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 h-4 border-amber-300 text-amber-600 bg-amber-50">
                          Soon
                        </Badge>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEvaluateDialog(manual)}>
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        {t("evaluateQuality")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground">{t("organize")}</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => openAssignDialog(manual)}>
                        <FolderKanban className="mr-2 h-4 w-4" />
                        {t("assignToProject")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openTagsDialog(manual)}>
                        <Tag className="mr-2 h-4 w-4" />
                        {t("manageTags")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => openDeleteDialog(manual)}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t("deleteManual")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Manual Panel - Full Page View */}
      {viewDialogOpen && selectedManual && (
        <div className={`fixed inset-y-0 right-0 z-40 bg-background flex flex-col overflow-hidden ${sidebarCollapsed ? 'left-16' : 'left-64'}`}>
          {/* Fixed Header */}
          <div className="border-b p-6 space-y-0 shrink-0">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewDialogOpen(false)}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3 flex-1">
                <h2 className="text-2xl font-bold">
                  {manualList.find((m) => m.id === selectedManual?.id)?.title || selectedManual?.id}
                </h2>
              {/* Document format badge */}
              {(() => {
                const currentManual = manualList.find((m) => m.id === selectedManual?.id);
                if (!currentManual?.document_format) return null;
                const formatLabels: Record<string, string> = {
                  "step-manual": "Step-by-step",
                  "quick-guide": "Quick Guide",
                  "reference": "Reference",
                  "summary": "Summary",
                };
                return (
                  <Badge
                    variant="secondary"
                    className="text-xs px-2 py-0.5 font-medium bg-primary/10 text-primary"
                  >
                    {formatLabels[currentManual.document_format] || currentManual.document_format}
                  </Badge>
                );
              })()}
              </div>
            </div>

            {/* Source info in header */}
            {selectedManual && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-2">
                {manualList.find((m) => m.id === selectedManual.id)?.source_video && (
                  <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md">
                    <Video className="h-4 w-4" />
                    {manualList.find((m) => m.id === selectedManual.id)?.source_video?.name}
                  </span>
                )}
                {(() => {
                  const m = manualList.find((m) => m.id === selectedManual.id);
                  return m?.project_name && (
                    <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md">
                      <FolderKanban className="h-4 w-4" />
                      {getManualProjectDisplayName(m)}
                    </span>
                  );
                })()}
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
                    <div className="flex flex-col items-center justify-center px-5 py-3 rounded-lg border bg-muted/30 min-w-[100px] min-h-[88px]">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
                      title={t("clickToViewDetails")}
                    >
                      {/* Card Header */}
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{t("evalScore")}</span>
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
          </div>

          {selectedManual && (
            <ScrollArea className="flex-1 min-h-0 custom-scrollbar">
              <div className="p-6 prose prose-base dark:prose-invert max-w-none pb-8">
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
                  {stripSemanticTags(selectedManual.content)}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          )}
        </div>
      )}

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
                      {getProjectDisplayName(project)}
                      {project.is_default && ` (${tp("default")})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {manualToAssign?.project_id && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-2">
                  {t("currentlyIn")} <strong>{getManualProjectDisplayName(manualToAssign)}</strong>
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
        if (!open) {
          resetProcessing();
          // Refresh manuals list to show new language
          setTimeout(() => loadManuals(), 100);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              {t("generateLanguage")}
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
                      {getManualProjectDisplayName(manualToGenerate)}
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
                  <Label>{t("project")}</Label>
                  <Input
                    value={manualToGenerate ? getManualProjectDisplayName(manualToGenerate) || tp("defaultProjectName") : tp("defaultProjectName")}
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
      <Dialog open={evaluateDialogOpen} onOpenChange={(open) => {
        // Prevent closing while evaluation is in progress
        if (!open && evaluating) return;
        setEvaluateDialogOpen(open);
        // Refresh manuals list and guide context when closing
        if (!open) {
          // Small delay to ensure dialog is fully closed before refresh
          setTimeout(() => {
            loadManuals();
          }, 100);
        }
      }}>
        <DialogContent
          className="max-w-[1100px] max-h-[90vh] flex flex-col"
          onInteractOutside={(e) => {
            // Prevent closing by clicking outside while evaluating
            if (evaluating) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            // Prevent closing by escape key while evaluating
            if (evaluating) e.preventDefault();
          }}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              {t("manualEvaluation")}
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
                          v{v.version} {v.is_current && t("current")}
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
                        <span className="text-muted-foreground">{t("audience")}:</span>
                        <span className="line-clamp-1">{manualToEvaluate.target_audience}</span>
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" align="start" className="w-96 p-0">
                      <div className="p-3 border-b">
                        <p className="font-medium text-sm flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {t("targetAudience")}
                        </p>
                      </div>
                      <div className="max-h-48 overflow-y-auto p-3 custom-scrollbar">
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
                        <span className="text-muted-foreground">{t("objective")}:</span>
                        <span className="line-clamp-1">{manualToEvaluate.target_objective}</span>
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" align="start" className="w-96 p-0">
                      <div className="p-3 border-b">
                        <p className="font-medium text-sm flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          {t("targetObjective")}
                        </p>
                      </div>
                      <div className="max-h-48 overflow-y-auto p-3 custom-scrollbar">
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
            <div className="flex-[2] overflow-y-auto pr-2 space-y-6 custom-scrollbar">

            {/* Evaluation Results */}
            {evaluationResult ? (
              <div className="space-y-6">
                {/* Version & Date Info */}
                {(evaluationResult as ManualEvaluation & { version?: string; stored_at?: string }).version && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
                    <span className="flex items-center gap-2">
                      <History className="h-3.5 w-3.5" />
                      {t("version")} {(evaluationResult as ManualEvaluation & { version?: string }).version}
                    </span>
                    <span className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(evaluationResult.evaluated_at).toLocaleDateString(dateLocale, {
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
                    <p className="text-sm text-muted-foreground">{t("overallScore")}</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs text-left">
                        <p className="font-semibold mb-1">{t("scoringGuide")}</p>
                        <ul className="space-y-0.5 text-xs">
                          <li><span className="text-green-500">8-10:</span> {t("scoreExcellent")}</li>
                          <li><span className="text-yellow-500">6-7:</span> {t("scoreGood")}</li>
                          <li><span className="text-orange-500">4-5:</span> {t("scoreFair")}</li>
                          <li><span className="text-red-500">1-3:</span> {t("scorePoor")}</li>
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
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("scoreBreakdown")}</h3>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-sm text-left">
                        <p className="font-semibold mb-2">{t("evaluationCategories")}</p>
                        <ul className="space-y-1.5 text-xs">
                          <li><span className="font-medium">{t("objectiveAlignment")}:</span> {t("objectiveAlignmentDesc")}</li>
                          <li><span className="font-medium">{t("audienceAppropriateness")}:</span> {t("audienceAppropriatenessDesc")}</li>
                          <li><span className="font-medium">{t("generalUsability")}:</span> {t("generalUsabilityDesc")}</li>
                          <li><span className="font-medium">{t("clarityCompleteness")}:</span> {t("clarityCompletenessDesc")}</li>
                          <li><span className="font-medium">{t("technicalAccuracy")}:</span> {t("technicalAccuracyDesc")}</li>
                          <li><span className="font-medium">{t("structureFlow")}:</span> {t("structureFlowDesc")}</li>
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Score Item Component - includes context-dependent and always-present categories */}
                  {[
                    // Context-dependent categories (only one set will be present)
                    { key: 'objective_alignment', label: t("objectiveAlignment"), data: evaluationResult.objective_alignment },
                    { key: 'audience_appropriateness', label: t("audienceAppropriateness"), data: evaluationResult.audience_appropriateness },
                    { key: 'general_usability', label: t("generalUsability"), data: evaluationResult.general_usability },
                    // Always-present categories
                    { key: 'clarity_and_completeness', label: t("clarityCompleteness"), data: evaluationResult.clarity_and_completeness },
                    { key: 'technical_accuracy', label: t("technicalAccuracy"), data: evaluationResult.technical_accuracy },
                    { key: 'structure_and_flow', label: t("structureFlow"), data: evaluationResult.structure_and_flow },
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
                      {t("strengths")}
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
                      {t("areasForImprovement")}
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
                      {t("recommendations")}
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
                  {t("evaluateDesc")}
                </p>
                <Button onClick={handleEvaluate} disabled={evaluating || loadingStoredEval} size="lg">
                  {evaluating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("analyzingManual")}
                    </>
                  ) : loadingStoredEval ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {tc("loading")}
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="mr-2 h-4 w-4" />
                      {t("startNewEvaluation")}
                    </>
                  )}
                </Button>
              </div>
            )}
            </div>

            {/* Right Column - Evaluation History Sidebar */}
            <div className="w-[280px] shrink-0 border-l pl-4 overflow-y-auto custom-scrollbar">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2 mb-4 sticky top-0 bg-background py-2">
                  <History className="h-4 w-4" />
                  {t("evaluationHistory")}
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
                            {new Date(evalItem.evaluated_at).toLocaleDateString(dateLocale, {
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
                    {t("noPreviousEvaluations")}
                  </p>
                )}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t pt-4 mt-4">
            <Button variant="outline" onClick={() => {
              setEvaluateDialogOpen(false);
              // Refresh manuals to show updated evaluation
              setTimeout(() => loadManuals(), 100);
            }} disabled={evaluating}>
              {evaluationResult ? tc("close") : tc("cancel")}
            </Button>
            {evaluationResult && (
              <Button onClick={handleEvaluate} disabled={evaluating} variant="secondary">
                {evaluating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("reEvaluating")}
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    {t("reEvaluate")}
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      {manualToExport && (
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          title={manualToExport.title}
          languages={manualToExport.languages}
          onExport={handleExportWithOptions}
          defaultLanguage={manualToExport.languages[0]}
          showFormat={true}
          documentFormat={manualToExport.document_format}
        />
      )}

      {/* Clone Manual Dialog */}
      {manualToClone && (
        <CloneManualDialog
          open={cloneDialogOpen}
          onOpenChange={setCloneDialogOpen}
          manual={manualToClone}
          onSuccess={handleCloneSuccess}
        />
      )}
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
