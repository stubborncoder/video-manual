"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface AlphaBadgeProps {
  className?: string;
}

/**
 * Alpha badge component shown during alpha release phase.
 * Displays version info and links to bug tracker.
 */
export function AlphaBadge({ className }: AlphaBadgeProps) {
  const t = useTranslations("common");
  const version = "0.1.0-alpha.1";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "cursor-help font-mono text-xs",
            "bg-gradient-to-r from-amber-500/10 to-orange-500/10",
            "border-amber-500/30 text-amber-600 dark:text-amber-400",
            "hover:border-amber-500/50 hover:from-amber-500/15 hover:to-orange-500/15",
            "transition-all duration-200",
            className
          )}
        >
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
          v{version}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="space-y-1">
          <p className="font-semibold">{t("alphaVersion")}</p>
          <p className="text-xs opacity-80">
            {t("alphaDescription")}
          </p>
          <p className="text-xs font-mono opacity-70">v{version}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
