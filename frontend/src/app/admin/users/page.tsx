"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { adminApi, UserInfo } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export default function UsersPage() {
  const t = useTranslations("admin");
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handleRoleChange = async (userId: string, newRole: "user" | "admin") => {
    try {
      await adminApi.setUserRole(userId, newRole);
      // Reload users
      await loadUsers();
    } catch (err) {
      alert(`${t("failedToChangeRole")}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return t("never");
    return new Date(dateStr).toLocaleString();
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
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
      <div>
        <h1 className="text-3xl font-bold">{t("users")}</h1>
        <p className="text-muted-foreground">
          {t("manageUsersDesc")}
        </p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("userId")}</TableHead>
              <TableHead>{t("displayName")}</TableHead>
              <TableHead>{t("email")}</TableHead>
              <TableHead>{t("role")}</TableHead>
              <TableHead>{t("created")}</TableHead>
              <TableHead>{t("lastLogin")}</TableHead>
              <TableHead className="text-right">{t("totalCost")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {t("noUsersFound")}
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono text-sm">{user.id}</TableCell>
                  <TableCell>{user.display_name || "—"}</TableCell>
                  <TableCell>{user.email || "—"}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value) =>
                        handleRoleChange(user.id, value as "user" | "admin")
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">{t("user")}</SelectItem>
                        <SelectItem value="admin">{t("admin")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(user.last_login)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCost(user.total_cost_usd)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
