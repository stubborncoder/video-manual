"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Video,
  FileText,
  FolderKanban,
  Trash2,
  LogOut,
  Home,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { auth } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/videos", label: "Videos", icon: Video },
  { href: "/dashboard/manuals", label: "Manuals", icon: FileText },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
  { href: "/dashboard/trash", label: "Trash", icon: Trash2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggleCollapsed } = useSidebar();

  const handleLogout = async () => {
    try {
      await auth.logout();
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
        <div className={cn("p-4", collapsed && "flex justify-center")}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                  VM
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">Video Manual Platform</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <h1 className="text-xl font-bold">Video Manual</h1>
              <p className="text-sm text-muted-foreground">Platform</p>
            </>
          )}
        </div>

        <Separator />

        {/* Navigation */}
        <nav className="flex-1 p-2">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              const button = (
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full",
                    collapsed ? "justify-center px-2" : "justify-start"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", !collapsed && "mr-2")} />
                  {!collapsed && item.label}
                </Button>
              );

              return (
                <li key={item.href}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href={item.href}>{button}</Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
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
          {/* Toggle button */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-center px-2"
                  onClick={toggleCollapsed}
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand sidebar</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
              onClick={toggleCollapsed}
            >
              <PanelLeftClose className="mr-2 h-4 w-4" />
              Collapse
            </Button>
          )}

          {/* Logout */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-center px-2 text-muted-foreground"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Logout</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
