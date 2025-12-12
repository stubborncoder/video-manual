"use client";

import { ImagePlus, Video, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface ImagePlaceholderProps {
  /** Description of what the image should show */
  description: string;
  /** Suggested timestamp in seconds (from AI) */
  suggestedTimestamp?: number;
  /** Line number where this placeholder is in the document */
  lineNumber?: number;
  /** Whether video is available for frame selection */
  hasVideo?: boolean;
  /** Callback when user clicks to select a frame */
  onSelectFrame?: () => void;
  /** Callback when user clicks to delete the placeholder */
  onDelete?: () => void;
}

/**
 * Renders a placeholder for an image that needs to be selected from video.
 * Used when AI suggests adding a new screenshot at a specific location.
 *
 * Note: Uses <span> elements with block display instead of <div> to avoid
 * hydration errors when ReactMarkdown renders this inside a <p> tag.
 */
export function ImagePlaceholder({
  description,
  suggestedTimestamp,
  hasVideo = true,
  onSelectFrame,
  onDelete,
}: ImagePlaceholderProps) {
  const t = useTranslations("imagePlaceholder");

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <span className="block my-6 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5 p-6 text-center">
      <span className="flex flex-col items-center gap-4">
        <span className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <ImagePlus className="h-8 w-8 text-primary/60" />
        </span>

        <span className="block space-y-2">
          <strong className="block font-medium text-foreground">{t("title")}</strong>
          <span className="block text-sm text-muted-foreground max-w-md">
            {description}
          </span>
        </span>

        {suggestedTimestamp !== undefined && suggestedTimestamp > 0 && (
          <span className="flex items-center gap-2 text-xs text-muted-foreground bg-background/50 px-3 py-1.5 rounded-full">
            <Clock className="h-3 w-3" />
            <span>{t("suggestedTime", { time: formatTimestamp(suggestedTimestamp) })}</span>
          </span>
        )}

        <span className="flex items-center gap-2">
          {hasVideo ? (
            <Button
              variant="default"
              size="sm"
              onClick={onSelectFrame}
              className="gap-2"
            >
              <Video className="h-4 w-4" />
              {t("selectFrame")}
            </Button>
          ) : (
            <span className="block text-xs text-muted-foreground italic">
              {t("noVideoAvailable")}
            </span>
          )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              {t("delete")}
            </Button>
          )}
        </span>
      </span>
    </span>
  );
}

export default ImagePlaceholder;
