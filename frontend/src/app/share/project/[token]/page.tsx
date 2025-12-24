"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { publicProjectShare, SharedProjectInfo, TocItem } from "@/lib/api";
import {
  Loader2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { VDocsIcon } from "@/components/ui/VDocsIcon";
import { VDocsText } from "@/components/ui/vdocs-text";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";

export default function ProjectSharePage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<SharedProjectInfo | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadSharedProject();
    }
  }, [token]);

  // Set initial TOC state based on screen size
  useEffect(() => {
    const handleResize = () => {
      setTocOpen(window.innerWidth >= 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Track active section on scroll
  useEffect(() => {
    if (!project?.toc?.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    project.toc.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [project?.toc]);

  async function loadSharedProject() {
    setLoading(true);
    setError(null);
    try {
      const data = await publicProjectShare.getProject(token);
      setProject(data);
    } catch (err: unknown) {
      console.error("Failed to load shared project:", err);
      if (err instanceof Error && err.message.includes("404")) {
        setError("not_found");
      } else {
        setError("error");
      }
    } finally {
      setLoading(false);
    }
  }

  const scrollToSection = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
      setMobileTocOpen(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading shared project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {error === "not_found" ? "Project Not Found" : "Error Loading Project"}
            </h1>
            <p className="text-muted-foreground">
              {error === "not_found"
                ? "This share link is invalid or has been revoked by the owner."
                : "There was a problem loading this project. Please try again later."}
            </p>
          </div>
          <Link
            href="/"
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-lg",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "transition-colors"
            )}
          >
            Go to <VDocsText className="text-primary-foreground [&_span]:text-primary-foreground" />
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const hasToc = project.toc && project.toc.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile TOC toggle */}
            {hasToc && (
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileTocOpen(!mobileTocOpen)}
              >
                {mobileTocOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            )}
            <VDocsIcon className="h-8 w-8 text-primary" branded />
            <div>
              <h1 className="font-semibold text-sm truncate max-w-[200px] sm:max-w-xs flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                {project.title}
              </h1>
              <p className="text-xs text-muted-foreground">
                Shared via <VDocsText className="text-xs" />
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/"
              className={cn(
                "text-sm font-medium text-muted-foreground hover:text-foreground",
                "transition-colors flex items-center gap-1"
              )}
            >
              <span className="hidden sm:inline">Powered by</span>
              <VDocsText />
            </Link>
          </div>
        </div>
      </header>

      <div className="container max-w-7xl mx-auto px-4">
        <div className="flex gap-8">
          {/* Desktop TOC Sidebar */}
          {hasToc && (
            <aside
              className={cn(
                "hidden lg:block sticky top-20 self-start shrink-0 transition-all duration-300",
                tocOpen ? "w-64" : "w-10"
              )}
            >
              <div className="border rounded-lg bg-background/50 backdrop-blur overflow-hidden">
                <button
                  onClick={() => setTocOpen(!tocOpen)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium",
                    "hover:bg-muted/50 transition-colors",
                    tocOpen ? "justify-between" : "justify-center"
                  )}
                >
                  {tocOpen && <span>Table of Contents</span>}
                  {tocOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                </button>
                {tocOpen && (
                  <nav className="px-2 pb-3 max-h-[calc(100vh-12rem)] overflow-y-auto">
                    <ul className="space-y-0.5">
                      {project.toc.map((item) => (
                        <li key={item.id}>
                          <button
                            onClick={() => scrollToSection(item.id)}
                            className={cn(
                              "w-full text-left px-2 py-1.5 rounded text-sm transition-colors",
                              "hover:bg-muted",
                              item.level === 1 && "font-medium",
                              item.level === 2 && "pl-4 text-muted-foreground",
                              item.level === 3 && "pl-6 text-xs text-muted-foreground",
                              activeSection === item.id &&
                                "bg-primary/10 text-primary font-medium"
                            )}
                          >
                            {item.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </nav>
                )}
              </div>
            </aside>
          )}

          {/* Mobile TOC Overlay */}
          {hasToc && mobileTocOpen && (
            <div
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur lg:hidden"
              onClick={() => setMobileTocOpen(false)}
            >
              <div
                className="absolute top-14 left-0 right-0 border-b bg-background shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <nav className="p-4 max-h-[60vh] overflow-y-auto">
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                    Table of Contents
                  </h3>
                  <ul className="space-y-1">
                    {project.toc.map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => scrollToSection(item.id)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                            "hover:bg-muted",
                            item.level === 1 && "font-medium",
                            item.level === 2 && "pl-6 text-muted-foreground",
                            item.level === 3 && "pl-9 text-xs text-muted-foreground",
                            activeSection === item.id &&
                              "bg-primary/10 text-primary font-medium"
                          )}
                        >
                          {item.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            </div>
          )}

          {/* Main content */}
          <main className={cn("flex-1 py-8 min-w-0", hasToc && tocOpen && "lg:ml-0")}>
            {/* Project description */}
            {project.description && (
              <div className="mb-8 p-4 rounded-lg border bg-muted/30">
                <p className="text-muted-foreground">{project.description}</p>
              </div>
            )}

            <article
              className={cn(
                "prose prose-neutral dark:prose-invert max-w-none",
                "prose-headings:font-display prose-headings:tracking-tight",
                "prose-h1:text-3xl prose-h1:font-bold prose-h1:mb-4 prose-h1:scroll-mt-20",
                "prose-h2:text-2xl prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-3 prose-h2:scroll-mt-20",
                "prose-h3:text-xl prose-h3:font-medium prose-h3:mt-6 prose-h3:mb-2 prose-h3:scroll-mt-20",
                "prose-p:leading-relaxed prose-p:text-foreground/90",
                "prose-li:my-1",
                "prose-img:rounded-lg prose-img:shadow-md prose-img:border prose-img:my-6",
                "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
                "prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm",
                "prose-pre:bg-muted prose-pre:border prose-pre:shadow-sm",
                "prose-blockquote:border-l-4 prose-blockquote:border-primary/30 prose-blockquote:bg-muted/30 prose-blockquote:py-1",
                "prose-table:border prose-table:border-collapse",
                "prose-th:bg-muted prose-th:p-2 prose-th:border",
                "prose-td:p-2 prose-td:border"
              )}
              dangerouslySetInnerHTML={{ __html: project.content_html }}
            />
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container max-w-4xl mx-auto px-4 py-6 space-y-4">
          {/* Version info */}
          {(project.version || project.updated_at) && (
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              {project.version && (
                <span className="px-2 py-0.5 rounded bg-muted">v{project.version}</span>
              )}
              {project.updated_at && (
                <span>Last updated: {new Date(project.updated_at).toLocaleDateString()}</span>
              )}
            </div>
          )}
          {/* Branding */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>
              This project was shared publicly via{" "}
              <Link href="/" className="hover:underline">
                <VDocsText />
              </Link>
            </p>
            <p>
              Create your own AI-powered documentation at{" "}
              <Link href="/" className="hover:underline">
                <VDocsText />
              </Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
