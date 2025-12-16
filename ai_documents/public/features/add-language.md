# Add Language

Generate your manual in additional languages while preserving the structure and screenshots.

## How to Add a Language

1. Go to **Manuals** page (`/dashboard/manuals`)
2. Find the manual you want to translate
3. Click the **three-dot menu** (⋯)
4. Select **Add Language**
5. A popup window appears showing:
   - Language selector (enter language name, converted to ISO format)
   - Existing languages for this manual
   - Project this manual belongs to (if any)
6. Click **Generate Manual**

## Generation Process

When you add a language:
- A generation pipeline popup appears
- **Video analysis is skipped** - uses existing keyframes from original
- **Keyframe identification is skipped** - copied from original manual
- Only the text content is regenerated in the new language
- **Screenshots remain the same** as the original manual

## Important: Screenshot Language

**Screenshots are NOT automatically translated.**

The images in the new language version will be the same as the original manual. If your original video shows UI in English, those English UI screenshots will appear in all language versions.

### Adding Localized Screenshots

To replace screenshots with images from a video in the target language:

1. Open the manual in the **Editor** (click Edit)
2. Click on an image you want to replace
3. Select **Replace from video** from the contextual menu
4. Click **Add a video** button
5. Upload a new video recorded in the target language
6. Once uploaded, use the **language dropdown** to select the correct language
7. Extract images from the new video to replace the old screenshots

**This is a manual process** - you must replace each image individually.

## Workflow for Fully Localized Manuals

1. **Create original manual** from video in primary language
2. **Add language** to generate translated text
3. **Record new video** in target language (same workflow)
4. **Upload localized video** via image replace menu
5. **Replace screenshots** one by one with frames from localized video

## Tips

- Plan for localization early - record videos in multiple languages if needed
- Keep UI workflows identical across language recordings for easier image replacement
- Review translated content for accuracy after generation
- Screenshots with minimal text work better across languages
