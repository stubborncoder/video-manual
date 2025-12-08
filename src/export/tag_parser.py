"""Semantic tag parser for document formats.

Parses content containing markdown wrapped in semantic XML tags.
Used for:
- Stripping tags for web view rendering
- Parsing tags for Word export styling
- Getting tag positions for syntax highlighting
"""

import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class TaggedBlock:
    """A block of content wrapped in a semantic tag."""
    tag_name: str
    content: str
    attributes: dict[str, str]
    start_pos: int
    end_pos: int

    @property
    def number(self) -> Optional[int]:
        """Get the number attribute if present (e.g., for step tags)."""
        num = self.attributes.get("number")
        return int(num) if num and num.isdigit() else None

    @property
    def type(self) -> Optional[str]:
        """Get the type attribute if present (e.g., for note tags)."""
        return self.attributes.get("type")


@dataclass
class TagPosition:
    """Position information for a tag (for syntax highlighting)."""
    tag_name: str
    is_opening: bool
    start_pos: int
    end_pos: int
    attributes: dict[str, str]
    # Line/column for editor integration
    line: int
    column: int


# Regex patterns for tag parsing
# Matches opening tags like <step number="1"> or <note type="warning">
OPENING_TAG_PATTERN = re.compile(
    r'<(\w+)(\s+[^>]*)?>',
    re.MULTILINE
)

# Matches closing tags like </step>
CLOSING_TAG_PATTERN = re.compile(
    r'</(\w+)>',
    re.MULTILINE
)

# Matches attribute pairs like number="1" or type="warning"
ATTRIBUTE_PATTERN = re.compile(
    r'(\w+)=["\']([^"\']*)["\']'
)

# Full tag block pattern - matches <tag>content</tag>
TAG_BLOCK_PATTERN = re.compile(
    r'<(\w+)(\s+[^>]*)?>(.+?)</\1>',
    re.DOTALL
)


def parse_attributes(attr_string: str) -> dict[str, str]:
    """Parse attribute string into dictionary.

    Args:
        attr_string: String like ' number="1" type="warning"'

    Returns:
        Dictionary of attribute name -> value
    """
    if not attr_string:
        return {}
    return dict(ATTRIBUTE_PATTERN.findall(attr_string))


def strip_semantic_tags(content: str) -> str:
    """Remove semantic tags, keeping only the markdown content.

    This is used for web view rendering where we want clean markdown
    without any XML-like tags visible.

    Args:
        content: Markdown content wrapped in semantic tags

    Returns:
        Clean markdown with all semantic tags removed
    """
    # Remove opening tags with optional attributes
    result = OPENING_TAG_PATTERN.sub('', content)
    # Remove closing tags
    result = CLOSING_TAG_PATTERN.sub('', result)
    # Clean up extra blank lines that might result from tag removal
    result = re.sub(r'\n{3,}', '\n\n', result)
    return result.strip()


def parse_semantic_tags(content: str) -> list[TaggedBlock]:
    """Parse content into a list of tagged blocks.

    This is used for Word export where we need to apply different
    styling based on the tag type.

    Args:
        content: Markdown content wrapped in semantic tags

    Returns:
        List of TaggedBlock objects in document order
    """
    blocks = []

    for match in TAG_BLOCK_PATTERN.finditer(content):
        tag_name = match.group(1)
        attr_string = match.group(2) or ""
        inner_content = match.group(3).strip()

        blocks.append(TaggedBlock(
            tag_name=tag_name,
            content=inner_content,
            attributes=parse_attributes(attr_string),
            start_pos=match.start(),
            end_pos=match.end(),
        ))

    return blocks


def get_tag_positions(content: str) -> list[TagPosition]:
    """Get positions of all tags for syntax highlighting.

    Returns both opening and closing tags with their positions,
    useful for editor syntax highlighting.

    Args:
        content: Markdown content wrapped in semantic tags

    Returns:
        List of TagPosition objects for all tags
    """
    positions = []
    lines = content.split('\n')

    # Build a mapping of character position to line/column
    def pos_to_line_col(pos: int) -> tuple[int, int]:
        """Convert character position to line and column."""
        current_pos = 0
        for line_num, line in enumerate(lines):
            line_end = current_pos + len(line) + 1  # +1 for newline
            if pos < line_end:
                return line_num + 1, pos - current_pos + 1
            current_pos = line_end
        return len(lines), 1

    # Find opening tags
    for match in OPENING_TAG_PATTERN.finditer(content):
        line, col = pos_to_line_col(match.start())
        positions.append(TagPosition(
            tag_name=match.group(1),
            is_opening=True,
            start_pos=match.start(),
            end_pos=match.end(),
            attributes=parse_attributes(match.group(2) or ""),
            line=line,
            column=col,
        ))

    # Find closing tags
    for match in CLOSING_TAG_PATTERN.finditer(content):
        line, col = pos_to_line_col(match.start())
        positions.append(TagPosition(
            tag_name=match.group(1),
            is_opening=False,
            start_pos=match.start(),
            end_pos=match.end(),
            attributes={},
            line=line,
            column=col,
        ))

    # Sort by position
    positions.sort(key=lambda p: p.start_pos)
    return positions


def extract_tag_content(content: str, tag_name: str) -> list[str]:
    """Extract all content from tags with the given name.

    Convenience function to get all content from a specific tag type.

    Args:
        content: Markdown content wrapped in semantic tags
        tag_name: Name of tag to extract (e.g., "step", "note")

    Returns:
        List of content strings from matching tags
    """
    blocks = parse_semantic_tags(content)
    return [block.content for block in blocks if block.tag_name == tag_name]


def get_title(content: str) -> Optional[str]:
    """Extract the title from content.

    Args:
        content: Markdown content wrapped in semantic tags

    Returns:
        Title content or None if no title tag found
    """
    titles = extract_tag_content(content, "title")
    return titles[0] if titles else None


def get_steps(content: str) -> list[tuple[int, str]]:
    """Extract numbered steps from content.

    Args:
        content: Markdown content wrapped in semantic tags

    Returns:
        List of (step_number, content) tuples
    """
    blocks = parse_semantic_tags(content)
    steps = []
    for block in blocks:
        if block.tag_name == "step":
            num = block.number or len(steps) + 1
            steps.append((num, block.content))
    return steps
