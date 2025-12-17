"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

// Validation constants
const VALIDATION_LIMITS = {
  PROJECT_NAME_MAX_LENGTH: 100,
  PROJECT_DESC_MAX_LENGTH: 500,
  CHAPTER_TITLE_MAX_LENGTH: 200,
  CHAPTER_DESC_MAX_LENGTH: 1000,
  SECTION_TITLE_MAX_LENGTH: 200,
  SECTION_DESC_MAX_LENGTH: 1000,
} as const;

const INVALID_CHARS_PATTERN = /[<>]/;
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FolderKanban,
  Plus,
  Trash2,
  FileDown,
  Wand2,
  Eye,
  Edit2,
  BookOpen,
  GripVertical,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Star,
  X,
  Settings,
  Video,
  AlertTriangle,
  Image as ImageIcon,
  History,
  Check,
  ChevronsUpDown,
  MoreVertical,
  MoveHorizontal,
  Layers,
  FolderTree,
  ArrowLeft,
} from "lucide-react";
import { SidebarToggle } from "@/components/layout/SidebarToggle";
import { useSidebar } from "@/components/layout/SidebarContext";
import {
  projects,
  manuals,
  type ProjectSummary,
  type ProjectDetail,
  type ManualDetail,
} from "@/lib/api";
import { ExportDialog, type ExportOptions } from "@/components/dialogs/ExportDialog";
import { useProjectCompiler } from "@/hooks/useWebSocket";
import { CompileSettingsDialog } from "@/components/dialogs/CompileSettingsDialog";
import { CompilerView } from "@/components/compiler/CompilerView";
import { CompilationVersionHistory } from "@/components/projects/CompilationVersionHistory";
import { useGuideStore } from "@/stores/guideStore";
import type { CompileSettings } from "@/lib/types";

// Validation helper
interface ValidationResult {
  isValid: boolean;
  errorKey?: "required" | "tooLong" | "invalidChars";
  fieldName?: string;
  maxLength?: number;
}

function validateInput(
  value: string,
  fieldName: string,
  maxLength: number,
  required: boolean = true
): ValidationResult {
  const trimmed = value.trim();

  if (required && !trimmed) {
    return { isValid: false, errorKey: "required", fieldName };
  }

  if (trimmed.length > maxLength) {
    return { isValid: false, errorKey: "tooLong", fieldName, maxLength };
  }

  if (INVALID_CHARS_PATTERN.test(trimmed)) {
    return { isValid: false, errorKey: "invalidChars", fieldName };
  }

  return { isValid: true };
}

// Helper to get validation error message
function getValidationError(
  result: ValidationResult,
  tc: (key: string, params?: Record<string, string | number>) => string
): string | null {
  if (result.isValid || !result.errorKey) return null;
  return tc(result.errorKey, { field: result.fieldName || "", max: result.maxLength || 0 });
}

// Extended info for delete confirmation
interface ProjectDeleteInfo extends ProjectSummary {
  chapters_with_manuals?: {
    id: string;
    title: string;
    manuals: string[];
  }[];
}

export default function ProjectsPage() {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const { collapsed: sidebarCollapsed } = useSidebar();

  // Helper to get translated name/description for default project
  const getProjectDisplayName = (project: { name: string; is_default?: boolean }) => {
    return project.is_default ? t("defaultProjectName") : project.name;
  };

  const getProjectDisplayDescription = (project: { description: string; is_default?: boolean }) => {
    return project.is_default ? t("defaultProjectDescription") : project.description;
  };

  const [projectList, setProjectList] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);

  // Edit project state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete project state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectDeleteInfo | null>(null);
  const [deleteManuals, setDeleteManuals] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Chapter management state
  const [addChapterDialogOpen, setAddChapterDialogOpen] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newChapterDesc, setNewChapterDesc] = useState("");
  const [editChapterId, setEditChapterId] = useState<string | null>(null);
  const [editChapterTitle, setEditChapterTitle] = useState("");
  const [editChapterDesc, setEditChapterDesc] = useState("");
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [moveManualDialogOpen, setMoveManualDialogOpen] = useState(false);
  const [manualToMove, setManualToMove] = useState<{ manualId: string; currentChapterId: string | null } | null>(null);
  const [targetChapterId, setTargetChapterId] = useState<string>("");

  // Section management state
  const [addSectionDialogOpen, setAddSectionDialogOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionDesc, setNewSectionDesc] = useState("");
  const [editSectionId, setEditSectionId] = useState<string | null>(null);
  const [editSectionTitle, setEditSectionTitle] = useState("");
  const [editSectionDesc, setEditSectionDesc] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [moveChapterToSectionDialogOpen, setMoveChapterToSectionDialogOpen] = useState(false);
  const [chapterToMoveToSection, setChapterToMoveToSection] = useState<{ chapterId: string; currentSectionId: string | null } | null>(null);
  const [targetSectionId, setTargetSectionId] = useState<string>("");

  const [compileProjectId, setCompileProjectId] = useState<string | null>(null);
  const [compileProjectName, setCompileProjectName] = useState<string>("");
  const [compileLanguage, setCompileLanguage] = useState<string>("en");
  const [compileSettingsOpen, setCompileSettingsOpen] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);

  // Manual viewer state
  const [viewManualOpen, setViewManualOpen] = useState(false);
  const [selectedManual, setSelectedManual] = useState<ManualDetail | null>(null);
  const [loadingManual, setLoadingManual] = useState(false);

  // Export state
  const [exporting, setExporting] = useState<"pdf" | "word" | "html" | "chunks" | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Project filter state
  const [filterProjectId, setFilterProjectId] = useState<string>("__all__");
  const [filterOpen, setFilterOpen] = useState(false);

  const {
    state: compilerState,
    startCompilation,
    submitDecision,
    sendMessage,
    reset: resetCompiler,
  } = useProjectCompiler();

  // Get guide store actions
  const setForceLeftPosition = useGuideStore((state) => state.setForceLeftPosition);
  const setPageContext = useGuideStore((state) => state.setPageContext);

  useEffect(() => {
    loadProjects();
  }, []);

  // Move guide button to left when compiler is active or viewing project detail
  useEffect(() => {
    setForceLeftPosition(isCompiling || !!selectedProject);
    return () => setForceLeftPosition(false);
  }, [isCompiling, selectedProject, setForceLeftPosition]);

  async function loadProjects() {
    try {
      const res = await projects.list();
      setProjectList(res.projects);

      // Update guide context with projects data
      const projectsForGuide = res.projects.map((p) => ({
        id: p.id,
        name: p.name,
        is_default: p.is_default,
        manual_count: p.manual_count,
        description: p.description,
      }));
      setPageContext({
        currentPage: "/dashboard/projects",
        pageTitle: "Projects",
        availableActions: ["create", "view", "edit", "compile", "delete"],
        pageState: {
          projects: projectsForGuide,
          totalCount: projectsForGuide.length,
        },
      });
    } catch (e) {
      console.error("Failed to load projects:", e);
      toast.error(t("loadFailed"), {
        description: e instanceof Error ? e.message : tc("error"),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    // Validate name
    const nameValidation = validateInput(
      newProjectName,
      t("projectName"),
      VALIDATION_LIMITS.PROJECT_NAME_MAX_LENGTH
    );
    if (!nameValidation.isValid) {
      toast.error(getValidationError(nameValidation, tc)!);
      return;
    }

    // Validate description (optional field)
    const descValidation = validateInput(
      newProjectDesc,
      tc("description"),
      VALIDATION_LIMITS.PROJECT_DESC_MAX_LENGTH,
      false
    );
    if (!descValidation.isValid) {
      toast.error(getValidationError(descValidation, tc)!);
      return;
    }

    try {
      await projects.create(newProjectName.trim(), newProjectDesc.trim());
      toast.success(t("projectCreated"));
      setCreateDialogOpen(false);
      setNewProjectName("");
      setNewProjectDesc("");
      await loadProjects();
    } catch (e) {
      console.error("Failed to create project:", e);
      toast.error(t("createFailed"), {
        description: e instanceof Error ? e.message : tc("error"),
      });
    }
  }

  function openEditDialog(project: Pick<ProjectSummary, "id" | "name" | "description">) {
    setEditProjectId(project.id);
    setEditName(project.name);
    setEditDescription(project.description);
    setEditDialogOpen(true);
  }

  async function handleEdit() {
    if (!editProjectId) return;

    // Validate name
    const nameValidation = validateInput(
      editName,
      t("projectName"),
      VALIDATION_LIMITS.PROJECT_NAME_MAX_LENGTH
    );
    if (!nameValidation.isValid) {
      toast.error(getValidationError(nameValidation, tc)!);
      return;
    }

    // Validate description (optional field)
    const descValidation = validateInput(
      editDescription,
      tc("description"),
      VALIDATION_LIMITS.PROJECT_DESC_MAX_LENGTH,
      false
    );
    if (!descValidation.isValid) {
      toast.error(getValidationError(descValidation, tc)!);
      return;
    }

    setSaving(true);
    try {
      await projects.update(editProjectId, editName.trim(), editDescription.trim());
      toast.success(t("projectUpdated"));
      setEditDialogOpen(false);
      await loadProjects();
      // Refresh detail view if open
      if (selectedProject?.id === editProjectId) {
        const detail = await projects.get(editProjectId);
        setSelectedProject(detail);
      }
    } catch (e) {
      console.error("Failed to update project:", e);
      toast.error(t("updateFailed"), {
        description: e instanceof Error ? e.message : tc("error"),
      });
    } finally {
      setSaving(false);
    }
  }

  function openDeleteDialog(project: ProjectDeleteInfo) {
    setProjectToDelete(project);
    setDeleteManuals(false);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!projectToDelete) return;

    setDeleting(true);
    try {
      await projects.delete(projectToDelete.id, deleteManuals);
      toast.success(t("movedToTrash"), {
        description: deleteManuals
          ? `${getProjectDisplayName(projectToDelete)} + ${projectToDelete.manual_count} ${t("manuals")}`
          : getProjectDisplayName(projectToDelete),
      });
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
      await loadProjects();
    } catch (e) {
      console.error("Failed to delete project:", e);
      toast.error(t("deleteFailed"), {
        description: e instanceof Error ? e.message : tc("error"),
      });
    } finally {
      setDeleting(false);
    }
  }

  async function handleViewDetails(projectId: string) {
    try {
      const detail = await projects.get(projectId);
      setSelectedProject(detail);
    } catch (e) {
      console.error("Failed to load project details:", e);
      toast.error(t("loadDetailsFailed"), {
        description: e instanceof Error ? e.message : tc("error"),
      });
    }
  }

  // Chapter handlers
  async function handleAddChapter() {
    if (!selectedProject) return;

    // Validate title
    const titleValidation = validateInput(
      newChapterTitle,
      t("chapterTitle"),
      VALIDATION_LIMITS.CHAPTER_TITLE_MAX_LENGTH
    );
    if (!titleValidation.isValid) {
      toast.error(getValidationError(titleValidation, tc)!);
      return;
    }

    // Validate description (optional field)
    const descValidation = validateInput(
      newChapterDesc,
      t("chapterDescription"),
      VALIDATION_LIMITS.CHAPTER_DESC_MAX_LENGTH,
      false
    );
    if (!descValidation.isValid) {
      toast.error(getValidationError(descValidation, tc)!);
      return;
    }

    try {
      await projects.addChapter(selectedProject.id, newChapterTitle.trim(), newChapterDesc.trim());
      toast.success(t("chapterAdded"));
      setAddChapterDialogOpen(false);
      setNewChapterTitle("");
      setNewChapterDesc("");
      // Refresh project detail
      const detail = await projects.get(selectedProject.id);
      setSelectedProject(detail);
    } catch (e) {
      console.error("Failed to add chapter:", e);
      toast.error(t("chapterAddFailed"), {
        description: e instanceof Error ? e.message : tc("error"),
      });
    }
  }

  async function handleEditChapter() {
    if (!selectedProject || !editChapterId) return;

    // Validate title
    const titleValidation = validateInput(
      editChapterTitle,
      t("chapterTitle"),
      VALIDATION_LIMITS.CHAPTER_TITLE_MAX_LENGTH
    );
    if (!titleValidation.isValid) {
      toast.error(getValidationError(titleValidation, tc)!);
      return;
    }

    // Validate description (optional field)
    const descValidation = validateInput(
      editChapterDesc,
      t("chapterDescription"),
      VALIDATION_LIMITS.CHAPTER_DESC_MAX_LENGTH,
      false
    );
    if (!descValidation.isValid) {
      toast.error(getValidationError(descValidation, tc)!);
      return;
    }

    try {
      await projects.updateChapter(selectedProject.id, editChapterId, editChapterTitle.trim(), editChapterDesc.trim());
      toast.success(t("chapterUpdated"));
      setEditChapterId(null);
      // Refresh project detail
      const detail = await projects.get(selectedProject.id);
      setSelectedProject(detail);
    } catch (e) {
      console.error("Failed to update chapter:", e);
      toast.error(t("chapterUpdateFailed"), {
        description: e instanceof Error ? e.message : tc("error"),
      });
    }
  }

  async function handleDeleteChapter(chapterId: string) {
    if (!selectedProject) return;

    try {
      await projects.deleteChapter(selectedProject.id, chapterId);
      toast.success(t("chapterDeleted"));
      // Refresh project detail
      const detail = await projects.get(selectedProject.id);
      setSelectedProject(detail);
    } catch (e) {
      console.error("Failed to delete chapter:", e);
      toast.error(t("chapterDeleteFailed"), {
        description: e instanceof Error ? e.message : tc("error"),
      });
    }
  }

  function openMoveManualDialog(manualId: string, currentChapterId: string | null) {
    setManualToMove({ manualId, currentChapterId });
    setTargetChapterId("");
    setMoveManualDialogOpen(true);
  }

  async function handleMoveManual() {
    if (!selectedProject || !manualToMove || !targetChapterId) return;

    try {
      await projects.moveManualToChapter(selectedProject.id, manualToMove.manualId, targetChapterId);
      toast.success(t("manualMovedToChapter"));
      setMoveManualDialogOpen(false);
      setManualToMove(null);
      // Refresh project detail
      const detail = await projects.get(selectedProject.id);
      setSelectedProject(detail);
    } catch (e) {
      console.error("Failed to move manual:", e);
      toast.error(t("manualMoveFailed"), {
        description: e instanceof Error ? e.message : tc("error"),
      });
    }
  }

  function toggleChapter(chapterId: string) {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  }

  // Section handlers
  async function handleAddSection() {
    if (!selectedProject) return;

    // Validate title
    const titleValidation = validateInput(
      newSectionTitle,
      t("sectionTitle"),
      VALIDATION_LIMITS.SECTION_TITLE_MAX_LENGTH
    );
    if (!titleValidation.isValid) {
      toast.error(getValidationError(titleValidation, tc)!);
      return;
    }

    // Validate description (optional field)
    const descValidation = validateInput(
      newSectionDesc,
      t("sectionDescription"),
      VALIDATION_LIMITS.SECTION_DESC_MAX_LENGTH,
      false
    );
    if (!descValidation.isValid) {
      toast.error(getValidationError(descValidation, tc)!);
      return;
    }

    try {
      await projects.addSection(selectedProject.id, newSectionTitle.trim(), newSectionDesc.trim());
      toast.success(t("sectionAdded"));
      setAddSectionDialogOpen(false);
      setNewSectionTitle("");
      setNewSectionDesc("");
      // Refresh project detail
      const detail = await projects.get(selectedProject.id);
      setSelectedProject(detail);
    } catch (e) {
      console.error("Failed to add section:", e);
      toast.error(t("sectionAddFailed"), {
        description: e instanceof Error ? e.message : tc("error"),
      });
    }
  }

  async function handleEditSection() {
    if (!selectedProject || !editSectionId) return;

    // Validate title
    const titleValidation = validateInput(
      editSectionTitle,
      t("sectionTitle"),
      VALIDATION_LIMITS.SECTION_TITLE_MAX_LENGTH
    );
    if (!titleValidation.isValid) {
      toast.error(getValidationError(titleValidation, tc)!);
      return;
    }

    // Validate description (optional field)
    const descValidation = validateInput(
      editSectionDesc,
      t("sectionDescription"),
      VALIDATION_LIMITS.SECTION_DESC_MAX_LENGTH,
      false
    );
    if (!descValidation.isValid) {
      toast.error(getValidationError(descValidation, tc)!);
      return;
    }

    try {
      await projects.updateSection(selectedProject.id, editSectionId, editSectionTitle.trim(), editSectionDesc.trim());
      toast.success(t("sectionUpdated"));
      setEditSectionId(null);
      // Refresh project detail
      const detail = await projects.get(selectedProject.id);
      setSelectedProject(detail);
    } catch (e) {
      console.error("Failed to update section:", e);
      toast.error(t("sectionUpdateFailed"), {
        description: e instanceof Error ? e.message : tc("error"),
      });
    }
  }

  async function handleDeleteSection(sectionId: string) {
    if (!selectedProject) return;

    try {
      await projects.deleteSection(selectedProject.id, sectionId);
      toast.success(t("sectionDeleted"));
      // Refresh project detail
      const detail = await projects.get(selectedProject.id);
      setSelectedProject(detail);
    } catch (e) {
      console.error("Failed to delete section:", e);
      toast.error(t("sectionDeleteFailed"), {
        description: e instanceof Error ? e.message : tc("error"),
      });
    }
  }

  function toggleSection(sectionId: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  function openMoveChapterToSectionDialog(chapterId: string, currentSectionId: string | null) {
    setChapterToMoveToSection({ chapterId, currentSectionId });
    setTargetSectionId("");
    setMoveChapterToSectionDialogOpen(true);
  }

  async function handleMoveChapterToSection() {
    if (!selectedProject || !chapterToMoveToSection || !targetSectionId) return;

    try {
      await projects.moveChapterToSection(selectedProject.id, targetSectionId, chapterToMoveToSection.chapterId);
      toast.success(t("chapterMovedToSection"));
      setMoveChapterToSectionDialogOpen(false);
      setChapterToMoveToSection(null);
      // Refresh project detail
      const detail = await projects.get(selectedProject.id);
      setSelectedProject(detail);
    } catch (e) {
      console.error("Failed to move chapter to section:", e);
      toast.error(t("chapterMoveToSectionFailed"), {
        description: e instanceof Error ? e.message : tc("error"),
      });
    }
  }

  async function handleRemoveChapterFromSection(sectionId: string, chapterId: string) {
    if (!selectedProject) return;

    try {
      await projects.removeChapterFromSection(selectedProject.id, sectionId, chapterId);
      toast.success(t("chapterRemovedFromSection"));
      // Refresh project detail
      const detail = await projects.get(selectedProject.id);
      setSelectedProject(detail);
    } catch (e) {
      console.error("Failed to remove chapter from section:", e);
      toast.error(t("chapterRemoveFromSectionFailed"), {
        description: e instanceof Error ? e.message : tc("error"),
      });
    }
  }

  // Helper to get chapters not in any section
  function getUngroupedChapters() {
    if (!selectedProject) return [];
    const sectionsChapterIds = new Set(
      selectedProject.sections?.flatMap((s) => s.chapters) || []
    );
    return selectedProject.chapters.filter((ch) => !sectionsChapterIds.has(ch.id));
  }

  async function handleRemoveManualFromProject(manualId: string) {
    if (!selectedProject) return;

    try {
      await projects.removeManual(selectedProject.id, manualId);
      toast.success(t("manualRemovedFromProject"));
      // Refresh project detail
      const detail = await projects.get(selectedProject.id);
      setSelectedProject(detail);
    } catch (e) {
      console.error("Failed to remove manual from project:", e);
      toast.error(t("manualRemoveFailed"), {
        description: e instanceof Error ? e.message : tc("error"),
      });
    }
  }

  function handleCompile(projectId: string, projectName: string) {
    // Open settings dialog first for validation
    setCompileProjectId(projectId);
    setCompileProjectName(projectName);
    setCompileSettingsOpen(true);
  }

  async function handleStartCompile(settings: CompileSettings) {
    if (!compileProjectId) return;

    // Close settings dialog and project view, open compiler view
    setCompileSettingsOpen(false);
    setSelectedProject(null);
    setCompileLanguage(settings.language);
    setIsCompiling(true);
    resetCompiler();

    // Start WebSocket compilation
    startCompilation({ project_id: compileProjectId, language: settings.language });
  }

  function handleExitCompiler() {
    setIsCompiling(false);
    setCompileProjectId(null);
    setCompileProjectName("");
    resetCompiler();
  }

  function openExportDialog() {
    setExportDialogOpen(true);
  }

  async function handleExportWithOptions(options: ExportOptions) {
    if (!selectedProject) return;
    setExporting(options.format);
    try {
      const result = await projects.export(
        selectedProject.id,
        options.format,
        options.language,
        options.templateName
      );
      toast.success(t("exportComplete"), {
        description: result.output_path,
      });
    } catch (e) {
      console.error("Failed to export project:", e);
      toast.error(t("exportFailed"), {
        description: e instanceof Error ? e.message : tc("error"),
      });
    } finally {
      setExporting(null);
    }
  }

  async function handleQuickExport(projectId: string, format: "pdf" | "html" | "chunks") {
    setExporting(format);
    try {
      const result = await projects.export(projectId, format);
      toast.success(t("exportComplete"), {
        description: result.output_path,
      });
    } catch (e) {
      console.error("Failed to export project:", e);
      toast.error(t("exportFailed"), {
        description: e instanceof Error ? e.message : tc("error"),
      });
    } finally {
      setExporting(null);
    }
  }

  async function handleViewManual(manualId: string) {
    setLoadingManual(true);
    try {
      const manual = await manuals.get(manualId);
      setSelectedManual(manual);
      setViewManualOpen(true);
    } catch (e) {
      console.error("Failed to load manual:", e);
      toast.error(tc("error"), {
        description: e instanceof Error ? e.message : tc("error"),
      });
    } finally {
      setLoadingManual(false);
    }
  }

  // Filter projects
  const filteredProjects = filterProjectId === "__all__"
    ? projectList
    : projectList.filter((p) => p.id === filterProjectId);

  const selectedFilterName = filterProjectId === "__all__"
    ? t("allProjects")
    : (() => {
        const project = projectList.find((p) => p.id === filterProjectId);
        return project ? getProjectDisplayName(project) : t("allProjects");
      })();

  // Show compiler view when compiling
  if (isCompiling && compileProjectId) {
    return (
      <div className="h-[calc(100vh-4rem)]">
        <CompilerView
          projectId={compileProjectId}
          projectName={compileProjectName}
          language={compileLanguage}
          state={compilerState}
          onDecision={submitDecision}
          onMessage={sendMessage}
          onBack={handleExitCompiler}
        />
      </div>
    );
  }

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
                <span className="truncate">{selectedFilterName}</span>
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

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-guide-id="create-project-btn">
                <Plus className="mr-2 h-4 w-4" />
                {t("newProject")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("createProject")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t("name")}</Label>
                    <span className="text-xs text-muted-foreground">
                      {newProjectName.length}/{VALIDATION_LIMITS.PROJECT_NAME_MAX_LENGTH}
                    </span>
                  </div>
                  <Input
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder={t("projectName")}
                    maxLength={VALIDATION_LIMITS.PROJECT_NAME_MAX_LENGTH}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{tc("description")}</Label>
                    <span className="text-xs text-muted-foreground">
                      {newProjectDesc.length}/{VALIDATION_LIMITS.PROJECT_DESC_MAX_LENGTH}
                    </span>
                  </div>
                  <Input
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder={t("optionalDesc")}
                    maxLength={VALIDATION_LIMITS.PROJECT_DESC_MAX_LENGTH}
                  />
                </div>
                <Button onClick={handleCreate} className="w-full">
                  {t("create")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          {tc("loading")}
        </div>
      ) : projectList.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FolderKanban className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t("noProjects")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("noProjectsDesc")}
            </p>
          </CardContent>
        </Card>
      ) : filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FolderKanban className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t("noMatchingProjects")}</p>
            <Button variant="outline" className="mt-4" onClick={() => setFilterProjectId("__all__")}>
              {t("showAll")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card
              key={project.id}
              data-guide-id={`project-card-${project.id}`}
              className="
                group relative overflow-hidden
                transition-all duration-300 ease-out
                hover:shadow-lg hover:-translate-y-1
                hover:border-primary/30
              "
            >
              {/* Subtle gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

              <CardHeader className="pb-3 relative">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Editorial title with serif font */}
                    <CardTitle className="font-display text-xl tracking-tight leading-tight flex items-center gap-2">
                      {getProjectDisplayName(project)}
                      {project.is_default && (
                        <Badge variant="secondary" className="shrink-0 text-[10px] font-semibold">
                          <Star className="h-3 w-3 mr-1" />
                          {t("default")}
                        </Badge>
                      )}
                    </CardTitle>

                    {(project.description || project.is_default) && (
                      <CardDescription className="text-sm leading-relaxed line-clamp-2 mt-1">
                        {getProjectDisplayDescription(project)}
                      </CardDescription>
                    )}
                  </div>

                  {!project.is_default && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => openEditDialog(project)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="relative space-y-4">
                {/* Stats with visual indicators */}
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-semibold leading-none">{project.manual_count}</span>
                      <span className="text-xs text-muted-foreground">{t("manuals")}</span>
                    </div>
                  </div>

                  {project.chapter_count !== undefined && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center h-8 w-8 rounded-md bg-secondary text-secondary-foreground">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-lg font-semibold leading-none">{project.chapter_count}</span>
                        <span className="text-xs text-muted-foreground">{t("chapters")}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions with refined styling */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    data-guide-id={`view-project-btn-${project.id}`}
                    onClick={() => handleViewDetails(project.id)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    {t("viewProject")}
                  </Button>
                  {!project.is_default && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="opacity-60 hover:opacity-100 hover:border-destructive hover:text-destructive transition-all"
                      onClick={async () => {
                        // Fetch full project details for tree view
                        try {
                          const detail = await projects.get(project.id);
                          openDeleteDialog({
                            ...project,
                            chapters_with_manuals: detail.chapters.map(ch => ({
                              id: ch.id,
                              title: ch.title,
                              manuals: detail.manuals
                                .filter(m => m.chapter_id === ch.id)
                                .map(m => m.manual_id),
                            })),
                          });
                        } catch {
                          // Fallback if fetch fails
                          openDeleteDialog(project);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Project Detail Panel - Full Page View */}
      {selectedProject && (
        <div className={`fixed inset-y-0 right-0 z-40 bg-background flex flex-col ${sidebarCollapsed ? 'left-16' : 'left-64'}`}>
          {/* Header Section */}
          <div className="border-b p-6 space-y-0">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedProject(null)}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <FolderKanban className="h-6 w-6" />
                  {getProjectDisplayName(selectedProject)}
                  {selectedProject.is_default && (
                    <Badge variant="secondary">
                      <Star className="h-3 w-3 mr-1" />
                      {t("default")}
                    </Badge>
                  )}
                </h2>
                {(selectedProject.description || selectedProject.is_default) && (
                  <p className="text-muted-foreground mt-1">{getProjectDisplayDescription(selectedProject)}</p>
                )}
              </div>
            </div>

                {/* Action Bar */}
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={() => handleCompile(selectedProject.id, selectedProject.name)}
                    disabled={selectedProject.manuals.length < 2}
                    title={selectedProject.manuals.length < 2 ? t("compilationRequires2Manuals") : undefined}
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    {t("compile")}
                  </Button>

                  {/* Export Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" disabled={selectedProject.manuals.length === 0 || exporting !== null}>
                        {exporting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <FileDown className="h-4 w-4 mr-2" />
                        )}
                        {exporting ? `${t("exporting")} ${exporting.toUpperCase()}...` : t("export")}
                        {!exporting && <ChevronDown className="h-4 w-4 ml-2" />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleQuickExport(selectedProject.id, "pdf")} disabled={exporting !== null}>
                        {t("pdfDocument")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openExportDialog()} disabled={exporting !== null}>
                        {t("wordDocument")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleQuickExport(selectedProject.id, "html")} disabled={exporting !== null}>
                        {t("html")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleQuickExport(selectedProject.id, "chunks")} disabled={exporting !== null}>
                        {t("semanticChunks")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {!selectedProject.is_default && (
                    <>
                      <Button variant="outline" onClick={() => openEditDialog(selectedProject)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        {tc("edit")}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => openDeleteDialog({
                          ...selectedProject,
                          manual_count: selectedProject.manuals.length,
                          chapter_count: selectedProject.chapters.length,
                          chapters_with_manuals: selectedProject.chapters.map(ch => ({
                            id: ch.id,
                            title: ch.title,
                            manuals: selectedProject.manuals
                              .filter(m => m.chapter_id === ch.id)
                              .map(m => m.manual_id),
                          })),
                        })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
          </div>

          {/* Tabs Section */}
              <Tabs defaultValue="chapters" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-6 pt-4">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="chapters">
                      <BookOpen className="h-4 w-4 mr-2" />
                      {t("chaptersTab")} ({selectedProject.chapters.length})
                    </TabsTrigger>
                    <TabsTrigger value="manuals">
                      <FileText className="h-4 w-4 mr-2" />
                      {t("manualsTab")} ({selectedProject.manuals.length})
                    </TabsTrigger>
                    <TabsTrigger value="videos">
                      <Video className="h-4 w-4 mr-2" />
                      {t("videosTab")} ({selectedProject.videos?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="settings">
                      <Settings className="h-4 w-4 mr-2" />
                      {t("exportSettings")}
                    </TabsTrigger>
                    <TabsTrigger value="versions">
                      <History className="h-4 w-4 mr-2" />
                      {t("compilations")}
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Chapters Tab - Hierarchical View: Sections > Chapters > Manuals */}
                <TabsContent value="chapters" className="flex-1 overflow-auto p-6 space-y-4 custom-scrollbar">
                  {/* Header with action buttons */}
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      {t("organizeChaptersDesc")}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setAddSectionDialogOpen(true)}>
                        <Layers className="h-4 w-4 mr-2" />
                        {t("addSection")}
                      </Button>
                      <Button size="sm" onClick={() => setAddChapterDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t("addChapter")}
                      </Button>
                    </div>
                  </div>

                  {/* Empty state when no chapters and no sections */}
                  {selectedProject.chapters.length === 0 && (!selectedProject.sections || selectedProject.sections.length === 0) ? (
                    <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                      <FolderTree className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <p className="text-lg font-medium">{t("noChaptersYet")}</p>
                      <p className="text-sm mt-1">{t("addChaptersToOrganize")}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Sections with their chapters */}
                      {selectedProject.sections && selectedProject.sections.length > 0 && (
                        <div className="space-y-3">
                          {selectedProject.sections
                            .sort((a, b) => a.order - b.order)
                            .map((section) => {
                              const isSectionExpanded = expandedSections.has(section.id);
                              const isSectionEditing = editSectionId === section.id;
                              const sectionChapters = selectedProject.chapters.filter((ch) =>
                                section.chapters.includes(ch.id)
                              );
                              const totalManualsInSection = sectionChapters.reduce((sum, ch) => {
                                return sum + selectedProject.manuals.filter((m) => m.chapter_id === ch.id).length;
                              }, 0);

                              return (
                                <Card key={section.id} className="overflow-hidden border-l-4 border-l-violet-500/50">
                                  <CardContent className="p-0">
                                    {isSectionEditing ? (
                                      /* Section Edit Mode */
                                      <div className="p-4 space-y-3 bg-violet-50/50 dark:bg-violet-950/20">
                                        <div>
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium">{t("sectionTitle")}</span>
                                            <span className="text-xs text-muted-foreground">
                                              {editSectionTitle.length}/{VALIDATION_LIMITS.SECTION_TITLE_MAX_LENGTH}
                                            </span>
                                          </div>
                                          <Input
                                            value={editSectionTitle}
                                            onChange={(e) => setEditSectionTitle(e.target.value)}
                                            placeholder={t("sectionTitle")}
                                            maxLength={VALIDATION_LIMITS.SECTION_TITLE_MAX_LENGTH}
                                          />
                                        </div>
                                        <div>
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium">{tc("description")}</span>
                                            <span className="text-xs text-muted-foreground">
                                              {editSectionDesc.length}/{VALIDATION_LIMITS.SECTION_DESC_MAX_LENGTH}
                                            </span>
                                          </div>
                                          <Input
                                            value={editSectionDesc}
                                            onChange={(e) => setEditSectionDesc(e.target.value)}
                                            placeholder={t("sectionDescription")}
                                            maxLength={VALIDATION_LIMITS.SECTION_DESC_MAX_LENGTH}
                                          />
                                        </div>
                                        <div className="flex gap-2">
                                          <Button size="sm" onClick={handleEditSection}>
                                            {tc("save")}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setEditSectionId(null)}
                                          >
                                            {tc("cancel")}
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        {/* Section Header */}
                                        <div
                                          className="flex items-center justify-between p-4 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 cursor-pointer transition-colors"
                                          onClick={() => toggleSection(section.id)}
                                        >
                                          <div className="flex items-center gap-3 flex-1 min-w-0">
                                            {isSectionExpanded ? (
                                              <ChevronDown className="h-5 w-5 text-violet-500 shrink-0" />
                                            ) : (
                                              <ChevronRight className="h-5 w-5 text-violet-500 shrink-0" />
                                            )}
                                            <Layers className="h-5 w-5 text-violet-500 shrink-0" />
                                            <div className="min-w-0 flex-1">
                                              <p className="font-semibold text-lg truncate">{section.title}</p>
                                              {section.description && (
                                                <p className="text-sm text-muted-foreground line-clamp-1">
                                                  {section.description}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 ml-3" onClick={(e) => e.stopPropagation()}>
                                            <Badge variant="outline" className="shrink-0 border-violet-300 text-violet-600 dark:text-violet-400">
                                              {sectionChapters.length} {sectionChapters.length === 1 ? t("chapter") : t("chapters")}
                                            </Badge>
                                            <Badge variant="secondary" className="shrink-0">
                                              {totalManualsInSection} {totalManualsInSection === 1 ? t("manual") : t("manuals")}
                                            </Badge>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-8 w-8 shrink-0"
                                              onClick={() => {
                                                setEditSectionId(section.id);
                                                setEditSectionTitle(section.title);
                                                setEditSectionDesc(section.description);
                                              }}
                                            >
                                              <Edit2 className="h-4 w-4" />
                                            </Button>
                                            {sectionChapters.length === 0 && (
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-destructive shrink-0"
                                                onClick={() => handleDeleteSection(section.id)}
                                                title={t("deleteEmptySection")}
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            )}
                                          </div>
                                        </div>

                                        {/* Expanded Section Content - Chapters */}
                                        {isSectionExpanded && (
                                          <div className="border-t bg-violet-50/30 dark:bg-violet-950/10">
                                            {sectionChapters.length === 0 ? (
                                              <div className="p-8 text-center">
                                                <BookOpen className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                                                <p className="text-sm text-muted-foreground">{t("noChaptersInSection")}</p>
                                              </div>
                                            ) : (
                                              <div className="p-4 space-y-3">
                                                {sectionChapters
                                                  .sort((a, b) => a.order - b.order)
                                                  .map((ch) => {
                                                    const chapterManuals = selectedProject.manuals.filter(
                                                      (m) => m.chapter_id === ch.id
                                                    );
                                                    const isChapterEditing = editChapterId === ch.id;
                                                    const isChapterExpanded = expandedChapters.has(ch.id);

                                                    return (
                                                      <Card key={ch.id} className="overflow-hidden border-l-4 border-l-primary/30">
                                                        <CardContent className="p-0">
                                                          {isChapterEditing ? (
                                                            <div className="p-4 space-y-3">
                                                              <div>
                                                                <div className="flex items-center justify-between mb-1">
                                                                  <span className="text-sm font-medium">{t("chapterTitle")}</span>
                                                                  <span className="text-xs text-muted-foreground">
                                                                    {editChapterTitle.length}/{VALIDATION_LIMITS.CHAPTER_TITLE_MAX_LENGTH}
                                                                  </span>
                                                                </div>
                                                                <Input
                                                                  value={editChapterTitle}
                                                                  onChange={(e) => setEditChapterTitle(e.target.value)}
                                                                  placeholder={t("chapterTitle")}
                                                                  maxLength={VALIDATION_LIMITS.CHAPTER_TITLE_MAX_LENGTH}
                                                                />
                                                              </div>
                                                              <div>
                                                                <div className="flex items-center justify-between mb-1">
                                                                  <span className="text-sm font-medium">{tc("description")}</span>
                                                                  <span className="text-xs text-muted-foreground">
                                                                    {editChapterDesc.length}/{VALIDATION_LIMITS.CHAPTER_DESC_MAX_LENGTH}
                                                                  </span>
                                                                </div>
                                                                <Input
                                                                  value={editChapterDesc}
                                                                  onChange={(e) => setEditChapterDesc(e.target.value)}
                                                                  placeholder={t("chapterDescription")}
                                                                  maxLength={VALIDATION_LIMITS.CHAPTER_DESC_MAX_LENGTH}
                                                                />
                                                              </div>
                                                              <div className="flex gap-2">
                                                                <Button size="sm" onClick={handleEditChapter}>
                                                                  {tc("save")}
                                                                </Button>
                                                                <Button
                                                                  size="sm"
                                                                  variant="ghost"
                                                                  onClick={() => setEditChapterId(null)}
                                                                >
                                                                  {tc("cancel")}
                                                                </Button>
                                                              </div>
                                                            </div>
                                                          ) : (
                                                            <>
                                                              {/* Chapter Header */}
                                                              <div
                                                                className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                                                                onClick={() => toggleChapter(ch.id)}
                                                              >
                                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                  {isChapterExpanded ? (
                                                                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                                                  ) : (
                                                                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                                                  )}
                                                                  <BookOpen className="h-4 w-4 text-primary shrink-0" />
                                                                  <div className="min-w-0 flex-1">
                                                                    <p className="font-medium truncate">{ch.title}</p>
                                                                    {ch.description && (
                                                                      <p className="text-xs text-muted-foreground line-clamp-1">
                                                                        {ch.description}
                                                                      </p>
                                                                    )}
                                                                  </div>
                                                                </div>
                                                                <div className="flex items-center gap-2 ml-3" onClick={(e) => e.stopPropagation()}>
                                                                  <Badge variant="secondary" className="shrink-0 text-xs">
                                                                    {chapterManuals.length} {chapterManuals.length === 1 ? t("manual") : t("manuals")}
                                                                  </Badge>
                                                                  <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0">
                                                                        <MoreVertical className="h-4 w-4" />
                                                                      </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                      <DropdownMenuItem onClick={() => {
                                                                        setEditChapterId(ch.id);
                                                                        setEditChapterTitle(ch.title);
                                                                        setEditChapterDesc(ch.description);
                                                                      }}>
                                                                        <Edit2 className="h-4 w-4 mr-2" />
                                                                        {tc("edit")}
                                                                      </DropdownMenuItem>
                                                                      <DropdownMenuItem onClick={() => handleRemoveChapterFromSection(section.id, ch.id)}>
                                                                        <X className="h-4 w-4 mr-2" />
                                                                        {t("removeFromSection")}
                                                                      </DropdownMenuItem>
                                                                      {chapterManuals.length === 0 && (
                                                                        <DropdownMenuItem
                                                                          onClick={() => handleDeleteChapter(ch.id)}
                                                                          className="text-destructive"
                                                                        >
                                                                          <Trash2 className="h-4 w-4 mr-2" />
                                                                          {tc("delete")}
                                                                        </DropdownMenuItem>
                                                                      )}
                                                                    </DropdownMenuContent>
                                                                  </DropdownMenu>
                                                                </div>
                                                              </div>

                                                              {/* Expanded Chapter Content - Manuals */}
                                                              {isChapterExpanded && chapterManuals.length > 0 && (
                                                                <div className="border-t bg-muted/20">
                                                                  <div className="p-3 space-y-2">
                                                                    {chapterManuals.map((m) => (
                                                                      <div
                                                                        key={m.manual_id}
                                                                        className="flex items-center justify-between p-2 bg-background rounded-lg border hover:border-primary/50 transition-colors group"
                                                                      >
                                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                          <FileText className="h-4 w-4 text-primary shrink-0" />
                                                                          <span className="text-sm truncate">{m.manual_id}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1 ml-2">
                                                                          <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            className="h-7 shrink-0 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                                            onClick={() => handleViewManual(m.manual_id)}
                                                                          >
                                                                            <Eye className="h-3 w-3 mr-1" />
                                                                            {t("view")}
                                                                          </Button>
                                                                          <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild>
                                                                              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0">
                                                                                <MoreVertical className="h-3.5 w-3.5" />
                                                                              </Button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent align="end">
                                                                              <DropdownMenuItem onClick={() => openMoveManualDialog(m.manual_id, ch.id)}>
                                                                                <MoveHorizontal className="h-4 w-4 mr-2" />
                                                                                {t("moveToChapter")}
                                                                              </DropdownMenuItem>
                                                                              <DropdownMenuItem
                                                                                onClick={() => handleRemoveManualFromProject(m.manual_id)}
                                                                                className="text-destructive"
                                                                              >
                                                                                <X className="h-4 w-4 mr-2" />
                                                                                {t("removeFromProject")}
                                                                              </DropdownMenuItem>
                                                                            </DropdownMenuContent>
                                                                          </DropdownMenu>
                                                                        </div>
                                                                      </div>
                                                                    ))}
                                                                  </div>
                                                                </div>
                                                              )}

                                                              {/* Empty Chapter State */}
                                                              {isChapterExpanded && chapterManuals.length === 0 && (
                                                                <div className="border-t bg-muted/10 p-6 text-center">
                                                                  <FileText className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
                                                                  <p className="text-xs text-muted-foreground">{t("noManualsInChapter")}</p>
                                                                </div>
                                                              )}
                                                            </>
                                                          )}
                                                        </CardContent>
                                                      </Card>
                                                    );
                                                  })}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </CardContent>
                                </Card>
                              );
                            })}
                        </div>
                      )}

                      {/* Ungrouped Chapters (not in any section) */}
                      {getUngroupedChapters().length > 0 && (
                        <div className="space-y-3">
                          {selectedProject.sections && selectedProject.sections.length > 0 && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-4">
                              <BookOpen className="h-4 w-4" />
                              <span className="font-medium">{t("ungroupedChapters")}</span>
                            </div>
                          )}
                          {getUngroupedChapters()
                            .sort((a, b) => a.order - b.order)
                            .map((ch) => {
                              const chapterManuals = selectedProject.manuals.filter(
                                (m) => m.chapter_id === ch.id
                              );
                              const isEditing = editChapterId === ch.id;
                              const isExpanded = expandedChapters.has(ch.id);

                              return (
                                <Card key={ch.id} className="overflow-hidden border-l-4 border-l-primary/30">
                                  <CardContent className="p-0">
                                    {isEditing ? (
                                      <div className="p-4 space-y-3">
                                        <div>
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium">{t("chapterTitle")}</span>
                                            <span className="text-xs text-muted-foreground">
                                              {editChapterTitle.length}/{VALIDATION_LIMITS.CHAPTER_TITLE_MAX_LENGTH}
                                            </span>
                                          </div>
                                          <Input
                                            value={editChapterTitle}
                                            onChange={(e) => setEditChapterTitle(e.target.value)}
                                            placeholder={t("chapterTitle")}
                                            maxLength={VALIDATION_LIMITS.CHAPTER_TITLE_MAX_LENGTH}
                                          />
                                        </div>
                                        <div>
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium">{tc("description")}</span>
                                            <span className="text-xs text-muted-foreground">
                                              {editChapterDesc.length}/{VALIDATION_LIMITS.CHAPTER_DESC_MAX_LENGTH}
                                            </span>
                                          </div>
                                          <Input
                                            value={editChapterDesc}
                                            onChange={(e) => setEditChapterDesc(e.target.value)}
                                            placeholder={t("chapterDescription")}
                                            maxLength={VALIDATION_LIMITS.CHAPTER_DESC_MAX_LENGTH}
                                          />
                                        </div>
                                        <div className="flex gap-2">
                                          <Button size="sm" onClick={handleEditChapter}>
                                            {tc("save")}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setEditChapterId(null)}
                                          >
                                            {tc("cancel")}
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        {/* Chapter Header */}
                                        <div
                                          className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                                          onClick={() => toggleChapter(ch.id)}
                                        >
                                          <div className="flex items-center gap-3 flex-1 min-w-0">
                                            {isExpanded ? (
                                              <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                                            ) : (
                                              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                                            )}
                                            <BookOpen className="h-5 w-5 text-primary shrink-0" />
                                            <div className="min-w-0 flex-1">
                                              <p className="font-semibold text-lg truncate">{ch.title}</p>
                                              {ch.description && (
                                                <p className="text-sm text-muted-foreground line-clamp-1">
                                                  {ch.description}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 ml-3" onClick={(e) => e.stopPropagation()}>
                                            <Badge variant="secondary" className="shrink-0">
                                              {chapterManuals.length} {chapterManuals.length === 1 ? t("manual") : t("manuals")}
                                            </Badge>
                                            {selectedProject.sections && selectedProject.sections.length > 0 && (
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 shrink-0 text-xs"
                                                onClick={() => openMoveChapterToSectionDialog(ch.id, null)}
                                              >
                                                <Layers className="h-3.5 w-3.5 mr-1" />
                                                {t("moveToSection")}
                                              </Button>
                                            )}
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-8 w-8 shrink-0"
                                              onClick={() => {
                                                setEditChapterId(ch.id);
                                                setEditChapterTitle(ch.title);
                                                setEditChapterDesc(ch.description);
                                              }}
                                            >
                                              <Edit2 className="h-4 w-4" />
                                            </Button>
                                            {chapterManuals.length === 0 && (
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-destructive shrink-0"
                                                onClick={() => handleDeleteChapter(ch.id)}
                                                title={t("deleteEmptyChapter")}
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            )}
                                          </div>
                                        </div>

                                        {/* Expanded Chapter Content - Manuals */}
                                        {isExpanded && chapterManuals.length > 0 && (
                                          <div className="border-t bg-muted/20">
                                            <div className="p-4 space-y-2">
                                              {chapterManuals.map((m) => (
                                                <div
                                                  key={m.manual_id}
                                                  className="flex items-center justify-between p-3 bg-background rounded-lg border hover:border-primary/50 transition-colors group"
                                                >
                                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    <FileText className="h-4 w-4 text-primary shrink-0" />
                                                    <span className="text-sm font-medium truncate">{m.manual_id}</span>
                                                  </div>
                                                  <div className="flex items-center gap-1 ml-2">
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      className="h-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                      onClick={() => handleViewManual(m.manual_id)}
                                                    >
                                                      <Eye className="h-3.5 w-3.5 mr-1" />
                                                      {t("view")}
                                                    </Button>
                                                    <DropdownMenu>
                                                      <DropdownMenuTrigger asChild>
                                                        <Button
                                                          size="icon"
                                                          variant="ghost"
                                                          className="h-8 w-8 shrink-0"
                                                        >
                                                          <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                      </DropdownMenuTrigger>
                                                      <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => openMoveManualDialog(m.manual_id, ch.id)}>
                                                          <MoveHorizontal className="h-4 w-4 mr-2" />
                                                          {t("moveToChapter")}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                          onClick={() => handleRemoveManualFromProject(m.manual_id)}
                                                          className="text-destructive"
                                                        >
                                                          <X className="h-4 w-4 mr-2" />
                                                          {t("removeFromProject")}
                                                        </DropdownMenuItem>
                                                      </DropdownMenuContent>
                                                    </DropdownMenu>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Empty Chapter State */}
                                        {isExpanded && chapterManuals.length === 0 && (
                                          <div className="border-t bg-muted/10 p-8 text-center">
                                            <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                                            <p className="text-sm text-muted-foreground">{t("noManualsInChapter")}</p>
                                            <p className="text-xs text-muted-foreground mt-1">{t("addManualsFromManualsTab")}</p>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </CardContent>
                                </Card>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* Manuals Tab */}
                <TabsContent value="manuals" className="flex-1 overflow-auto p-6 custom-scrollbar">
                  {selectedProject.manuals.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                      <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <p className="text-lg font-medium">{t("noManualsInProject")}</p>
                      <p className="text-sm mt-1">{t("processVideoToGenerate")}</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {selectedProject.manuals.map((m) => {
                        const chapter = selectedProject.chapters.find(
                          (ch) => ch.id === m.chapter_id
                        );
                        return (
                          <Card key={m.manual_id} className="overflow-hidden group hover:border-primary/50 transition-colors">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3 min-w-0">
                                <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium truncate">{m.manual_id}</p>
                                  {chapter && (
                                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                                      <BookOpen className="h-3 w-3" />
                                      {chapter.title}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 mt-3">
                                <Button
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => handleViewManual(m.manual_id)}
                                  disabled={loadingManual}
                                >
                                  {loadingManual ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Eye className="h-4 w-4 mr-2" />
                                  )}
                                  {t("view")}
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="outline">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openMoveManualDialog(m.manual_id, m.chapter_id)}>
                                      <MoveHorizontal className="h-4 w-4 mr-2" />
                                      {t("moveToChapter")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleRemoveManualFromProject(m.manual_id)}
                                      className="text-destructive"
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      {t("removeFromProject")}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* Videos Tab */}
                <TabsContent value="videos" className="flex-1 overflow-auto p-6 custom-scrollbar">
                  {!selectedProject.videos || selectedProject.videos.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                      <Video className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <p className="text-lg font-medium">{t("noVideosInProject")}</p>
                      <p className="text-sm mt-1">{t("videosAutoLinked")}</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {selectedProject.videos.map((v) => (
                        <Card key={v.path} className={`overflow-hidden ${!v.exists ? "border-amber-500/50" : ""}`}>
                          {/* Video Thumbnail */}
                          <div className="relative aspect-video bg-muted">
                            {v.exists ? (
                              <video
                                src={`/api/videos/${encodeURIComponent(v.name)}/stream`}
                                className="w-full h-full object-cover"
                                muted
                                preload="metadata"
                                onMouseEnter={(e) => e.currentTarget.play()}
                                onMouseLeave={(e) => {
                                  e.currentTarget.pause();
                                  e.currentTarget.currentTime = 0;
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-amber-500">
                                <AlertTriangle className="h-8 w-8 mb-2" />
                                <span className="text-sm">Video deleted</span>
                              </div>
                            )}
                          </div>

                          <CardContent className="p-4">
                            <p className="font-medium truncate" title={v.name}>
                              {v.name}
                            </p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <FileText className="h-3.5 w-3.5" />
                              {v.manual_count} manual{v.manual_count !== 1 ? 's' : ''} generated
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Export Settings Tab */}
                <TabsContent value="settings" className="flex-1 overflow-auto p-6 custom-scrollbar">
                  <div className="max-w-2xl space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Export Options</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="font-medium">Include Table of Contents</p>
                            <p className="text-sm text-muted-foreground">
                              Add a navigable table of contents to the exported document
                            </p>
                          </div>
                          <Checkbox defaultChecked />
                        </div>
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="font-medium">Include Chapter Covers</p>
                            <p className="text-sm text-muted-foreground">
                              Add a cover page before each chapter
                            </p>
                          </div>
                          <Checkbox defaultChecked />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-4">Quick Export</h3>
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => handleQuickExport(selectedProject.id, "pdf")}
                          disabled={selectedProject.manuals.length === 0 || exporting !== null}
                        >
                          {exporting === "pdf" ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <FileDown className="h-4 w-4 mr-2" />
                          )}
                          {exporting === "pdf" ? "Exporting..." : "Export PDF"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => openExportDialog()}
                          disabled={selectedProject.manuals.length === 0 || exporting !== null}
                        >
                          {exporting === "word" ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <FileDown className="h-4 w-4 mr-2" />
                          )}
                          {exporting === "word" ? "Exporting..." : "Export Word..."}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleQuickExport(selectedProject.id, "html")}
                          disabled={selectedProject.manuals.length === 0 || exporting !== null}
                        >
                          {exporting === "html" ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <FileDown className="h-4 w-4 mr-2" />
                          )}
                          {exporting === "html" ? "Exporting..." : "Export HTML"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleQuickExport(selectedProject.id, "chunks")}
                          disabled={selectedProject.manuals.length === 0 || exporting !== null}
                        >
                          {exporting === "chunks" ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <FileDown className="h-4 w-4 mr-2" />
                          )}
                          {exporting === "chunks" ? "Exporting..." : t("semanticChunks")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Version History Tab */}
                <TabsContent value="versions" className="flex-1 overflow-auto p-6 custom-scrollbar">
                  <CompilationVersionHistory projectId={selectedProject.id} />
                </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Add Chapter Dialog */}
      <Dialog open={addChapterDialogOpen} onOpenChange={setAddChapterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addChapter")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("chapterTitle")}</Label>
                <span className="text-xs text-muted-foreground">
                  {newChapterTitle.length}/{VALIDATION_LIMITS.CHAPTER_TITLE_MAX_LENGTH}
                </span>
              </div>
              <Input
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                placeholder={t("chapterTitle")}
                maxLength={VALIDATION_LIMITS.CHAPTER_TITLE_MAX_LENGTH}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{tc("description")}</Label>
                <span className="text-xs text-muted-foreground">
                  {newChapterDesc.length}/{VALIDATION_LIMITS.CHAPTER_DESC_MAX_LENGTH}
                </span>
              </div>
              <Input
                value={newChapterDesc}
                onChange={(e) => setNewChapterDesc(e.target.value)}
                placeholder={t("chapterDescription")}
                maxLength={VALIDATION_LIMITS.CHAPTER_DESC_MAX_LENGTH}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddChapterDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleAddChapter} disabled={!newChapterTitle.trim()}>
              {t("addChapter")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Section Dialog */}
      <Dialog open={addSectionDialogOpen} onOpenChange={setAddSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addSection")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("sectionTitle")}</Label>
                <span className="text-xs text-muted-foreground">
                  {newSectionTitle.length}/{VALIDATION_LIMITS.SECTION_TITLE_MAX_LENGTH}
                </span>
              </div>
              <Input
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder={t("sectionTitle")}
                maxLength={VALIDATION_LIMITS.SECTION_TITLE_MAX_LENGTH}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{tc("description")}</Label>
                <span className="text-xs text-muted-foreground">
                  {newSectionDesc.length}/{VALIDATION_LIMITS.SECTION_DESC_MAX_LENGTH}
                </span>
              </div>
              <Input
                value={newSectionDesc}
                onChange={(e) => setNewSectionDesc(e.target.value)}
                placeholder={t("sectionDescription")}
                maxLength={VALIDATION_LIMITS.SECTION_DESC_MAX_LENGTH}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSectionDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleAddSection} disabled={!newSectionTitle.trim()}>
              <Layers className="h-4 w-4 mr-2" />
              {t("addSection")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Manual to Chapter Dialog */}
      <Dialog open={moveManualDialogOpen} onOpenChange={setMoveManualDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("moveToChapter")}</DialogTitle>
          </DialogHeader>
          {manualToMove && selectedProject && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("manual")}</Label>
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{manualToMove.manualId}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("targetChapter")}</Label>
                <select
                  className="w-full p-2 border rounded-md bg-background"
                  value={targetChapterId}
                  onChange={(e) => setTargetChapterId(e.target.value)}
                >
                  <option value="" disabled>{t("selectChapter")}</option>
                  {selectedProject.chapters
                    .filter((ch) => ch.id !== manualToMove.currentChapterId)
                    .sort((a, b) => a.order - b.order)
                    .map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.title}
                      </option>
                    ))}
                </select>
              </div>

              {manualToMove.currentChapterId && (
                <p className="text-sm text-muted-foreground">
                  {t("currentChapter")}: {selectedProject.chapters.find((ch) => ch.id === manualToMove.currentChapterId)?.title}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveManualDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleMoveManual} disabled={!targetChapterId}>
              <MoveHorizontal className="h-4 w-4 mr-2" />
              {t("moveManual")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Chapter to Section Dialog */}
      <Dialog open={moveChapterToSectionDialogOpen} onOpenChange={setMoveChapterToSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("moveToSection")}</DialogTitle>
          </DialogHeader>
          {chapterToMoveToSection && selectedProject && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("chapter")}</Label>
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    {selectedProject.chapters.find((ch) => ch.id === chapterToMoveToSection.chapterId)?.title}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("targetSection")}</Label>
                <select
                  className="w-full p-2 border rounded-md bg-background"
                  value={targetSectionId}
                  onChange={(e) => setTargetSectionId(e.target.value)}
                >
                  <option value="" disabled>{t("selectSection")}</option>
                  {selectedProject.sections
                    ?.filter((s) => s.id !== chapterToMoveToSection.currentSectionId)
                    .sort((a, b) => a.order - b.order)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                </select>
              </div>

              {chapterToMoveToSection.currentSectionId && (
                <p className="text-sm text-muted-foreground">
                  {t("currentSection")}: {selectedProject.sections?.find((s) => s.id === chapterToMoveToSection.currentSectionId)?.title}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveChapterToSectionDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleMoveChapterToSection} disabled={!targetSectionId}>
              <Layers className="h-4 w-4 mr-2" />
              {t("moveChapter")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Name</Label>
                <span className="text-xs text-muted-foreground">
                  {editName.length}/{VALIDATION_LIMITS.PROJECT_NAME_MAX_LENGTH}
                </span>
              </div>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Project name"
                maxLength={VALIDATION_LIMITS.PROJECT_NAME_MAX_LENGTH}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Description</Label>
                <span className="text-xs text-muted-foreground">
                  {editDescription.length}/{VALIDATION_LIMITS.PROJECT_DESC_MAX_LENGTH}
                </span>
              </div>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
                maxLength={VALIDATION_LIMITS.PROJECT_DESC_MAX_LENGTH}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={saving || !editName.trim()}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Project?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  You are about to delete this project. It will be moved to trash where it can be recovered within 30 days.
                </p>

                {/* Project Tree View */}
                {projectToDelete && (
                  <div className="rounded-lg border bg-muted/30 p-4 max-h-[300px] overflow-auto custom-scrollbar">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Project Contents</p>

                    {/* Project Root */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-foreground font-medium">
                        <FolderKanban className="h-5 w-5 text-primary" />
                        <span>{projectToDelete.name}</span>
                      </div>

                      {/* Description */}
                      {projectToDelete.description && (
                        <p className="text-sm text-muted-foreground ml-7 mb-2">{projectToDelete.description}</p>
                      )}

                      {/* Chapters with manuals */}
                      {projectToDelete.chapters_with_manuals && projectToDelete.chapters_with_manuals.length > 0 ? (
                        <div className="ml-4 border-l-2 border-muted-foreground/20 pl-4 space-y-2 mt-2">
                          {projectToDelete.chapters_with_manuals.map((chapter) => (
                            <div key={chapter.id} className="space-y-1">
                              {/* Chapter */}
                              <div className="flex items-center gap-2 text-foreground">
                                <BookOpen className="h-4 w-4 text-blue-500" />
                                <span className="font-medium">{chapter.title}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({chapter.manuals.length} manual{chapter.manuals.length !== 1 ? 's' : ''})
                                </span>
                              </div>

                              {/* Manuals in chapter */}
                              {chapter.manuals.length > 0 && (
                                <div className="ml-4 border-l-2 border-muted-foreground/20 pl-4 space-y-1">
                                  {chapter.manuals.map((manualId) => (
                                    <div key={manualId} className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <FileText className="h-3.5 w-3.5" />
                                      <span className="truncate">{manualId}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground ml-7 italic">No chapters or manuals</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Manual handling option */}
                {projectToDelete && projectToDelete.manual_count > 0 && (
                  <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 space-y-3">
                    <p className="font-medium text-foreground">
                      What should happen to the {projectToDelete.manual_count} manual{projectToDelete.manual_count !== 1 ? 's' : ''}?
                    </p>

                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="deleteManuals"
                          checked={!deleteManuals}
                          onChange={() => setDeleteManuals(false)}
                          className="h-4 w-4"
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground">Keep manuals</p>
                          <p className="text-xs text-muted-foreground">Move them to the default project</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="deleteManuals"
                          checked={deleteManuals}
                          onChange={() => setDeleteManuals(true)}
                          className="h-4 w-4"
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground">Delete manuals</p>
                          <p className="text-xs text-muted-foreground">Move them to trash with the project</p>
                        </div>
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
                  {deleteManuals ? "Delete Project & Manuals" : "Delete Project"}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Compile Settings Dialog */}
      {selectedProject && (
        <CompileSettingsDialog
          open={compileSettingsOpen}
          onOpenChange={setCompileSettingsOpen}
          projectId={compileProjectId || selectedProject.id}
          projectName={selectedProject.name}
          onStartCompile={handleStartCompile}
        />
      )}


      {/* Manual Viewer Dialog */}
      <Dialog open={viewManualOpen} onOpenChange={setViewManualOpen}>
        <DialogContent className="sm:max-w-6xl w-[90vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedManual?.id}
            </DialogTitle>
            {selectedManual && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                {selectedManual.screenshots.length} screenshots
              </div>
            )}
          </DialogHeader>

          {selectedManual && (
            <Tabs defaultValue="content" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="shrink-0 w-fit">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="screenshots">
                  Screenshots ({selectedManual.screenshots.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="flex-1 overflow-y-auto mt-4 pr-2 custom-scrollbar">
                <div className="prose prose-sm dark:prose-invert max-w-none pb-4">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      img: ({ src, alt }) => {
                        const srcStr = typeof src === "string" ? src : "";
                        const filename = srcStr.split("/").pop() || srcStr;
                        const apiUrl = `/api/manuals/${selectedManual.id}/screenshots/${filename}`;
                        return (
                          <span className="block my-4">
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
                        <h1 className="text-2xl font-bold mt-6 mb-3 first:mt-0 pb-2 border-b">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-xl font-semibold mt-6 mb-3">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-lg font-medium mt-4 mb-2">{children}</h3>
                      ),
                      p: ({ children }) => (
                        <p className="my-3 leading-7 text-foreground/90">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="my-3 ml-6 list-disc space-y-1">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="my-3 ml-6 list-decimal space-y-1">{children}</ol>
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
                        <blockquote className="border-l-4 border-primary/50 bg-muted/50 pl-4 pr-4 py-2 my-4 italic rounded-r-lg">
                          {children}
                        </blockquote>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-foreground">{children}</strong>
                      ),
                    }}
                  >
                    {selectedManual.content}
                  </ReactMarkdown>
                </div>
              </TabsContent>

              <TabsContent value="screenshots" className="flex-1 overflow-y-auto mt-4 pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 gap-4 pb-4">
                  {selectedManual.screenshots.map((screenshot, idx) => (
                    <div key={idx} className="border rounded-lg overflow-hidden shadow-sm">
                      <img
                        src={`/api/manuals/${selectedManual.id}/screenshots/${screenshot.split("/").pop()}`}
                        alt={`Screenshot ${idx + 1}`}
                        className="w-full"
                      />
                      <div className="px-4 py-2 text-sm text-muted-foreground bg-muted/50 flex items-center justify-between">
                        <span className="font-medium">Step {idx + 1}</span>
                        <span className="text-xs">{screenshot.split("/").pop()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      {selectedProject && (
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          title={selectedProject.name}
          languages={["en"]}
          onExport={handleExportWithOptions}
          defaultLanguage="en"
          showFormat={false}
        />
      )}
    </div>
  );
}
