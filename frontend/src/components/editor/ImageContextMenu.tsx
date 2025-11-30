"use client";

import { ReactNode } from "react";
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
            Open Full View
          </DropdownMenuItem>
        )}

        {hasVideo && onReplaceFromVideo && (
          <DropdownMenuItem onClick={onReplaceFromVideo}>
            <Video className="h-4 w-4 mr-2" />
            Replace from Video
          </DropdownMenuItem>
        )}

        {onUpload && (
          <DropdownMenuItem onClick={onUpload}>
            <Upload className="h-4 w-4 mr-2" />
            Upload New Image
          </DropdownMenuItem>
        )}

        {onAnnotate && (
          <DropdownMenuItem onClick={onAnnotate}>
            <Pencil className="h-4 w-4 mr-2" />
            Annotate
          </DropdownMenuItem>
        )}

        {onEditCaption && (
          <DropdownMenuItem onClick={onEditCaption}>
            <Type className="h-4 w-4 mr-2" />
            Edit Caption
          </DropdownMenuItem>
        )}

        {onAskAI && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onAskAI}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Ask AI About Image
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
              Delete Image
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ImageContextMenu;
