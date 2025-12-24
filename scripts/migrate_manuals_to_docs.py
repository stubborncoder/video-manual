#!/usr/bin/env python3
"""Migration script: Rename manuals/ to docs/ and manual.md to doc.md.

This script migrates the storage structure from:
    users/{user_id}/manuals/{doc_id}/
        {lang}/manual.md
        screenshots/
        metadata.json

To:
    users/{user_id}/docs/{doc_id}/
        {lang}/doc.md
        screenshots/
        metadata.json

Usage:
    # Dry run (no changes made)
    python scripts/migrate_manuals_to_docs.py --dry-run

    # Execute migration
    python scripts/migrate_manuals_to_docs.py

    # Rollback from backup
    python scripts/migrate_manuals_to_docs.py --rollback
"""

import argparse
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import USERS_DIR, DATA_DIR


def create_backup(users_dir: Path, backup_dir: Path) -> bool:
    """Create a backup of the users directory before migration.

    Args:
        users_dir: Path to users directory
        backup_dir: Path to backup directory

    Returns:
        True if backup successful, False otherwise
    """
    if not users_dir.exists():
        print(f"[INFO] No users directory found at {users_dir}")
        return True

    print(f"[INFO] Creating backup at {backup_dir}")
    try:
        if backup_dir.exists():
            print("[WARN] Backup directory already exists, removing old backup")
            shutil.rmtree(backup_dir)
        shutil.copytree(users_dir, backup_dir)
        print("[OK] Backup created successfully")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to create backup: {e}")
        return False


def migrate_default_project(user_dir: Path, dry_run: bool = False) -> bool:
    """Migrate default project name from 'My Manuals' to 'My Docs'.

    Args:
        user_dir: Path to user directory
        dry_run: If True, only log changes without making them

    Returns:
        True if project was updated, False otherwise
    """
    default_project_file = user_dir / "projects" / "__default__" / "project.json"

    if not default_project_file.exists():
        return False

    try:
        with open(default_project_file, "r") as f:
            project_data = json.load(f)

        # Check if name needs updating
        old_names = ["My Manuals", "Mis Manuales"]
        current_name = project_data.get("name", "")

        if current_name in old_names:
            new_name = "My Docs" if current_name == "My Manuals" else "Mis Docs"
            print(f"  [PROJECT] Updating default project name: '{current_name}' -> '{new_name}'")

            if not dry_run:
                project_data["name"] = new_name
                # Also update description if it mentions manual/manuals (case-insensitive)
                desc = project_data.get("description", "")
                if "manual" in desc.lower():  # Catches "manual", "manuals", "Manual", etc.
                    project_data["description"] = "Default project for new docs"
                with open(default_project_file, "w") as f:
                    json.dump(project_data, f, indent=2)

            return True

    except Exception as e:
        print(f"  [ERROR] Failed to migrate default project: {e}")

    return False


def migrate_user(user_dir: Path, dry_run: bool = False) -> dict:
    """Migrate a single user's manuals to docs.

    Args:
        user_dir: Path to user directory
        dry_run: If True, only log changes without making them

    Returns:
        Dictionary with migration statistics
    """
    stats = {
        "dirs_renamed": 0,
        "files_renamed": 0,
        "projects_updated": 0,
        "errors": [],
    }

    # Migrate default project name
    if migrate_default_project(user_dir, dry_run):
        stats["projects_updated"] += 1

    manuals_dir = user_dir / "manuals"
    docs_dir = user_dir / "docs"

    if not manuals_dir.exists():
        return stats

    # Step 1: Rename manuals/ to docs/
    print(f"  [MIGRATE] {manuals_dir} -> {docs_dir}")
    if not dry_run:
        try:
            manuals_dir.rename(docs_dir)
            stats["dirs_renamed"] += 1
        except Exception as e:
            stats["errors"].append(f"Failed to rename {manuals_dir}: {e}")
            return stats
    else:
        stats["dirs_renamed"] += 1
        docs_dir = manuals_dir  # For dry run, continue with old path

    # Step 2: Rename manual.md to doc.md in all language folders
    for doc_dir in docs_dir.iterdir():
        if not doc_dir.is_dir():
            continue

        # Check for language subdirectories
        for item in doc_dir.iterdir():
            if item.is_dir():
                # This is a language folder (e.g., en/, es/)
                manual_md = item / "manual.md"
                doc_md = item / "doc.md"

                if manual_md.exists():
                    print(f"    [RENAME] {manual_md.relative_to(docs_dir)} -> doc.md")
                    if not dry_run:
                        try:
                            manual_md.rename(doc_md)
                            stats["files_renamed"] += 1
                        except Exception as e:
                            stats["errors"].append(f"Failed to rename {manual_md}: {e}")
                    else:
                        stats["files_renamed"] += 1

            elif item.name == "manual.md":
                # Legacy: manual.md at doc root level
                doc_md = doc_dir / "doc.md"
                print(f"    [RENAME] {item.relative_to(docs_dir)} -> doc.md")
                if not dry_run:
                    try:
                        item.rename(doc_md)
                        stats["files_renamed"] += 1
                    except Exception as e:
                        stats["errors"].append(f"Failed to rename {item}: {e}")
                else:
                    stats["files_renamed"] += 1

    return stats


def migrate_all(dry_run: bool = False) -> dict:
    """Migrate all users from manuals to docs structure.

    Args:
        dry_run: If True, only log changes without making them

    Returns:
        Dictionary with overall migration statistics
    """
    total_stats = {
        "users_processed": 0,
        "dirs_renamed": 0,
        "files_renamed": 0,
        "projects_updated": 0,
        "errors": [],
    }

    if not USERS_DIR.exists():
        print(f"[INFO] No users directory found at {USERS_DIR}")
        return total_stats

    # Create backup first (unless dry run)
    if not dry_run:
        backup_dir = DATA_DIR / f"users_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        if not create_backup(USERS_DIR, backup_dir):
            print("[ERROR] Backup failed, aborting migration")
            return total_stats
        print(f"\n[INFO] Backup location: {backup_dir}\n")

    # Process each user
    for user_dir in USERS_DIR.iterdir():
        if not user_dir.is_dir():
            continue

        print(f"\n[USER] Processing {user_dir.name}")
        stats = migrate_user(user_dir, dry_run)

        total_stats["users_processed"] += 1
        total_stats["dirs_renamed"] += stats["dirs_renamed"]
        total_stats["files_renamed"] += stats["files_renamed"]
        total_stats["projects_updated"] += stats["projects_updated"]
        total_stats["errors"].extend(stats["errors"])

    return total_stats


def rollback(backup_name: str = None) -> bool:
    """Rollback from a backup.

    Args:
        backup_name: Name of backup directory (optional, uses latest if not specified)

    Returns:
        True if rollback successful, False otherwise
    """
    # Find backup directory
    if backup_name:
        backup_dir = DATA_DIR / backup_name
    else:
        # Find latest backup
        backups = sorted(DATA_DIR.glob("users_backup_*"), reverse=True)
        if not backups:
            print("[ERROR] No backup found")
            return False
        backup_dir = backups[0]

    if not backup_dir.exists():
        print(f"[ERROR] Backup not found: {backup_dir}")
        return False

    print(f"[INFO] Rolling back from {backup_dir}")

    try:
        # Remove current users directory
        if USERS_DIR.exists():
            print("[INFO] Removing current users directory")
            shutil.rmtree(USERS_DIR)

        # Restore from backup
        print("[INFO] Restoring from backup")
        shutil.copytree(backup_dir, USERS_DIR)

        print("[OK] Rollback successful")
        return True
    except Exception as e:
        print(f"[ERROR] Rollback failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Migrate manuals/ to docs/ storage structure"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes"
    )
    parser.add_argument(
        "--rollback",
        action="store_true",
        help="Rollback to the latest backup"
    )
    parser.add_argument(
        "--backup-name",
        type=str,
        help="Specific backup name to rollback to"
    )

    args = parser.parse_args()

    if args.rollback:
        success = rollback(args.backup_name)
        sys.exit(0 if success else 1)

    print("=" * 60)
    print("Migration: manuals/ -> docs/")
    print("=" * 60)

    if args.dry_run:
        print("\n[DRY RUN MODE] No changes will be made\n")

    stats = migrate_all(dry_run=args.dry_run)

    print("\n" + "=" * 60)
    print("Migration Summary")
    print("=" * 60)
    print(f"Users processed:     {stats['users_processed']}")
    print(f"Directories renamed: {stats['dirs_renamed']}")
    print(f"Files renamed:       {stats['files_renamed']}")
    print(f"Projects updated:    {stats['projects_updated']}")
    print(f"Errors:              {len(stats['errors'])}")

    if stats["errors"]:
        print("\nErrors:")
        for error in stats["errors"]:
            print(f"  - {error}")

    if args.dry_run:
        print("\n[DRY RUN] Run without --dry-run to apply changes")


if __name__ == "__main__":
    main()
