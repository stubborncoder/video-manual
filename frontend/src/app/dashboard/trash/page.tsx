"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, RotateCcw, Video, FileText, FolderKanban, Clock } from "lucide-react";
import { SidebarToggle } from "@/components/layout/SidebarToggle";
import { trash, type TrashItem, type TrashStats } from "@/lib/api";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDaysUntilExpiry(expiresAt: string): number {
  const expires = new Date(expiresAt);
  const now = new Date();
  const diff = expires.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getItemIcon(type: string) {
  switch (type) {
    case "video":
      return <Video className="h-4 w-4" />;
    case "manual":
      return <FileText className="h-4 w-4" />;
    case "project":
      return <FolderKanban className="h-4 w-4" />;
    default:
      return <Trash2 className="h-4 w-4" />;
  }
}

export default function TrashPage() {
  const t = useTranslations("trash");
  const tc = useTranslations("common");
  const [items, setItems] = useState<TrashItem[]>([]);
  const [stats, setStats] = useState<TrashStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadTrash();
  }, []);

  async function loadTrash() {
    try {
      const res = await trash.list();
      setItems(res.items);
      setStats(res.stats);
    } catch (e) {
      console.error("Failed to load trash:", e);
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore(item: TrashItem) {
    setRestoring(item.trash_id);
    try {
      await trash.restore(item.item_type, item.trash_id);
      toast.success(t("itemRestored"), { description: item.original_name });
      await loadTrash();
    } catch (e) {
      const message = e instanceof Error ? e.message : t("restoreFailed");
      toast.error(t("restoreFailed"), { description: message });
    } finally {
      setRestoring(null);
    }
  }

  async function handlePermanentDelete(item: TrashItem) {
    setDeleting(item.trash_id);
    try {
      await trash.permanentDelete(item.item_type, item.trash_id);
      toast.success(t("permanentlyDeleted"), { description: item.original_name });
      await loadTrash();
    } catch (e) {
      const message = e instanceof Error ? e.message : t("deleteFailed");
      toast.error(t("deleteFailed"), { description: message });
    } finally {
      setDeleting(null);
    }
  }

  async function handleEmptyTrash() {
    try {
      const res = await trash.empty();
      toast.success(t("trashEmptied"), { description: t("itemsDeleted", { count: res.deleted_count }) });
      await loadTrash();
    } catch (e) {
      const message = e instanceof Error ? e.message : t("emptyTrashFailed");
      toast.error(t("emptyTrashFailed"), { description: message });
    }
  }

  // Group items by type
  const groupedItems = {
    video: items.filter((i) => i.item_type === "video"),
    manual: items.filter((i) => i.item_type === "manual"),
    project: items.filter((i) => i.item_type === "project"),
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        {/* Decorative background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-bl from-primary/10 via-primary/5 to-transparent rounded-full blur-3xl" />
          <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-gradient-to-tr from-primary/5 to-transparent rounded-full blur-2xl" />
          {/* Icon pattern */}
          <div className="absolute top-8 right-12 opacity-[0.03]">
            <Trash2 className="w-64 h-64" strokeWidth={0.5} />
          </div>
        </div>

        <div className="relative p-8 lg:p-10">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex items-start gap-4 flex-1">
              <SidebarToggle className="mt-1 shrink-0" />
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
                    <Trash2 className="h-5 w-5 text-primary" />
                  </div>
                  <h1 className="font-display text-3xl tracking-tight">{t("title")}</h1>
                </div>
                <p className="text-muted-foreground max-w-xl leading-relaxed">
                  {t("description")}
                </p>
                {/* Quick stats */}
                {!loading && stats && (
                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                        <Video className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-muted-foreground">{stats.videos} {t("videos").toLowerCase()}</span>
                    </div>
                    <div className="w-px h-4 bg-border" />
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-muted-foreground">{stats.manuals} {t("manuals").toLowerCase()}</span>
                    </div>
                    <div className="w-px h-4 bg-border" />
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                        <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-muted-foreground">{stats.projects} {t("projects").toLowerCase()}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {stats && stats.total > 0 && (
              <div className="flex items-center gap-3 lg:self-center">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button data-guide-id="empty-trash-btn" variant="destructive" size="lg" className="gap-2 shadow-lg">
                      <Trash2 className="h-4 w-4" />
                      {t("emptyTrashCount", { count: stats.total })}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("emptyTrashTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("emptyTrashDesc", { count: stats.total })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleEmptyTrash}>
                        {t("emptyTrash")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-card border">
              <Trash2 className="h-7 w-7 animate-pulse text-primary" />
            </div>
          </div>
          <p className="mt-6 text-muted-foreground font-medium">{tc("loading")}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border-2 border-dashed">
          <div className="absolute inset-0 opacity-[0.02]">
            <div className="absolute inset-0" style={{
              backgroundImage: `repeating-linear-gradient(45deg, currentColor, currentColor 1px, transparent 1px, transparent 12px)`
            }} />
          </div>
          <div className="relative flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="relative mb-6">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <Trash2 className="h-7 w-7 text-muted-foreground" />
              </div>
            </div>
            <h3 className="font-semibold text-lg mb-2">{t("empty")}</h3>
            <p className="text-muted-foreground max-w-sm">{t("emptyDesc")}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Videos */}
          {groupedItems.video.length > 0 && (
            <Card className="border border-primary/10 bg-gradient-to-br from-primary/5 via-background to-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
                    <Video className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-display">{t("videos")} ({groupedItems.video.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {groupedItems.video.map((item) => (
                    <TrashItemRow
                      key={item.trash_id}
                      item={item}
                      onRestore={handleRestore}
                      onDelete={handlePermanentDelete}
                      isRestoring={restoring === item.trash_id}
                      isDeleting={deleting === item.trash_id}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Manuals */}
          {groupedItems.manual.length > 0 && (
            <Card className="border border-primary/10 bg-gradient-to-br from-primary/5 via-background to-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-display">{t("manuals")} ({groupedItems.manual.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {groupedItems.manual.map((item) => (
                    <TrashItemRow
                      key={item.trash_id}
                      item={item}
                      onRestore={handleRestore}
                      onDelete={handlePermanentDelete}
                      isRestoring={restoring === item.trash_id}
                      isDeleting={deleting === item.trash_id}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Projects */}
          {groupedItems.project.length > 0 && (
            <Card className="border border-primary/10 bg-gradient-to-br from-primary/5 via-background to-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
                    <FolderKanban className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-display">{t("projects")} ({groupedItems.project.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {groupedItems.project.map((item) => (
                    <TrashItemRow
                      key={item.trash_id}
                      item={item}
                      onRestore={handleRestore}
                      onDelete={handlePermanentDelete}
                      isRestoring={restoring === item.trash_id}
                      isDeleting={deleting === item.trash_id}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

interface TrashItemRowProps {
  item: TrashItem;
  onRestore: (item: TrashItem) => void;
  onDelete: (item: TrashItem) => void;
  isRestoring: boolean;
  isDeleting: boolean;
}

function TrashItemRow({
  item,
  onRestore,
  onDelete,
  isRestoring,
  isDeleting,
}: TrashItemRowProps) {
  const t = useTranslations("trash");
  const tc = useTranslations("common");
  const daysLeft = getDaysUntilExpiry(item.expires_at);

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-primary/10 bg-background/50 hover:bg-background transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
          {getItemIcon(item.item_type)}
        </div>
        <div>
          <p className="font-medium">{item.original_name}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t("deleted", { date: formatDate(item.deleted_at) })}</span>
            {item.cascade_deleted && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {t("cascadeDeleted")}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{t("daysLeft", { count: daysLeft })}</span>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRestore(item)}
            disabled={isRestoring || isDeleting}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            {t("restore")}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="destructive"
                disabled={isRestoring || isDeleting}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                {tc("delete")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("permanentDeleteTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("permanentDeleteDesc", { name: item.original_name })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(item)}>
                  {t("deletePermanently")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
