"use client";

import { useState, useEffect } from "react";
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
  Mail,
  Lock,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VDocsIcon } from "@/components/ui/VDocsIcon";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auth } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useLocale } from "@/components/providers/I18nProvider";
import { Locale } from "@/lib/i18n";
import { useIsMobile } from "@/hooks/useMediaQuery";

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
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInLegacy } = useAuthStore();
  const authenticated = useAuthStore((state) => !!(state.user || state.legacyUserId));
  const supabaseEnabled = isSupabaseConfigured();
  const { locale, setLocale } = useLocale();
  const isMobile = useIsMobile();
  const [mobileWarningOpen, setMobileWarningOpen] = useState(false);

  const toggleLocale = () => {
    const newLocale: Locale = locale === "en" ? "es" : "en";
    setLocale(newLocale);
  };

  // Handle login attempt - block on mobile (show warning every time)
  const handleLoginAttempt = () => {
    if (isMobile) {
      setMobileWarningOpen(true);
    } else {
      setLoginOpen(true);
    }
  };

  const handleMobileWarningDismiss = () => {
    setMobileWarningOpen(false);
  };

  // Handle email/password sign in
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError(tAuth("pleaseEnterEmail"));
      return;
    }
    if (!password) {
      setError(tAuth("pleaseEnterPassword"));
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");

    const { error: authError } = await signInWithEmail(email.trim(), password);

    if (authError) {
      setError(authError.message || tAuth("loginFailed"));
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  // Handle email/password sign up
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError(tAuth("pleaseEnterEmail"));
      return;
    }
    if (!password) {
      setError(tAuth("pleaseEnterPassword"));
      return;
    }
    if (password.length < 6) {
      setError(tAuth("passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(tAuth("passwordsDoNotMatch"));
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");

    const { error: authError } = await signUpWithEmail(email.trim(), password);

    if (authError) {
      setError(authError.message || tAuth("signUpFailed"));
      setLoading(false);
    } else {
      setSuccessMessage(tAuth("checkEmailForConfirmation"));
      setLoading(false);
    }
  };

  // Handle Google OAuth sign in
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    setSuccessMessage("");

    const { error: authError } = await signInWithGoogle();

    if (authError) {
      setError(authError.message || tAuth("loginFailed"));
      setLoading(false);
    }
    // Google OAuth will redirect, so no need to handle success here
  };

  // Handle legacy login (development mode)
  const handleLegacyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) {
      setError(tAuth("pleaseEnterUserId"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      await signInLegacy(userId.trim());
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
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
          <div className="flex h-16 sm:h-[72px] items-center justify-between">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <VDocsIcon className="h-8 w-8 sm:h-12 sm:w-12 text-primary" />
              <span className="font-display text-xl sm:text-3xl tracking-tight">
                v<span className="text-primary">D</span>ocs
              </span>
              <Badge variant="secondary" className="ml-0.5 sm:ml-1 text-[10px] sm:text-xs font-medium">
                Alpha
              </Badge>
            </div>

            <div className="flex items-center gap-2 sm:gap-8">
              <button
                onClick={() => scrollToSection("features")}
                className="hidden md:block text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("nav.features")}
              </button>
              <button
                onClick={() => scrollToSection("how-it-works")}
                className="hidden md:block text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("nav.howItWorks")}
              </button>

              <div className="flex items-center gap-1.5 sm:gap-3">
                {authenticated ? (
                  <Button size="sm" onClick={() => router.push("/dashboard")} className="text-xs sm:text-sm px-2 sm:px-4">
                    {t("nav.goToDashboard")}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLoginAttempt}
                      className="hidden sm:flex"
                    >
                      {t("nav.signIn")}
                    </Button>
                    <Button size="sm" onClick={handleLoginAttempt} className="text-xs sm:text-sm px-2 sm:px-4">
                      {t("nav.getStarted")}
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 text-xs font-semibold"
                  onClick={toggleLocale}
                  title={locale === "en" ? "Cambiar a Español" : "Switch to English"}
                >
                  {locale === "en" ? "EN" : "ES"}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-3.5 w-3.5 sm:h-4 sm:w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-4 lg:py-6">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
          <div className="grid grid-cols-1 items-center gap-6 sm:gap-8 lg:gap-12 lg:grid-cols-[1.2fr_1fr]">
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
              <div className="hidden sm:flex flex-col gap-3 sm:flex-row">
                {authenticated ? (
                  <Button size="default" onClick={() => router.push("/dashboard")}>
                    {t("nav.goToDashboard")}
                  </Button>
                ) : (
                  <Button size="default" onClick={handleLoginAttempt}>
                    {t("hero.cta")}
                  </Button>
                )}
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
            <div className="hero-flow relative aspect-[4/3] sm:aspect-[5/4] lg:aspect-[4/4] overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 shadow-2xl">
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
              <div className="completed-phases absolute top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-3 flex items-center justify-center gap-1 sm:gap-1.5 flex-wrap">
                <div className="completed-step completed-step-1 flex items-center gap-0.5 sm:gap-1 rounded-full bg-white/25 backdrop-blur px-1.5 sm:px-2 py-0.5 sm:py-1 text-white text-[9px] sm:text-[10px] font-medium">
                  <Video className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                  <span className="hidden xs:inline">{t("heroAnimation.completedSteps.upload")}</span>
                  <svg className="h-2 w-2 sm:h-2.5 sm:w-2.5 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="completed-step completed-step-2 flex items-center gap-0.5 sm:gap-1 rounded-full bg-white/25 backdrop-blur px-1.5 sm:px-2 py-0.5 sm:py-1 text-white text-[9px] sm:text-[10px] font-medium">
                  <div className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-green-400 flex items-center justify-center">
                    <svg className="h-1.5 w-1.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="hidden xs:inline">{t("heroAnimation.completedSteps.ai")}</span>
                </div>
                <div className="completed-step completed-step-3 flex items-center gap-0.5 sm:gap-1 rounded-full bg-white/25 backdrop-blur px-1.5 sm:px-2 py-0.5 sm:py-1 text-white text-[9px] sm:text-[10px] font-medium">
                  <FileText className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                  <span className="hidden xs:inline">{t("heroAnimation.completedSteps.generate")}</span>
                  <svg className="h-2 w-2 sm:h-2.5 sm:w-2.5 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="completed-step completed-step-4 flex items-center gap-0.5 sm:gap-1 rounded-full bg-white/25 backdrop-blur px-1.5 sm:px-2 py-0.5 sm:py-1 text-white text-[9px] sm:text-[10px] font-medium">
                  <Edit3 className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                  <span className="hidden xs:inline">{t("heroAnimation.completedSteps.edit")}</span>
                  <svg className="h-2 w-2 sm:h-2.5 sm:w-2.5 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="completed-step completed-step-5 flex items-center gap-0.5 sm:gap-1 rounded-full bg-white/25 backdrop-blur px-1.5 sm:px-2 py-0.5 sm:py-1 text-white text-[9px] sm:text-[10px] font-medium">
                  <FolderKanban className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                  <span className="hidden xs:inline">{t("heroAnimation.completedSteps.compile")}</span>
                  <svg className="h-2 w-2 sm:h-2.5 sm:w-2.5 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="completed-step completed-step-6 flex items-center gap-0.5 sm:gap-1 rounded-full bg-white/25 backdrop-blur px-1.5 sm:px-2 py-0.5 sm:py-1 text-white text-[9px] sm:text-[10px] font-medium">
                  <Download className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                  <span className="hidden xs:inline">{t("heroAnimation.completedSteps.export")}</span>
                  <svg className="h-2 w-2 sm:h-2.5 sm:w-2.5 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              {/* Active phase container (center) */}
              <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">

                {/* Phase 1: Upload → AI Analysis → Generate */}
                <div className="phase phase-1 absolute inset-3 sm:inset-6 pb-4 sm:pb-8 flex flex-col items-center justify-center">
                  <div className="flow-step flow-upload flex items-center gap-2 sm:gap-3 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-md border border-white/30 px-3 py-2 sm:px-5 sm:py-4 text-white mb-2 sm:mb-4">
                    <div className="flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-white/25">
                      <Video className="h-4 w-4 sm:h-6 sm:w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs sm:text-base truncate">{t("heroAnimation.phase1.uploadVideo")}</div>
                      <div className="text-white/70 text-[10px] sm:text-sm truncate">{t("heroAnimation.phase1.uploadFormats")}</div>
                    </div>
                    <svg className="check-icon h-4 w-4 sm:h-6 sm:w-6 text-green-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>

                  <div className="flow-connector w-0.5 h-3 sm:h-6 bg-white/50 mb-2 sm:mb-4" />

                  <div className="flow-step flow-ai flex items-center gap-2 sm:gap-3 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-md border border-white/30 px-3 py-2 sm:px-5 sm:py-4 text-white mb-2 sm:mb-4">
                    <div className="flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-white/25 relative">
                      <div className="ai-spinner h-4 w-4 sm:h-6 sm:w-6 rounded-full border-2 border-white/80 border-t-transparent" />
                      <svg className="ai-complete-icon absolute h-4 w-4 sm:h-6 sm:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs sm:text-base truncate">{t("heroAnimation.phase1.aiAnalysis")}</div>
                      <div className="text-white/70 text-[10px] sm:text-sm truncate">{t("heroAnimation.phase1.processingFrames")}</div>
                    </div>
                    <svg className="check-icon h-4 w-4 sm:h-6 sm:w-6 text-green-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>

                  <div className="flow-connector w-0.5 h-3 sm:h-6 bg-white/50 mb-2 sm:mb-4" />

                  <div className="flow-step flow-generate flex items-center gap-2 sm:gap-3 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-md border border-white/30 px-3 py-2 sm:px-5 sm:py-4 text-white">
                    <div className="flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-white/25">
                      <FileText className="h-4 w-4 sm:h-6 sm:w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs sm:text-base truncate">{t("heroAnimation.phase1.generateManual")}</div>
                      <div className="text-white/70 text-[10px] sm:text-sm truncate">{t("heroAnimation.phase1.creatingDocs")}</div>
                    </div>
                    <svg className="check-icon h-4 w-4 sm:h-6 sm:w-6 text-green-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>

                {/* Phase 2: Edit & Refine */}
                <div className="phase phase-2 absolute inset-2 sm:inset-4 top-8 sm:top-12 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-4">
                    <Edit3 className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
                    <span className="text-white text-sm sm:text-lg font-semibold">{t("heroAnimation.phase2.title")}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:gap-3">
                    <div className="feature-item rounded-lg sm:rounded-xl bg-white/15 backdrop-blur border border-white/20 px-2 py-1.5 sm:px-4 sm:py-3">
                      <div className="flex items-center gap-1.5 sm:gap-3 mb-0.5 sm:mb-1">
                        <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-cyan-500/30">
                          <svg className="h-3 w-3 sm:h-4 sm:w-4 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="text-white font-medium text-xs sm:text-base">{t("heroAnimation.phase2.frameReplace")}</div>
                      </div>
                      <div className="text-white/70 text-[10px] sm:text-xs leading-relaxed pl-7 sm:pl-11 hidden sm:block">{t("heroAnimation.phase2.frameReplaceDesc")}</div>
                    </div>
                    <div className="feature-item rounded-lg sm:rounded-xl bg-white/15 backdrop-blur border border-white/20 px-2 py-1.5 sm:px-4 sm:py-3">
                      <div className="flex items-center gap-1.5 sm:gap-3 mb-0.5 sm:mb-1">
                        <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-yellow-500/30">
                          <svg className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </div>
                        <div className="text-white font-medium text-xs sm:text-base">{t("heroAnimation.phase2.visualAnnotations")}</div>
                      </div>
                      <div className="text-white/70 text-[10px] sm:text-xs leading-relaxed pl-7 sm:pl-11 hidden sm:block">{t("heroAnimation.phase2.visualAnnotationsDesc")}</div>
                    </div>
                    <div className="feature-item rounded-lg sm:rounded-xl bg-white/15 backdrop-blur border border-white/20 px-2 py-1.5 sm:px-4 sm:py-3">
                      <div className="flex items-center gap-1.5 sm:gap-3 mb-0.5 sm:mb-1">
                        <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-green-500/30">
                          <svg className="h-3 w-3 sm:h-4 sm:w-4 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="text-white font-medium text-xs sm:text-base">{t("heroAnimation.phase2.richTextEditor")}</div>
                      </div>
                      <div className="text-white/70 text-[10px] sm:text-xs leading-relaxed pl-7 sm:pl-11 hidden sm:block">{t("heroAnimation.phase2.richTextEditorDesc")}</div>
                    </div>
                    <div className="feature-item rounded-lg sm:rounded-xl bg-white/15 backdrop-blur border border-white/20 px-2 py-1.5 sm:px-4 sm:py-3">
                      <div className="flex items-center gap-1.5 sm:gap-3 mb-0.5 sm:mb-1">
                        <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-blue-500/30">
                          <svg className="h-3 w-3 sm:h-4 sm:w-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <div className="text-white font-medium text-xs sm:text-base">{t("heroAnimation.phase2.aiCopilot")}</div>
                      </div>
                      <div className="text-white/70 text-[10px] sm:text-xs leading-relaxed pl-7 sm:pl-11 hidden sm:block">{t("heroAnimation.phase2.aiCopilotDesc")}</div>
                    </div>
                  </div>
                </div>

                {/* Phase 3: Compilation */}
                <div className="phase phase-3 absolute inset-2 sm:inset-4 top-8 sm:top-12 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-4">
                    <FolderKanban className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
                    <span className="text-white text-sm sm:text-lg font-semibold">{t("heroAnimation.phase3.title")}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:gap-3">
                    <div className="compile-item rounded-lg sm:rounded-xl bg-white/15 backdrop-blur border border-white/20 px-2 py-1.5 sm:px-4 sm:py-3">
                      <div className="flex items-center gap-1.5 sm:gap-3 mb-0.5 sm:mb-1">
                        <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-indigo-500/30">
                          <svg className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                        <div className="text-white font-medium text-xs sm:text-base">{t("heroAnimation.phase3.projectWorkspace")}</div>
                      </div>
                      <div className="text-white/70 text-[10px] sm:text-xs leading-relaxed pl-7 sm:pl-11 hidden sm:block">{t("heroAnimation.phase3.projectWorkspaceDesc")}</div>
                    </div>
                    <div className="compile-item rounded-lg sm:rounded-xl bg-white/15 backdrop-blur border border-white/20 px-2 py-1.5 sm:px-4 sm:py-3">
                      <div className="flex items-center gap-1.5 sm:gap-3 mb-0.5 sm:mb-1">
                        <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-pink-500/30">
                          <svg className="h-3 w-3 sm:h-4 sm:w-4 text-pink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                          </svg>
                        </div>
                        <div className="text-white font-medium text-xs sm:text-base">{t("heroAnimation.phase3.customStructure")}</div>
                      </div>
                      <div className="text-white/70 text-[10px] sm:text-xs leading-relaxed pl-7 sm:pl-11 hidden sm:block">{t("heroAnimation.phase3.customStructureDesc")}</div>
                    </div>
                    <div className="compile-item rounded-lg sm:rounded-xl bg-white/15 backdrop-blur border border-white/20 px-2 py-1.5 sm:px-4 sm:py-3">
                      <div className="flex items-center gap-1.5 sm:gap-3 mb-0.5 sm:mb-1">
                        <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-teal-500/30">
                          <svg className="h-3 w-3 sm:h-4 sm:w-4 text-teal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="text-white font-medium text-xs sm:text-base">{t("heroAnimation.phase3.autoToc")}</div>
                      </div>
                      <div className="text-white/70 text-[10px] sm:text-xs leading-relaxed pl-7 sm:pl-11 hidden sm:block">{t("heroAnimation.phase3.autoTocDesc")}</div>
                    </div>
                    <div className="compile-item rounded-lg sm:rounded-xl bg-white/15 backdrop-blur border border-white/20 px-2 py-1.5 sm:px-4 sm:py-3">
                      <div className="flex items-center gap-1.5 sm:gap-3 mb-0.5 sm:mb-1">
                        <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-orange-500/30">
                          <svg className="h-3 w-3 sm:h-4 sm:w-4 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                          </svg>
                        </div>
                        <div className="text-white font-medium text-xs sm:text-base">{t("heroAnimation.phase3.multilingualExport")}</div>
                      </div>
                      <div className="text-white/70 text-[10px] sm:text-xs leading-relaxed pl-7 sm:pl-11 hidden sm:block">{t("heroAnimation.phase3.multilingualExportDesc")}</div>
                    </div>
                  </div>
                </div>

                {/* Phase 4: Export */}
                <div className="phase phase-4 absolute inset-2 sm:inset-4 top-8 sm:top-12 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-4">
                    <Download className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
                    <span className="text-white text-sm sm:text-lg font-semibold">{t("heroAnimation.phase4.title")}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:gap-3">
                    <div className="export-item rounded-lg sm:rounded-xl bg-red-500/20 backdrop-blur border border-red-400/30 px-2 py-1.5 sm:px-4 sm:py-3">
                      <div className="flex items-center gap-1.5 sm:gap-3 mb-0.5 sm:mb-1">
                        <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-red-500/30">
                          <svg className="h-3 w-3 sm:h-4 sm:w-4 text-red-300" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                          </svg>
                        </div>
                        <div className="text-white font-medium text-xs sm:text-base">{t("heroAnimation.phase4.pdfExport")}</div>
                      </div>
                      <div className="text-white/70 text-[10px] sm:text-xs leading-relaxed pl-7 sm:pl-11 hidden sm:block">{t("heroAnimation.phase4.pdfExportDesc")}</div>
                    </div>
                    <div className="export-item rounded-lg sm:rounded-xl bg-blue-500/20 backdrop-blur border border-blue-400/30 px-2 py-1.5 sm:px-4 sm:py-3">
                      <div className="flex items-center gap-1.5 sm:gap-3 mb-0.5 sm:mb-1">
                        <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-blue-500/30">
                          <svg className="h-3 w-3 sm:h-4 sm:w-4 text-blue-300" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h12V4H6zm2 3h8v2H8V7zm0 4h8v2H8v-2zm0 4h5v2H8v-2z"/>
                          </svg>
                        </div>
                        <div className="text-white font-medium text-xs sm:text-base">{t("heroAnimation.phase4.wordDocument")}</div>
                      </div>
                      <div className="text-white/70 text-[10px] sm:text-xs leading-relaxed pl-7 sm:pl-11 hidden sm:block">{t("heroAnimation.phase4.wordDocumentDesc")}</div>
                    </div>
                    <div className="export-item rounded-lg sm:rounded-xl bg-gray-500/20 backdrop-blur border border-gray-400/30 px-2 py-1.5 sm:px-4 sm:py-3">
                      <div className="flex items-center gap-1.5 sm:gap-3 mb-0.5 sm:mb-1">
                        <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-gray-500/30">
                          <svg className="h-3 w-3 sm:h-4 sm:w-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20.56 18H3.44C2.65 18 2 17.37 2 16.59V7.41C2 6.63 2.65 6 3.44 6H20.56C21.35 6 22 6.63 22 7.41V16.59C22 17.37 21.35 18 20.56 18zM5 15V9H6.5L8.25 11.5L10 9H11.5V15H10V11.5L8.25 14L6.5 11.5V15H5zM13.5 9H17.5V10.5H15V11.5H17.5V15H13.5V13.5H16V12.5H13.5V9Z"/>
                          </svg>
                        </div>
                        <div className="text-white font-medium text-xs sm:text-base">{t("heroAnimation.phase4.markdown")}</div>
                      </div>
                      <div className="text-white/70 text-[10px] sm:text-xs leading-relaxed pl-7 sm:pl-11 hidden sm:block">{t("heroAnimation.phase4.markdownDesc")}</div>
                    </div>
                    <div className="export-item rounded-lg sm:rounded-xl bg-purple-500/20 backdrop-blur border border-purple-400/30 px-2 py-1.5 sm:px-4 sm:py-3">
                      <div className="flex items-center gap-1.5 sm:gap-3 mb-0.5 sm:mb-1">
                        <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-purple-500/30">
                          <svg className="h-3 w-3 sm:h-4 sm:w-4 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                        <div className="text-white font-medium text-xs sm:text-base">{t("heroAnimation.phase4.semanticChunks")}</div>
                      </div>
                      <div className="text-white/70 text-[10px] sm:text-xs leading-relaxed pl-7 sm:pl-11 hidden sm:block">{t("heroAnimation.phase4.semanticChunksDesc")}</div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Rerun button */}
              <button
                className="rerun-btn absolute bottom-2 sm:bottom-3 right-2 sm:right-3 flex items-center justify-center rounded-full bg-white/20 backdrop-blur border border-white/30 w-7 h-7 sm:w-8 sm:h-8 text-white hover:bg-white/30 transition-colors"
                onClick={(e) => {
                  const heroFlow = e.currentTarget.closest('.hero-flow');
                  if (heroFlow) {
                    heroFlow.classList.remove('hero-flow');
                    void (heroFlow as HTMLElement).offsetWidth; // Force reflow
                    heroFlow.classList.add('hero-flow');
                  }
                }}
              >
                <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile-only CTA buttons below hero */}
          <div className="flex sm:hidden flex-col gap-3 mt-6">
            {authenticated ? (
              <Button size="default" onClick={() => router.push("/dashboard")} className="w-full">
                {t("nav.goToDashboard")}
              </Button>
            ) : (
              <Button size="default" onClick={handleLoginAttempt} className="w-full">
                {t("hero.cta")}
              </Button>
            )}
            <Button
              variant="outline"
              size="default"
              onClick={() => scrollToSection("how-it-works")}
              className="w-full"
            >
              {t("hero.ctaSecondary")}
            </Button>
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
                {authenticated ? (
                  <Button
                    size="lg"
                    variant="secondary"
                    className="bg-white text-primary hover:bg-white/90"
                    onClick={() => router.push("/dashboard")}
                  >
                    {t("nav.goToDashboard")}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    variant="secondary"
                    className="bg-white text-primary hover:bg-white/90"
                    onClick={handleLoginAttempt}
                  >
                    {t("cta.button")}
                  </Button>
                )}
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
      <Dialog open={loginOpen} onOpenChange={(open) => {
        setLoginOpen(open);
        if (!open) {
          setError("");
          setSuccessMessage("");
          setEmail("");
          setPassword("");
          setConfirmPassword("");
          setUserId("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {authTab === "signin" ? tAuth("welcomeBack") : tAuth("createAccount")}
            </DialogTitle>
            <DialogDescription>
              {supabaseEnabled
                ? (authTab === "signin" ? tAuth("emailPlaceholder") : tAuth("createAccount"))
                : tAuth("userIdPlaceholder")}
            </DialogDescription>
          </DialogHeader>

          {supabaseEnabled ? (
            <Tabs value={authTab} onValueChange={(v) => {
              setAuthTab(v as "signin" | "signup");
              setError("");
              setSuccessMessage("");
            }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">{tAuth("signIn")}</TabsTrigger>
                <TabsTrigger value="signup">{tAuth("signUp")}</TabsTrigger>
              </TabsList>

              {/* Sign In Tab */}
              <TabsContent value="signin">
                <form onSubmit={handleEmailSignIn}>
                  <div className="space-y-4 py-4">
                    {/* Google OAuth Button */}
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      {tAuth("continueWithGoogle")}
                    </Button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          {tAuth("orContinueWith")}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">{tAuth("email")}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder={tAuth("emailPlaceholder")}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={loading}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">{tAuth("password")}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="password"
                          type="password"
                          placeholder={tAuth("passwordPlaceholder")}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={loading}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                    {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? tAuth("signingIn") : tAuth("signIn")}
                    </Button>
                  </DialogFooter>
                </form>
              </TabsContent>

              {/* Sign Up Tab */}
              <TabsContent value="signup">
                <form onSubmit={handleEmailSignUp}>
                  <div className="space-y-4 py-4">
                    {/* Google OAuth Button */}
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      {tAuth("continueWithGoogle")}
                    </Button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          {tAuth("orContinueWith")}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email">{tAuth("email")}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder={tAuth("emailPlaceholder")}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={loading}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password">{tAuth("password")}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder={tAuth("passwordPlaceholder")}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={loading}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">{tAuth("confirmPassword")}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="confirm-password"
                          type="password"
                          placeholder={tAuth("confirmPasswordPlaceholder")}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          disabled={loading}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                    {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? tAuth("signingUp") : tAuth("signUp")}
                    </Button>
                  </DialogFooter>
                </form>
              </TabsContent>
            </Tabs>
          ) : (
            /* Legacy Login (Development Mode) */
            <form onSubmit={handleLegacyLogin}>
              <div className="space-y-4 py-4">
                <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  <User className="mr-2 inline-block h-4 w-4" />
                  {tAuth("devModeLogin")}
                </div>
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
          )}
        </DialogContent>
      </Dialog>

      {/* Mobile Warning Dialog */}
      <Dialog open={mobileWarningOpen} onOpenChange={setMobileWarningOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {t("mobileWarning.title")}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {t("mobileWarning.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleMobileWarningDismiss} className="w-full">
              {t("mobileWarning.understood")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
