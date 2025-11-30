"use client";

import { X, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ImageContext {
  url: string;
  name: string;
}

interface ImageContextChipProps {
  imageContext: ImageContext;
  onClear: () => void;
}

/**
 * Displays the current image context as a chip in the chat input area
 */
export function ImageContextChip({ imageContext, onClear }: ImageContextChipProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="shrink-0 w-10 h-10 rounded overflow-hidden border cursor-help">
                <img
                  src={imageContext.url}
                  alt={imageContext.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="p-0" align="start">
              <img
                src={imageContext.url}
                alt={imageContext.name}
                className="max-w-[200px] max-h-[200px] object-contain"
              />
            </TooltipContent>
          </Tooltip>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Image className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">
                Image attached
              </span>
            </div>
            <p className="text-sm text-foreground/80 truncate">
              {imageContext.name}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-6 w-6 p-0 shrink-0 hover:bg-primary/20"
        >
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Clear image</span>
        </Button>
      </div>
    </TooltipProvider>
  );
}

export default ImageContextChip;
