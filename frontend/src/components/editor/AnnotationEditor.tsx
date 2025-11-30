"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Canvas, FabricImage, Rect, Ellipse, Line, Triangle, Group, IText, FabricObject, TPointerEvent, TPointerEventInfo, PencilBrush, InteractiveFabricObject } from "fabric";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import { AnnotationToolbar, AnnotationTool } from "./AnnotationToolbar";

interface AnnotationEditorProps {
  /** URL of the image to annotate */
  imageUrl: string;
  /** Callback when annotations are saved */
  onSave: (dataUrl: string) => void;
  /** Callback when annotation is cancelled */
  onCancel: () => void;
}

/**
 * Canvas-based image annotation editor using Fabric.js v6
 */
export function AnnotationEditor({
  imageUrl,
  onSave,
  onCancel,
}: AnnotationEditorProps) {
  console.log("[AnnotationEditor] Component rendering, imageUrl:", imageUrl);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<Canvas | null>(null);

  // Tool state
  const [activeTool, setActiveTool] = useState<AnnotationTool>("arrow");
  const [strokeColor, setStrokeColor] = useState("#FF0000");
  const [strokeWidth, setStrokeWidth] = useState(3);

  // Undo/redo state
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Crop state
  const [cropRect, setCropRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const cropRectRef = useRef<Rect | null>(null);

  // Original image state for high-res cropping
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const scaleFactorRef = useRef<number>(1);

  // Drawing state
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const currentShapeRef = useRef<FabricObject | null>(null);

  // Save canvas state for undo
  const saveState = useCallback(() => {
    if (!fabricRef.current) return;
    const json = JSON.stringify(fabricRef.current.toJSON());
    setUndoStack((prev) => [...prev.slice(-20), json]); // Keep last 20 states
    setRedoStack([]);
  }, []);

  // Initialize Fabric.js canvas
  useEffect(() => {
    console.log("[AnnotationEditor] useEffect running, refs:", {
      canvasRef: !!canvasRef.current,
      containerRef: !!containerRef.current,
    });

    if (!canvasRef.current || !containerRef.current) {
      console.log("[AnnotationEditor] Refs not ready, skipping init");
      return;
    }

    const container = containerRef.current;
    let canvas: Canvas | null = null;
    let isMounted = true;

    const initCanvas = async () => {
      console.log("[AnnotationEditor] initCanvas starting");
      try {
        canvas = new Canvas(canvasRef.current!, {
          selection: true,
          preserveObjectStacking: true,
        });
        fabricRef.current = canvas;
        console.log("[AnnotationEditor] Canvas created successfully");

        // Initialize pencil brush for freehand drawing
        canvas.freeDrawingBrush = new PencilBrush(canvas);
        canvas.freeDrawingBrush.color = "#FF0000";
        canvas.freeDrawingBrush.width = 3;

        // Configure control styles for better visibility
        InteractiveFabricObject.ownDefaults.cornerColor = "#00ff00";
        InteractiveFabricObject.ownDefaults.cornerStrokeColor = "#000000";
        InteractiveFabricObject.ownDefaults.cornerSize = 12;
        InteractiveFabricObject.ownDefaults.cornerStyle = "circle";
        InteractiveFabricObject.ownDefaults.transparentCorners = false;
        InteractiveFabricObject.ownDefaults.borderColor = "#00ff00";
        InteractiveFabricObject.ownDefaults.borderScaleFactor = 2;

        // Load image using HTML Image element for better compatibility
        const htmlImg = new Image();
        htmlImg.crossOrigin = "anonymous";

        htmlImg.onload = () => {
          if (!isMounted || !canvas || !containerRef.current) return;

          console.log("[AnnotationEditor] Image loaded:", htmlImg.width, "x", htmlImg.height);

          // Store original image for high-res cropping
          originalImageRef.current = htmlImg;

          // Create FabricImage from loaded HTML image
          const img = new FabricImage(htmlImg);

          // Get available space (use window dimensions as fallback)
          const containerWidth = Math.max(containerRef.current.clientWidth - 32, window.innerWidth * 0.8);
          const containerHeight = Math.max(containerRef.current.clientHeight - 150, window.innerHeight * 0.6);
          const imgWidth = img.width || 800;
          const imgHeight = img.height || 600;

          console.log("[AnnotationEditor] Container:", containerWidth, "x", containerHeight);

          // Calculate scale to fit container while maintaining aspect ratio
          // Allow scaling up to fill available space
          const scaleX = containerWidth / imgWidth;
          const scaleY = containerHeight / imgHeight;
          const scale = Math.min(scaleX, scaleY);

          // Store scale factor for high-res cropping
          scaleFactorRef.current = scale;

          const canvasWidth = imgWidth * scale;
          const canvasHeight = imgHeight * scale;

          console.log("[AnnotationEditor] Canvas dimensions:", canvasWidth, "x", canvasHeight, "scale:", scale);

          canvas.setDimensions({ width: canvasWidth, height: canvasHeight });

          // Set background image with scaling
          img.scaleX = scale;
          img.scaleY = scale;
          canvas.backgroundImage = img;
          canvas.renderAll();

          setIsLoading(false);
        };

        htmlImg.onerror = (error) => {
          console.error("[AnnotationEditor] Failed to load image:", error, "URL:", imageUrl);
          if (isMounted) {
            setIsLoading(false);
          }
        };

        // Ensure absolute URL for image loading
        const absoluteUrl = imageUrl.startsWith("http") ? imageUrl : window.location.origin + imageUrl;
        console.log("[AnnotationEditor] Loading image from:", absoluteUrl);
        htmlImg.src = absoluteUrl;
      } catch (error) {
        console.error("[AnnotationEditor] Error in initCanvas:", error);
        setIsLoading(false);
      }
    };

    initCanvas();

    return () => {
      isMounted = false;
      if (canvas) {
        canvas.dispose();
      }
      fabricRef.current = null;
    };
  }, [imageUrl]);

  // Handle tool change effects
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Clear crop selection when changing tools
    if (activeTool !== "crop" && cropRectRef.current) {
      canvas.remove(cropRectRef.current);
      cropRectRef.current = null;
      setCropRect(null);
    }

    // Reset drawing mode
    canvas.isDrawingMode = activeTool === "freehand";
    canvas.selection = activeTool === "select";

    if (activeTool === "freehand" && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = strokeColor;
      canvas.freeDrawingBrush.width = strokeWidth;
    }

    // Update cursor
    if (activeTool === "select") {
      canvas.defaultCursor = "default";
      canvas.hoverCursor = "move";
    } else if (activeTool === "text") {
      canvas.defaultCursor = "text";
      canvas.hoverCursor = "text";
    } else if (activeTool === "crop") {
      canvas.defaultCursor = "crosshair";
      canvas.hoverCursor = "crosshair";
    } else {
      canvas.defaultCursor = "crosshair";
      canvas.hoverCursor = "crosshair";
    }
  }, [activeTool, strokeColor, strokeWidth]);

  // Mouse down handler for drawing shapes
  const handleMouseDown = useCallback(
    (e: TPointerEventInfo<TPointerEvent>) => {
      const canvas = fabricRef.current;
      if (!canvas || activeTool === "select" || activeTool === "freehand") return;

      const pointer = canvas.getScenePoint(e.e);
      isDrawingRef.current = true;
      startPointRef.current = { x: pointer.x, y: pointer.y };

      // Handle crop tool
      if (activeTool === "crop") {
        // Remove existing crop rect
        if (cropRectRef.current) {
          canvas.remove(cropRectRef.current);
        }

        const cropSelection = new Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: "rgba(0, 150, 255, 0.2)",
          stroke: "#0096ff",
          strokeWidth: 2,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
        });
        canvas.add(cropSelection);
        cropRectRef.current = cropSelection;
        currentShapeRef.current = cropSelection;
        return;
      }

      if (activeTool === "text") {
        // Add text at click position
        const text = new IText("Text", {
          left: pointer.x,
          top: pointer.y,
          fontSize: 24,
          fill: strokeColor,
          fontFamily: "Arial",
          hasControls: true,
          hasBorders: true,
          cornerColor: "#00ff00",
          cornerStrokeColor: "#000000",
          cornerSize: 12,
          cornerStyle: "circle",
          transparentCorners: false,
          borderColor: "#00ff00",
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        isDrawingRef.current = false;
        saveState();
        return;
      }

      // Create initial shape with controls enabled
      let shape: FabricObject | null = null;

      // Common control settings for all shapes
      const controlSettings = {
        hasControls: true,
        hasBorders: true,
        selectable: true,
        cornerColor: "#00ff00",
        cornerStrokeColor: "#000000",
        cornerSize: 12,
        cornerStyle: "circle" as const,
        transparentCorners: false,
        borderColor: "#00ff00",
      };

      switch (activeTool) {
        case "rect":
          shape = new Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: "transparent",
            strokeUniform: true,
            ...controlSettings,
          });
          break;
        case "circle":
          shape = new Ellipse({
            left: pointer.x,
            top: pointer.y,
            rx: 0,
            ry: 0,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: "transparent",
            strokeUniform: true,
            originX: "center",
            originY: "center",
            ...controlSettings,
          });
          break;
        case "arrow":
          // Start with a line, will add arrowhead on mouse up
          shape = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            strokeUniform: true,
            ...controlSettings,
          });
          break;
      }

      if (shape) {
        canvas.add(shape);
        currentShapeRef.current = shape;
      }
    },
    [activeTool, strokeColor, strokeWidth, saveState]
  );

  // Mouse move handler for drawing shapes
  const handleMouseMove = useCallback(
    (e: TPointerEventInfo<TPointerEvent>) => {
      const canvas = fabricRef.current;
      if (
        !canvas ||
        !isDrawingRef.current ||
        !startPointRef.current ||
        !currentShapeRef.current
      )
        return;

      const pointer = canvas.getScenePoint(e.e);
      const startX = startPointRef.current.x;
      const startY = startPointRef.current.y;

      switch (activeTool) {
        case "rect": {
          const rect = currentShapeRef.current as Rect;
          const width = pointer.x - startX;
          const height = pointer.y - startY;
          rect.set({
            left: width > 0 ? startX : pointer.x,
            top: height > 0 ? startY : pointer.y,
            width: Math.abs(width),
            height: Math.abs(height),
          });
          break;
        }
        case "circle": {
          const ellipse = currentShapeRef.current as Ellipse;
          const rx = Math.abs(pointer.x - startX) / 2;
          const ry = Math.abs(pointer.y - startY) / 2;
          ellipse.set({
            left: (startX + pointer.x) / 2,
            top: (startY + pointer.y) / 2,
            rx,
            ry,
          });
          break;
        }
        case "arrow": {
          const line = currentShapeRef.current as Line;
          line.set({ x2: pointer.x, y2: pointer.y });
          break;
        }
        case "crop": {
          const cropSelection = currentShapeRef.current as Rect;
          const width = pointer.x - startX;
          const height = pointer.y - startY;
          cropSelection.set({
            left: width > 0 ? startX : pointer.x,
            top: height > 0 ? startY : pointer.y,
            width: Math.abs(width),
            height: Math.abs(height),
          });
          break;
        }
      }

      canvas.renderAll();
    },
    [activeTool]
  );

  // Mouse up handler for completing shapes
  const handleMouseUp = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || !isDrawingRef.current) return;

    isDrawingRef.current = false;

    // Convert line to arrow with arrowhead
    if (activeTool === "arrow" && currentShapeRef.current) {
      const line = currentShapeRef.current as Line;
      const x1 = line.x1 || 0;
      const y1 = line.y1 || 0;
      const x2 = line.x2 || 0;
      const y2 = line.y2 || 0;

      // Only create arrow if line has length
      if (Math.abs(x2 - x1) > 5 || Math.abs(y2 - y1) > 5) {
        // Calculate arrowhead
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLength = 15 + strokeWidth * 2;

        // Remove the temporary line
        canvas.remove(line);

        // Create fresh line for the group (reusing removed objects can cause issues)
        const arrowLine = new Line([x1, y1, x2, y2], {
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          strokeUniform: true,
        });

        const triangle = new Triangle({
          left: x2,
          top: y2,
          width: headLength,
          height: headLength,
          fill: strokeColor,
          angle: (angle * 180) / Math.PI + 90,
          originX: "center",
          originY: "center",
        });

        // Group line and triangle
        const group = new Group([arrowLine, triangle], {
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          cornerColor: "#00ff00",
          cornerStrokeColor: "#000000",
          cornerSize: 12,
          cornerStyle: "circle",
          transparentCorners: false,
          borderColor: "#00ff00",
        });
        canvas.add(group);
      } else {
        // Remove tiny line
        canvas.remove(line);
      }
    }

    // Handle crop tool completion
    if (activeTool === "crop" && cropRectRef.current) {
      const rect = cropRectRef.current;
      const width = rect.width || 0;
      const height = rect.height || 0;

      if (width > 10 && height > 10) {
        // Set crop state to show confirm button
        setCropRect({
          left: rect.left || 0,
          top: rect.top || 0,
          width,
          height,
        });
      } else {
        // Remove tiny selection
        canvas.remove(rect);
        cropRectRef.current = null;
        setCropRect(null);
      }
      currentShapeRef.current = null;
      startPointRef.current = null;
      canvas.renderAll();
      return; // Don't save state for crop selection
    }

    currentShapeRef.current = null;
    startPointRef.current = null;
    saveState();
    canvas.renderAll();
  }, [activeTool, strokeColor, strokeWidth, saveState]);

  // Attach canvas event listeners
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);

    // Save state after freehand drawing
    canvas.on("path:created", saveState);

    // Save state after object modified
    canvas.on("object:modified", saveState);

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
      canvas.off("path:created", saveState);
      canvas.off("object:modified", saveState);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, saveState]);

  // Undo handler
  const handleUndo = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas || undoStack.length === 0) return;

    const currentState = JSON.stringify(canvas.toJSON());
    setRedoStack((prev) => [...prev, currentState]);

    const prevState = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    await canvas.loadFromJSON(JSON.parse(prevState));
    canvas.renderAll();
  }, [undoStack]);

  // Redo handler
  const handleRedo = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas || redoStack.length === 0) return;

    const currentState = JSON.stringify(canvas.toJSON());
    setUndoStack((prev) => [...prev, currentState]);

    const nextState = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));

    await canvas.loadFromJSON(JSON.parse(nextState));
    canvas.renderAll();
  }, [redoStack]);

  // Apply crop
  const handleApplyCrop = useCallback(() => {
    const canvas = fabricRef.current;
    const originalImage = originalImageRef.current;
    if (!canvas || !cropRect || !originalImage) return;

    // Remove crop selection rectangle
    if (cropRectRef.current) {
      canvas.remove(cropRectRef.current);
      cropRectRef.current = null;
    }

    // Get the crop area in canvas coordinates
    const { left, top, width, height } = cropRect;
    const scale = scaleFactorRef.current;

    // Convert to original image coordinates
    const origLeft = Math.round(left / scale);
    const origTop = Math.round(top / scale);
    const origWidth = Math.round(width / scale);
    const origHeight = Math.round(height / scale);

    console.log("[AnnotationEditor] Crop at original resolution:", origWidth, "x", origHeight);

    // Create offscreen canvas for high-res cropping
    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = origWidth;
    offscreenCanvas.height = origHeight;
    const ctx = offscreenCanvas.getContext("2d");

    if (!ctx) {
      console.error("[AnnotationEditor] Could not get 2D context");
      return;
    }

    // Draw cropped portion of original image
    ctx.drawImage(
      originalImage,
      origLeft, origTop, origWidth, origHeight,  // Source rectangle
      0, 0, origWidth, origHeight                 // Destination rectangle
    );

    // Get high-res cropped image as data URL
    const croppedDataUrl = offscreenCanvas.toDataURL("image/png", 1);

    // Load cropped image as new background
    const htmlImg = new Image();
    htmlImg.crossOrigin = "anonymous";
    htmlImg.onload = () => {
      // Store as new original image
      originalImageRef.current = htmlImg;

      // Clear all objects
      canvas.clear();

      // Calculate new scale for the cropped image
      const containerWidth = Math.max(containerRef.current?.clientWidth || window.innerWidth * 0.8 - 32, window.innerWidth * 0.8);
      const containerHeight = Math.max((containerRef.current?.clientHeight || window.innerHeight * 0.6) - 150, window.innerHeight * 0.6);
      const newScaleX = containerWidth / htmlImg.width;
      const newScaleY = containerHeight / htmlImg.height;
      const newScale = Math.min(newScaleX, newScaleY);

      // Update scale factor
      scaleFactorRef.current = newScale;

      // Create new FabricImage
      const img = new FabricImage(htmlImg);
      img.scaleX = newScale;
      img.scaleY = newScale;

      // Set new canvas dimensions
      canvas.setDimensions({
        width: htmlImg.width * newScale,
        height: htmlImg.height * newScale
      });

      // Set as background
      canvas.backgroundImage = img;
      canvas.renderAll();

      // Reset crop state
      setCropRect(null);
      saveState();
    };
    htmlImg.src = croppedDataUrl;
  }, [cropRect, saveState]);

  // Cancel crop
  const handleCancelCrop = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    if (cropRectRef.current) {
      canvas.remove(cropRectRef.current);
      cropRectRef.current = null;
    }
    setCropRect(null);
    canvas.renderAll();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in text
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      )
        return;

      const canvas = fabricRef.current;

      // Check if we're editing text in fabric
      const activeObject = canvas?.getActiveObject();
      if (activeObject && activeObject.type === "i-text" && (activeObject as IText).isEditing) {
        // Only handle Escape in text editing mode
        if (e.key === "Escape") {
          (activeObject as IText).exitEditing();
          canvas?.renderAll();
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case "escape":
          onCancel();
          break;
        case "v":
          setActiveTool("select");
          break;
        case "a":
          setActiveTool("arrow");
          break;
        case "r":
          setActiveTool("rect");
          break;
        case "c":
          setActiveTool("circle");
          break;
        case "t":
          setActiveTool("text");
          break;
        case "p":
          setActiveTool("freehand");
          break;
        case "x":
          setActiveTool("crop");
          break;
        case "delete":
        case "backspace":
          if (canvas && activeObject) {
            canvas.remove(activeObject);
            canvas.renderAll();
            saveState();
          }
          break;
        case "z":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleUndo();
          }
          break;
        case "y":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleRedo();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, saveState, handleUndo, handleRedo]);

  // Save handler
  const handleSave = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    setIsSaving(true);

    try {
      // Deselect all objects to hide selection handles
      canvas.discardActiveObject();
      canvas.renderAll();

      // Export as PNG data URL
      const dataUrl = canvas.toDataURL({
        format: "png",
        quality: 1,
        multiplier: 1 / (canvas.getZoom() || 1), // Ensure original resolution
      });

      onSave(dataUrl);
    } catch (error) {
      console.error("Failed to save annotation:", error);
    } finally {
      setIsSaving(false);
    }
  }, [onSave]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
    >
      {/* Top bar with save/cancel */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50">
        <div className="text-white font-medium">Annotate Image</div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="text-white hover:bg-white/20"
            disabled={isSaving}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-primary hover:bg-primary/90"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Canvas container */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-4 relative">
        {/* Always render canvas so ref is available */}
        <canvas ref={canvasRef} className="rounded-lg shadow-2xl" />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="flex items-center gap-2 text-white">
              <Loader2 className="h-6 w-6 animate-spin" />
              Loading image...
            </div>
          </div>
        )}

        {/* Crop confirmation overlay */}
        {cropRect && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/80 px-4 py-2 rounded-lg">
            <span className="text-white text-sm mr-2">
              {Math.round(cropRect.width)} × {Math.round(cropRect.height)}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCancelCrop}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApplyCrop}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Check className="h-4 w-4 mr-1" />
              Apply Crop
            </Button>
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className="flex justify-center pb-4">
        <AnnotationToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          strokeColor={strokeColor}
          onStrokeColorChange={setStrokeColor}
          strokeWidth={strokeWidth}
          onStrokeWidthChange={setStrokeWidth}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={undoStack.length > 1}
          canRedo={redoStack.length > 0}
        />
      </div>
    </div>
  );
}

export default AnnotationEditor;
