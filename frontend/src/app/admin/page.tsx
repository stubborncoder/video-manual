"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi, UsageSummary, UserInfo, DailyUsage } from "@/lib/api/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Zap,
  Users,
  Activity,
  ArrowRight,
  Database,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<UsageSummary[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get last 30 days of data for dashboard
        const endDate = new Date().toISOString().split("T")[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];

        const [summaryData, usersData, dailyData] = await Promise.all([
          adminApi.getUsageSummary(startDate, endDate),
          adminApi.listUsers(),
          adminApi.getDailyUsage(startDate, endDate),
        ]);
        setSummary(summaryData);
        setUsers(usersData);
        setDailyUsage(dailyData);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Calculate metrics
  const totalCost = summary.reduce((sum, s) => sum + s.total_cost_usd, 0);
  const totalRequests = summary.reduce((sum, s) => sum + s.total_requests, 0);
  const totalTokens = summary.reduce(
    (sum, s) => sum + s.total_input_tokens + s.total_output_tokens,
    0
  );
  const totalCached = summary.reduce((sum, s) => sum + s.total_cached_tokens, 0);
  const activeUsers = summary.length;
  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === "admin").length;

  // Aggregate daily data for chart
  const chartData = dailyUsage.reduce((acc, d) => {
    const existing = acc.find((item) => item.date === d.date);
    if (existing) {
      existing.cost += d.total_cost_usd;
      existing.requests += d.request_count;
      existing.tokens += d.total_input_tokens + d.total_output_tokens;
    } else {
      acc.push({
        date: d.date,
        cost: d.total_cost_usd,
        requests: d.request_count,
        tokens: d.total_input_tokens + d.total_output_tokens,
      });
    }
    return acc;
  }, [] as { date: string; cost: number; requests: number; tokens: number }[]);

  // Sort by date
  chartData.sort((a, b) => a.date.localeCompare(b.date));

  // Top users by cost
  const topUsers = [...summary]
    .sort((a, b) => b.total_cost_usd - a.total_cost_usd)
    .slice(0, 5);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          System overview for the last 30 days
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(totalCost)}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">API Requests</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalRequests)}</div>
            <p className="text-xs text-muted-foreground">LLM calls</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tokens</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalTokens)}</div>
            <p className="text-xs text-muted-foreground">Input + Output</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cached</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalCached)}</div>
            <p className="text-xs text-muted-foreground">Tokens saved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeUsers}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}/ {totalUsers}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{adminCount} admin(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Daily Cost</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No usage data yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => v.slice(5)}
                    className="text-xs"
                  />
                  <YAxis
                    tickFormatter={(v) => `$${v.toFixed(2)}`}
                    className="text-xs"
                  />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.2)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Daily Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No usage data yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => v.slice(5)}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => [value, "Requests"]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Bar dataKey="requests" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-base">Top Users by Cost</CardTitle>
            <Link href="/admin/usage">
              <Button variant="ghost" size="sm" className="gap-1 h-7">
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {topUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No usage data yet</p>
            ) : (
              <div className="space-y-3">
                {topUsers.map((user, index) => (
                  <div
                    key={user.user_id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-4">
                        {index + 1}.
                      </span>
                      <span className="text-sm font-medium">{user.user_id}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-mono">
                        {formatCost(user.total_cost_usd)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({formatNumber(user.total_requests)} req)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-base">Recent Users</CardTitle>
            <Link href="/admin/users">
              <Button variant="ghost" size="sm" className="gap-1 h-7">
                Manage <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users yet</p>
            ) : (
              <div className="space-y-3">
                {users.slice(0, 5).map((user) => (
                  <div key={user.id} className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">
                        {user.display_name || user.id}
                      </span>
                      {user.role === "admin" && (
                        <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {user.last_login
                        ? new Date(user.last_login).toLocaleDateString()
                        : "Never"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
