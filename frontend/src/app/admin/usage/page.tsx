"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLocale } from "@/components/providers/I18nProvider";
import { adminApi, UsageSummary, DailyUsage, ModelUsage, DocUsage, UserInfo } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlphaBadge } from "@/components/ui/alpha-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronDown,
  ChevronUp,
  Filter,
  RefreshCw,
  Copy,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Types for sorting
type ModelSortField = "provider" | "model" | "requests" | "input" | "output" | "cached" | "cost";
type DailySortField = "date" | "operation" | "model" | "requests" | "cost";
type UserSortField = "email" | "requests" | "input" | "output" | "cached" | "cost";
type SortDirection = "asc" | "desc";

// Extended usage summary with user info
interface UsageSummaryWithUser extends UsageSummary {
  email?: string;
  display_name?: string;
}

export default function UsagePage() {
  const t = useTranslations("admin");
  const { locale } = useLocale();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [summary, setSummary] = useState<UsageSummaryWithUser[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [modelUsage, setModelUsage] = useState<ModelUsage[]>([]);
  const [docUsage, setDocUsage] = useState<DocUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Date range for filtering (default: last 7 days)
  const getDefaultStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split("T")[0];
  };

  const getDefaultEndDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(getDefaultEndDate());

  // Model/API table filters and sorting
  const [modelProviderFilter, setModelProviderFilter] = useState<string>("all");
  const [modelSortField, setModelSortField] = useState<ModelSortField>("cost");
  const [modelSortDirection, setModelSortDirection] = useState<SortDirection>("desc");

  // Daily breakdown filters and sorting
  const [dailyOperationFilter, setDailyOperationFilter] = useState<string>("all");
  const [dailyModelFilter, setDailyModelFilter] = useState<string>("all");
  const [dailySortField, setDailySortField] = useState<DailySortField>("date");
  const [dailySortDirection, setDailySortDirection] = useState<SortDirection>("desc");

  // User table sorting
  const [userSortField, setUserSortField] = useState<UserSortField>("cost");
  const [userSortDirection, setUserSortDirection] = useState<SortDirection>("desc");

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, summaryData, dailyData, modelData, docData] = await Promise.all([
        adminApi.listUsers(),
        adminApi.getUsageSummary(startDate, endDate),
        adminApi.getDailyUsage(startDate, endDate),
        adminApi.getModelUsage(startDate, endDate),
        adminApi.getDocUsage(startDate, endDate),
      ]);

      setUsers(usersData);

      // Merge user info into usage summary
      const userMap = new Map(usersData.map(u => [u.id, u]));
      const summaryWithUsers: UsageSummaryWithUser[] = summaryData.map(s => ({
        ...s,
        email: userMap.get(s.user_id)?.email,
        display_name: userMap.get(s.user_id)?.display_name,
      }));

      setSummary(summaryWithUsers);
      setDailyUsage(dailyData);
      setModelUsage(modelData);
      setDocUsage(docData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load usage data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApplyFilters = () => {
    loadData();
    setFiltersOpen(false);
  };

  const formatCost = (cost: number) => {
    if (cost >= 1) return `$${cost.toFixed(2)}`;
    if (cost >= 0.01) return `$${cost.toFixed(3)}`;
    return `$${cost.toFixed(4)}`;
  };

  const formatNumber = (num: number | null | undefined) => {
    const n = num || 0;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const getProvider = (model: string) => {
    if (model.toLowerCase().includes("gemini")) return "Google";
    if (model.toLowerCase().includes("claude")) return "Anthropic";
    if (model.toLowerCase().includes("gpt")) return "OpenAI";
    return "Unknown";
  };

  const getProviderColor = (model: string) => {
    const provider = getProvider(model);
    switch (provider) {
      case "Google": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "Anthropic": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "OpenAI": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case "video_analysis": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "manual_generation": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "evaluation": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "manual_reformat": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "guide_assistant": return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200";
      case "manual_editing": return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200";
      case "project_compilation": return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  // Copy user ID to clipboard
  const copyUserId = (userId: string) => {
    navigator.clipboard.writeText(userId);
    toast.success(t("copiedToClipboard"));
  };

  // Get unique values for filters
  const uniqueOperations = useMemo(() =>
    [...new Set(dailyUsage.map(d => d.operation))].sort(),
    [dailyUsage]
  );

  const uniqueModels = useMemo(() =>
    [...new Set(dailyUsage.map(d => d.model))].sort(),
    [dailyUsage]
  );

  const uniqueProviders = useMemo(() =>
    [...new Set(modelUsage.map(m => getProvider(m.model)))].sort(),
    [modelUsage]
  );

  // Filtered and sorted model usage
  const filteredModelUsage = useMemo(() => {
    let result = [...modelUsage];

    if (modelProviderFilter !== "all") {
      result = result.filter(m => getProvider(m.model) === modelProviderFilter);
    }

    result.sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;

      switch (modelSortField) {
        case "provider":
          aVal = getProvider(a.model);
          bVal = getProvider(b.model);
          break;
        case "model":
          aVal = a.model;
          bVal = b.model;
          break;
        case "requests":
          aVal = a.total_requests;
          bVal = b.total_requests;
          break;
        case "input":
          aVal = a.total_input_tokens;
          bVal = b.total_input_tokens;
          break;
        case "output":
          aVal = a.total_output_tokens;
          bVal = b.total_output_tokens;
          break;
        case "cached":
          aVal = (a.total_cached_tokens || 0) + (a.total_cache_read_tokens || 0);
          bVal = (b.total_cached_tokens || 0) + (b.total_cache_read_tokens || 0);
          break;
        case "cost":
          aVal = a.total_cost_usd;
          bVal = b.total_cost_usd;
          break;
      }

      if (aVal < bVal) return modelSortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return modelSortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [modelUsage, modelProviderFilter, modelSortField, modelSortDirection]);

  // Filtered and sorted daily usage
  const filteredDailyUsage = useMemo(() => {
    let result = [...dailyUsage];

    if (dailyOperationFilter !== "all") {
      result = result.filter(d => d.operation === dailyOperationFilter);
    }

    if (dailyModelFilter !== "all") {
      result = result.filter(d => d.model === dailyModelFilter);
    }

    result.sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;

      switch (dailySortField) {
        case "date":
          aVal = a.date;
          bVal = b.date;
          break;
        case "operation":
          aVal = a.operation;
          bVal = b.operation;
          break;
        case "model":
          aVal = a.model;
          bVal = b.model;
          break;
        case "requests":
          aVal = a.request_count;
          bVal = b.request_count;
          break;
        case "cost":
          aVal = a.total_cost_usd;
          bVal = b.total_cost_usd;
          break;
      }

      if (aVal < bVal) return dailySortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return dailySortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [dailyUsage, dailyOperationFilter, dailyModelFilter, dailySortField, dailySortDirection]);

  // Sorted user usage
  const sortedUserUsage = useMemo(() => {
    const result = [...summary];

    result.sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;

      switch (userSortField) {
        case "email":
          aVal = a.email?.toLowerCase() || a.user_id;
          bVal = b.email?.toLowerCase() || b.user_id;
          break;
        case "requests":
          aVal = a.total_requests;
          bVal = b.total_requests;
          break;
        case "input":
          aVal = a.total_input_tokens;
          bVal = b.total_input_tokens;
          break;
        case "output":
          aVal = a.total_output_tokens;
          bVal = b.total_output_tokens;
          break;
        case "cached":
          aVal = (a.total_cached_tokens || 0) + (a.total_cache_read_tokens || 0);
          bVal = (b.total_cached_tokens || 0) + (b.total_cache_read_tokens || 0);
          break;
        case "cost":
          aVal = a.total_cost_usd;
          bVal = b.total_cost_usd;
          break;
      }

      if (aVal < bVal) return userSortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return userSortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [summary, userSortField, userSortDirection]);

  // Sort handlers
  const handleModelSort = (field: ModelSortField) => {
    if (modelSortField === field) {
      setModelSortDirection(modelSortDirection === "asc" ? "desc" : "asc");
    } else {
      setModelSortField(field);
      setModelSortDirection("desc");
    }
  };

  const handleDailySort = (field: DailySortField) => {
    if (dailySortField === field) {
      setDailySortDirection(dailySortDirection === "asc" ? "desc" : "asc");
    } else {
      setDailySortField(field);
      setDailySortDirection("desc");
    }
  };

  const handleUserSort = (field: UserSortField) => {
    if (userSortField === field) {
      setUserSortDirection(userSortDirection === "asc" ? "desc" : "asc");
    } else {
      setUserSortField(field);
      setUserSortDirection("desc");
    }
  };

  // Sort icon component
  const SortIcon = ({ field, currentField, direction }: { field: string; currentField: string; direction: SortDirection }) => {
    if (currentField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />;
    }
    return direction === "asc"
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  // Check if filters are active
  const hasDailyFilters = dailyOperationFilter !== "all" || dailyModelFilter !== "all";
  const hasModelFilters = modelProviderFilter !== "all";

  // Calculate totals
  const totalCost = summary.reduce((sum, s) => sum + s.total_cost_usd, 0);
  const totalRequests = summary.reduce((sum, s) => sum + s.total_requests, 0);
  const totalInputTokens = summary.reduce((sum, s) => sum + s.total_input_tokens, 0);
  const totalOutputTokens = summary.reduce((sum, s) => sum + s.total_output_tokens, 0);
  const totalCachedTokens = summary.reduce((sum, s) => sum + s.total_cached_tokens, 0);
  const totalCacheReadTokens = summary.reduce((sum, s) => sum + s.total_cache_read_tokens, 0);

  if (error) {
    return (
      <div className="py-12">
        <p className="text-destructive">Error: {error}</p>
        <Button onClick={loadData} className="mt-4">
          {t("retry") || "Retry"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filter toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {t("usage")} & {t("cost")}
            <AlphaBadge />
          </h1>
          <p className="text-sm text-muted-foreground">
            {startDate} to {endDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            {t("dateRange") || "Date Range"}
            {filtersOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Collapsible Date Range Filters */}
      {filtersOpen && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-48">
                <Label htmlFor="start-date" className="text-xs">{t("startDate") || "Start Date"}</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex-1 max-w-48">
                <Label htmlFor="end-date" className="text-xs">{t("endDate") || "End Date"}</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <Button onClick={handleApplyFilters} size="sm">
                {t("apply") || "Apply"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">{t("totalCost")}</p>
          <p className="text-lg font-bold">{formatCost(totalCost)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">{t("requests")}</p>
          <p className="text-lg font-bold">{formatNumber(totalRequests)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">{t("inputTokens")}</p>
          <p className="text-lg font-bold">{formatNumber(totalInputTokens)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">{t("outputTokens")}</p>
          <p className="text-lg font-bold">{formatNumber(totalOutputTokens)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">{t("cached")} (Gemini)</p>
          <p className="text-lg font-bold">{formatNumber(totalCachedTokens)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Cache Read (Claude)</p>
          <p className="text-lg font-bold">{formatNumber(totalCacheReadTokens)}</p>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
          <p className="text-muted-foreground">{t("loadingDashboard") || "Loading..."}</p>
        </div>
      ) : (
        <>
          {/* Model/API Usage with filters and sorting */}
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t("usageByModel") || "Usage by Model/API"}</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={modelProviderFilter} onValueChange={setModelProviderFilter}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder={t("provider")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allProviders") || "All Providers"}</SelectItem>
                      {uniqueProviders.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasModelFilters && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setModelProviderFilter("all")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleModelSort("provider")}
                    >
                      <div className="flex items-center">
                        {t("provider")}
                        <SortIcon field="provider" currentField={modelSortField} direction={modelSortDirection} />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleModelSort("model")}
                    >
                      <div className="flex items-center">
                        {t("model")}
                        <SortIcon field="model" currentField={modelSortField} direction={modelSortDirection} />
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleModelSort("requests")}
                    >
                      <div className="flex items-center justify-end">
                        {t("requests")}
                        <SortIcon field="requests" currentField={modelSortField} direction={modelSortDirection} />
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleModelSort("input")}
                    >
                      <div className="flex items-center justify-end">
                        Input
                        <SortIcon field="input" currentField={modelSortField} direction={modelSortDirection} />
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleModelSort("output")}
                    >
                      <div className="flex items-center justify-end">
                        Output
                        <SortIcon field="output" currentField={modelSortField} direction={modelSortDirection} />
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleModelSort("cached")}
                    >
                      <div className="flex items-center justify-end">
                        {t("cached")}
                        <SortIcon field="cached" currentField={modelSortField} direction={modelSortDirection} />
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleModelSort("cost")}
                    >
                      <div className="flex items-center justify-end">
                        {t("cost")}
                        <SortIcon field="cost" currentField={modelSortField} direction={modelSortDirection} />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredModelUsage.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        {t("noData")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredModelUsage.map((m) => (
                      <TableRow key={m.model}>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded ${getProviderColor(m.model)}`}>
                            {getProvider(m.model)}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{m.model}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(m.total_requests)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(m.total_input_tokens)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(m.total_output_tokens)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatNumber((m.total_cached_tokens || 0) + (m.total_cache_read_tokens || 0))}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCost(m.total_cost_usd)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Per-Doc Breakdown */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">{t("usageByDoc") || "Usage by Doc"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doc ID</TableHead>
                    <TableHead className="text-right">{t("requests")}</TableHead>
                    <TableHead className="text-right">Input</TableHead>
                    <TableHead className="text-right">Output</TableHead>
                    <TableHead className="text-right">{t("cost")}</TableHead>
                    <TableHead className="text-right">{t("lastActivity") || "Last Activity"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docUsage.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        {t("noData")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    docUsage.map((m) => (
                      <TableRow key={m.doc_id}>
                        <TableCell className="font-mono text-xs">{m.doc_id}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(m.total_requests)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(m.total_input_tokens)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(m.total_output_tokens)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCost(m.total_cost_usd)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs">
                          {new Date(m.last_request).toLocaleDateString(locale)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Per-User Breakdown with email display and sorting */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">{t("usageByUser") || "Usage by User"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleUserSort("email")}
                      >
                        <div className="flex items-center">
                          {t("user") || "User"}
                          <SortIcon field="email" currentField={userSortField} direction={userSortDirection} />
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer hover:bg-muted/50"
                        onClick={() => handleUserSort("requests")}
                      >
                        <div className="flex items-center justify-end">
                          {t("requests")}
                          <SortIcon field="requests" currentField={userSortField} direction={userSortDirection} />
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer hover:bg-muted/50"
                        onClick={() => handleUserSort("input")}
                      >
                        <div className="flex items-center justify-end">
                          Input
                          <SortIcon field="input" currentField={userSortField} direction={userSortDirection} />
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer hover:bg-muted/50"
                        onClick={() => handleUserSort("output")}
                      >
                        <div className="flex items-center justify-end">
                          Output
                          <SortIcon field="output" currentField={userSortField} direction={userSortDirection} />
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer hover:bg-muted/50"
                        onClick={() => handleUserSort("cached")}
                      >
                        <div className="flex items-center justify-end">
                          {t("cached")}
                          <SortIcon field="cached" currentField={userSortField} direction={userSortDirection} />
                        </div>
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer hover:bg-muted/50"
                        onClick={() => handleUserSort("cost")}
                      >
                        <div className="flex items-center justify-end">
                          {t("cost")}
                          <SortIcon field="cost" currentField={userSortField} direction={userSortDirection} />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedUserUsage.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          {t("noData")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedUserUsage.map((s) => (
                        <TableRow key={s.user_id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => copyUserId(s.user_id)}
                                    className="p-1 hover:bg-muted rounded transition-colors"
                                  >
                                    <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs">
                                  <p className="font-mono text-xs break-all">{s.user_id}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{t("clickToCopy")}</p>
                                </TooltipContent>
                              </Tooltip>
                              <Link
                                href={`/admin/users/${s.user_id}`}
                                className="font-medium hover:text-primary hover:underline transition-colors"
                              >
                                {s.email || s.user_id}
                              </Link>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(s.total_requests)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(s.total_input_tokens)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(s.total_output_tokens)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatNumber((s.total_cached_tokens || 0) + (s.total_cache_read_tokens || 0))}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCost(s.total_cost_usd)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </CardContent>
          </Card>

          {/* Daily Breakdown with filters and sorting */}
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t("dailyBreakdown") || "Daily Breakdown"}</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={dailyOperationFilter} onValueChange={setDailyOperationFilter}>
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue placeholder={t("operation") || "Operation"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allOperations") || "All Operations"}</SelectItem>
                      {uniqueOperations.map(op => (
                        <SelectItem key={op} value={op}>
                          {op.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={dailyModelFilter} onValueChange={setDailyModelFilter}>
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue placeholder={t("model")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allModels") || "All Models"}</SelectItem>
                      {uniqueModels.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasDailyFilters && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setDailyOperationFilter("all");
                        setDailyModelFilter("all");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              {hasDailyFilters && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("showingResults", { count: filteredDailyUsage.length, total: dailyUsage.length }) ||
                   `Showing ${filteredDailyUsage.length} of ${dailyUsage.length} records`}
                </p>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleDailySort("date")}
                    >
                      <div className="flex items-center">
                        {t("date")}
                        <SortIcon field="date" currentField={dailySortField} direction={dailySortDirection} />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleDailySort("operation")}
                    >
                      <div className="flex items-center">
                        {t("operation") || "Operation"}
                        <SortIcon field="operation" currentField={dailySortField} direction={dailySortDirection} />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleDailySort("model")}
                    >
                      <div className="flex items-center">
                        {t("model")}
                        <SortIcon field="model" currentField={dailySortField} direction={dailySortDirection} />
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleDailySort("requests")}
                    >
                      <div className="flex items-center justify-end">
                        {t("requests")}
                        <SortIcon field="requests" currentField={dailySortField} direction={dailySortDirection} />
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleDailySort("cost")}
                    >
                      <div className="flex items-center justify-end">
                        {t("cost")}
                        <SortIcon field="cost" currentField={dailySortField} direction={dailySortDirection} />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDailyUsage.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        {t("noData")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDailyUsage.map((d, idx) => (
                      <TableRow key={`${d.date}-${d.operation}-${d.model}-${idx}`}>
                        <TableCell>{d.date}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded capitalize ${getOperationColor(d.operation)}`}>
                            {d.operation.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{d.model}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(d.request_count)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCost(d.total_cost_usd)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
