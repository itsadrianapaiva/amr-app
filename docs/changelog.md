# Changelog

Project changelog for tracking significant changes, features, and fixes.

---

## Format

```
## [Version/Date] - YYYY-MM-DD

### Added
- New feature descriptions

### Changed
- Changes to existing functionality

### Fixed
- Bug fixes

### Removed
- Removed features
```

---

## [Unreleased]

### Added
- Comprehensive documentation set in `/docs`
- Workflow documentation for operational changes:
  - Adding a new machine (CSV management, seeding, validation)
  - Updating machine images (static imports, image mapping, optimization)
  - Changing copy and content (centralized content modules)
  - Pricing and availability changes (rates, deposits, minimum days)
- **Cart-Ready Implementation Review** (`docs/ops/cart-ready-implementation-review.md`) - Complete end-to-end review of cart-ready upgrade
- **Catalog Filtering Architecture** (`docs/architecture/catalog-filtering.md`) - Comprehensive documentation of URL-only state pattern

### Changed (2025-12-30 to 2026-01-16)
- **Cart-Ready Upgrade (BookingItems model):**
  - `BookingItem` model added for itemized booking line items (machines + equipment addons with quantity)
  - Machine model extended with cart-ready fields (`itemType`, `chargeModel`, `timeUnit`, `addonGroup`)
  - Item-aware pricing engine (`computeTotalsFromItems()`) with exact parity to legacy single-item pricing
  - Checkout creates itemized Stripe line items with cent-exact discount allocation
  - BookingItem records created atomically with Booking (primary machine + equipment addons)
- **VAT Correctness:**
  - `Booking.totalCost` documented as **authoritative ex-VAT total** throughout system
  - Email notifications treat `totalCost` as ex-VAT, compute VAT using integer cents (`Math.round(netCents * 0.23)`)
  - Booking Success Page displays ex-VAT total with note directing to Stripe receipt/invoice for VAT-inclusive total
  - Stripe checkout metadata persists discount info (percent, original/discounted cents ex-VAT) to Booking fields
- **Catalog Category Filtering (2026-01-16):**
  - Refactored from dual-source-of-truth (state + URL sync) to **URL-only state pattern**
  - Eliminated local `selectedCategory` state, `useRef` guards, and all sync `useEffect` hooks
  - Category filter now derived entirely from URL query parameter via `useMemo`
  - User interactions update URL directly via `router.replace()`, triggering natural re-render
  - **Bug fixes:** Eliminated URL oscillation, race conditions, and initialization complexity
  - **Performance:** Reduced component from 137 to 115 lines (-16%), zero sync effects
  - Footer category links and catalog pills now work reliably with back/forward navigation
- **Documentation Updates:**
  - `docs/architecture/data-model.md` - Added BookingItem model docs, clarified totalCost as ex-VAT
  - `docs/architecture/booking-and-payments.md` - Updated checkout flow with itemization, VAT handling summary, cart-ready notes
  - `docs/architecture/catalog-filtering.md` - New comprehensive documentation of URL-only filtering architecture
  - `docs/workflows/pricing-and-availability-changes.md` - Already accurate (no changes needed)

---

**Note:** This changelog template is for future use. Historical changes are tracked via git commits and PRs. See `docs/Git-Workflow.md` for git conventions.

---

**Last Updated:** 2025-12-29
