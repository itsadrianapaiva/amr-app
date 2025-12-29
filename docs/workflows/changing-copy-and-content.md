# Changing Copy and Content

Step-by-step guide for updating text content, headings, CTAs, and marketing copy across the platform.

---

## Overview

Content is centralized in `/lib/content` modules to keep copy separate from UI components. This allows marketing/content updates without touching React code.

**Content Directory:** [lib/content/](../../lib/content/)

**Pattern:** Each section has a dedicated TypeScript file exporting typed content objects

---

## Prerequisites

- Access to repository
- Basic understanding of TypeScript syntax
- Text editor (VS Code recommended)

---

## Content Modules Inventory

### Homepage Content

| File | Sections | What It Controls |
|------|----------|-----------------|
| [home.ts](../../lib/content/home.ts) | Hero, Inventory section | Main headline, subtitle, CTAs, pretitles |
| [why.ts](../../lib/content/why.ts) | "Why book with us" section | Value propositions, benefit points |
| [catalog-teaser.ts](../../lib/content/catalog-teaser.ts) | Catalog preview | Call-to-action for machine catalog |
| [social-proof.ts](../../lib/content/social-proof.ts) | Reviews/testimonials | Customer testimonials and ratings |
| [faq.ts](../../lib/content/faq.ts) | FAQ section | Question and answer pairs |
| [how-to-book.ts](../../lib/content/how-to-book.ts) | Booking flow steps | Step-by-step booking instructions |

### Machine Content

| File | What It Controls |
|------|-----------------|
| [machines.ts](../../lib/content/machines.ts) | Machine card labels, category names |
| [machine-detail.ts](../../lib/content/machine-detail.ts) | Machine detail page copy, CTAs |
| [machine-description.ts](../../lib/content/machine-description.ts) | Custom machine descriptions (overrides CSV) |

### Navigation & Layout

| File | What It Controls |
|------|-----------------|
| [nav.ts](../../lib/content/nav.ts) | Navigation menu items, links |
| [footer.ts](../../lib/content/footer.ts) | Footer sections, links, legal text |
| [promo.ts](../../lib/content/promo.ts) | Promo banner (site-wide announcements) |

### Other Content

| File | What It Controls |
|------|-----------------|
| [contacts.ts](../../lib/content/contacts.ts) | Contact information, support details |
| [legal.ts](../../lib/content/legal.ts) | Legal page metadata |
| [rental-conditions.ts](../../lib/content/rental-conditions.ts) | Rental terms, conditions |
| [payment-methods.ts](../../lib/content/payment-methods.ts) | Payment method labels and descriptions |

---

## Step-by-Step Process

### 1. Identify the Content Module

**By Section:**
- Hero section → `home.ts`
- FAQ → `faq.ts`
- Navigation links → `nav.ts`
- Machine card labels → `machines.ts`
- Footer → `footer.ts`

**By Page:**
- Homepage → `home.ts`, `why.ts`, `faq.ts`, `catalog-teaser.ts`
- Machine pages → `machine-detail.ts`, `machines.ts`
- All pages → `nav.ts`, `footer.ts`, `promo.ts`

### 2. Open the Content File

**Example:** Update hero headline

**File:** `lib/content/home.ts`

```typescript
export const HOME_HERO: HeroContent = {
  pretitle: "Book online. 25% off now",
  title: "Pro-grade machinery in the Algarve",  // ← Edit this
  subtitle: "See live availability and real time pricing...",
  // ... rest
};
```

### 3. Edit the Content

**Simple Text Change:**

```typescript
// Before
title: "Pro-grade machinery in the Algarve",

// After
title: "Professional machinery rental in the Algarve",
```

**Multi-line Strings:**

```typescript
subtitle:
  "See live availability and real time pricing. " +
  "Choose dates, add extras, and confirm in minutes. " +
  "Instant confirmation with fast delivery or pickup.",
```

**Array of Items (FAQ, Points):**

```typescript
items: [
  {
    q: "How does instant booking work?",
    a: "Choose your machine, select dates, and confirm online...",
  },
  {
    q: "Why do you only rent online?",
    a: "AMR is built to save time for both sides...",
  },
  // Add new item
  {
    q: "What about insurance?",
    a: "All machines include basic insurance coverage...",
  },
],
```

### 4. Save and Verify

**Build Check (Catches TypeScript Errors):**
```bash
npm run build
```

**Local Preview:**
```bash
npm run dev
```

Navigate to the affected page and verify the change appears correctly.

### 5. Commit the Change

```bash
git add lib/content/home.ts
git commit -m "Update hero headline for clarity"
git push
```

**Note:** Changes deploy automatically on merge to `main` (production) or `staging` branch.

---

## Common Scenarios

### Scenario 1: Update Hero Headline and CTA

**File:** `lib/content/home.ts`

```typescript
export const HOME_HERO: HeroContent = {
  pretitle: "Book online. 25% off now",
  title: "Professional machinery rental in the Algarve",  // ← Updated
  subtitle: "...",

  primaryHref: "/catalog",
  primaryLabel: "Browse Equipment",  // ← Updated CTA text

  whatsappNumberE164: "+351934014611",
  whatsappLabel: "Need help? Chat on WhatsApp",
};
```

### Scenario 2: Add New FAQ Item

**File:** `lib/content/faq.ts`

```typescript
export const FAQ_CONTENT: FaqContent = {
  pretitle: "FAQ",
  title: "Learn how easy it is to rent online",
  subtitle: "...",

  items: [
    // ... existing items
    {
      q: "What about insurance?",  // ← New question
      a: "All machines include comprehensive insurance coverage...",
    },
  ],
};
```

### Scenario 3: Update "Why Book With Us" Points

**File:** `lib/content/why.ts`

```typescript
points: [
  {
    title: "Instant online booking",
    detail: "Real-time availability and confirmation. No request forms or waits.",
  },
  {
    title: "Transparent pricing",
    detail: "VAT-inclusive totals shown before you pay. No hidden fees.",  // ← Edit detail
  },
  // ... more points
],
```

### Scenario 4: Change Machine Card Labels

**File:** `lib/content/machines.ts`

```typescript
export const MACHINE_CARD_COPY: MachineCardCopy = {
  preBadge: "Instant online booking",  // ← Edit badge text
  labels: {
    deliveryAvailable: "Delivery included",  // ← Edit label
    pickupAvailable: "Pickup available",
    operatorAvailable: "Operator available",
  },
  // ... formatters
};
```

### Scenario 5: Add Category Alias (Machine Type Display)

**File:** `lib/content/machines.ts`

**Problem:** CSV uses "dumpers" but UI should show "Tracked Dumpers"

**Solution:** Add to `CATEGORY_LABELS`:

```typescript
export const CATEGORY_LABELS: Record<string, string> = {
  // ... existing categories

  // Add alias for dumpers
  "dumpers": "Tracked Dumpers",
  "dumper": "Tracked Dumpers",
  "mini dumper": "Tracked Dumpers",
};
```

**How It Works:**
- Keys are normalized (lowercase, hyphens)
- Values are displayed in UI
- Multiple keys can map to same display value (aliases)

### Scenario 6: Change Navigation Links

**File:** `lib/content/nav.ts`

```typescript
export const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Equipment", href: "/catalog" },  // ← Updated label
  { label: "FAQ", href: "/#faq" },
  { label: "Contact", href: "/#contact" },
];
```

### Scenario 7: Update Footer Contact Info

**File:** `lib/content/contacts.ts`

```typescript
export const CONTACTS = {
  phone: "+351 934 014 611",
  email: "support@amr-rentals.com",
  whatsapp: "+351934014611",
  // ... other fields
};
```

**File:** `lib/content/footer.ts`

```typescript
export const FOOTER_CONTENT = {
  tagline: "Professional machinery rental in the Algarve",  // ← Edit tagline
  copyright: "© 2025 AMR Rentals. All rights reserved.",
  // ... sections
};
```

---

## Content Best Practices

### Writing Copy

**Headlines:**
- Keep under 60 characters for readability
- Front-load key benefit (e.g., "Instant booking" not "Book with us")
- Use sentence case, not Title Case

**CTAs:**
- Action-oriented ("Book Online Now" not "Click Here")
- Clear benefit ("Browse Equipment" not "See More")
- Max 3-4 words

**Body Text:**
- Short paragraphs (2-3 sentences)
- Active voice ("Choose dates" not "Dates can be chosen")
- Avoid jargon unless industry-standard

### SEO Considerations

**Titles:**
- Include primary keyword (e.g., "machinery rental", "Algarve")
- Unique per page
- 50-60 characters

**Descriptions:**
- Include call-to-action
- Mention location/benefit
- 150-160 characters

### Accessibility

**Alt Text (handled in `images.ts`):**
- Describe image content, not just the subject
- Good: "Mini excavator working at residential job site"
- Bad: "Excavator"

**Link Text:**
- Descriptive ("View rental terms" not "Click here")
- Unique across page

---

## Troubleshooting

### TypeScript Build Error After Edit

**Error Example:**
```
Type '{ q: string; }' is missing property 'a' from type 'FaqItem'
```

**Cause:** Missing required field in object

**Fix:** Ensure all required fields are present (check type definition at top of file)

```typescript
// Wrong (missing 'a')
{
  q: "What about insurance?",
}

// Right
{
  q: "What about insurance?",
  a: "All machines include insurance...",
}
```

### Content Not Updating in Browser

**Likely Causes:**
1. Browser cache
2. Dev server needs restart
3. Build error (check terminal)

**Solutions:**
```bash
# Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

# Restart dev server
npm run dev

# Check for build errors
npm run build
```

### String Too Long (Lint Warning)

**Error:** "Line length exceeds 80 characters"

**Fix:** Use multi-line string:

```typescript
// Before (long line)
subtitle: "See live availability and real time pricing. Choose dates, add extras, and confirm in minutes.",

// After (multi-line)
subtitle:
  "See live availability and real time pricing. " +
  "Choose dates, add extras, and confirm in minutes.",
```

Or use template literals:

```typescript
subtitle: `See live availability and real time pricing.
  Choose dates, add extras, and confirm in minutes.`,
```

### Quotes and Special Characters

**Use Double Quotes for Strings:**
```typescript
title: "Professional machinery rental",  // ✓ Good
title: 'Professional machinery rental',  // ✗ Lint error (single quotes)
```

**Escape Special Characters:**
```typescript
detail: "It's refunded right after...",  // ✓ Good (escaped apostrophe)
detail: "It's refunded...",                // ✗ Syntax error
```

**Or Use Template Literals:**
```typescript
detail: `It's refunded right after...`,  // ✓ Good (no escaping needed)
```

---

## Machine Description Overrides

Machine descriptions can come from CSV or be overridden in code.

**File:** `lib/content/machine-description.ts`

**Usage:** Override CSV description with richer, formatted content

```typescript
export const MACHINE_DESCRIPTIONS: Record<string, string> = {
  "MINI-EXCAVATOR": "Compact tracked excavator perfect for...",
  "TELEHANDLER": "Versatile lifting machine with...",
  // Add more overrides as needed
};
```

**When to Use:**
- Rich formatting needed (CSV is plain text)
- Frequently updated machines (easier to edit in code)
- A/B testing copy variations

**When to Use CSV:**
- Simple descriptions
- Infrequent changes
- Non-technical editors (CSV is easier to edit for non-devs)

---

## Related Documentation

- [Adding a New Machine](adding-a-new-machine.md) - Machine data management
- [Updating Machine Images](updating-machine-images.md) - Image management
- [Local Setup](../development/local-setup.md) - Development environment

---

## Source Pointers

**Content Modules:**
- Homepage: `lib/content/home.ts`, `lib/content/why.ts`, `lib/content/faq.ts`
- Machines: `lib/content/machines.ts`, `lib/content/machine-detail.ts`
- Navigation: `lib/content/nav.ts`, `lib/content/footer.ts`
- All content files: `lib/content/*.ts` (23 modules)

**Components Using Content:**
- Hero: `app/page.tsx` (imports `HOME_HERO`)
- FAQ: `components/faq-section.tsx` (imports `FAQ_CONTENT`)
- Machine cards: `components/machine-card.tsx` (imports `MACHINE_CARD_COPY`)
- Navigation: `components/nav.tsx` (imports `NAV_ITEMS`)

**Type Definitions:**
- Defined at top of each content file (e.g., `HeroContent`, `FaqContent`)
- Enforces required fields and structure

---

**Last Updated:** 2025-12-29
