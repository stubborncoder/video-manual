# Projects

Projects let you organize multiple docs into structured collections and compile them into unified documents.

## Project Cards

Each project card has two buttons:
- **View Project** - Opens the project side panel (NOT a new page)
- **Delete Project** - Opens deletion popup

**Note:** Projects do NOT have their own URLs. Clicking "View Project" opens a side panel on the `/dashboard/projects` page.

### Deleting a Project

When you click Delete Project:
1. A popup shows the project tree structure
2. Choose one of two options:
   - **Keep docs** - Docs move to default project "My Docs"
   - **Delete docs** - Docs are deleted along with the project
3. Source videos are **never deleted** regardless of choice

## Project Panel

When you click "View Project", a side panel opens with tabs:

| Tab | Purpose |
|-----|---------|
| Chapters | Organize sections and chapters |
| Docs | View docs included in project |
| Videos | View related source videos |
| Export Settings | Configure export options |
| Compilations | View and export compiled documents |

## Organization Structure

Projects use a hierarchical structure:

```
Project
├── Section (can be nested)
│   ├── Section
│   │   └── Chapter
│   └── Chapter
├── Chapter
│   └── Doc (can be nested)
└── Chapter
    ├── Doc
    └── Doc
```

**Sections:**
- Used to group chapters
- Can be nested (sections within sections)
- Provide top-level organization

**Chapters:**
- Contain docs
- Can have nested docs
- Define the document structure

Sections and Chapters are used in compilation to structure the final compiled document.

## Compilations

Compilations merge multiple docs into a single document.

### Requirements

- **Minimum 2 docs** - Compile button is disabled with only one doc
- **Same language** - Only docs in the same language can be compiled together

### Starting a Compilation

1. Open your project
2. Click **Compile** button (only enabled with 2+ docs)
3. A popup window appears showing:
   - **Available languages** for compilation
   - Which languages **can** be compiled
   - Which languages **cannot** be compiled (missing translations in some docs)
4. Select options:
   - Include table of contents
   - Include page numbers
5. Click **Compile**

### Compilation Agent

The compilation is handled by an AI agent:

1. **Agent proposes** a compilation structure
2. **Proposal displays** in the content area showing:
   - Chapters organization
   - Sections structure
   - Transitions between docs
3. **User can interact** with the agent to refine the proposal
4. **User must accept** the proposal for compilation to complete

### After Compilation

Once accepted:
- Compilation appears in the **Compilations tab**
- Can be **exported** in all doc formats (PDF, Word, HTML, Chunks)
- Has **version history per language**

## Creating a Project

1. Go to **Projects** page (`/dashboard/projects`)
2. Click **Create Project** button (`create-project-btn`)
3. Enter project name and description
4. Click **Create**

## Managing Structure

### Adding Sections
1. Open project → Chapters tab
2. Click **Add Section**
3. Name your section
4. Drag to reorder or nest within other sections

### Adding Chapters
1. Open project → Chapters tab
2. Click **Add Chapter** (within a section or at root)
3. Name your chapter
4. Add docs to the chapter

### Adding Docs
1. Open a chapter
2. Click **Add Doc**
3. Select from your existing docs
4. Docs can be nested within chapters

## Tips

- Plan your structure before adding content
- Use sections for major divisions (Part 1, Part 2)
- Use chapters for topics within sections
- Ensure all docs have the same language before compiling
- Review the compilation proposal carefully before accepting
- Use transitions to create smooth flow between docs
