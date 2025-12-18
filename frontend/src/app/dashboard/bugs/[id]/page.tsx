"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Bug,
  ArrowLeft,
  ExternalLink,
  MessageSquare,
  Send,
  Loader2,
  Clock,
  CheckCircle,
  Circle,
  User,
} from "lucide-react";
import { SidebarToggle } from "@/components/layout/SidebarToggle";
import { AlphaBadge } from "@/components/ui/alpha-badge";
import {
  bugsApi,
  type BugDetail,
  getCategoryFromLabels,
  getCategoryName,
  getCategoryColor,
} from "@/lib/api/bugs";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

// Simple markdown-like rendering for issue body
function renderBody(body: string): React.ReactNode {
  if (!body) return null;

  // Split into paragraphs
  const paragraphs = body.split("\n\n");

  return paragraphs.map((paragraph, i) => {
    // Check for headers
    if (paragraph.startsWith("## ")) {
      return (
        <h3 key={i} className="font-semibold text-base mt-4 mb-2">
          {paragraph.substring(3)}
        </h3>
      );
    }
    if (paragraph.startsWith("# ")) {
      return (
        <h2 key={i} className="font-bold text-lg mt-4 mb-2">
          {paragraph.substring(2)}
        </h2>
      );
    }

    // Check for horizontal rule
    if (paragraph.startsWith("---") || paragraph.startsWith("***")) {
      return <Separator key={i} className="my-4" />;
    }

    // Regular paragraph with line breaks preserved
    return (
      <p key={i} className="text-sm text-muted-foreground whitespace-pre-wrap mb-3">
        {paragraph}
      </p>
    );
  });
}

export default function BugDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("bugs");
  const tc = useTranslations("common");

  const issueNumber = Number(params.id);

  const [bug, setBug] = useState<BugDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (issueNumber) {
      loadBug();
    }
  }, [issueNumber]);

  async function loadBug() {
    setLoading(true);
    try {
      const res = await bugsApi.get(issueNumber);
      setBug(res);
    } catch (e) {
      console.error("Failed to load bug:", e);
      const message = e instanceof Error ? e.message : t("loadFailed");
      toast.error(t("loadFailed"), { description: message });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim() || !bug) return;

    setSubmitting(true);
    try {
      await bugsApi.addComment(bug.number, comment.trim());
      toast.success(t("commentAdded"));
      setComment("");
      // Reload to get updated comments
      await loadBug();
    } catch (e) {
      const message = e instanceof Error ? e.message : t("commentFailed");
      toast.error(t("commentFailed"), { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-card border">
            <Bug className="h-7 w-7 animate-pulse text-primary" />
          </div>
        </div>
        <p className="mt-6 text-muted-foreground font-medium">{tc("loading")}</p>
      </div>
    );
  }

  if (!bug) {
    return (
      <div className="text-center py-24">
        <Bug className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="font-semibold text-lg">{t("notFound")}</h2>
        <p className="text-muted-foreground mb-4">{t("notFoundDesc")}</p>
        <Link href="/dashboard/bugs">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("backToList")}
          </Button>
        </Link>
      </div>
    );
  }

  const category = getCategoryFromLabels(bug.labels);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <SidebarToggle className="mt-1 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard/bugs">
              <Button variant="ghost" size="sm" className="gap-1 -ml-2">
                <ArrowLeft className="h-4 w-4" />
                {t("backToList")}
              </Button>
            </Link>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl tracking-tight mb-2 flex items-center gap-2">
                {bug.title}
                <AlphaBadge />
              </h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className={`w-3 h-3 rounded-full ${
                    bug.state === "open" ? "bg-green-500" : "bg-purple-500"
                  }`} />
                  {bug.state === "open" ? t("open") : t("closed")}
                </span>
                <span>#{bug.number}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(bug.created_at)}
                </span>
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {bug.author}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge className={getCategoryColor(category)}>
                {getCategoryName(category)}
              </Badge>
              <a
                href={bug.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-1">
                  <ExternalLink className="h-4 w-4" />
                  GitHub
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Issue Body */}
      <Card className="border border-primary/10 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <CardContent className="p-6">
          {bug.body ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {renderBody(bug.body)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">{t("noDescription")}</p>
          )}
        </CardContent>
      </Card>

      {/* Comments Section */}
      <Card className="border border-primary/10">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            {t("comments")} ({bug.comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {bug.comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("noComments")}
            </p>
          ) : (
            <div className="space-y-4">
              {bug.comments.map((c) => (
                <div key={c.id} className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-2 text-sm">
                    <span className="font-medium">{c.author}</span>
                    <span className="text-muted-foreground">
                      {formatRelativeTime(c.created_at)}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {c.body}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Comment Form */}
          <Separator className="my-4" />
          <form onSubmit={handleSubmitComment} className="space-y-3">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("addCommentPlaceholder")}
              rows={3}
              disabled={submitting}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={!comment.trim() || submitting}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {t("addComment")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
