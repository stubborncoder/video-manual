"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import {
  Video,
  FileText,
  Edit3,
  FolderKanban,
  Download,
  Globe,
  Sun,
  Moon,
  FileVideo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { auth } from "@/lib/api";

// Feature icons mapping
const featureIcons = {
  ai: Video,
  screenshots: FileText,
  export: Edit3,
  projects: FolderKanban,
  templates: Download,
  multilingual: Globe,
};

export default function LandingPage() {
  const t = useTranslations("landing");
  const tAuth = useTranslations("auth");
  const tc = useTranslations("common");
  const [loginOpen, setLoginOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) {
      setError(tAuth("pleaseEnterUserId"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      await auth.login(userId.trim());
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : tAuth("loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="flex h-[72px] items-center justify-between">
            <div className="flex items-center gap-2">
              <FileVideo className="h-12 w-12 text-primary" strokeWidth={2.5} />
              <span className="font-display text-3xl tracking-tight">
                v<span className="text-primary">D</span>ocs
              </span>
            </div>

            <div className="flex items-center gap-8">
              <button
                onClick={() => scrollToSection("features")}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("nav.features")}
              </button>
              <button
                onClick={() => scrollToSection("how-it-works")}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("nav.howItWorks")}
              </button>

              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLoginOpen(true)}
                >
                  {t("nav.signIn")}
                </Button>
                <Button size="sm" onClick={() => setLoginOpen(true)}>
                  {t("nav.getStarted")}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-4 lg:py-6">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="grid grid-cols-1 items-center gap-8 lg:gap-12 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <span className="mb-3 inline-block rounded bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-primary-foreground">
                {t("hero.badge")}
              </span>
              <h1 className="mb-3 font-display text-3xl leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                {t("hero.title")}
                <span className="block text-primary">{t("hero.titleHighlight")}</span>
              </h1>
              <p className="mb-5 max-w-[540px] text-base leading-relaxed text-muted-foreground lg:text-lg">
                {t("hero.description")}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="default" onClick={() => setLoginOpen(true)}>
                  {t("hero.cta")}
                </Button>
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => scrollToSection("how-it-works")}
                >
                  {t("hero.ctaSecondary")}
                </Button>
              </div>
            </div>

            {/* Hero Visual - Animated Flow Diagram */}
            <div className="hero-flow relative aspect-[5/4] lg:aspect-[4/4] overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 shadow-2xl">
              {/* Dark overlay for dark mode */}
              <div className="absolute inset-0 bg-black/40 hidden dark:block" />
              {/* Pattern background */}
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }}
              />

              {/* Completed phases bar (top) */}
              <div className="completed-phases absolute top-3 left-3 right-3 flex items-center justify-center gap-1.5 flex-wrap">
                <div className="completed-step completed-step-1 flex items-center gap-1 rounded-full bg-white/25 backdrop-blur px-2 py-1 text-white text-[10px] font-medium">
                  <Video className="h-2.5 w-2.5" />
                  <span>{t("heroAnimation.completedSteps.upload")}</span>
                  <svg className="h-2.5 w-2.5 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="completed-step completed-step-2 flex items-center gap-1 rounded-full bg-white/25 backdrop-blur px-2 py-1 text-white text-[10px] font-medium">
                  <div className="h-2.5 w-2.5 rounded-full bg-green-400 flex items-center justify-center">
                    <svg className="h-1.5 w-1.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>{t("heroAnimation.completedSteps.ai")}</span>
                </div>
                <div className="completed-step completed-step-3 flex items-center gap-1 rounded-full bg-white/25 backdrop-blur px-2 py-1 text-white text-[10px] font-medium">
                  <FileText className="h-2.5 w-2.5" />
                  <span>{t("heroAnimation.completedSteps.generate")}</span>
                  <svg className="h-2.5 w-2.5 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="completed-step completed-step-4 flex items-center gap-1 rounded-full bg-white/25 backdrop-blur px-2 py-1 text-white text-[10px] font-medium">
                  <Edit3 className="h-2.5 w-2.5" />
                  <span>{t("heroAnimation.completedSteps.edit")}</span>
                  <svg className="h-2.5 w-2.5 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="completed-step completed-step-5 flex items-center gap-1 rounded-full bg-white/25 backdrop-blur px-2 py-1 text-white text-[10px] font-medium">
                  <FolderKanban className="h-2.5 w-2.5" />
                  <span>{t("heroAnimation.completedSteps.compile")}</span>
                  <svg className="h-2.5 w-2.5 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="completed-step completed-step-6 flex items-center gap-1 rounded-full bg-white/25 backdrop-blur px-2 py-1 text-white text-[10px] font-medium">
                  <Download className="h-2.5 w-2.5" />
                  <span>{t("heroAnimation.completedSteps.export")}</span>
                  <svg className="h-2.5 w-2.5 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              {/* Active phase container (center) */}
              <div className="absolute inset-0 flex items-center justify-center p-6">

                {/* Phase 1: Upload → AI Analysis → Generate */}
                <div className="phase phase-1 absolute inset-6 pb-8 flex flex-col items-center justify-center">
                  <div className="flow-step flow-upload flex items-center gap-3 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 px-5 py-4 text-white mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/25">
                      <Video className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-semibold">{t("heroAnimation.phase1.uploadVideo")}</div>
                      <div className="text-white/70 text-sm">{t("heroAnimation.phase1.uploadFormats")}</div>
                    </div>
                    <svg className="check-icon h-6 w-6 text-green-300 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>

                  <div className="flow-connector w-0.5 h-6 bg-white/50 mb-4" />

                  <div className="flow-step flow-ai flex items-center gap-3 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 px-5 py-4 text-white mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/25 relative">
                      <div className="ai-spinner h-6 w-6 rounded-full border-2 border-white/80 border-t-transparent" />
                      <svg className="ai-complete-icon absolute h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold">{t("heroAnimation.phase1.aiAnalysis")}</div>
                      <div className="text-white/70 text-sm">{t("heroAnimation.phase1.processingFrames")}</div>
                    </div>
                    <svg className="check-icon h-6 w-6 text-green-300 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>

                  <div className="flow-connector w-0.5 h-6 bg-white/50 mb-4" />

                  <div className="flow-step flow-generate flex items-center gap-3 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 px-5 py-4 text-white">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/25">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-semibold">{t("heroAnimation.phase1.generateManual")}</div>
                      <div className="text-white/70 text-sm">{t("heroAnimation.phase1.creatingDocs")}</div>
                    </div>
                    <svg className="check-icon h-6 w-6 text-green-300 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>

                {/* Phase 2: Edit & Refine */}
                <div className="phase phase-2 absolute inset-4 top-9 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-4">
                    <Edit3 className="h-6 w-6 text-white" />
                    <span className="text-white text-lg font-semibold">{t("heroAnimation.phase2.title")}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="feature-item rounded-xl bg-white/15 backdrop-blur border border-white/20 px-4 py-3">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/30">
                          <svg className="h-4 w-4 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="text-white font-medium">{t("heroAnimation.phase2.frameReplace")}</div>
                      </div>
                      <div className="text-white/70 text-xs leading-relaxed pl-11">{t("heroAnimation.phase2.frameReplaceDesc")}</div>
                    </div>
                    <div className="feature-item rounded-xl bg-white/15 backdrop-blur border border-white/20 px-4 py-3">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/30">
                          <svg className="h-4 w-4 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </div>
                        <div className="text-white font-medium">{t("heroAnimation.phase2.visualAnnotations")}</div>
                      </div>
                      <div className="text-white/70 text-xs leading-relaxed pl-11">{t("heroAnimation.phase2.visualAnnotationsDesc")}</div>
                    </div>
                    <div className="feature-item rounded-xl bg-white/15 backdrop-blur border border-white/20 px-4 py-3">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/30">
                          <svg className="h-4 w-4 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="text-white font-medium">{t("heroAnimation.phase2.richTextEditor")}</div>
                      </div>
                      <div className="text-white/70 text-xs leading-relaxed pl-11">{t("heroAnimation.phase2.richTextEditorDesc")}</div>
                    </div>
                    <div className="feature-item rounded-xl bg-white/15 backdrop-blur border border-white/20 px-4 py-3">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/30">
                          <svg className="h-4 w-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <div className="text-white font-medium">{t("heroAnimation.phase2.aiCopilot")}</div>
                      </div>
                      <div className="text-white/70 text-xs leading-relaxed pl-11">{t("heroAnimation.phase2.aiCopilotDesc")}</div>
                    </div>
                  </div>
                </div>

                {/* Phase 3: Compilation */}
                <div className="phase phase-3 absolute inset-4 top-9 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-4">
                    <FolderKanban className="h-6 w-6 text-white" />
                    <span className="text-white text-lg font-semibold">{t("heroAnimation.phase3.title")}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="compile-item rounded-xl bg-white/15 backdrop-blur border border-white/20 px-4 py-3">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/30">
                          <svg className="h-4 w-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                        <div className="text-white font-medium">{t("heroAnimation.phase3.projectWorkspace")}</div>
                      </div>
                      <div className="text-white/70 text-xs leading-relaxed pl-11">{t("heroAnimation.phase3.projectWorkspaceDesc")}</div>
                    </div>
                    <div className="compile-item rounded-xl bg-white/15 backdrop-blur border border-white/20 px-4 py-3">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/30">
                          <svg className="h-4 w-4 text-pink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                          </svg>
                        </div>
                        <div className="text-white font-medium">{t("heroAnimation.phase3.customStructure")}</div>
                      </div>
                      <div className="text-white/70 text-xs leading-relaxed pl-11">{t("heroAnimation.phase3.customStructureDesc")}</div>
                    </div>
                    <div className="compile-item rounded-xl bg-white/15 backdrop-blur border border-white/20 px-4 py-3">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/30">
                          <svg className="h-4 w-4 text-teal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="text-white font-medium">{t("heroAnimation.phase3.autoToc")}</div>
                      </div>
                      <div className="text-white/70 text-xs leading-relaxed pl-11">{t("heroAnimation.phase3.autoTocDesc")}</div>
                    </div>
                    <div className="compile-item rounded-xl bg-white/15 backdrop-blur border border-white/20 px-4 py-3">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/30">
                          <svg className="h-4 w-4 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                          </svg>
                        </div>
                        <div className="text-white font-medium">{t("heroAnimation.phase3.multilingualExport")}</div>
                      </div>
                      <div className="text-white/70 text-xs leading-relaxed pl-11">{t("heroAnimation.phase3.multilingualExportDesc")}</div>
                    </div>
                  </div>
                </div>

                {/* Phase 4: Export */}
                <div className="phase phase-4 absolute inset-4 top-9 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-4">
                    <Download className="h-6 w-6 text-white" />
                    <span className="text-white text-lg font-semibold">{t("heroAnimation.phase4.title")}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="export-item rounded-xl bg-red-500/20 backdrop-blur border border-red-400/30 px-4 py-3">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/30">
                          <svg className="h-4 w-4 text-red-300" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                          </svg>
                        </div>
                        <div className="text-white font-medium">{t("heroAnimation.phase4.pdfExport")}</div>
                      </div>
                      <div className="text-white/70 text-xs leading-relaxed pl-11">{t("heroAnimation.phase4.pdfExportDesc")}</div>
                    </div>
                    <div className="export-item rounded-xl bg-blue-500/20 backdrop-blur border border-blue-400/30 px-4 py-3">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/30">
                          <svg className="h-4 w-4 text-blue-300" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h12V4H6zm2 3h8v2H8V7zm0 4h8v2H8v-2zm0 4h5v2H8v-2z"/>
                          </svg>
                        </div>
                        <div className="text-white font-medium">{t("heroAnimation.phase4.wordDocument")}</div>
                      </div>
                      <div className="text-white/70 text-xs leading-relaxed pl-11">{t("heroAnimation.phase4.wordDocumentDesc")}</div>
                    </div>
                    <div className="export-item rounded-xl bg-gray-500/20 backdrop-blur border border-gray-400/30 px-4 py-3">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-500/30">
                          <svg className="h-4 w-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20.56 18H3.44C2.65 18 2 17.37 2 16.59V7.41C2 6.63 2.65 6 3.44 6H20.56C21.35 6 22 6.63 22 7.41V16.59C22 17.37 21.35 18 20.56 18zM5 15V9H6.5L8.25 11.5L10 9H11.5V15H10V11.5L8.25 14L6.5 11.5V15H5zM13.5 9H17.5V10.5H15V11.5H17.5V15H13.5V13.5H16V12.5H13.5V9Z"/>
                          </svg>
                        </div>
                        <div className="text-white font-medium">{t("heroAnimation.phase4.markdown")}</div>
                      </div>
                      <div className="text-white/70 text-xs leading-relaxed pl-11">{t("heroAnimation.phase4.markdownDesc")}</div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Rerun button */}
              <button
                className="rerun-btn absolute bottom-3 right-3 flex items-center justify-center rounded-full bg-white/20 backdrop-blur border border-white/30 w-8 h-8 text-white hover:bg-white/30 transition-colors"
                onClick={(e) => {
                  const heroFlow = e.currentTarget.closest('.hero-flow');
                  if (heroFlow) {
                    heroFlow.classList.remove('hero-flow');
                    void (heroFlow as HTMLElement).offsetWidth; // Force reflow
                    heroFlow.classList.add('hero-flow');
                  }
                }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-primary py-8 text-primary-foreground">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { value: "10K+", labelKey: "stats.manuals" },
              { value: "95%", labelKey: "stats.hours" },
              { value: "500+", labelKey: "stats.users" },
              { value: "4.9/5", labelKey: "stats.videos" },
            ].map((stat) => (
              <div key={stat.labelKey} className="text-center">
                <div className="mb-2 font-display text-4xl">{stat.value}</div>
                <div className="text-sm font-medium uppercase tracking-wide opacity-90">
                  {t(stat.labelKey)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="relative py-32"
        style={{
          background: `
            linear-gradient(135deg, rgba(67, 97, 238, 0.08) 0%, rgba(67, 97, 238, 0.03) 50%, rgba(67, 97, 238, 0.08) 100%),
            radial-gradient(circle at 20% 30%, rgba(67, 97, 238, 0.12) 0%, transparent 40%),
            radial-gradient(circle at 80% 70%, rgba(67, 97, 238, 0.10) 0%, transparent 40%)
          `
        }}
      >
        {/* Dot pattern overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(67, 97, 238, 0.25) 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />

        <div className="relative mx-auto max-w-[1100px] px-6">
          <div className="mb-20 text-center">
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-primary">
              {t("nav.features")}
            </p>
            <h2 className="mb-6 font-display text-4xl leading-tight lg:text-5xl">
              {t("features.title")} <span className="text-primary">{t("features.titleHighlight")}</span>
            </h2>
            <p className="mx-auto max-w-[600px] text-lg text-muted-foreground">
              {t("features.subtitle")}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {(["ai", "screenshots", "export", "projects", "templates", "multilingual"] as const).map((key) => {
              const Icon = featureIcons[key];
              return (
                <div
                  key={key}
                  className="group relative overflow-hidden rounded-lg border border-border bg-card p-8 transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-lg"
                >
                  <div className="absolute left-0 right-0 top-0 h-1 origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100" />
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-lg border border-primary bg-primary/10">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="mb-4 font-display text-xl font-semibold">{t(`features.${key}.title`)}</h3>
                  <p className="leading-relaxed text-muted-foreground">
                    {t(`features.${key}.description`)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-muted/50 py-32">
        <div className="mx-auto max-w-[1100px] px-6">
          <div className="mb-20 text-center">
            <h2 className="font-display text-4xl leading-tight lg:text-5xl">
              {t("steps.title")}
            </h2>
          </div>

          <div className="grid gap-12 md:grid-cols-2">
            {(["step1", "step2", "step3", "step4"] as const).map((stepKey, index) => (
              <div
                key={stepKey}
                className="rounded-lg border border-border bg-background p-10 transition-all duration-300 hover:border-primary hover:shadow-lg"
              >
                <div className="mb-4 font-display text-4xl text-primary/80">
                  {t(`steps.${stepKey}.badge`)}
                </div>
                <h3 className="mb-4 font-display text-2xl font-semibold">{t(`steps.${stepKey}.title`)}</h3>
                <p className="mb-6 leading-relaxed text-muted-foreground">
                  {t(`steps.${stepKey}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="relative overflow-hidden rounded-lg bg-primary p-12 text-center text-primary-foreground md:p-24">
            {/* Decorative circles */}
            <div className="absolute -right-[10%] -top-1/2 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.1)_0%,transparent_70%)]" />
            <div className="absolute -bottom-[30%] -left-[5%] h-[250px] w-[250px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.08)_0%,transparent_70%)]" />

            <div className="relative z-10 mx-auto max-w-[700px]">
              <h2 className="mb-6 font-display text-3xl leading-tight md:text-4xl">
                {t("cta.title")}
              </h2>
              <p className="mb-10 text-lg leading-relaxed opacity-95">
                {t("cta.description")}
              </p>
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Button
                  size="lg"
                  variant="secondary"
                  className="bg-white text-primary hover:bg-white/90"
                  onClick={() => setLoginOpen(true)}
                >
                  {t("cta.button")}
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="border-2 border-white/50 bg-white/10 text-white hover:bg-white/20"
                  onClick={() => scrollToSection("how-it-works")}
                >
                  {t("hero.ctaSecondary")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/50 py-20">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="mb-16 grid gap-16 md:grid-cols-2 lg:grid-cols-4">
            <div className="max-w-[350px]">
              <div className="mb-4 font-display text-xl">vDocs</div>
              <p className="leading-relaxed text-muted-foreground">
                {t("hero.badge")}
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-wider">
                {t("footer.product")}
              </h4>
              <ul className="space-y-3">
                <li>
                  <a
                    href="#features"
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("footer.features")}
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("footer.pricing")}
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("footer.changelog")}
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-wider">
                {t("footer.company")}
              </h4>
              <ul className="space-y-3">
                <li>
                  <a
                    href="#"
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("footer.about")}
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("footer.blog")}
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("footer.careers")}
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-wider">
                {t("footer.legal")}
              </h4>
              <ul className="space-y-3">
                <li>
                  <a
                    href="#"
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("footer.privacy")}
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("footer.terms")}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-8">
            <p className="text-sm text-muted-foreground">
              © 2025 vDocs. {t("footer.copyright")}
            </p>
          </div>
        </div>
      </footer>

      {/* Login Dialog */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {tAuth("welcomeBack")}
            </DialogTitle>
            <DialogDescription>
              {tAuth("userIdPlaceholder")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLogin}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="userId">{tAuth("userId")}</Label>
                <Input
                  id="userId"
                  placeholder={tAuth("userIdPlaceholder")}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLoginOpen(false)}
              >
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? tAuth("signingIn") : tAuth("signIn")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
