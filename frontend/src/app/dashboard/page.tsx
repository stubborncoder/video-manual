"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, FileText, FolderKanban, Plus } from "lucide-react";
import { videos, manuals, projects } from "@/lib/api";
import { SidebarToggle } from "@/components/layout/SidebarToggle";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const [stats, setStats] = useState({
    videoCount: 0,
    manualCount: 0,
    projectCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [videosRes, manualsRes, projectsRes] = await Promise.all([
          videos.list(),
          manuals.list(),
          projects.list(),
        ]);

        setStats({
          videoCount: videosRes.videos.length,
          manualCount: manualsRes.manuals.length,
          projectCount: projectsRes.projects.length,
        });
      } catch (e) {
        console.error("Failed to load stats:", e);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  const gettingStartedSteps = [
    t("gettingStarted.step1"),
    t("gettingStarted.step2"),
    t("gettingStarted.step3"),
    t("gettingStarted.step4"),
    t("gettingStarted.step5"),
  ];

  return (
    <div className="space-y-8">
      <div className="flex gap-3">
        <SidebarToggle className="mt-1.5 shrink-0" />
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("welcome")}
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Link href="/dashboard/videos">
          <Card className="group transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t("stats.videos")}</p>
                  <p className="font-display text-4xl tracking-tight">
                    {loading ? "..." : stats.videoCount}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("stats.videosDesc")}
                  </p>
                </div>
                <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Video className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/manuals">
          <Card className="group transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t("stats.manuals")}</p>
                  <p className="font-display text-4xl tracking-tight">
                    {loading ? "..." : stats.manualCount}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("stats.manualsDesc")}
                  </p>
                </div>
                <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <FileText className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/projects">
          <Card className="group transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t("stats.projects")}</p>
                  <p className="font-display text-4xl tracking-tight">
                    {loading ? "..." : stats.projectCount}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("stats.projectsDesc")}
                  </p>
                </div>
                <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <FolderKanban className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Actions & Getting Started */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">{t("quickActions.title")}</CardTitle>
            <CardDescription>
              {t("quickActions.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/dashboard/videos" className="block">
              <div className="group flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent hover:border-primary/30 transition-all">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Video className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{t("quickActions.processVideo")}</p>
                  <p className="text-sm text-muted-foreground">{t("quickActions.processVideoDesc")}</p>
                </div>
                <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
            <Link href="/dashboard/projects" className="block">
              <div className="group flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent hover:border-primary/30 transition-all">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <FolderKanban className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{t("quickActions.createProject")}</p>
                  <p className="text-sm text-muted-foreground">{t("quickActions.createProjectDesc")}</p>
                </div>
                <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">{t("gettingStarted.title")}</CardTitle>
            <CardDescription>
              {t("gettingStarted.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {gettingStartedSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm text-muted-foreground pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
