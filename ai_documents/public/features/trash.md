# Trash

The Trash page lets you recover or permanently delete items that were removed from your account.

## Trash Page

The Trash page (`/dashboard/trash`) shows all deleted items organized by type.

### Page Layout

- **Header**: Title and "Empty Trash" button (shows item count)
- **Videos Section**: Deleted videos grouped together
- **Docs Section**: Deleted docs grouped together
- **Projects Section**: Deleted projects grouped together

Each section only appears if there are items of that type in the trash.

## Retention Period

- Deleted items stay in trash for **30 days**
- After 30 days, items are **automatically deleted permanently**
- Each item row shows "X days left" until automatic deletion

## Item Information

Each trash item shows:

| Field | Description |
|-------|-------------|
| Icon | Type indicator (video, doc, project) |
| Name | Original item name |
| Deleted date | When the item was deleted |
| Days left | Time until automatic permanent deletion |
| Cascade badge | Shows if item was deleted due to parent deletion |

### Cascade Deletion

Some items show a "Cascade deleted" badge. This means the item was deleted because its parent was deleted:
- Doc deleted when its parent project was deleted (with "Delete docs" option)
- Related items deleted together

## Actions

### Restore Item

Each item has a **Restore** button:
1. Click **Restore** on the item row
2. Item is moved back to its original location
3. Toast confirmation appears

**What gets restored:**
- **Video**: Video file returns to Videos page
- **Doc**: Doc returns to Docs page (and its original project if still exists)
- **Project**: Project returns to Projects page (without its docs if they were deleted separately)

### Delete Permanently

Each item has a **Delete** button:
1. Click **Delete** on the item row
2. Confirmation dialog appears warning this cannot be undone
3. Confirm to permanently delete
4. Item is removed forever

### Empty Trash

The **Empty Trash** button in the header permanently deletes all items:
1. Click **Empty Trash (X items)**
2. Confirmation dialog shows total count
3. Confirm to permanently delete all
4. All items are removed forever

## What Happens When You Delete

### From Videos Page
- Video moves to Trash
- Associated docs are NOT deleted
- Docs may show "Source video deleted" warning

### From Docs Page
- Doc (all languages) moves to Trash
- Source video is NOT deleted
- Project assignment is removed (but project kept)

### From Projects Page
Depends on user choice in deletion dialog:
- **Keep docs**: Docs move to "My Docs" project, project moves to Trash
- **Delete docs**: Both docs and project move to Trash (cascade)

## Automatic Cleanup

The system automatically:
- Removes expired items (older than 30 days) when Trash page loads
- Cleans up storage from permanently deleted items

## Tips

- Check Trash before it's too late - items auto-delete after 30 days
- Restore items you accidentally deleted
- Use "Empty Trash" to free up storage space
- Remember: permanent deletion cannot be undone
