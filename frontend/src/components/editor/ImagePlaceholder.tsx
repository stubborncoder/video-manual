"use client";

import { ImagePlus, Video, Clock } from "lucide-react";
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
}

/**
 * Renders a placeholder for an image that needs to be selected from video.
 * Used when AI suggests adding a new screenshot at a specific location.
 */
export function ImagePlaceholder({
  description,
  suggestedTimestamp,
  hasVideo = true,
  onSelectFrame,
}: ImagePlaceholderProps) {
  const t = useTranslations("imagePlaceholder");

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="my-6 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5 p-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <ImagePlus className="h-8 w-8 text-primary/60" />
        </div>

        <div className="space-y-2">
          <h4 className="font-medium text-foreground">{t("title")}</h4>
          <p className="text-sm text-muted-foreground max-w-md">
            {description}
          </p>
        </div>

        {suggestedTimestamp !== undefined && suggestedTimestamp > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/50 px-3 py-1.5 rounded-full">
            <Clock className="h-3 w-3" />
            <span>{t("suggestedTime", { time: formatTimestamp(suggestedTimestamp) })}</span>
          </div>
        )}

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
          <p className="text-xs text-muted-foreground italic">
            {t("noVideoAvailable")}
          </p>
        )}
      </div>
    </div>
  );
}

export default ImagePlaceholder;
