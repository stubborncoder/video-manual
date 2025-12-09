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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
} from "lucide-react";
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
import type { CompileSettings } from "@/lib/types";

// Validation helper
interface ValidationResult {
  isValid: boolean;
  error?: string;
}

function validateInput(
  value: string,
  fieldName: string,
  maxLength: number,
  required: boolean = true
): ValidationResult {
  const trimmed = value.trim();

  if (required && !trimmed) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  if (trimmed.length > maxLength) {
    return { isValid: false, error: `${fieldName} too long (max ${maxLength} characters)` };
  }

  if (INVALID_CHARS_PATTERN.test(trimmed)) {
    return { isValid: false, error: `${fieldName} contains invalid characters (< >)` };
  }

  return { isValid: true };
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
  const [projectList, setProjectList] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
  const [projectSheetOpen, setProjectSheetOpen] = useState(false);

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

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const res = await projects.list();
      setProjectList(res.projects);
    } catch (e) {
      console.error("Failed to load projects:", e);
      toast.error("Failed to load projects", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    // Validate name
    const nameValidation = validateInput(
      newProjectName,
      "Project name",
      VALIDATION_LIMITS.PROJECT_NAME_MAX_LENGTH
    );
    if (!nameValidation.isValid) {
      toast.error(nameValidation.error!);
      return;
    }

    // Validate description (optional field)
    const descValidation = validateInput(
      newProjectDesc,
      "Description",
      VALIDATION_LIMITS.PROJECT_DESC_MAX_LENGTH,
      false
    );
    if (!descValidation.isValid) {
      toast.error(descValidation.error!);
      return;
    }

    try {
      await projects.create(newProjectName.trim(), newProjectDesc.trim());
      toast.success("Project created");
      setCreateDialogOpen(false);
      setNewProjectName("");
      setNewProjectDesc("");
      await loadProjects();
    } catch (e) {
      console.error("Failed to create project:", e);
      toast.error("Failed to create project", {
        description: e instanceof Error ? e.message : "Unknown error",
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
      "Project name",
      VALIDATION_LIMITS.PROJECT_NAME_MAX_LENGTH
    );
    if (!nameValidation.isValid) {
      toast.error(nameValidation.error!);
      return;
    }

    // Validate description (optional field)
    const descValidation = validateInput(
      editDescription,
      "Description",
      VALIDATION_LIMITS.PROJECT_DESC_MAX_LENGTH,
      false
    );
    if (!descValidation.isValid) {
      toast.error(descValidation.error!);
      return;
    }

    setSaving(true);
    try {
      await projects.update(editProjectId, editName.trim(), editDescription.trim());
      toast.success("Project updated");
      setEditDialogOpen(false);
      await loadProjects();
      // Refresh detail view if open
      if (selectedProject?.id === editProjectId) {
        const detail = await projects.get(editProjectId);
        setSelectedProject(detail);
      }
    } catch (e) {
      console.error("Failed to update project:", e);
      toast.error("Failed to update project", {
        description: e instanceof Error ? e.message : "Unknown error",
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
      toast.success("Project moved to trash", {
        description: deleteManuals
          ? `${projectToDelete.name} and ${projectToDelete.manual_count} manual(s)`
          : projectToDelete.name,
      });
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
      await loadProjects();
    } catch (e) {
      console.error("Failed to delete project:", e);
      toast.error("Failed to delete project", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function handleViewDetails(projectId: string) {
    try {
      const detail = await projects.get(projectId);
      setSelectedProject(detail);
      setProjectSheetOpen(true);
    } catch (e) {
      console.error("Failed to load project details:", e);
      toast.error("Failed to load project details", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  // Chapter handlers
  async function handleAddChapter() {
    if (!selectedProject) return;

    // Validate title
    const titleValidation = validateInput(
      newChapterTitle,
      "Chapter title",
      VALIDATION_LIMITS.CHAPTER_TITLE_MAX_LENGTH
    );
    if (!titleValidation.isValid) {
      toast.error(titleValidation.error!);
      return;
    }

    // Validate description (optional field)
    const descValidation = validateInput(
      newChapterDesc,
      "Chapter description",
      VALIDATION_LIMITS.CHAPTER_DESC_MAX_LENGTH,
      false
    );
    if (!descValidation.isValid) {
      toast.error(descValidation.error!);
      return;
    }

    try {
      await projects.addChapter(selectedProject.id, newChapterTitle.trim(), newChapterDesc.trim());
      toast.success("Chapter added");
      setAddChapterDialogOpen(false);
      setNewChapterTitle("");
      setNewChapterDesc("");
      // Refresh project detail
      const detail = await projects.get(selectedProject.id);
      setSelectedProject(detail);
    } catch (e) {
      console.error("Failed to add chapter:", e);
      toast.error("Failed to add chapter", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  async function handleEditChapter() {
    if (!selectedProject || !editChapterId) return;

    // Validate title
    const titleValidation = validateInput(
      editChapterTitle,
      "Chapter title",
      VALIDATION_LIMITS.CHAPTER_TITLE_MAX_LENGTH
    );
    if (!titleValidation.isValid) {
      toast.error(titleValidation.error!);
      return;
    }

    // Validate description (optional field)
    const descValidation = validateInput(
      editChapterDesc,
      "Chapter description",
      VALIDATION_LIMITS.CHAPTER_DESC_MAX_LENGTH,
      false
    );
    if (!descValidation.isValid) {
      toast.error(descValidation.error!);
      return;
    }

    try {
      await projects.updateChapter(selectedProject.id, editChapterId, editChapterTitle.trim(), editChapterDesc.trim());
      toast.success("Chapter updated");
      setEditChapterId(null);
      // Refresh project detail
      const detail = await projects.get(selectedProject.id);
      setSelectedProject(detail);
    } catch (e) {
      console.error("Failed to update chapter:", e);
      toast.error("Failed to update chapter", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  async function handleDeleteChapter(chapterId: string) {
    if (!selectedProject) return;

    try {
      await projects.deleteChapter(selectedProject.id, chapterId);
      toast.success("Chapter deleted");
      // Refresh project detail
      const detail = await projects.get(selectedProject.id);
      setSelectedProject(detail);
    } catch (e) {
      console.error("Failed to delete chapter:", e);
      toast.error("Failed to delete chapter", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  async function handleRemoveManualFromProject(manualId: string) {
    if (!selectedProject) return;

    try {
      await projects.removeManual(selectedProject.id, manualId);
      toast.success("Manual removed from project");
      // Refresh project detail
      const detail = await projects.get(selectedProject.id);
      setSelectedProject(detail);
    } catch (e) {
      console.error("Failed to remove manual from project:", e);
      toast.error("Failed to remove manual from project", {
        description: e instanceof Error ? e.message : "Unknown error",
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

    // Close settings dialog and sheet, open compiler view
    setCompileSettingsOpen(false);
    setProjectSheetOpen(false);
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
      toast.success("Export complete", {
        description: result.output_path,
      });
    } catch (e) {
      console.error("Failed to export project:", e);
      toast.error("Failed to export project", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setExporting(null);
    }
  }

  async function handleQuickExport(projectId: string, format: "pdf" | "html") {
    setExporting(format);
    try {
      const result = await projects.export(projectId, format);
      toast.success("Export complete", {
        description: result.output_path,
      });
    } catch (e) {
      console.error("Failed to export project:", e);
      toast.error("Failed to export project", {
        description: e instanceof Error ? e.message : "Unknown error",
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
      toast.error("Failed to load manual", {
        description: e instanceof Error ? e.message : "Unknown error",
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
    ? "All Projects"
    : projectList.find((p) => p.id === filterProjectId)?.name || "Select project";

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
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("description")}
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
                <span className="truncate">{selectedFilterName}</span>
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

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Name</Label>
                    <span className="text-xs text-muted-foreground">
                      {newProjectName.length}/{VALIDATION_LIMITS.PROJECT_NAME_MAX_LENGTH}
                    </span>
                  </div>
                  <Input
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Project name"
                    maxLength={VALIDATION_LIMITS.PROJECT_NAME_MAX_LENGTH}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Description</Label>
                    <span className="text-xs text-muted-foreground">
                      {newProjectDesc.length}/{VALIDATION_LIMITS.PROJECT_DESC_MAX_LENGTH}
                    </span>
                  </div>
                  <Input
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder="Optional description"
                    maxLength={VALIDATION_LIMITS.PROJECT_DESC_MAX_LENGTH}
                  />
                </div>
                <Button onClick={handleCreate} className="w-full">
                  Create
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
            <p className="text-muted-foreground">No projects match this filter</p>
            <Button variant="outline" className="mt-4" onClick={() => setFilterProjectId("__all__")}>
              Show All
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card
              key={project.id}
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
                      {project.name}
                      {project.is_default && (
                        <Badge variant="secondary" className="shrink-0 text-[10px] font-semibold">
                          <Star className="h-3 w-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </CardTitle>

                    {project.description && (
                      <CardDescription className="text-sm leading-relaxed line-clamp-2 mt-1">
                        {project.description}
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
                      <span className="text-xs text-muted-foreground">manuals</span>
                    </div>
                  </div>

                  {project.chapter_count !== undefined && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center h-8 w-8 rounded-md bg-secondary text-secondary-foreground">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-lg font-semibold leading-none">{project.chapter_count}</span>
                        <span className="text-xs text-muted-foreground">chapters</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions with refined styling */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleViewDetails(project.id)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Project
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

      {/* Project Detail Sheet - Full Page Panel */}
      <Sheet open={projectSheetOpen} onOpenChange={setProjectSheetOpen}>
        <SheetContent side="right" fullPage className="p-0 flex flex-col">
          {selectedProject && (
            <>
              {/* Header Section */}
              <SheetHeader className="border-b p-6 pr-14 space-y-0">
                <SheetTitle className="text-2xl font-bold flex items-center gap-2">
                  <FolderKanban className="h-6 w-6" />
                  {selectedProject.name}
                  {selectedProject.is_default && (
                    <Badge variant="secondary">
                      <Star className="h-3 w-3 mr-1" />
                      Default
                    </Badge>
                  )}
                </SheetTitle>
                {selectedProject.description && (
                  <p className="text-muted-foreground mt-1">{selectedProject.description}</p>
                )}

                {/* Action Bar */}
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={() => handleCompile(selectedProject.id, selectedProject.name)}
                    disabled={selectedProject.manuals.length === 0}
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    Compile
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
                        {exporting ? `Exporting ${exporting.toUpperCase()}...` : "Export"}
                        {!exporting && <ChevronDown className="h-4 w-4 ml-2" />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleQuickExport(selectedProject.id, "pdf")} disabled={exporting !== null}>
                        PDF Document
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openExportDialog()} disabled={exporting !== null}>
                        Word Document...
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleQuickExport(selectedProject.id, "html")} disabled={exporting !== null}>
                        HTML
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {!selectedProject.is_default && (
                    <>
                      <Button variant="outline" onClick={() => openEditDialog(selectedProject)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
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
              </SheetHeader>

              {/* Tabs Section */}
              <Tabs defaultValue="chapters" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-6 pt-4 border-b">
                  <TabsList>
                    <TabsTrigger value="chapters">
                      <BookOpen className="h-4 w-4 mr-2" />
                      Chapters ({selectedProject.chapters.length})
                    </TabsTrigger>
                    <TabsTrigger value="manuals">
                      <FileText className="h-4 w-4 mr-2" />
                      Manuals ({selectedProject.manuals.length})
                    </TabsTrigger>
                    <TabsTrigger value="videos">
                      <Video className="h-4 w-4 mr-2" />
                      Videos ({selectedProject.videos?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="settings">
                      <Settings className="h-4 w-4 mr-2" />
                      Export Settings
                    </TabsTrigger>
                    <TabsTrigger value="versions">
                      <History className="h-4 w-4 mr-2" />
                      Compilations
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Chapters Tab */}
                <TabsContent value="chapters" className="flex-1 overflow-auto p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      Organize your manuals into chapters for better structure
                    </p>
                    <Button size="sm" onClick={() => setAddChapterDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Chapter
                    </Button>
                  </div>

                  {selectedProject.chapters.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                      <BookOpen className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <p className="text-lg font-medium">No chapters yet</p>
                      <p className="text-sm mt-1">Add chapters to organize your manuals</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedProject.chapters
                        .sort((a, b) => a.order - b.order)
                        .map((ch) => {
                          const chapterManuals = selectedProject.manuals.filter(
                            (m) => m.chapter_id === ch.id
                          );
                          const isEditing = editChapterId === ch.id;

                          return (
                            <Card key={ch.id} className="overflow-hidden">
                              <CardContent className="p-4">
                                {isEditing ? (
                                  <div className="space-y-3">
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium">Title</span>
                                        <span className="text-xs text-muted-foreground">
                                          {editChapterTitle.length}/{VALIDATION_LIMITS.CHAPTER_TITLE_MAX_LENGTH}
                                        </span>
                                      </div>
                                      <Input
                                        value={editChapterTitle}
                                        onChange={(e) => setEditChapterTitle(e.target.value)}
                                        placeholder="Chapter title"
                                        maxLength={VALIDATION_LIMITS.CHAPTER_TITLE_MAX_LENGTH}
                                      />
                                    </div>
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium">Description</span>
                                        <span className="text-xs text-muted-foreground">
                                          {editChapterDesc.length}/{VALIDATION_LIMITS.CHAPTER_DESC_MAX_LENGTH}
                                        </span>
                                      </div>
                                      <Input
                                        value={editChapterDesc}
                                        onChange={(e) => setEditChapterDesc(e.target.value)}
                                        placeholder="Description (optional)"
                                        maxLength={VALIDATION_LIMITS.CHAPTER_DESC_MAX_LENGTH}
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={handleEditChapter}>
                                        Save
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditChapterId(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-center gap-3">
                                        <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                                        <div>
                                          <p className="font-semibold text-lg">{ch.title}</p>
                                          {ch.description && (
                                            <p className="text-sm text-muted-foreground">
                                              {ch.description}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant="secondary">
                                          {chapterManuals.length} manuals
                                        </Badge>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8"
                                          onClick={() => {
                                            setEditChapterId(ch.id);
                                            setEditChapterTitle(ch.title);
                                            setEditChapterDesc(ch.description);
                                          }}
                                        >
                                          <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8 text-destructive"
                                          onClick={() => handleDeleteChapter(ch.id)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                    {chapterManuals.length > 0 && (
                                      <div className="mt-3 ml-8 space-y-1 border-l-2 pl-4">
                                        {chapterManuals.map((m) => (
                                          <div
                                            key={m.manual_id}
                                            className="flex items-center gap-2 text-sm text-muted-foreground py-1"
                                          >
                                            <FileText className="h-3 w-3" />
                                            <span className="truncate">{m.manual_id}</span>
                                          </div>
                                        ))}
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
                </TabsContent>

                {/* Manuals Tab */}
                <TabsContent value="manuals" className="flex-1 overflow-auto p-6">
                  {selectedProject.manuals.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                      <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <p className="text-lg font-medium">No manuals in this project</p>
                      <p className="text-sm mt-1">Process a video to generate manuals</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {selectedProject.manuals.map((m) => {
                        const chapter = selectedProject.chapters.find(
                          (ch) => ch.id === m.chapter_id
                        );
                        return (
                          <Card key={m.manual_id} className="overflow-hidden">
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
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRemoveManualFromProject(m.manual_id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* Videos Tab */}
                <TabsContent value="videos" className="flex-1 overflow-auto p-6">
                  {!selectedProject.videos || selectedProject.videos.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                      <Video className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <p className="text-lg font-medium">No videos in this project</p>
                      <p className="text-sm mt-1">Videos are automatically linked when you generate manuals</p>
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
                <TabsContent value="settings" className="flex-1 overflow-auto p-6">
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
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Version History Tab */}
                <TabsContent value="versions" className="flex-1 overflow-auto p-6">
                  <CompilationVersionHistory projectId={selectedProject.id} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Chapter Dialog */}
      <Dialog open={addChapterDialogOpen} onOpenChange={setAddChapterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Chapter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Title</Label>
                <span className="text-xs text-muted-foreground">
                  {newChapterTitle.length}/{VALIDATION_LIMITS.CHAPTER_TITLE_MAX_LENGTH}
                </span>
              </div>
              <Input
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                placeholder="Chapter title"
                maxLength={VALIDATION_LIMITS.CHAPTER_TITLE_MAX_LENGTH}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Description</Label>
                <span className="text-xs text-muted-foreground">
                  {newChapterDesc.length}/{VALIDATION_LIMITS.CHAPTER_DESC_MAX_LENGTH}
                </span>
              </div>
              <Input
                value={newChapterDesc}
                onChange={(e) => setNewChapterDesc(e.target.value)}
                placeholder="Optional description"
                maxLength={VALIDATION_LIMITS.CHAPTER_DESC_MAX_LENGTH}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddChapterDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddChapter} disabled={!newChapterTitle.trim()}>
              Add Chapter
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
                  <div className="rounded-lg border bg-muted/30 p-4 max-h-[300px] overflow-auto">
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

              <TabsContent value="content" className="flex-1 overflow-y-auto mt-4 pr-2">
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

              <TabsContent value="screenshots" className="flex-1 overflow-y-auto mt-4 pr-2">
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
