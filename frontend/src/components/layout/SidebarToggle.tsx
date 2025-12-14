"use client";

import { PanelLeftClose, PanelLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebar } from "./SidebarContext";
import { cn } from "@/lib/utils";

interface SidebarToggleProps {
  className?: string;
}

export function SidebarToggle({ className }: SidebarToggleProps) {
  const { collapsed, toggleCollapsed } = useSidebar();
  const t = useTranslations("sidebar");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          onClick={toggleCollapsed}
          className={cn(
            "cursor-pointer text-primary hover:text-primary/70 transition-colors",
            className
          )}
        >
          {collapsed ? (
            <PanelLeft className="h-6 w-6" />
          ) : (
            <PanelLeftClose className="h-6 w-6" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {collapsed ? t("expand") : t("collapse")}
      </TooltipContent>
    </Tooltip>
  );
}
