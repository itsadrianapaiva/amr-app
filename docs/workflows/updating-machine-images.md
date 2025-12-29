# Updating Machine Images

Step-by-step guide for adding or updating machine images in the UI.

---

## Overview

Machine images are managed as **local static assets** in the codebase, not loaded from external URLs. The CSV `Image` column is NOT used by the UI (it's stored as `referenceUrl` for ops reference only).

Images are resolved using a static import system with fallback logic based on machine name/category.

**Image Directory:** [public/images/machines/](../../public/images/machines/)

**Image Mapping:** [lib/content/images.ts](../../lib/content/images.ts)

**Optimized Images:** [public/images/optimized/machines/](../../public/images/optimized/machines/)

---

## Prerequisites

- Access to repository
- Image files (JPG, WEBP, or PNG format)
- Basic understanding of git workflow

---

## Step-by-Step Process

### 1. Prepare Image File

**Format Requirements:**
- **Preferred:** WebP (best compression, optimized)
- **Acceptable:** JPG, JPEG, PNG
- **Avoid:** SVG (blocked by security guard)

**Size Recommendations:**
- Minimum: 800x600px
- Recommended: 1200x900px (4:3 aspect ratio works well)
- File size: <500KB ideally (for fast loading)

**Naming Convention:**
- Use kebab-case (lowercase with hyphens)
- Match machine name slug when possible
- Examples: `mini-excavator.jpg`, `telehandler-02.webp`, `lg-skid-steer-loader-tracks.webp`

### 2. Add Image to Repository

**Location:** `public/images/machines/`

**Example:**
```bash
# Copy image to public directory
cp ~/Downloads/new-machine.webp public/images/machines/new-machine.webp
```

**For Optimized WebP:**

If you have a WebP-optimized version (compressed for production), place it in:
```
public/images/optimized/machines/new-machine.webp
```

The optimization directory is preferred for production images but not required.

### 3. Import Image in images.ts

**File:** `lib/content/images.ts`

**Add Static Import (Recommended):**

Near the top of the file (around lines 38-56), add your import:

```typescript
// Add to existing imports section
import newMachine from "@/public/images/optimized/machines/new-machine.webp";
```

**Why Static Import?**
- Unlocks intrinsic sizes (no layout shift)
- Generates blurDataURL for nice placeholders
- Type-safe with Next.js Image optimization

### 4. Add to Image Map

**File:** `lib/content/images.ts`

**Location:** `imageContent.machines` object (lines 121-193)

Add your machine entry with appropriate alt text:

```typescript
export const imageContent = {
  // ... existing content
  machines: {
    // ... existing machines

    // Add your new machine (use canonical slug as key)
    "new-machine": {
      src: newMachine,  // Use the imported variable
      alt: "Description of machine for accessibility",  // SEO & accessibility
    },

    // ... rest of machines
  }
}
```

**Alt Text Best Practices:**
- Describe what's in the image (not just the machine name)
- Include context if helpful (e.g., "at a construction site")
- Keep under 125 characters
- Good: "Mini excavator working at a residential job site"
- Bad: "Mini excavator"

### 5. Add Alias Mapping

**File:** `lib/content/images.ts`

**Location:** `MACHINE_IMAGE_ALIASES` object (lines 62-79)

Add aliases so the image resolves correctly from CSV machine names:

```typescript
const MACHINE_IMAGE_ALIASES: Record<string, string> = {
  // ... existing aliases

  // Map CSV machine name slug to canonical image key
  "new-machine-from-csv": "new-machine",

  // You can add multiple aliases pointing to same image
  "alternate-name": "new-machine",
};
```

**How to Find the Alias Key:**

The alias key should match the **slug-normalized version** of your machine's `name` or `code` from `machines.csv`.

Example:
- CSV name: "New Machine 3000"
- Slug: `new-machine-3000` (lowercase, spaces → hyphens)
- Alias: `"new-machine-3000": "new-machine"`

### 6. Verify Resolution

**Test Image Resolution:**

The system tries to match images using this priority:
1. Machine `category` → alias → image map
2. Machine `name` → alias → image map
3. Fallback: `_fallback.jpg`

**Quick Test:**
```bash
npm run dev
```

Navigate to the machine's page and verify the correct image loads.

---

## Common Scenarios

### Scenario 1: New Machine Needs Image

**Steps:**
1. Add image file: `public/images/machines/new-excavator.webp`
2. Import in `images.ts`: `import newExcavator from "@/public/images/machines/new-excavator.webp"`
3. Add to map: `"new-excavator": { src: newExcavator, alt: "..." }`
4. Add alias: `"new-excavator-from-csv": "new-excavator"`

### Scenario 2: Replace Existing Machine Image

**Steps:**
1. Replace file in `public/images/machines/` (keep same filename)
2. No code changes needed if using same filename
3. Clear browser cache and hard refresh to see new image

**Or, if changing filename:**
1. Add new file with new name
2. Update import in `images.ts`
3. Update src in `imageContent.machines[key]`

### Scenario 3: Add Alternate/Secondary Image

**Steps:**
1. Add image with suffix: `mini-excavator-02.jpg`
2. Import: `import miniExcavator02 from "@/public/images/machines/mini-excavator-02.jpg"`
3. Add new entry: `"mini-excavator-02": { src: miniExcavator02, alt: "..." }`
4. To use on detail pages, update the page component logic (requires dev work)

Currently, the system uses ONE primary image per machine. Secondary images exist in the directory but aren't cycled through automatically.

### Scenario 4: Optimize Existing JPG to WebP

**Steps:**
1. Convert JPG to WebP using a tool (e.g., `cwebp`, Squoosh.app, or ImageMagick)
2. Place optimized file in `public/images/optimized/machines/`
3. Update import path in `images.ts` to point to optimized version
4. No other changes needed

**Example:**
```typescript
// Before
import miniExcavator from "@/public/images/machines/mini-excavator.jpg";

// After
import miniExcavator from "@/public/images/optimized/machines/mini-excavator.webp";
```

---

## Troubleshooting

### Image Not Showing (Fallback Image Appears)

**Likely Causes:**
1. Alias mapping missing or incorrect
2. Slug normalization doesn't match
3. Import statement missing or typo

**Debug Steps:**
1. Check browser console for 404 errors
2. Verify import path matches actual file location
3. Check alias key matches machine name slug (use `toSlugLike()` logic: lowercase, hyphens only)
4. Verify machine `name` or `category` in CSV matches alias key

**Test Slug Normalization:**

The system normalizes names using this logic (from `lib/content/images.ts:204-212`):
- Trim whitespace
- Lowercase
- Remove accents/diacritics
- Replace non-alphanumeric with hyphens
- Remove leading/trailing hyphens

Example: `"New Machine 3000!"` → `"new-machine-3000"`

### Image File Size Too Large

**Solutions:**
1. Use WebP format (better compression than JPG)
2. Resize to max 1200px width
3. Use online tools: Squoosh.app, TinyPNG, or ImageOptim
4. Target <500KB for card images, <1MB for detail page images

### Import Error: "Cannot find module"

**Cause:** Import path doesn't match file location

**Fix:**
```typescript
// Wrong
import img from "@/public/images/machines/non-existent.jpg";

// Right (verify file exists)
import img from "@/public/images/machines/mini-excavator.jpg";
```

### TypeScript Error: "Type not assignable"

**Cause:** Missing `as const` or incorrect type annotation

**Fix:** Ensure the `imageContent` object uses proper typing:
```typescript
machines: {
  "key": {
    src: importedImage,
    alt: "Description",
  },
} as Record<string, MachineImage>
```

---

## Image Optimization Best Practices

### Convert to WebP

**Using cwebp (command-line):**
```bash
cwebp -q 85 input.jpg -o output.webp
```

**Using Squoosh.app (browser):**
1. Go to squoosh.app
2. Drop image
3. Select WebP format
4. Adjust quality (85-90 recommended)
5. Download optimized file

### Batch Optimization

If adding multiple images, use a script:

```bash
# Using ImageMagick (if installed)
for img in public/images/machines/*.jpg; do
  convert "$img" -quality 85 "${img%.jpg}.webp"
done
```

### File Naming for Variants

- Primary: `machine-name.webp`
- Alternate 1: `machine-name-02.webp`
- Alternate 2: `machine-name-03.webp`

This keeps files organized and makes it clear which are alternates.

---

## Related Documentation

- [Adding a New Machine](adding-a-new-machine.md) - How to add machines to CSV
- [Changing Copy and Content](changing-copy-and-content.md) - Update text content
- [Local Setup](../development/local-setup.md) - Development environment

---

## Source Pointers

- **Image Resolution:** `lib/content/images.ts` (entire file)
- **Static Imports:** `lib/content/images.ts:29-56`
- **Image Map:** `lib/content/images.ts:121-193`
- **Alias Map:** `lib/content/images.ts:62-79`
- **Helper Functions:** `lib/content/images.ts:204-293`
- **Machine Card Component:** `components/machine-card.tsx:66-70`
- **Image Directory:** `public/images/machines/`
- **Optimized Directory:** `public/images/optimized/machines/`

---

## Technical Notes

### Why Not Use Database URLs?

The CSV `Image` column (stored as `referenceUrl` in DB) is explicitly ignored by the UI:

```typescript
// From machine-card.tsx:69
const img = resolveMachineImage({
  type: categoryOrType,
  name: machine.name ?? "",
  dbUrl: null, // explicitly ignore external URLs on cards
});
```

**Reasons:**
1. **Performance:** Static imports enable Next.js optimization
2. **Security:** Avoids loading arbitrary external URLs (SVG XSS risks)
3. **Reliability:** No dependency on external hosts
4. **Quality:** Curated, optimized images for production

The `referenceUrl` field can be used for ops reference or future features, but is not rendered.

### Fallback Logic

If no image matches, the system falls back to `_fallback.jpg`:

```typescript
// From lib/content/images.ts:59
const FALLBACK_MACHINE_IMAGE = "/images/machines/_fallback.jpg" as const;
```

This ensures the UI never breaks due to missing images.

---

**Last Updated:** 2025-12-29
