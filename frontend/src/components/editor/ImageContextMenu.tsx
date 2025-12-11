"use client";

import { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Video, Upload, Pencil, Type, Trash2, Maximize2, MessageSquare } from "lucide-react";

interface ImageContextMenuProps {
  children: ReactNode;
  /** Whether video replacement is available */
  hasVideo?: boolean;
  /** Called when "Replace from Video" is clicked */
  onReplaceFromVideo?: () => void;
  /** Called when "Upload" is clicked */
  onUpload?: () => void;
  /** Called when "Annotate" is clicked */
  onAnnotate?: () => void;
  /** Called when "Edit Caption" is clicked */
  onEditCaption?: () => void;
  /** Called when "Delete" is clicked */
  onDelete?: () => void;
  /** Called when "Open Full" is clicked (opens lightbox) */
  onOpenFull?: () => void;
  /** Called when "Ask AI" is clicked */
  onAskAI?: () => void;
}

/**
 * Context menu for image actions in the manual editor.
 * Wraps an image and provides quick access to common actions.
 */
export function ImageContextMenu({
  children,
  hasVideo = false,
  onReplaceFromVideo,
  onUpload,
  onAnnotate,
  onEditCaption,
  onDelete,
  onOpenFull,
  onAskAI,
}: ImageContextMenuProps) {
  const t = useTranslations("imageContextMenu");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        side="bottom"
        sideOffset={-200}
        avoidCollisions={false}
        className="w-48 translate-x-[100px]"
      >
        {onOpenFull && (
          <DropdownMenuItem onClick={onOpenFull}>
            <Maximize2 className="h-4 w-4 mr-2" />
            {t("openFull")}
          </DropdownMenuItem>
        )}

        {hasVideo && onReplaceFromVideo && (
          <DropdownMenuItem onClick={onReplaceFromVideo}>
            <Video className="h-4 w-4 mr-2" />
            {t("replaceFromVideo")}
          </DropdownMenuItem>
        )}

        {onUpload && (
          <DropdownMenuItem onClick={onUpload}>
            <Upload className="h-4 w-4 mr-2" />
            {t("uploadImage")}
          </DropdownMenuItem>
        )}

        {onAnnotate && (
          <DropdownMenuItem onClick={onAnnotate}>
            <Pencil className="h-4 w-4 mr-2" />
            {t("annotate")}
          </DropdownMenuItem>
        )}

        {onEditCaption && (
          <DropdownMenuItem onClick={onEditCaption}>
            <Type className="h-4 w-4 mr-2" />
            {t("editCaption")}
          </DropdownMenuItem>
        )}

        {onAskAI && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onAskAI}>
              <MessageSquare className="h-4 w-4 mr-2" />
              {t("askAI")}
            </DropdownMenuItem>
          </>
        )}

        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t("delete")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ImageContextMenu;
