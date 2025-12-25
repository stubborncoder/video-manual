---
description: Create a new vDocs release with version bump and changelog
argument-hint: "<major|minor|patch> [--notes 'Release notes']"
allowed-tools: ["Bash", "Read", "Edit", "Write"]
---

# Release Management

Create a new release for vDocs with proper versioning and changelog updates.

## Process

### 1. Determine Version Type

- **major**: Breaking changes (0.x.x → 1.0.0)
- **minor**: New features (0.2.x → 0.3.0)
- **patch**: Bug fixes (0.2.1 → 0.2.2)

### 2. Get Current Version

Read from `pyproject.toml`:
```bash
grep '^version = ' pyproject.toml
```

### 3. Update Version

Edit `pyproject.toml` to bump the version number.

### 4. Update CHANGELOG.md

Read current CHANGELOG:
```bash
head -50 CHANGELOG.md
```

Add new version section at the top (after `## [Unreleased]`):

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features...

### Changed
- Changes...

### Fixed
- Bug fixes...
```

Use the provided `--notes` or summarize recent commits:
```bash
git log --oneline $(git describe --tags --abbrev=0)..HEAD
```

### 5. Commit Changes

```bash
git add pyproject.toml CHANGELOG.md
git commit -m "chore: bump version to X.Y.Z"
```

### 6. Create and Push Tag

```bash
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
```

### 7. Monitor Release

The `release.yml` workflow will:
1. Extract changelog for this version
2. Create GitHub release with release notes

Watch the workflow:
```bash
gh run list --workflow=release.yml --limit=1
```

## Example

```
/vdocs:release minor --notes "Add project compilation feature"
```

This will:
1. Bump 0.2.1 → 0.3.0
2. Add changelog entry
3. Commit, tag, and push
4. Trigger release workflow

## Pre-release Versions

For alpha/beta releases:
```
0.2.1-alpha.1
0.2.1-beta.2
```

These are marked as pre-release on GitHub automatically.
