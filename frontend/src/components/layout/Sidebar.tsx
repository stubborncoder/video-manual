"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Video,
  FileText,
  FolderKanban,
  Trash2,
  LogOut,
  Home,
  Shield,
  LayoutTemplate,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VDocsIcon } from "@/components/ui/VDocsIcon";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { cn, getInitials } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";

const navItemsConfig = [
  { href: "/dashboard", labelKey: "dashboard", icon: Home },
  { href: "/dashboard/videos", labelKey: "videos", icon: Video },
  { href: "/dashboard/manuals", labelKey: "manuals", icon: FileText },
  { href: "/dashboard/projects", labelKey: "projects", icon: FolderKanban },
  { href: "/dashboard/templates", labelKey: "templates", icon: LayoutTemplate },
  { href: "/dashboard/trash", labelKey: "trash", icon: Trash2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed } = useSidebar();
  const [isAdmin, setIsAdmin] = useState(false);
  const t = useTranslations("sidebar");
  const { user, signOut } = useAuthStore();

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const session = await auth.me();
        setIsAdmin(session.role === "admin");
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      router.push("/");
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          "flex flex-col h-full border-r bg-card transition-all duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header */}
        <div className={cn("p-2", collapsed && "flex justify-center")}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/" className="relative w-full h-12 flex items-center justify-center hover:opacity-80 transition-opacity">
                  <VDocsIcon className="h-11 w-11 text-primary" aria-label="vDocs logo" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">vDocs (Alpha)</TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                <VDocsIcon className="h-11 w-11 text-primary" aria-label="vDocs logo" />
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">v<span className="text-primary">D</span>ocs</h1>
                <Badge variant="secondary" className="text-xs font-normal px-1.5 py-0">alpha</Badge>
              </div>
            </Link>
          )}
        </div>

        <Separator />

        {/* Navigation */}
        <nav className="flex-1 p-2">
          <ul className="space-y-1">
            {navItemsConfig.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const label = t(item.labelKey);

              const button = (
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full hover:text-primary",
                    collapsed ? "justify-center px-2" : "justify-start"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", !collapsed && "mr-2")} />
                  {!collapsed && label}
                </Button>
              );

              return (
                <li key={item.href}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href={item.href}>{button}</Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">{label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Link href={item.href}>{button}</Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <Separator />

        {/* Footer */}
        <div className="p-2 space-y-1">
          {/* Admin link - only for admins */}
          {isAdmin && (
            collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/admin">
                    <Button
                      variant={pathname.startsWith("/admin") ? "secondary" : "ghost"}
                      className="w-full justify-center px-2 hover:text-primary"
                    >
                      <Shield className="h-4 w-4" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{t("admin")}</TooltipContent>
              </Tooltip>
            ) : (
              <Link href="/admin">
                <Button
                  variant={pathname.startsWith("/admin") ? "secondary" : "ghost"}
                  className="w-full justify-start text-muted-foreground hover:text-primary"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  {t("admin")}
                </Button>
              </Link>
            )
          )}

          {/* Logout */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-center px-2 text-muted-foreground hover:text-primary"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t("logout")}</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-primary"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t("logout")}
            </Button>
          )}

          {/* User avatar and info - at the very bottom */}
          {user && (
            <>
              <Separator className="my-2" />
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/dashboard/profile" className="flex justify-center p-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                          alt={user.user_metadata?.full_name || user.email || ""}
                        />
                        <AvatarFallback className="text-xs">
                          {getInitials(user.user_metadata?.full_name || user.email)}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div>
                      <p className="font-medium">{user.user_metadata?.full_name || user.email?.split("@")[0]}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Link
                  href="/dashboard/profile"
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                      alt={user.user_metadata?.full_name || user.email || ""}
                    />
                    <AvatarFallback>
                      {getInitials(user.user_metadata?.full_name || user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {user.user_metadata?.full_name || user.email?.split("@")[0]}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                  </div>
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
