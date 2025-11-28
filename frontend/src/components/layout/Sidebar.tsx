"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Video,
  FileText,
  FolderKanban,
  Settings,
  LogOut,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/lib/api";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/videos", label: "Videos", icon: Video },
  { href: "/dashboard/manuals", label: "Manuals", icon: FileText },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await auth.logout();
      router.push("/");
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  return (
    <div className="flex flex-col h-full w-64 border-r bg-card">
      <div className="p-4">
        <h1 className="text-xl font-bold">Video Manual</h1>
        <p className="text-sm text-muted-foreground">Platform</p>
      </div>

      <Separator />

      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start"
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Separator />

      <div className="p-2">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
