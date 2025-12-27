"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Info, Lightbulb, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGuideStore } from "@/stores/guideStore";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

const iconMap = {
  info: Info,
  tip: Lightbulb,
  warning: AlertTriangle,
  success: CheckCircle,
};

const styleMap = {
  info: {
    border: "border-blue-500/50",
    bg: "bg-blue-50 dark:bg-blue-950/50",
    icon: "text-blue-500",
    header: "text-blue-700 dark:text-blue-300",
  },
  tip: {
    border: "border-amber-500/50",
    bg: "bg-amber-50 dark:bg-amber-950/50",
    icon: "text-amber-500",
    header: "text-amber-700 dark:text-amber-300",
  },
  warning: {
    border: "border-orange-500/50",
    bg: "bg-orange-50 dark:bg-orange-950/50",
    icon: "text-orange-500",
    header: "text-orange-700 dark:text-orange-300",
  },
  success: {
    border: "border-green-500/50",
    bg: "bg-green-50 dark:bg-green-950/50",
    icon: "text-green-500",
    header: "text-green-700 dark:text-green-300",
  },
};

/**
 * Modal component for displaying informational content from the guide agent.
 * Supports different visual styles (info, tip, warning, success) and
 * optional auto-close functionality.
 */
export function GuideModal() {
  const { modal, hideModal } = useGuideStore();

  // Auto-close timer
  useEffect(() => {
    if (modal?.isOpen && modal.autoClose && modal.autoClose > 0) {
      const timer = setTimeout(() => {
        hideModal();
      }, modal.autoClose);
      return () => clearTimeout(timer);
    }
  }, [modal, hideModal]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modal?.isOpen) {
        hideModal();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [modal?.isOpen, hideModal]);

  if (!modal?.isOpen) return null;

  const Icon = iconMap[modal.type];
  const styles = styleMap[modal.type];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-sm"
        onClick={hideModal}
      >
        <div className="fixed left-1/2 top-1/2 z-[71] -translate-x-1/2 -translate-y-1/2 w-full max-w-lg px-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "rounded-lg border-2 p-6 shadow-xl",
              styles.border,
              styles.bg
            )}
          >
            {/* Header */}
            <div className="flex items-start gap-4 mb-4">
              <div className={cn("shrink-0 mt-0.5", styles.icon)}>
                <Icon className="h-6 w-6" />
              </div>
              <h3 className={cn("text-lg font-semibold flex-1", styles.header)}>
                {modal.title}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={hideModal}
                className="h-8 w-8 p-0 shrink-0 -mt-1 -mr-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
              <ReactMarkdown>{modal.content}</ReactMarkdown>
            </div>

            {/* Footer */}
            <div className="mt-6 flex justify-end">
              <Button onClick={hideModal} variant="outline">
                Got it
              </Button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
