"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, FileText, FolderKanban, Plus } from "lucide-react";
import { videos, manuals, projects } from "@/lib/api";

export default function DashboardPage() {
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome to Video Manual Platform
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Link href="/dashboard/videos">
          <Card className="group transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Videos</p>
                  <p className="font-display text-4xl tracking-tight">
                    {loading ? "..." : stats.videoCount}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Available for processing
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
                  <p className="text-sm font-medium text-muted-foreground mb-1">Manuals</p>
                  <p className="font-display text-4xl tracking-tight">
                    {loading ? "..." : stats.manualCount}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Generated manuals
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
                  <p className="text-sm font-medium text-muted-foreground mb-1">Projects</p>
                  <p className="font-display text-4xl tracking-tight">
                    {loading ? "..." : stats.projectCount}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Organized collections
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
            <CardTitle className="font-display text-xl">Quick Actions</CardTitle>
            <CardDescription>
              Common tasks to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/dashboard/videos" className="block">
              <div className="group flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent hover:border-primary/30 transition-all">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Video className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Process a Video</p>
                  <p className="text-sm text-muted-foreground">Generate a manual from video</p>
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
                  <p className="font-medium">Create a Project</p>
                  <p className="text-sm text-muted-foreground">Organize manuals together</p>
                </div>
                <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Getting Started</CardTitle>
            <CardDescription>
              How to use the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {[
                "Upload or select a video from your videos folder",
                "Process it to generate a step-by-step manual",
                "Organize manuals into projects",
                "Compile projects into unified documents",
                "Export to PDF, Word, or HTML",
              ].map((step, i) => (
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
