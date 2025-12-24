# Export

Export your docs in various formats for sharing, distribution, and integration.

## How to Export

### From Doc Card
1. Go to **Docs** page (`/dashboard/docs`)
2. Find the doc to export
3. Click the **three-dot menu** (⋯)
4. Select **Export Doc**
5. A popup window appears with format options
6. Choose your format and click **Export**
7. File downloads automatically

### From Editor
1. Open the doc in the editor
2. Click **Export** button in the header
3. Choose format from the popup
4. Click **Export** to download

## Available Formats

| Format | Extension | Best For |
|--------|-----------|----------|
| PDF | .pdf | Printing, sharing, archiving |
| Word | .docx | Editing, applying templates |
| Markdown | .zip | Obsidian, Notion, GitHub, portable notes |
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

### Markdown (.zip)
- Downloads as a **.zip archive** containing:
  - **`.md` file** - Markdown content with relative image paths
  - **`images/` folder** - All screenshots referenced in the doc
- **Portable format** - Works with:
  - Obsidian
  - Notion (import markdown)
  - GitHub / GitLab wikis
  - Any markdown editor
- Self-contained and version-control friendly

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

For project exports, see [Projects](projects.md) - compile multiple docs into a single document.

## Shareable Links

Share docs via a public URL without downloading files.

### How to Create a Share Link

1. Go to **Docs** page (`/dashboard/docs`)
2. Find the doc to share
3. Click the **three-dot menu** (⋯)
4. Select **Share**
5. Choose the language version to share
6. Click **Create Share Link**
7. Copy the link to share with others

### Share Link Features

- **Public access** - Anyone with the link can view the doc
- **No authentication required** - Recipients don't need a vDocs account
- **Live updates** - If you edit the doc, viewers see the latest version
- **Version displayed** - Shows version number and last updated date
- **Images included** - Screenshots render inline
- **Theme support** - Viewers can toggle light/dark mode

### Managing Share Links

- **Copy link** - Click the copy button to copy URL to clipboard
- **Open link** - Click the external link button to preview
- **Revoke access** - Click "Revoke Share" to disable the link permanently

### Share Link URL Format

```
https://your-domain.com/share/{token}
```

The token is a unique identifier for the shared doc. Once revoked, the token becomes invalid and cannot be reused.
