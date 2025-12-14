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

        {stats && stats.total > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
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
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          {tc("loading")}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Trash2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t("empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Videos */}
          {groupedItems.video.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  {t("videos")} ({groupedItems.video.length})
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t("manuals")} ({groupedItems.manual.length})
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderKanban className="h-5 w-5" />
                  {t("projects")} ({groupedItems.project.length})
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
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-muted">
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
