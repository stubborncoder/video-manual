"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Trash2, FileText, Image as ImageIcon } from "lucide-react";
import { manuals, type ManualSummary, type ManualDetail } from "@/lib/api";

export default function ManualsPage() {
  const [manualList, setManualList] = useState<ManualSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedManual, setSelectedManual] = useState<ManualDetail | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  useEffect(() => {
    loadManuals();
  }, []);

  async function loadManuals() {
    try {
      const res = await manuals.list();
      setManualList(res.manuals);
    } catch (e) {
      console.error("Failed to load manuals:", e);
    } finally {
      setLoading(false);
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

  async function handleDelete(manualId: string) {
    try {
      await manuals.delete(manualId);
      toast.success("Manual deleted", { description: manualId });
      await loadManuals();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Delete failed";
      toast.error("Delete failed", { description: message });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Manuals</h1>
        <p className="text-muted-foreground">
          View and manage your generated manuals
        </p>
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
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {manualList.map((manual) => (
            <Card key={manual.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base truncate">{manual.id}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground mb-4">
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

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleView(manual.id)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(manual.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Manual Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedManual?.id}</DialogTitle>
          </DialogHeader>

          {selectedManual && (
            <Tabs defaultValue="content">
              <TabsList>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="screenshots">
                  Screenshots ({selectedManual.screenshots.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="content">
                <ScrollArea className="h-[60vh]">
                  <div className="prose prose-sm dark:prose-invert max-w-none p-4">
                    <pre className="whitespace-pre-wrap font-sans">
                      {selectedManual.content}
                    </pre>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="screenshots">
                <ScrollArea className="h-[60vh]">
                  <div className="grid grid-cols-2 gap-4 p-4">
                    {selectedManual.screenshots.map((screenshot, idx) => (
                      <div key={idx} className="border rounded overflow-hidden">
                        <img
                          src={`/api/manuals/${selectedManual.id}/screenshots/${screenshot.split("/").pop()}`}
                          alt={`Screenshot ${idx + 1}`}
                          className="w-full"
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
