"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  ArrowLeft,
  PanelLeftClose,
  PanelLeft,
  Sun,
  Moon,
  Shield,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { VDocsIcon } from "@/components/ui/VDocsIcon";
import { Badge } from "@/components/ui/badge";
import { useAdminSidebar } from "./AdminSidebarContext";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/usage", label: "Usage & Costs", icon: BarChart3 },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggleCollapsed } = useAdminSidebar();
  const { theme, setTheme } = useTheme();

  const isActiveRoute = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
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
                <div className="relative w-full h-12 flex items-center justify-center">
                  <div className="relative">
                    <VDocsIcon className="h-11 w-11 text-primary" aria-label="vDocs Admin" />
                    <Shield className="h-4 w-4 text-primary absolute -bottom-1 -right-1" />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">vDocs Admin (Alpha)</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                <VDocsIcon className="h-11 w-11 text-primary" aria-label="vDocs Admin" />
                <Shield className="h-4 w-4 text-primary absolute bottom-0 right-0" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">v<span className="text-primary">D</span>ocs</h1>
                  <Badge variant="secondary" className="text-xs font-normal px-1.5 py-0">alpha</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Admin</p>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Navigation */}
        <nav className="flex-1 p-2">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = isActiveRoute(item.href);

              const button = (
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full hover:text-primary",
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
          {/* Toggle sidebar */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-center px-2 hover:text-primary"
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
              className="w-full justify-start text-muted-foreground hover:text-primary"
              onClick={toggleCollapsed}
            >
              <PanelLeftClose className="mr-2 h-4 w-4" />
              Collapse
            </Button>
          )}

          {/* Theme toggle */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-center px-2 hover:text-primary"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Toggle {theme === "dark" ? "light" : "dark"} mode
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-primary"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="mr-2 h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              {theme === "dark" ? "Light" : "Dark"} Mode
            </Button>
          )}

          {/* Back to App */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/dashboard">
                  <Button
                    variant="ghost"
                    className="w-full justify-center px-2 text-muted-foreground hover:text-primary"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Back to App</TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/dashboard">
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground hover:text-primary"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to App
              </Button>
            </Link>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
