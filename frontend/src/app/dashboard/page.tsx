"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, FileText, FolderKanban, Upload, Sparkles, Download, Bot, Compass, BookOpen, MessageCircle, ChevronRight, Pencil } from "lucide-react";
import { videos, docs, projects } from "@/lib/api";
import { SidebarToggle } from "@/components/layout/SidebarToggle";
import { AlphaBadge } from "@/components/ui/alpha-badge";
import { VDocsText } from "@/components/ui/vdocs-text";
import { useGuideStore } from "@/stores/guideStore";

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
          docs.list(),
          projects.list(),
        ]);

        setStats({
          videoCount: videosRes.videos.length,
          manualCount: manualsRes.docs.length,
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

  const { open: openGuide } = useGuideStore();

  const journeySteps = [
    { icon: Upload, title: t("gettingStarted.step1Title"), desc: t("gettingStarted.step1Desc") },
    { icon: Sparkles, title: t("gettingStarted.step2Title"), desc: t("gettingStarted.step2Desc") },
    { icon: Pencil, title: t("gettingStarted.step3Title"), desc: t("gettingStarted.step3Desc") },
    { icon: Download, title: t("gettingStarted.step4Title"), desc: t("gettingStarted.step4Desc") },
  ];

  const guideFeatures = [
    { icon: Compass, label: t("guideAgent.features.navigate") },
    { icon: BookOpen, label: t("guideAgent.features.learn") },
    { icon: MessageCircle, label: t("guideAgent.features.help") },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex gap-3">
        <SidebarToggle className="mt-1.5 shrink-0" />
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            {t("title")}
            <AlphaBadge />
          </h1>
          <p className="text-muted-foreground">
            {t.rich("welcome", { vdocs: () => <VDocsText /> })}
          </p>
        </div>
      </div>

      {/* Guide Agent Introduction - TOP */}
      <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
            {/* Bot Icon with Glow */}
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl animate-pulse" />
              <div className="relative flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
                <Bot className="h-10 w-10 text-primary-foreground" />
              </div>
              {/* Online indicator */}
              <div className="absolute -bottom-1 -right-1 flex items-center justify-center">
                <span className="absolute h-4 w-4 rounded-full bg-green-500/40 animate-ping" />
                <span className="relative h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
              </div>
            </div>

            {/* Content */}
            <div className="text-center md:text-left">
              <h3 className="font-display text-xl font-semibold mb-2">
                {t("guideAgent.title")}
              </h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-md">
                {t.rich("guideAgent.description", { vdocs: () => <VDocsText /> })}
              </p>

              {/* Feature pills */}
              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                {guideFeatures.map((feature, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium"
                  >
                    <feature.icon className="h-3.5 w-3.5 text-primary" />
                    <span>{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Button */}
            <Button
              onClick={openGuide}
              size="lg"
              className="shrink-0 gap-2 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 md:ml-72 px-8 py-6 text-base"
            >
              <MessageCircle className="h-5 w-5" />
              {t("guideAgent.cta")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stat Cards - Videos, Manuals, Projects */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Videos Card */}
        <Link href="/dashboard/videos" className="group">
          <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5 cursor-pointer border-0 bg-gradient-to-r from-card to-primary/[0.03]">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 group-hover:border-primary/25 transition-colors">
                    <Video className="h-6 w-6 text-primary" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold tracking-tight">
                      {loading ? "..." : stats.videoCount}
                    </span>
                    <span className="font-medium text-sm text-muted-foreground">{t("stats.videos")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{t("stats.videosDesc")}</p>
                </div>

                {/* Arrow */}
                <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Manuals Card */}
        <Link href="/dashboard/docs" className="group">
          <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5 cursor-pointer border-0 bg-gradient-to-r from-card to-primary/[0.03]">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 group-hover:border-primary/25 transition-colors">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold tracking-tight">
                      {loading ? "..." : stats.manualCount}
                    </span>
                    <span className="font-medium text-sm text-muted-foreground">{t("stats.docs")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{t("stats.docsDesc")}</p>
                </div>

                {/* Arrow */}
                <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Projects Card */}
        <Link href="/dashboard/projects" className="group">
          <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5 cursor-pointer border-0 bg-gradient-to-r from-card to-primary/[0.03]">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 group-hover:border-primary/25 transition-colors">
                    <FolderKanban className="h-6 w-6 text-primary" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold tracking-tight">
                      {loading ? "..." : stats.projectCount}
                    </span>
                    <span className="font-medium text-sm text-muted-foreground">{t("stats.projects")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{t("stats.projectsDesc")}</p>
                </div>

                {/* Arrow */}
                <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Journey Steps - 4 steps */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-xl">{t("gettingStarted.title")}</CardTitle>
          <CardDescription>
            {t("gettingStarted.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 pb-6">
          <div className="flex items-center justify-between">
            {journeySteps.map((step, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className="flex flex-col items-center text-center flex-1">
                  <div className="relative mb-3">
                    <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg scale-110" />
                    <div className="relative flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="absolute -top-1 -right-1 flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                      {i + 1}
                    </div>
                  </div>
                  <p className="font-semibold text-sm">{step.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{step.desc}</p>
                </div>
                {i < journeySteps.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
