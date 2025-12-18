"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bug, Search, MessageSquare, ExternalLink, Loader2, Clock, CheckCircle, Circle, ArrowRight } from "lucide-react";
import { SidebarToggle } from "@/components/layout/SidebarToggle";
import { AlphaBadge } from "@/components/ui/alpha-badge";
import {
  bugsApi,
  type BugSummary,
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

export default function BugsPage() {
  const t = useTranslations("bugs");
  const tc = useTranslations("common");

  const [bugs, setBugs] = useState<BugSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"open" | "closed" | "all">("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    loadBugs();
  }, [status, searchQuery]);

  async function loadBugs() {
    setLoading(true);
    try {
      const res = await bugsApi.list(status, searchQuery || undefined);
      setBugs(res.issues);
    } catch (e) {
      console.error("Failed to load bugs:", e);
      const message = e instanceof Error ? e.message : t("loadFailed");
      toast.error(t("loadFailed"), { description: message });
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchQuery(searchInput);
  }

  // Group bugs by status
  const openCount = bugs.filter(b => b.state === "open").length;
  const closedCount = bugs.filter(b => b.state === "closed").length;

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
            <Bug className="w-64 h-64" strokeWidth={0.5} />
          </div>
        </div>

        <div className="relative p-8 lg:p-10">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex items-start gap-4 flex-1">
              <SidebarToggle className="mt-1 shrink-0" />
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
                    <Bug className="h-5 w-5 text-primary" />
                  </div>
                  <h1 className="font-display text-3xl tracking-tight">{t("title")}</h1>
                  <AlphaBadge />
                </div>
                <p className="text-muted-foreground max-w-xl leading-relaxed">
                  {t("description")}
                </p>
                {/* Quick stats */}
                {!loading && (
                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-green-500/10">
                        <Circle className="h-3.5 w-3.5 text-green-500 fill-green-500" />
                      </div>
                      <span className="text-muted-foreground">{openCount} {t("open")}</span>
                    </div>
                    <div className="w-px h-4 bg-border" />
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500/10">
                        <CheckCircle className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                      <span className="text-muted-foreground">{closedCount} {t("closed")}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 lg:self-center">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={t("searchPlaceholder")}
                    className="pl-9 w-[200px]"
                  />
                </div>
              </form>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">{t("open")}</SelectItem>
                  <SelectItem value="closed">{t("closed")}</SelectItem>
                  <SelectItem value="all">{t("all")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-card border">
              <Bug className="h-7 w-7 animate-pulse text-primary" />
            </div>
          </div>
          <p className="mt-6 text-muted-foreground font-medium">{tc("loading")}</p>
        </div>
      ) : bugs.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border-2 border-dashed">
          <div className="absolute inset-0 opacity-[0.02]">
            <div className="absolute inset-0" style={{
              backgroundImage: `repeating-linear-gradient(45deg, currentColor, currentColor 1px, transparent 1px, transparent 12px)`
            }} />
          </div>
          <div className="relative flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="relative mb-6">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <Bug className="h-7 w-7 text-muted-foreground" />
              </div>
            </div>
            <h3 className="font-semibold text-lg mb-2">{t("noIssues")}</h3>
            <p className="text-muted-foreground max-w-sm">{t("noIssuesDesc")}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {bugs.map((bug) => {
            const category = getCategoryFromLabels(bug.labels);
            return (
              <Link key={bug.number} href={`/dashboard/bugs/${bug.number}`}>
                <Card className="group border border-primary/10 bg-gradient-to-br from-primary/5 via-background to-primary/5 hover:border-primary/20 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Status indicator */}
                      <div className={`mt-1 flex h-8 w-8 items-center justify-center rounded-lg ${
                        bug.state === "open"
                          ? "bg-green-500/10 text-green-500"
                          : "bg-purple-500/10 text-purple-500"
                      }`}>
                        {bug.state === "open" ? (
                          <Circle className="h-4 w-4 fill-current" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-medium text-base group-hover:text-primary transition-colors">
                              {bug.title}
                            </h3>
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                              <span>#{bug.number}</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatRelativeTime(bug.created_at)}
                              </span>
                              {bug.comments_count > 0 && (
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  {bug.comments_count}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={getCategoryColor(category)}>
                              {getCategoryName(category)}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* GitHub link */}
      {bugs.length > 0 && (
        <div className="text-center">
          <a
            href={`https://github.com/${process.env.NEXT_PUBLIC_GITHUB_REPO || "stubborncoder/video-manual"}/issues?q=label%3Avdocs%3Auser-report`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            {t("viewOnGitHub")}
          </a>
        </div>
      )}
    </div>
  );
}
