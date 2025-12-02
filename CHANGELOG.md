# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
