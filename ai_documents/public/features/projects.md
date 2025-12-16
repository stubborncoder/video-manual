# Projects

Projects let you organize multiple manuals into structured collections and compile them into unified documents.

## Project Cards

Each project card has two buttons:
- **View Project** - Opens the project side panel (NOT a new page)
- **Delete Project** - Opens deletion popup

**Note:** Projects do NOT have their own URLs. Clicking "View Project" opens a side panel on the `/dashboard/projects` page.

### Deleting a Project

When you click Delete Project:
1. A popup shows the project tree structure
2. Choose one of two options:
   - **Keep manuals** - Manuals move to default project "My Manuals"
   - **Delete manuals** - Manuals are deleted along with the project
3. Source videos are **never deleted** regardless of choice

## Project Panel

When you click "View Project", a side panel opens with tabs:

| Tab | Purpose |
|-----|---------|
| Chapters | Organize sections and chapters |
| Manuals | View manuals included in project |
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
│   └── Manual (can be nested)
└── Chapter
    ├── Manual
    └── Manual
```

**Sections:**
- Used to group chapters
- Can be nested (sections within sections)
- Provide top-level organization

**Chapters:**
- Contain manuals
- Can have nested manuals
- Define the document structure

Sections and Chapters are used in compilation to structure the final compiled document.

## Compilations

Compilations merge multiple manuals into a single document.

### Requirements

- **Minimum 2 manuals** - Compile button is disabled with only one manual
- **Same language** - Only manuals in the same language can be compiled together

### Starting a Compilation

1. Open your project
2. Click **Compile** button (only enabled with 2+ manuals)
3. A popup window appears showing:
   - **Available languages** for compilation
   - Which languages **can** be compiled
   - Which languages **cannot** be compiled (missing translations in some manuals)
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
   - Transitions between manuals
3. **User can interact** with the agent to refine the proposal
4. **User must accept** the proposal for compilation to complete

### After Compilation

Once accepted:
- Compilation appears in the **Compilations tab**
- Can be **exported** in all manual formats (PDF, Word, HTML, Chunks)
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
4. Add manuals to the chapter

### Adding Manuals
1. Open a chapter
2. Click **Add Manual**
3. Select from your existing manuals
4. Manuals can be nested within chapters

## Tips

- Plan your structure before adding content
- Use sections for major divisions (Part 1, Part 2)
- Use chapters for topics within sections
- Ensure all manuals have the same language before compiling
- Review the compilation proposal carefully before accepting
- Use transitions to create smooth flow between manuals
