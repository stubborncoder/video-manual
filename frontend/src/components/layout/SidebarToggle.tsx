"use client";

import { PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebar } from "./SidebarContext";
import { cn } from "@/lib/utils";

interface SidebarToggleProps {
  className?: string;
}

export function SidebarToggle({ className }: SidebarToggleProps) {
  const { collapsed, toggleCollapsed } = useSidebar();

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleCollapsed}
            className={cn(
              "h-7 w-7 rounded-md border-border/50 bg-background/80 backdrop-blur-sm shadow-sm hover:bg-accent hover:border-border",
              className
            )}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4 text-muted-foreground" />
            ) : (
              <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {collapsed ? "Expand" : "Collapse"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
