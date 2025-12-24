"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLocale } from "@/components/providers/I18nProvider";
import { adminApi, UserStats, UserTier } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlphaBadge } from "@/components/ui/alpha-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Copy,
  Check,
  Shield,
  FlaskConical,
  Video,
  FileText,
  FolderOpen,
  Layout,
  Trash2,
  Zap,
  Activity,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("admin");
  const { locale } = useLocale();
  const userId = params.id as string;

  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadUserStats = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getUserStats(userId);
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToLoadUser"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserStats();
  }, [userId]);

  const copyUserId = () => {
    navigator.clipboard.writeText(userId);
    setCopied(true);
    toast.success(t("copiedToClipboard"));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRoleChange = async (newRole: "user" | "admin") => {
    if (!stats) return;
    const previousRole = stats.role;
    setStats({ ...stats, role: newRole });

    try {
      await adminApi.setUserRole(userId, newRole);
      toast.success(t("roleUpdated"));
    } catch {
      setStats({ ...stats, role: previousRole });
      toast.error(t("failedToChangeRole"));
    }
  };

  const handleTierChange = async (newTier: UserTier) => {
    if (!stats) return;
    const previousTier = stats.tier;
    setStats({ ...stats, tier: newTier });

    try {
      await adminApi.setUserTier(userId, newTier);
      toast.success(t("tierUpdated"));
    } catch {
      setStats({ ...stats, tier: previousTier });
      toast.error(t("failedToChangeTier"));
    }
  };

  const handleTesterChange = async (isTester: boolean) => {
    if (!stats) return;
    const previousTester = stats.tester;
    setStats({ ...stats, tester: isTester });

    try {
      await adminApi.setUserTester(userId, isTester);
      toast.success(t("testerUpdated"));
    } catch {
      setStats({ ...stats, tester: previousTester });
      toast.error(t("failedToChangeTester"));
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatCost = (cost: number) => {
    if (cost >= 1) return `$${cost.toFixed(2)}`;
    if (cost >= 0.01) return `$${cost.toFixed(3)}`;
    return `$${cost.toFixed(4)}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const getTierConfig = (tier: string) => {
    switch (tier) {
      case "enterprise":
        return {
          bg: "from-violet-500/20 to-purple-500/20",
          border: "border-violet-500/30",
          text: "text-violet-400",
          label: "Enterprise",
        };
      case "pro":
        return {
          bg: "from-blue-500/20 to-cyan-500/20",
          border: "border-blue-500/30",
          text: "text-blue-400",
          label: "Pro",
        };
      case "basic":
        return {
          bg: "from-emerald-500/20 to-teal-500/20",
          border: "border-emerald-500/30",
          text: "text-emerald-400",
          label: "Basic",
        };
      default:
        return {
          bg: "from-zinc-500/20 to-slate-500/20",
          border: "border-zinc-500/30",
          text: "text-zinc-400",
          label: "Free",
        };
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
          <p className="text-sm text-muted-foreground font-medium tracking-wide">
            {t("loadingUser")}
          </p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="text-2xl">!</span>
          </div>
          <p className="text-destructive font-medium">{error || t("userNotFound")}</p>
          <Button variant="outline" onClick={() => router.push("/admin/users")}>
            {t("backToUsers")}
          </Button>
        </div>
      </div>
    );
  }

  const tierConfig = getTierConfig(stats.tier);

  return (
    <TooltipProvider>
      <div className="space-y-8 pb-12">
        {/* Navigation */}
        <button
          onClick={() => router.push("/admin/users")}
          className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          <span>{t("backToUsers")}</span>
        </button>

        {/* Hero Section - User Identity */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-muted/30">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/5 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-primary/5 to-transparent rounded-full blur-2xl" />

          <div className="relative p-8">
            <div className="flex flex-col lg:flex-row lg:items-start gap-6">
              {/* Avatar/Initial */}
              <div className={`shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br ${tierConfig.bg} ${tierConfig.border} border flex items-center justify-center`}>
                <span className={`text-3xl font-bold ${tierConfig.text}`}>
                  {(stats.email?.[0] || stats.display_name?.[0] || "U").toUpperCase()}
                </span>
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0 space-y-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight truncate flex items-center gap-2">
                    {stats.email || t("noEmail")}
                    <AlphaBadge />
                  </h1>
                  {stats.display_name && (
                    <p className="text-muted-foreground mt-1">{stats.display_name}</p>
                  )}
                </div>

                {/* User ID with copy */}
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border">
                    {userId}
                  </code>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={copyUserId}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t("clickToCopy")}</TooltipContent>
                  </Tooltip>
                </div>

                {/* Timestamps */}
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium">{t("created")}:</span>
                    <span>{formatDate(stats.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium">{t("lastLogin")}:</span>
                    <span>{formatDate(stats.last_login)}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions - Role/Tier/Tester */}
              <div className="flex flex-wrap lg:flex-col gap-3">
                {/* Role */}
                <div className="flex items-center gap-2">
                  <Shield className={`h-4 w-4 ${stats.role === "admin" ? "text-amber-500" : "text-muted-foreground"}`} />
                  <Select
                    value={stats.role}
                    onValueChange={(v) => handleRoleChange(v as "user" | "admin")}
                  >
                    <SelectTrigger className={`w-28 h-9 text-sm ${stats.role === "admin" ? "border-amber-500/50 bg-amber-500/10" : ""}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">{t("user")}</SelectItem>
                      <SelectItem value="admin">{t("admin")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tier */}
                <Select
                  value={stats.tier}
                  onValueChange={(v) => handleTierChange(v as UserTier)}
                >
                  <SelectTrigger className={`w-36 h-9 text-sm border ${tierConfig.border} bg-gradient-to-r ${tierConfig.bg}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">{t("tierFree")}</SelectItem>
                    <SelectItem value="basic">{t("tierBasic")}</SelectItem>
                    <SelectItem value="pro">{t("tierPro")}</SelectItem>
                    <SelectItem value="enterprise">{t("tierEnterprise")}</SelectItem>
                  </SelectContent>
                </Select>

                {/* Tester Toggle */}
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer">
                  <Checkbox
                    checked={stats.tester}
                    onCheckedChange={(checked) => handleTesterChange(checked === true)}
                  />
                  <FlaskConical className={`h-4 w-4 ${stats.tester ? "text-purple-500" : "text-muted-foreground"}`} />
                  <span className="text-sm font-medium">{t("tester")}</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Content Statistics */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">{t("contentStatistics")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { icon: Video, label: t("videos"), value: stats.video_count, color: "blue" },
              { icon: FileText, label: t("docs"), value: stats.manual_count, color: "emerald" },
              { icon: FolderOpen, label: t("projects"), value: stats.project_count, color: "violet" },
              { icon: Layout, label: t("templates"), value: stats.template_count, color: "amber" },
              { icon: Trash2, label: t("trash"), value: stats.trash_count, color: "red" },
            ].map((item) => {
              const Icon = item.icon;
              const colorClasses = {
                blue: "from-blue-500/10 to-blue-600/5 border-blue-500/20 text-blue-500",
                emerald: "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 text-emerald-500",
                violet: "from-violet-500/10 to-violet-600/5 border-violet-500/20 text-violet-500",
                amber: "from-amber-500/10 to-amber-600/5 border-amber-500/20 text-amber-500",
                red: "from-red-500/10 to-red-600/5 border-red-500/20 text-red-500",
              }[item.color];

              return (
                <div
                  key={item.label}
                  className={`group relative overflow-hidden rounded-xl border bg-gradient-to-br ${colorClasses} p-5 transition-all hover:scale-[1.02] hover:shadow-lg`}
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-current opacity-[0.03] rounded-full blur-2xl translate-x-4 -translate-y-4" />
                  <Icon className="h-5 w-5 mb-3 opacity-80" />
                  <p className="text-3xl font-bold tracking-tight text-foreground">
                    {item.value}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{item.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Usage Statistics */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">{t("usageStatistics")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cost Card - Featured */}
            <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">{t("totalCost")}</span>
                </div>
                <p className="text-4xl font-bold tracking-tight">
                  {formatCost(stats.total_cost_usd)}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {formatNumber(stats.total_requests)} {t("apiRequests").toLowerCase()}
                </p>
              </div>
            </div>

            {/* Tokens Card */}
            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-muted">
                  <Zap className="h-5 w-5 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">{t("tokens")}</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("inputTokens")}</span>
                  <span className="font-mono font-medium">{formatNumber(stats.total_input_tokens)}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("outputTokens")}</span>
                  <span className="font-mono font-medium">{formatNumber(stats.total_output_tokens)}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("cached")}</span>
                  <span className="font-mono font-medium text-emerald-500">{formatNumber(stats.total_cached_tokens)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
