# Export

Export your manuals in various formats for sharing, distribution, and integration.

## How to Export

### From Manual Card
1. Go to **Manuals** page (`/dashboard/manuals`)
2. Find the manual to export
3. Click the **three-dot menu** (⋯)
4. Select **Export Manual**
5. A popup window appears with format options
6. Choose your format and click **Export**
7. File downloads automatically

### From Editor
1. Open the manual in the editor
2. Click **Export** button in the header
3. Choose format from the popup
4. Click **Export** to download

## Available Formats

| Format | Extension | Best For |
|--------|-----------|----------|
| PDF | .pdf | Printing, sharing, archiving |
| Word | .docx | Editing, applying templates |
| HTML | .html | Microsoft Teams Spaces, web embedding |
| Chunks | .zip | Semantic RAG ingestion |

## Format Details

### PDF
- Standard document format
- Good for printing and sharing
- Preserves layout and images

### Word (.docx)
- Editable in Microsoft Word
- **Supports templates** - Apply a template for custom formatting
- Good for further editing or corporate branding

### HTML
- Single HTML file
- **Images embedded as base64** - No external dependencies
- Useful for:
  - Microsoft Teams Spaces
  - SharePoint pages
  - Any platform that accepts HTML content
- Self-contained file works anywhere

### Chunks (RAG Export)
- Downloads as **.zip archive**
- Contains:
  - **JSON files** - Structured content for ingestion
  - **Images** - Extracted screenshots
- Designed for **semantic RAG pipelines**
- Use for building searchable knowledge bases

## Using Templates (Word Export)

When exporting to Word format:
1. Select **Word** as format
2. Choose a template from the dropdown
3. Template controls:
   - Fonts and typography
   - Header/footer design
   - Page layout and margins
   - Corporate branding

See [Templates](templates.md) for managing templates.

## Export from Projects

For project exports, see [Projects](projects.md) - compile multiple manuals into a single document.
