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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to Video Manual Platform
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Videos</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : stats.videoCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Available for processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Manuals</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : stats.manualCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Generated manuals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : stats.projectCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Organized collections
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/dashboard/videos">
              <Button variant="outline" className="w-full justify-start">
                <Plus className="mr-2 h-4 w-4" />
                Process a Video
              </Button>
            </Link>
            <Link href="/dashboard/projects">
              <Button variant="outline" className="w-full justify-start">
                <Plus className="mr-2 h-4 w-4" />
                Create a Project
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              How to use the platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Upload or select a video from your videos folder</p>
            <p>2. Process it to generate a step-by-step manual</p>
            <p>3. Organize manuals into projects</p>
            <p>4. Compile projects into unified documents</p>
            <p>5. Export to PDF, Word, or HTML</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
