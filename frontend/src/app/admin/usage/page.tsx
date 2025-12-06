"use client";

import { useEffect, useState } from "react";
import { adminApi, UsageSummary, DailyUsage, ModelUsage, ManualUsage } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, Filter, RefreshCw } from "lucide-react";

export default function UsagePage() {
  const [summary, setSummary] = useState<UsageSummary[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [modelUsage, setModelUsage] = useState<ModelUsage[]>([]);
  const [manualUsage, setManualUsage] = useState<ManualUsage[]>([]);
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

  const loadData = async () => {
    try {
      setLoading(true);
      const [summaryData, dailyData, modelData, manualData] = await Promise.all([
        adminApi.getUsageSummary(startDate, endDate),
        adminApi.getDailyUsage(startDate, endDate),
        adminApi.getModelUsage(startDate, endDate),
        adminApi.getManualUsage(startDate, endDate),
      ]);
      setSummary(summaryData);
      setDailyUsage(dailyData);
      setModelUsage(modelData);
      setManualUsage(manualData);
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
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filter toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usage & Costs</h1>
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
            Filters
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

      {/* Collapsible Filters */}
      {filtersOpen && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-48">
                <Label htmlFor="start-date" className="text-xs">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex-1 max-w-48">
                <Label htmlFor="end-date" className="text-xs">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <Button onClick={handleApplyFilters} size="sm">
                Apply
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Cost</p>
          <p className="text-lg font-bold">{formatCost(totalCost)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Requests</p>
          <p className="text-lg font-bold">{formatNumber(totalRequests)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Input Tokens</p>
          <p className="text-lg font-bold">{formatNumber(totalInputTokens)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Output Tokens</p>
          <p className="text-lg font-bold">{formatNumber(totalOutputTokens)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Cached (Gemini)</p>
          <p className="text-lg font-bold">{formatNumber(totalCachedTokens)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Cache Read (Claude)</p>
          <p className="text-lg font-bold">{formatNumber(totalCacheReadTokens)}</p>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading usage data...</p>
        </div>
      ) : (
        <>
          {/* Model/API Usage */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Usage by Model/API</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Input</TableHead>
                    <TableHead className="text-right">Output</TableHead>
                    <TableHead className="text-right">Cached</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelUsage.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No model usage data
                      </TableCell>
                    </TableRow>
                  ) : (
                    modelUsage.map((m) => (
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

          {/* Per-Manual Breakdown */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Usage by Manual</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Manual ID</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Input</TableHead>
                    <TableHead className="text-right">Output</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manualUsage.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No manual usage data
                      </TableCell>
                    </TableRow>
                  ) : (
                    manualUsage.map((m) => (
                      <TableRow key={m.manual_id}>
                        <TableCell className="font-mono text-xs">{m.manual_id}</TableCell>
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
                          {new Date(m.last_request).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Per-User Breakdown */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Usage by User</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Input</TableHead>
                    <TableHead className="text-right">Output</TableHead>
                    <TableHead className="text-right">Cached</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No usage data for selected period
                      </TableCell>
                    </TableRow>
                  ) : (
                    summary.map((s) => (
                      <TableRow key={s.user_id}>
                        <TableCell className="font-medium">{s.user_id}</TableCell>
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
            </CardContent>
          </Card>

          {/* Daily Breakdown */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Daily Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Operation</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyUsage.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No daily usage data
                      </TableCell>
                    </TableRow>
                  ) : (
                    dailyUsage.map((d, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{d.date}</TableCell>
                        <TableCell className="capitalize">
                          {d.operation.replace(/_/g, " ")}
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
