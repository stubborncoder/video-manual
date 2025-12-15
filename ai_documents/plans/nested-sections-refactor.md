# Nested Sections Refactor Plan

## Executive Summary

This refactoring eliminates the redundant chapter layer from the project organization hierarchy, replacing it with nestable sections. The current structure (Project > Sections > Chapters > Manuals) will become (Project > Sections (nestable) > Manuals), where sections can contain other sections via a `parent_section_id` field, and manuals are assigned directly to sections (or remain at root level).

**Target Structure:**
```
📁 Project
├── 📂 Section: Getting Started
│   ├── 📂 Section: For Admins (nested)
│   │   └── 📄 Manual: Admin setup
│   └── 📂 Section: For Users (nested)
│       └── 📄 Manual: User guide
├── 📂 Section: Advanced Topics
│   └── 📄 Manual: Configuration
└── 📄 Manual: Quick Reference (root level, no section)
```

**Key Changes:**
- Remove all chapter-related code (storage, routes, schemas, UI)
- Add `parent_section_id` field to sections for nesting
- Add `section_id` field to manuals for direct section assignment
- Update exports and compilation to use the new section hierarchy
- Migrate existing data from chapters to sections

---

## Phase 1: Backend Storage Layer

**File: `src/storage/project_storage.py`**

### Remove Chapter Methods
- `add_chapter()`
- `update_chapter()`
- `delete_chapter()`
- `reorder_chapters()`
- `list_chapters()`

### Update Section Data Structure
Add `parent_section_id` field to section creation and `manuals` array to section structure.

### New Methods to Add
```python
def add_section(
    self,
    project_id: str,
    title: str,
    description: str = "",
    parent_section_id: Optional[str] = None,
) -> str:
    """Add a section to a project, optionally nested under a parent section."""

def move_section(
    self,
    project_id: str,
    section_id: str,
    new_parent_id: Optional[str],  # None = root level
) -> None:
    """Move a section to a different parent (or to root)."""

def get_section_hierarchy(self, project_id: str) -> List[Dict[str, Any]]:
    """Get sections as a nested tree structure."""

def add_manual_to_section(
    self,
    project_id: str,
    manual_id: str,
    section_id: Optional[str] = None,
) -> None:
    """Add a manual directly to a section (or project root)."""

def move_manual_to_section(
    self,
    project_id: str,
    manual_id: str,
    target_section_id: Optional[str],
) -> None:
    """Move a manual to a different section (or to root)."""
```

### Updated Data Structures
```python
# Project structure
project_data = {
    "id": project_id,
    "name": name,
    "description": description,
    "sections": [],  # Sections with parent_section_id for nesting
    "manuals": [],   # Root-level manual IDs (not in any section)
    # REMOVED: "chapters": []
}

# Section structure
section = {
    "id": section_id,
    "title": title,
    "description": description,
    "order": order,
    "parent_section_id": parent_section_id,  # null for root sections
    "manuals": [],  # manual IDs in this section
    # REMOVED: "chapters": []
}
```

---

## Phase 2: Backend API Schemas

**File: `src/api/schemas.py`**

### Remove
- `ChapterCreate`
- `ChapterInfo`

### Update Section Schemas
```python
class SectionCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = ""
    parent_section_id: Optional[str] = None

class SectionInfo(BaseModel):
    id: str
    title: str
    description: str
    order: int
    parent_section_id: Optional[str] = None
    children: list["SectionInfo"] = []
    manuals: list[str] = []

class ProjectDetail(BaseModel):
    id: str
    name: str
    description: str
    created_at: str
    is_default: bool = False
    sections: list[SectionInfo] = []  # Hierarchical sections
    manuals: list[ProjectManualInfo]
    root_manuals: list[str] = []
    videos: list[ProjectVideoInfo] = []
    # REMOVED: chapters

class ProjectManualInfo(BaseModel):
    manual_id: str
    section_id: Optional[str] = None  # CHANGED from chapter_id
    order: int
```

---

## Phase 3: Backend API Routes

**File: `src/api/routes/projects.py`**

### Remove Chapter Endpoints
- `POST /projects/{project_id}/chapters`
- `PUT /projects/{project_id}/chapters/{chapter_id}`
- `DELETE /projects/{project_id}/chapters/{chapter_id}`
- `PUT /projects/{project_id}/chapters/reorder`
- `PUT /projects/{project_id}/chapters/{chapter_id}/manuals/reorder`

### Add New Endpoints
```python
@router.post("/{project_id}/sections/{section_id}/manuals/{manual_id}")
async def add_manual_to_section(...) -> dict:
    """Add a manual to a section."""

@router.delete("/{project_id}/sections/{section_id}/manuals/{manual_id}")
async def remove_manual_from_section(...) -> dict:
    """Remove a manual from a section (moves to root)."""

@router.put("/{project_id}/sections/{section_id}/manuals/reorder")
async def reorder_manuals_in_section(...) -> dict:
    """Reorder manuals within a section."""

@router.put("/{project_id}/sections/{section_id}/parent")
async def move_section(...) -> dict:
    """Move section to different parent (or root)."""
```

---

## Phase 4: Export Layer

**Files to update:**
- `src/export/base_exporter.py`
- `src/export/word_exporter.py`
- `src/export/html_exporter.py`
- `src/export/project_exporter.py`
- `src/export/template_word_exporter.py`
- `src/export/chunks_exporter.py`

### Changes
- Change from iterating chapters to iterating sections recursively
- Support nested section hierarchy in TOC and content
- Rename `_generate_chapter_cover()` to `_generate_section_cover()`

---

## Phase 5: Compiler Agent

**File: `src/agents/project_compiler_agent/tools.py`**

Update `analyze_project()` and `compile_manuals()` to use section hierarchy instead of chapters.

---

## Phase 6: Frontend API Client

**File: `frontend/src/lib/api.ts`**

### Remove
- `ChapterInfo` interface
- Chapter methods: `addChapter`, `updateChapter`, `deleteChapter`, `reorderChapters`

### Update
```typescript
export interface SectionInfo {
  id: string;
  title: string;
  description: string;
  order: number;
  parent_section_id: string | null;
  children: SectionInfo[];
  manuals: string[];
}

export const projects = {
  addSection: (projectId, title, description, parentSectionId?) => ...,
  moveSection: (projectId, sectionId, newParentId?) => ...,
  addManualToSection: (projectId, sectionId, manualId) => ...,
  removeManualFromSection: (projectId, sectionId, manualId) => ...,
  reorderManualsInSection: (projectId, sectionId, order) => ...,
};
```

---

## Phase 7: Frontend Projects Page

**File: `frontend/src/app/dashboard/projects/page.tsx`**

### Remove
- Chapter state variables and handlers
- Chapter-related UI components

### Add
- Recursive `SectionTreeItem` component for nested sections
- "Create Subsection" option
- "Move Section" dialog
- Support drag-drop for section nesting

---

## Phase 8: Translations

Remove chapter-related keys, add section keys:
- `addSubsection`, `parentSection`, `noParentSection`
- `moveSection`, `moveToRoot`
- `ungroupedManuals`

---

## Phase 9: CLI Updates

**File: `src/cli/main.py`**

- Remove chapter commands
- Update section commands to support `parent_section` parameter
- Update manual commands to use `section` instead of `chapter`

---

## Data Migration Strategy

Create migration script: `scripts/migrate_chapters_to_sections.py`

1. For each project:
   - Convert standalone chapters to root sections
   - For chapters inside sections, move manuals directly to parent section
   - Update manual metadata: `chapter_id` → `section_id`

2. Create backups before migration

---

## Testing Checklist

### Unit Tests
- [ ] Creating nested sections
- [ ] Moving sections between parents
- [ ] Adding manuals to sections
- [ ] Moving manuals between sections
- [ ] Cascading delete behavior
- [ ] Tree structure retrieval

### Integration Tests
- [ ] API CRUD operations
- [ ] Export with nested sections (PDF, Word, HTML)
- [ ] Compile with section hierarchy

### Frontend Tests
- [ ] Render nested section tree
- [ ] Expand/collapse at all levels
- [ ] Drag-and-drop manuals and sections
- [ ] All dialogs functional

---

## Rollback Plan

1. **Before Migration**: Full backup of `users/` directory, git tag
2. **If Issues**: Restore `.backup` files, revert git commit
3. **Partial Rollback**: Restore individual project backups

---

## Critical Files

| File | Changes |
|------|---------|
| `src/storage/project_storage.py` | Core storage - remove chapters, add nesting |
| `src/api/routes/projects.py` | API endpoints |
| `src/api/schemas.py` | Data models |
| `frontend/src/lib/api.ts` | Frontend API client |
| `frontend/src/app/dashboard/projects/page.tsx` | Main UI rewrite |

---

## Implementation Order

1. Backend Storage (1-2 days)
2. Migration Script (0.5 day)
3. Frontend API Client (0.5 day)
4. Frontend UI (2-3 days)
5. Export/Compile (1 day)
6. Testing & Polish (1-2 days)

**Total: 6-9 days**
