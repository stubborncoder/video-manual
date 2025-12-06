# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

#### Async Video Processing & Job System
- **SQLite-based job persistence** for tracking video processing jobs
  - Jobs table stores: id, user_id, video_name, status, progress, error, timestamps
  - Jobs survive page refreshes and browser closes
  - Database located at `src/db/vdocs.db`
- **Non-blocking video processing UI**
  - Processing dialog closes immediately after job starts
  - Users can navigate freely while processing continues
- **Job progress toast notifications**
  - Persistent toasts in bottom-right corner
  - Shows current step, progress bar, video name
  - "View Manual" button on completion
  - Polling fallback every 5 seconds for reliability
- **REST API for job management**
  - `GET /api/jobs` - List all user jobs
  - `GET /api/jobs/active` - List pending/processing jobs
  - `GET /api/jobs/{id}` - Get single job
  - `POST /api/jobs/{id}/seen` - Mark job as seen (dismiss notification)
- **Zustand store for frontend job state** (`jobsStore.ts`)

#### Manuals Page Improvements
- **Filter state persistence via URL params**
  - Project and tag filters saved in URL query string
  - Navigating back from edit preserves filter selection
  - Shareable filtered URLs (e.g., `/dashboard/manuals?project=my-project&tags=tag1,tag2`)

### Changed

#### Prompt Improvements
- **Video analyzer prompt** - Enhanced keyframe selection guidance:
  - Timestamp and description must match what's visible at that exact moment
  - Guidance for capturing both "where to click" and "result after click" frames
  - Examples of correct vs incorrect timestamp/description pairing
- **Manual generator prompt** - Added output rules:
  - Must start directly with manual content (no "Here is your manual" preamble)
  - No conversational filler or closing remarks
  - Output only clean Markdown

### Fixed
- **Progress bar showing 0%** when `node_index` was 0 (changed falsy check to `!== null`)
- **"View Manual" 404 error** - Fixed navigation to correct URL (`/dashboard/manuals/{id}/edit`)
- **Screenshot timing mismatch** - Improved prompts so keyframe descriptions match actual screenshot content

### Removed
- **"Unassigned" filter option** from project filter dropdown (not useful for this use case)

---

## [0.2.0] - 2024-12-01

### Breaking Changes
- **CLI commands renamed**:
  - `video-manual` → `vdocs`
  - `video-manual-api` → `vdocs-api`
  - Update your scripts and documentation accordingly

### Added
- New branding: Platform rebranded from "Video Manual Platform" to "vDocs"
- FileVideo icon branding across landing page and dashboard
- Blue hover effects on sidebar menu items
- Styled "D" in vDocs branding with primary color
- Testing infrastructure: Jest + React Testing Library
- Component tests for Sidebar (branding, navigation, theme toggle, collapse/expand)
- Component tests for ProjectsPage (chapter count accuracy, N+1 query prevention, performance)

### Changed
- Standardized heading fonts across all dashboard sections (text-3xl font-bold)
- Improved theme toggle text spacing in sidebar
- Updated all user-facing text to reflect vDocs branding

### Fixed
- N+1 query performance issue in projects list (reduced from N+1 to 1 API call)
- Project cards layout by removing CONTENTS section
- Stale chapter count bug by using actual data from API
- Silent error handling in project loading

### Removed
- CONTENTS section from project cards
- Unused manual_names fetching logic
