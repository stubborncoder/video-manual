/**
 * Semantic tag parser utilities for document formats.
 *
 * Parses content containing markdown wrapped in semantic XML tags.
 * Used for:
 * - Stripping tags for web view rendering
 * - Getting tag positions for syntax highlighting
 * - Identifying collapsible regions in the editor
 */

export interface TaggedBlock {
  tagName: string;
  content: string;
  attributes: Record<string, string>;
  startPos: number;
  endPos: number;
}

export interface TagPosition {
  tagName: string;
  isOpening: boolean;
  startPos: number;
  endPos: number;
  attributes: Record<string, string>;
  line: number;
  column: number;
}

export interface CollapsibleRegion {
  tagName: string;
  label: string;
  startLine: number;
  endLine: number;
  startPos: number;
  endPos: number;
  isCollapsed: boolean;
}

// Regex patterns for tag parsing
const OPENING_TAG_REGEX = /<(\w+)(\s+[^>]*)?>/g;
const CLOSING_TAG_REGEX = /<\/(\w+)>/g;
const ATTRIBUTE_REGEX = /(\w+)=["']([^"']*)["']/g;
// Using [\s\S] instead of . with 's' flag for cross-browser compatibility
const TAG_BLOCK_REGEX = /<(\w+)(\s+[^>]*)?>([\s\S]+?)<\/\1>/g;

/**
 * Parse attribute string into object.
 */
function parseAttributes(attrString: string | undefined): Record<string, string> {
  if (!attrString) return {};

  const attrs: Record<string, string> = {};
  let match;
  const regex = new RegExp(ATTRIBUTE_REGEX.source, "g");

  while ((match = regex.exec(attrString)) !== null) {
    attrs[match[1]] = match[2];
  }

  return attrs;
}

/**
 * Remove semantic tags, keeping only the markdown content.
 *
 * Used for web view rendering where we want clean markdown
 * without any XML-like tags visible.
 */
export function stripSemanticTags(content: string): string {
  // Remove opening tags with optional attributes
  let result = content.replace(/<\w+(\s+[^>]*)?>/g, "");
  // Remove closing tags
  result = result.replace(/<\/\w+>/g, "");
  // Clean up extra blank lines
  result = result.replace(/\n{3,}/g, "\n\n");
  return result.trim();
}

/**
 * Transform semantic tags for preview, converting tags to visible styled labels.
 *
 * This allows users to see semantic structure that matches what the AI agent references.
 * Each tag type gets its own color-coded badge with a gradient line.
 */
export function transformSemanticTagsForPreview(content: string): string {
  // Tag styling configuration
  const tagStyles: Record<string, { color: string; label: string }> = {
    step: { color: "#8b5cf6", label: "Step" },           // Purple
    introduction: { color: "#0ea5e9", label: "Introduction" }, // Sky blue
    conclusion: { color: "#10b981", label: "Conclusion" },     // Emerald
    note: { color: "#f59e0b", label: "Note" },                 // Amber
    keypoint: { color: "#ec4899", label: "Key Point" },        // Pink
    tip: { color: "#14b8a6", label: "Tip" },                   // Teal
    warning: { color: "#ef4444", label: "Warning" },           // Red
    overview: { color: "#6366f1", label: "Overview" },         // Indigo
    section: { color: "#8b5cf6", label: "Section" },           // Purple
    definition: { color: "#0891b2", label: "Definition" },     // Cyan
    finding: { color: "#7c3aed", label: "Finding" },           // Violet
    summary: { color: "#059669", label: "Summary" },           // Green
  };

  // Store badges with unique IDs to preserve order
  const badges: Map<string, string> = new Map();
  let badgeId = 0;

  const knownTags = Object.keys(tagStyles).join("|");
  let stepCount = 0;

  // Single pass: replace all opening tags in document order with unique placeholders
  let result = content.replace(
    new RegExp(`<(${knownTags})(\\s+[^>]*)?>`, "gi"),
    (match, tagName, attrs) => {
      const tagLower = tagName.toLowerCase();
      const style = tagStyles[tagLower];
      if (!style) return "";

      let label = style.label;
      let color = style.color;

      // Handle step numbering
      if (tagLower === "step") {
        stepCount++;
        const numberMatch = attrs?.match(/number=["'](\d+)["']/);
        const stepNum = numberMatch ? numberMatch[1] : stepCount;
        label = `Step ${stepNum}`;
      }
      // Handle other numbered tags
      else if (attrs) {
        const numberMatch = attrs.match(/number=["'](\d+)["']/);
        if (numberMatch) {
          label = `${style.label} ${numberMatch[1]}`;
        }
        // Handle note types
        const typeMatch = attrs.match(/type=["'](\w+)["']/);
        if (typeMatch && tagLower === "note") {
          const noteType = typeMatch[1];
          if (noteType === "warning") {
            label = "Warning";
            color = "#ef4444";
          } else if (noteType === "tip") {
            label = "Tip";
            color = "#14b8a6";
          } else if (noteType === "info") {
            label = "Info";
            color = "#3b82f6";
          }
        }
        // Handle section titles
        const titleMatch = attrs.match(/title=["']([^"']+)["']/);
        if (titleMatch) {
          label = titleMatch[1];
        }
      }

      const badge = `<div style="display:flex;align-items:center;gap:12px;margin:20px 0 12px 0;"><span style="display:inline-block;background:${color};color:white;font-size:12px;font-weight:600;padding:4px 12px;border-radius:12px;white-space:nowrap;">${label}</span><div style="flex:1;height:1px;background:linear-gradient(to right,${color},transparent);"></div></div>`;

      const placeholder = `___BADGE_${badgeId}___`;
      badges.set(placeholder, badge);
      badgeId++;

      return `\n${placeholder}\n\n`;
    }
  );

  // Remove closing tags for known semantic tags
  result = result.replace(new RegExp(`</(${knownTags})>`, "gi"), "");

  // Strip title tags without badge (title is usually the document heading)
  result = result.replace(/<title(\s+[^>]*)?>/gi, "");
  result = result.replace(/<\/title>/gi, "");

  // Strip any remaining unknown semantic tags
  result = result.replace(/<\w+(\s+[^>]*)?>/g, "");
  result = result.replace(/<\/\w+>/g, "");

  // Restore badges from placeholders
  for (const [placeholder, badge] of badges) {
    result = result.replace(placeholder, badge);
  }

  // Clean up extra blank lines
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

/**
 * Parse content into a list of tagged blocks.
 *
 * Used for extracting structured content for processing.
 */
export function parseSemanticTags(content: string): TaggedBlock[] {
  const blocks: TaggedBlock[] = [];
  const regex = new RegExp(TAG_BLOCK_REGEX.source, "g");

  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      tagName: match[1],
      content: match[3].trim(),
      attributes: parseAttributes(match[2]),
      startPos: match.index,
      endPos: match.index + match[0].length,
    });
  }

  return blocks;
}

/**
 * Convert character position to line and column.
 */
function posToLineCol(
  content: string,
  pos: number
): { line: number; column: number } {
  const lines = content.slice(0, pos).split("\n");
  return {
    line: lines.length,
    column: (lines[lines.length - 1]?.length || 0) + 1,
  };
}

/**
 * Get positions of all tags for syntax highlighting.
 *
 * Returns both opening and closing tags with their positions.
 */
export function getTagPositions(content: string): TagPosition[] {
  const positions: TagPosition[] = [];

  // Find opening tags
  const openRegex = new RegExp(OPENING_TAG_REGEX.source, "g");
  let match;

  while ((match = openRegex.exec(content)) !== null) {
    const { line, column } = posToLineCol(content, match.index);
    positions.push({
      tagName: match[1],
      isOpening: true,
      startPos: match.index,
      endPos: match.index + match[0].length,
      attributes: parseAttributes(match[2]),
      line,
      column,
    });
  }

  // Find closing tags
  const closeRegex = new RegExp(CLOSING_TAG_REGEX.source, "g");

  while ((match = closeRegex.exec(content)) !== null) {
    const { line, column } = posToLineCol(content, match.index);
    positions.push({
      tagName: match[1],
      isOpening: false,
      startPos: match.index,
      endPos: match.index + match[0].length,
      attributes: {},
      line,
      column,
    });
  }

  // Sort by position
  positions.sort((a, b) => a.startPos - b.startPos);
  return positions;
}

/**
 * Generate a human-readable label for a tag.
 */
function getTagLabel(
  tagName: string,
  attributes: Record<string, string>
): string {
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  switch (tagName) {
    case "step":
      return attributes.number ? `Step ${attributes.number}` : "Step";
    case "note":
      return attributes.type
        ? `Note: ${capitalize(attributes.type)}`
        : "Note";
    case "keypoint":
      return attributes.number
        ? `Key Point ${attributes.number}`
        : "Key Point";
    case "finding":
      return attributes.number ? `Finding ${attributes.number}` : "Finding";
    default:
      return capitalize(tagName);
  }
}

/**
 * Get collapsible regions for the editor.
 *
 * Each semantic tag block becomes a collapsible region with a label.
 */
export function getCollapsibleRegions(content: string): CollapsibleRegion[] {
  const regions: CollapsibleRegion[] = [];
  const lines = content.split("\n");

  // Build line start positions
  const lineStarts: number[] = [0];
  for (let i = 0; i < lines.length; i++) {
    lineStarts.push(lineStarts[i] + lines[i].length + 1);
  }

  // Find position to line number
  const posToLine = (pos: number): number => {
    for (let i = 0; i < lineStarts.length - 1; i++) {
      if (pos >= lineStarts[i] && pos < lineStarts[i + 1]) {
        return i + 1;
      }
    }
    return lines.length;
  };

  const blocks = parseSemanticTags(content);

  for (const block of blocks) {
    regions.push({
      tagName: block.tagName,
      label: getTagLabel(block.tagName, block.attributes),
      startLine: posToLine(block.startPos),
      endLine: posToLine(block.endPos),
      startPos: block.startPos,
      endPos: block.endPos,
      isCollapsed: false,
    });
  }

  return regions;
}

/**
 * Extract all content from tags with the given name.
 */
export function extractTagContent(content: string, tagName: string): string[] {
  const blocks = parseSemanticTags(content);
  return blocks
    .filter((block) => block.tagName === tagName)
    .map((block) => block.content);
}

/**
 * Get the title from content.
 */
export function getTitle(content: string): string | null {
  const titles = extractTagContent(content, "title");
  return titles[0] || null;
}

/**
 * Get numbered steps from content.
 */
export function getSteps(content: string): Array<{ number: number; content: string }> {
  const blocks = parseSemanticTags(content);
  const steps: Array<{ number: number; content: string }> = [];

  let stepCount = 0;
  for (const block of blocks) {
    if (block.tagName === "step") {
      stepCount++;
      const num = block.attributes.number
        ? parseInt(block.attributes.number, 10)
        : stepCount;
      steps.push({ number: num, content: block.content });
    }
  }

  return steps;
}

/**
 * Check if content contains semantic tags.
 */
export function hasSemanticTags(content: string): boolean {
  return OPENING_TAG_REGEX.test(content) && CLOSING_TAG_REGEX.test(content);
}

/**
 * Get list of unique tag names in content.
 */
export function getTagNames(content: string): string[] {
  const blocks = parseSemanticTags(content);
  const names = new Set(blocks.map((b) => b.tagName));
  return Array.from(names);
}
