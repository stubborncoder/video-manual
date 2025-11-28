"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FolderKanban,
  Plus,
  Trash2,
  FileDown,
  Wand2,
  Eye,
} from "lucide-react";
import {
  projects,
  type ProjectSummary,
  type ProjectDetail,
} from "@/lib/api";
import { useProjectCompiler } from "@/hooks/useWebSocket";
import { CompilerChat } from "@/components/chat/CompilerChat";

export default function ProjectsPage() {
  const [projectList, setProjectList] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const [compileDialogOpen, setCompileDialogOpen] = useState(false);
  const [compileProjectId, setCompileProjectId] = useState<string | null>(null);

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
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newProjectName.trim()) return;

    try {
      await projects.create(newProjectName.trim(), newProjectDesc.trim());
      setCreateDialogOpen(false);
      setNewProjectName("");
      setNewProjectDesc("");
      await loadProjects();
    } catch (e) {
      console.error("Create failed:", e);
    }
  }

  async function handleDelete(projectId: string) {
    if (!confirm(`Delete project ${projectId}?`)) return;

    try {
      await projects.delete(projectId);
      await loadProjects();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }

  async function handleViewDetails(projectId: string) {
    try {
      const detail = await projects.get(projectId);
      setSelectedProject(detail);
      setDetailDialogOpen(true);
    } catch (e) {
      console.error("Failed to load project:", e);
    }
  }

  async function handleCompile(projectId: string) {
    setCompileProjectId(projectId);
    setCompileDialogOpen(true);
    resetCompiler();

    try {
      await startCompilation({ project_id: projectId });
    } catch (e) {
      console.error("Compilation failed:", e);
    }
  }

  async function handleExport(projectId: string, format: "pdf" | "word" | "html") {
    try {
      const result = await projects.export(projectId, format);
      toast.success("Export complete", {
        description: result.output_path,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Export failed";
      toast.error("Export failed", {
        description: message,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">
            Organize and compile your manuals
          </p>
        </div>

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
                <Label>Name</Label>
                <Input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Project name"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <Button onClick={handleCreate} className="w-full">
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading projects...
        </div>
      ) : projectList.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FolderKanban className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No projects found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a project to organize your manuals
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projectList.map((project) => (
            <Card key={project.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{project.name}</CardTitle>
                {project.description && (
                  <CardDescription>{project.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {project.manual_count} manuals
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewDetails(project.id)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCompile(project.id)}
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    Compile
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExport(project.id, "pdf")}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(project.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Project Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedProject?.name}</DialogTitle>
          </DialogHeader>

          {selectedProject && (
            <Tabs defaultValue="chapters">
              <TabsList>
                <TabsTrigger value="chapters">
                  Chapters ({selectedProject.chapters.length})
                </TabsTrigger>
                <TabsTrigger value="manuals">
                  Manuals ({selectedProject.manuals.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chapters" className="space-y-2">
                {selectedProject.chapters.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4">
                    No chapters yet
                  </p>
                ) : (
                  selectedProject.chapters.map((ch) => (
                    <div
                      key={ch.id}
                      className="p-3 bg-muted rounded-lg"
                    >
                      <p className="font-medium">{ch.title}</p>
                      {ch.description && (
                        <p className="text-sm text-muted-foreground">
                          {ch.description}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="manuals" className="space-y-2">
                {selectedProject.manuals.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4">
                    No manuals added yet
                  </p>
                ) : (
                  selectedProject.manuals.map((m) => (
                    <div
                      key={m.manual_id}
                      className="p-3 bg-muted rounded-lg"
                    >
                      <p className="font-medium">{m.manual_id}</p>
                      {m.chapter_id && (
                        <p className="text-sm text-muted-foreground">
                          Chapter: {m.chapter_id}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Compile Dialog */}
      <Dialog open={compileDialogOpen} onOpenChange={setCompileDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Compile Project</DialogTitle>
          </DialogHeader>
          <CompilerChat
            state={compilerState}
            onDecision={submitDecision}
            onMessage={sendMessage}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
