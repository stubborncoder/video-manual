"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGuideStore } from "@/stores/guideStore";
import { useSidebar } from "@/components/layout/SidebarContext";
import { cn } from "@/lib/utils";

/**
 * Check if the current page has another copilot agent (editor/compiler)
 * On these pages, the guide button should be on the left to avoid overlap
 */
function hasCopilotAgent(pathname: string): boolean {
  // Manual edit page has editor agent
  if (pathname.includes("/edit")) return true;
  // Compilation pages (if any dedicated routes exist)
  if (pathname.includes("/compile")) return true;
  return false;
}

/**
 * Floating button that toggles the Guide Agent panel
 * Uses shrink-fade transition when changing position (less disruptive than sliding)
 * Features a traveling shimmer effect for an "alive" feel
 */
export function GuideButton() {
  const pathname = usePathname();
  const { isOpen, hasUnread, toggle, forceLeftPosition } = useGuideStore();
  const { collapsed: sidebarCollapsed } = useSidebar();

  // Position on left side when on pages with other copilot agents
  // OR when explicitly forced (e.g., when compiler is active on projects page)
  const positionLeft = hasCopilotAgent(pathname) || forceLeftPosition;

  // Track position changes to trigger animation
  const [isVisible, setIsVisible] = useState(true);
  const [currentPosition, setCurrentPosition] = useState(positionLeft);
  const isFirstMount = useRef(true);

  // Handle position change with fade transition
  useEffect(() => {
    // Skip animation on first mount
    if (isFirstMount.current) {
      isFirstMount.current = false;
      setCurrentPosition(positionLeft);
      return;
    }

    // Only animate if position actually changed
    if (positionLeft !== currentPosition) {
      // Fade out
      setIsVisible(false);

      // After fade out, update position and fade in
      const timer = setTimeout(() => {
        setCurrentPosition(positionLeft);
        setIsVisible(true);
      }, 150); // Match exit animation duration

      return () => clearTimeout(timer);
    }
  }, [positionLeft, currentPosition]);

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key={currentPosition ? "left" : "right"}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{
            duration: 0.15,
            ease: "easeOut",
          }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "fixed bottom-6 z-[60] transition-[left] duration-200",
            // When on left side, position past the sidebar
            // Collapsed sidebar: w-16 (64px) -> left-20 (80px)
            // Expanded sidebar: w-64 (256px) -> left-72 (288px)
            currentPosition
              ? sidebarCollapsed ? "left-20" : "left-72"
              : "right-6"
          )}
        >
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20,
            }}
          >
            <Button
              onClick={(e) => {
                e.stopPropagation();
                toggle();
              }}
              size="lg"
              className={cn(
                "relative h-14 w-14 rounded-full shadow-lg overflow-hidden",
                "hover:shadow-xl",
                isOpen && "scale-95",
                hasUnread && "animate-pulse"
              )}
            >
              {/* Traveling shimmer effect */}
              <span
                className={cn(
                  "absolute inset-0 rounded-full",
                  "before:absolute before:inset-0",
                  "before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
                  "before:animate-shimmer before:-translate-x-full"
                )}
              />
              <Bot className="h-6 w-6 relative z-10" />
              {hasUnread && (
                <div
                  className={cn(
                    "absolute -top-1 h-5 w-5 z-20",
                    currentPosition ? "-left-1" : "-right-1"
                  )}
                >
                  <Badge
                    variant="destructive"
                    className="h-5 w-5 rounded-full p-0 flex items-center justify-center"
                  >
                    <span className="sr-only">Unread messages</span>
                  </Badge>
                </div>
              )}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
