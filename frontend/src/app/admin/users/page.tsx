"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { adminApi, UserInfo, UserTier } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  X,
  Shield,
  User,
  FlaskConical,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

type SortField = "display_name" | "email" | "role" | "tier" | "created_at" | "last_login" | "total_cost_usd";
type SortDirection = "asc" | "desc";

interface Filters {
  search: string;
  role: "all" | "user" | "admin";
  tier: "all" | UserTier;
  tester: "all" | "yes" | "no";
}

export default function UsersPage() {
  const t = useTranslations("admin");
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtering state
  const [filters, setFilters] = useState<Filters>({
    search: "",
    role: "all",
    tier: "all",
    tester: "all",
  });

  // Sorting state
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await adminApi.listUsers();
      setUsers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToLoadUsers"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];

    // Apply filters
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (user) =>
          user.display_name?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower) ||
          user.id.toLowerCase().includes(searchLower)
      );
    }

    if (filters.role !== "all") {
      result = result.filter((user) => user.role === filters.role);
    }

    if (filters.tier !== "all") {
      result = result.filter((user) => user.tier === filters.tier);
    }

    if (filters.tester !== "all") {
      result = result.filter((user) =>
        filters.tester === "yes" ? user.tester : !user.tester
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: string | number | boolean | null = null;
      let bVal: string | number | boolean | null = null;

      switch (sortField) {
        case "display_name":
          aVal = a.display_name?.toLowerCase() || "";
          bVal = b.display_name?.toLowerCase() || "";
          break;
        case "email":
          aVal = a.email?.toLowerCase() || "";
          bVal = b.email?.toLowerCase() || "";
          break;
        case "role":
          aVal = a.role;
          bVal = b.role;
          break;
        case "tier":
          const tierOrder = { free: 0, basic: 1, pro: 2, enterprise: 3 };
          aVal = tierOrder[a.tier] ?? 0;
          bVal = tierOrder[b.tier] ?? 0;
          break;
        case "created_at":
          aVal = a.created_at || "";
          bVal = b.created_at || "";
          break;
        case "last_login":
          aVal = a.last_login || "";
          bVal = b.last_login || "";
          break;
        case "total_cost_usd":
          aVal = a.total_cost_usd;
          bVal = b.total_cost_usd;
          break;
      }

      if (aVal === null || bVal === null) return 0;
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [users, filters, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />;
    }
    return sortDirection === "asc"
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      role: "all",
      tier: "all",
      tester: "all",
    });
  };

  const hasActiveFilters =
    filters.search !== "" ||
    filters.role !== "all" ||
    filters.tier !== "all" ||
    filters.tester !== "all";

  const handleRoleChange = async (userId: string, newRole: "user" | "admin") => {
    // Optimistic update
    const previousUsers = [...users];
    setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));

    try {
      await adminApi.setUserRole(userId, newRole);
      toast.success(t("roleUpdated"));
    } catch (err) {
      // Revert on error
      setUsers(previousUsers);
      toast.error(t("failedToChangeRole"), {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleTierChange = async (userId: string, newTier: UserTier) => {
    // Optimistic update
    const previousUsers = [...users];
    setUsers(users.map(u => u.id === userId ? { ...u, tier: newTier } : u));

    try {
      await adminApi.setUserTier(userId, newTier);
      toast.success(t("tierUpdated"));
    } catch (err) {
      // Revert on error
      setUsers(previousUsers);
      toast.error(t("failedToChangeTier"), {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleTesterChange = async (userId: string, isTester: boolean) => {
    // Optimistic update
    const previousUsers = [...users];
    setUsers(users.map(u => u.id === userId ? { ...u, tester: isTester } : u));

    try {
      await adminApi.setUserTester(userId, isTester);
      toast.success(t("testerUpdated"));
    } catch (err) {
      // Revert on error
      setUsers(previousUsers);
      toast.error(t("failedToChangeTester"), {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return t("never");
    return new Date(dateStr).toLocaleString();
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  // Get role cell class
  const getRoleCellClass = (role: string) => {
    if (role === "admin") {
      return "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200";
    }
    return "";
  };

  // Get tier cell class
  const getTierCellClass = (tier: UserTier) => {
    switch (tier) {
      case "enterprise":
        return "bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-200";
      case "pro":
        return "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200";
      case "basic":
        return "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200";
      case "free":
      default:
        return "bg-gray-100 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400";
    }
  };

  // Stats
  const stats = useMemo(() => ({
    total: users.length,
    admins: users.filter(u => u.role === "admin").length,
    testers: users.filter(u => u.tester).length,
    filtered: filteredAndSortedUsers.length,
    tiers: {
      free: users.filter(u => u.tier === "free").length,
      basic: users.filter(u => u.tier === "basic").length,
      pro: users.filter(u => u.tier === "pro").length,
      enterprise: users.filter(u => u.tier === "enterprise").length,
    },
  }), [users, filteredAndSortedUsers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
        <p className="text-muted-foreground">{t("loadingUsers")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12">
        <p className="text-destructive">Error: {error}</p>
        <Button onClick={loadUsers} className="mt-4">
          {t("retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t("users")}</h1>
        <p className="text-muted-foreground">
          {t("manageUsersDesc")}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="space-y-4">
        {/* Main stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <User className="h-4 w-4" />
              {t("totalUsers")}
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </div>
          <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 p-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
              <Shield className="h-4 w-4" />
              {t("admins", { count: stats.admins })}
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-400">{stats.admins}</p>
          </div>
          <div className="rounded-lg border bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900 p-4">
            <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 text-sm">
              <FlaskConical className="h-4 w-4" />
              {t("testers")}
            </div>
            <p className="text-2xl font-bold mt-1 text-purple-700 dark:text-purple-400">{stats.testers}</p>
          </div>
        </div>

        {/* Tier breakdown row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                {t("tierFree")}
              </div>
              <div className="w-2 h-2 rounded-full bg-gray-400" />
            </div>
            <p className="text-2xl font-bold mt-1 text-gray-700 dark:text-gray-300">{stats.tiers.free}</p>
          </div>
          <div className="rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 p-4">
            <div className="flex items-center justify-between">
              <div className="text-emerald-700 dark:text-emerald-400 text-sm font-medium">
                {t("tierBasic")}
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <p className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{stats.tiers.basic}</p>
          </div>
          <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 p-4">
            <div className="flex items-center justify-between">
              <div className="text-blue-700 dark:text-blue-400 text-sm font-medium">
                {t("tierPro")}
              </div>
              <div className="w-2 h-2 rounded-full bg-blue-500" />
            </div>
            <p className="text-2xl font-bold mt-1 text-blue-700 dark:text-blue-400">{stats.tiers.pro}</p>
          </div>
          <div className="rounded-lg border bg-violet-50/50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-900 p-4">
            <div className="flex items-center justify-between">
              <div className="text-violet-700 dark:text-violet-400 text-sm font-medium">
                {t("tierEnterprise")}
              </div>
              <div className="w-2 h-2 rounded-full bg-violet-500" />
            </div>
            <p className="text-2xl font-bold mt-1 text-violet-700 dark:text-violet-400">{stats.tiers.enterprise}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-lg border bg-muted/30">
          <Button
            variant="outline"
            size="icon"
            onClick={loadUsers}
            className="shrink-0"
            title={t("refresh")}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchUsers")}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-9"
            />
          </div>

          <Select
            value={filters.role}
            onValueChange={(value) => setFilters({ ...filters, role: value as Filters["role"] })}
          >
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder={t("role")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allRoles")}</SelectItem>
              <SelectItem value="user">{t("user")}</SelectItem>
              <SelectItem value="admin">{t("admin")}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.tier}
            onValueChange={(value) => setFilters({ ...filters, tier: value as Filters["tier"] })}
          >
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder={t("tier")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTiers")}</SelectItem>
              <SelectItem value="free">{t("tierFree")}</SelectItem>
              <SelectItem value="basic">{t("tierBasic")}</SelectItem>
              <SelectItem value="pro">{t("tierPro")}</SelectItem>
              <SelectItem value="enterprise">{t("tierEnterprise")}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.tester}
            onValueChange={(value) => setFilters({ ...filters, tester: value as Filters["tester"] })}
          >
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder={t("tester")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTesters")}</SelectItem>
              <SelectItem value="yes">{t("testersOnly")}</SelectItem>
              <SelectItem value="no">{t("nonTesters")}</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearFilters}
              className="shrink-0"
              title={t("clearFilters")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Filter results count */}
        {hasActiveFilters && (
          <p className="text-xs text-muted-foreground px-1">
            {t("showingResults", { count: stats.filtered, total: stats.total })}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[100px]">{t("userId")}</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => handleSort("display_name")}
              >
                <div className="flex items-center">
                  {t("displayName")}
                  <SortIcon field="display_name" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => handleSort("email")}
              >
                <div className="flex items-center">
                  {t("email")}
                  <SortIcon field="email" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => handleSort("role")}
              >
                <div className="flex items-center">
                  {t("role")}
                  <SortIcon field="role" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => handleSort("tier")}
              >
                <div className="flex items-center">
                  {t("tier")}
                  <SortIcon field="tier" />
                </div>
              </TableHead>
              <TableHead className="text-center">{t("tester")}</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => handleSort("created_at")}
              >
                <div className="flex items-center">
                  {t("created")}
                  <SortIcon field="created_at" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => handleSort("last_login")}
              >
                <div className="flex items-center">
                  {t("lastLogin")}
                  <SortIcon field="last_login" />
                </div>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => handleSort("total_cost_usd")}
              >
                <div className="flex items-center justify-end">
                  {t("totalCost")}
                  <SortIcon field="total_cost_usd" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  {hasActiveFilters ? t("noUsersMatchFilter") : t("noUsersFound")}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {user.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="font-medium">
                    {user.display_name || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email || "—"}</TableCell>
                  <TableCell className={`${getRoleCellClass(user.role)}`}>
                    <Select
                      value={user.role}
                      onValueChange={(value) =>
                        handleRoleChange(user.id, value as "user" | "admin")
                      }
                    >
                      <SelectTrigger className={`w-24 h-8 text-xs border-0 ${user.role === "admin" ? "bg-transparent" : ""}`}>
                        <div className="flex items-center gap-1.5">
                          {user.role === "admin" && (
                            <Shield className="h-3 w-3" />
                          )}
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">{t("user")}</SelectItem>
                        <SelectItem value="admin">{t("admin")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className={`${getTierCellClass(user.tier)}`}>
                    <Select
                      value={user.tier}
                      onValueChange={(value) =>
                        handleTierChange(user.id, value as UserTier)
                      }
                    >
                      <SelectTrigger className="w-28 h-8 text-xs border-0 bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">{t("tierFree")}</SelectItem>
                        <SelectItem value="basic">{t("tierBasic")}</SelectItem>
                        <SelectItem value="pro">{t("tierPro")}</SelectItem>
                        <SelectItem value="enterprise">{t("tierEnterprise")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={user.tester}
                      onCheckedChange={(checked) =>
                        handleTesterChange(user.id, checked === true)
                      }
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.last_login)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCost(user.total_cost_usd)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{t("role")}:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/40" />
            <span>{t("admin")}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{t("tier")}:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-800/40" />
            <span>{t("tierFree")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/40" />
            <span>{t("tierBasic")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/40" />
            <span>{t("tierPro")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-violet-100 dark:bg-violet-900/40" />
            <span>{t("tierEnterprise")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
