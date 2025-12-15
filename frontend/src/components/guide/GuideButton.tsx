"use client";

import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGuideStore } from "@/stores/guideStore";
import { cn } from "@/lib/utils";

/**
 * Floating button that toggles the Guide Agent panel
 * Positioned in bottom-right corner with notification badge
 */
export function GuideButton() {
  const { isOpen, hasUnread, toggle } = useGuideStore();

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <Button
        onClick={toggle}
        size="lg"
        className={cn(
          "h-14 w-14 rounded-full shadow-lg transition-all duration-200",
          "hover:scale-110 hover:shadow-xl",
          isOpen && "scale-95",
          hasUnread && "animate-pulse"
        )}
      >
        <Bot className="h-6 w-6" />
        {hasUnread && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center"
          >
            <span className="sr-only">Unread messages</span>
          </Badge>
        )}
      </Button>
    </div>
  );
}
