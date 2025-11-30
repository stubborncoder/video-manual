"use client";

import { useEffect, useState } from "react";
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
import { Eye, Trash2, FileText, Image as ImageIcon, FolderKanban, Plus, X, Tag, Loader2, Filter, Video, AlertCircle, ArrowUpRight, Pencil } from "lucide-react";
import { manuals, manualProject, projects, type ManualSummary, type ManualDetail, type ProjectSummary } from "@/lib/api";

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

  // Project data
  const [projectList, setProjectList] = useState<ProjectSummary[]>([]);
  const [filterProject, setFilterProject] = useState<string>("all");

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

  async function handleView(manualId: string, language = "en") {
    try {
      const manual = await manuals.get(manualId, language);
      setSelectedManual(manual);
      setViewDialogOpen(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load manual";
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

  // Filter manuals by project
  const filteredManuals =
    filterProject === "all"
      ? manualList
      : filterProject === "unassigned"
      ? manualList.filter((m) => !m.project_id)
      : manualList.filter((m) => m.project_id === filterProject);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manuals</h1>
          <p className="text-muted-foreground">
            View and manage your generated manuals
          </p>
        </div>

        {/* Project Filter */}
        {manualList.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {projectList.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button variant="outline" className="mt-4" onClick={() => setFilterProject("all")}>
              Show All
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredManuals.map((manual) => (
            <Card key={manual.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base truncate flex-1">{manual.id}</CardTitle>
                </div>

                {/* Source video info */}
                {manual.source_video && (
                  <div className="flex items-center gap-1 text-sm mt-1">
                    <Video className="h-3 w-3 text-muted-foreground" />
                    <Link
                      href="/dashboard/videos"
                      className="text-muted-foreground hover:text-foreground truncate flex items-center gap-1"
                    >
                      {manual.source_video.name}
                      {!manual.source_video.exists && (
                        <Badge variant="destructive" className="text-xs px-1 py-0">
                          <AlertCircle className="h-3 w-3 mr-0.5" />
                          deleted
                        </Badge>
                      )}
                    </Link>
                  </div>
                )}

                {/* Project info */}
                {manual.project_name && manual.project_id && (
                  <Link href="/dashboard/projects">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mt-1">
                      <FolderKanban className="h-3 w-3" />
                      <span className="truncate">{manual.project_name}</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </div>
                  </Link>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground mb-3">
                  <p className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    {manual.screenshot_count} screenshots
                  </p>
                  <p>Languages: {manual.languages.join(", ") || "en"}</p>
                  {manual.created_at && (
                    <p>
                      Created: {new Date(manual.created_at).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Tags */}
                {manual.tags && manual.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {manual.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleView(manual.id)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                  <Link href={`/dashboard/manuals/${manual.id}/edit`}>
                    <Button
                      size="sm"
                      variant="outline"
                      title="Edit manual"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openAssignDialog(manual)}
                    title="Assign to project"
                  >
                    <FolderKanban className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openTagsDialog(manual)}
                    title="Manage tags"
                  >
                    <Tag className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openDeleteDialog(manual)}
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
        <SheetContent className="w-full sm:max-w-none sm:w-[70vw] lg:w-[60vw] xl:w-[50vw] overflow-hidden flex flex-col">
          {/* Fixed Header */}
          <SheetHeader className="border-b pb-4 shrink-0">
            <SheetTitle className="text-2xl font-bold">{selectedManual?.id}</SheetTitle>

            {/* Source info in header */}
            {selectedManual && (
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
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
              </div>
            )}
          </SheetHeader>

          {selectedManual && (
            <div className="flex-1 overflow-hidden flex flex-col pt-4">
              <Tabs defaultValue="content" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="shrink-0 mb-4 w-fit">
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="screenshots">
                    Screenshots ({selectedManual.screenshots.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="content" className="flex-1 overflow-y-auto mt-0 pr-2">
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

                <TabsContent value="screenshots" className="flex-1 overflow-y-auto mt-0 pr-2">
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
    </div>
  );
}
