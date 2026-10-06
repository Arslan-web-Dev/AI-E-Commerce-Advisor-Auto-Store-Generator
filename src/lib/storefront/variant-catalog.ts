/**
 * Module 7 — Component Variant Catalog
 * All variant definitions live here in the trusted application codebase.
 * Only variant IDs and props are persisted to the database — never executable code.
 *
 * Syntropic Emerald design tokens:
 *   --primary: #4edea3  --secondary: #4cd7f6  --surface: #0b1326
 *   --on-surface: #dae2fd  --outline: #86948a
 */

export type ComponentType =
  | 'header'
  | 'hero'
  | 'product_card'
  | 'product_grid'
  | 'category_tile'
  | 'footer'
  | 'button'
  | 'badge'
  | 'announcement_bar'
  | 'faq_accordion'
  | 'newsletter_signup'
  | 'promotional_banner'
  | 'product_detail_gallery'
  | 'cart_drawer'
  | 'page_home'
  | 'page_listing'
  | 'page_product_detail'
  | 'page_cart'
  | 'page_checkout_preview'
  | 'page_about'
  | 'page_contact'
  | 'page_faq'
  | 'page_not_found';

export type AvailabilityTier = 'core' | 'priority_optional' | 'integration_dependent';

export interface VariantDefinition {
  id: string;                    // stable, never changes
  name: string;
  componentType: ComponentType;
  catalogVersion: string;
  description: string;
  availability: AvailabilityTier;
  supportedCategories: string[]; // [] = all categories
  pageSlots: string[];           // where this component can appear
  requiredProps: string[];
  optionalProps: string[];
  responsiveBehavior: string;
  accessibilityNotes: string;
  themeTokens: string[];
  compatibleWith: string[];      // variant IDs this can appear alongside
  incompatibleWith: string[];    // variant IDs this cannot be combined with
  requiresData: string[];        // e.g. 'hero_image', 'product_catalog'
  fallbackBehavior: string;      // what happens when requiresData is missing
}

// ============================================================
// HEADERS (FR-7.1 navbar style step — 5 variants; SRS specifies 3-5 options)
// ============================================================
export const HEADER_VARIANTS: VariantDefinition[] = [
  {
    id: 'header-v1-sticky-centered',
    name: 'Sticky Centered Logo',
    componentType: 'header',
    catalogVersion: 'v1.0',
    description: 'Dark surface sticky header, centered logo, nav links left and right, cart/account icons.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['global_shell'],
    requiredProps: ['store_name', 'nav_links'],
    optionalProps: ['logo_url', 'show_search', 'show_wishlist'],
    responsiveBehavior: 'Collapses to hamburger menu at < 768px.',
    accessibilityNotes: 'Keyboard-navigable menu; aria-expanded on mobile toggle.',
    themeTokens: ['--surface-container-lowest', '--primary', '--on-surface'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: [],
    fallbackBehavior: 'Renders store_name as text if logo_url absent.',
  },
  {
    id: 'header-v2-left-logo-full-nav',
    name: 'Left Logo Full Navigation',
    componentType: 'header',
    catalogVersion: 'v1.0',
    description: 'Logo left, full horizontal nav center, search + cart right. Transparent-to-solid on scroll.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['global_shell'],
    requiredProps: ['store_name', 'nav_links'],
    optionalProps: ['logo_url', 'show_search'],
    responsiveBehavior: 'Hamburger at < 768px; slide-down drawer.',
    accessibilityNotes: 'role="navigation"; focus trap in mobile drawer.',
    themeTokens: ['--surface', '--primary', '--on-surface'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: [],
    fallbackBehavior: 'Text store name fallback.',
  },
  {
    id: 'header-v3-minimal-bar',
    name: 'Minimal Single Bar',
    componentType: 'header',
    catalogVersion: 'v1.0',
    description: 'Compact single-line header with logo, minimal nav items, and icon cluster. Ideal for boutique stores.',
    availability: 'core',
    supportedCategories: ['fashion', 'craft', 'beauty'],
    pageSlots: ['global_shell'],
    requiredProps: ['store_name'],
    optionalProps: ['logo_url', 'nav_links', 'show_search'],
    responsiveBehavior: 'Same layout at tablet; collapses at mobile.',
    accessibilityNotes: 'Skip-to-content link at top.',
    themeTokens: ['--surface-container-low', '--primary'],
    compatibleWith: [],
    incompatibleWith: ['header-v1-sticky-centered', 'header-v2-left-logo-full-nav'],
    requiresData: [],
    fallbackBehavior: 'Shows store name text only.',
  },
  {
    id: 'header-v4-emerald-gradient-bar',
    name: 'Emerald Gradient Accent Bar',
    componentType: 'header',
    catalogVersion: 'v1.0',
    description: 'Dark header with emerald-to-teal gradient bottom border accent. Prominent search bar center.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['global_shell'],
    requiredProps: ['store_name', 'nav_links'],
    optionalProps: ['logo_url', 'announcement_text'],
    responsiveBehavior: 'Stacked layout on mobile: logo row + search row.',
    accessibilityNotes: 'Search input has visible label; aria-label on icon buttons.',
    themeTokens: ['--primary', '--secondary', '--surface-container-lowest'],
    compatibleWith: ['announcement_bar-v1-scrolling-text'],
    incompatibleWith: [],
    requiresData: [],
    fallbackBehavior: 'Renders without accent gradient if CSS vars unavailable.',
  },
  {
    id: 'header-v5-split-utility',
    name: 'Split Two-Row Utility Header',
    componentType: 'header',
    catalogVersion: 'v1.0',
    description: 'Top utility row (contact, social) + main nav row below. High-information display for larger catalogs.',
    availability: 'core',
    supportedCategories: ['electronics', 'general', 'wholesale'],
    pageSlots: ['global_shell'],
    requiredProps: ['store_name', 'nav_links', 'contact_email'],
    optionalProps: ['logo_url', 'social_links', 'show_search'],
    responsiveBehavior: 'Top utility row hidden on mobile; single nav bar shown.',
    accessibilityNotes: 'Consistent landmark regions; aria-current on active nav.',
    themeTokens: ['--surface-container', '--outline-variant', '--primary'],
    compatibleWith: [],
    incompatibleWith: ['header-v3-minimal-bar'],
    requiresData: [],
    fallbackBehavior: 'Contact row omitted if contact_email absent.',
  },
];

// ============================================================
// HERO SECTIONS (FR-7.1 step 3 — 5 options; extended to meaningful variants)
// ============================================================
export const HERO_VARIANTS: VariantDefinition[] = [
  {
    id: 'hero-v1-fullbleed-image',
    name: 'Full-Bleed Image Hero',
    componentType: 'hero',
    catalogVersion: 'v1.0',
    description: 'Edge-to-edge hero image with dark overlay, large headline, subtext, and CTA button.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['home_top'],
    requiredProps: ['headline', 'cta_label', 'cta_href'],
    optionalProps: ['subtext', 'hero_image_url'],
    responsiveBehavior: 'Image height 60vh mobile, 85vh desktop; text repositioned.',
    accessibilityNotes: 'Decorative image alt="" + aria-hidden; heading h1.',
    themeTokens: ['--primary', '--on-surface'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: ['hero_image_url'],
    fallbackBehavior: 'Renders emerald gradient background if hero_image_url absent.',
  },
  {
    id: 'hero-v2-split-text-image',
    name: 'Split Text/Image Hero',
    componentType: 'hero',
    catalogVersion: 'v1.0',
    description: '50/50 split: headline + CTA left, product/brand image right.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['home_top'],
    requiredProps: ['headline', 'cta_label', 'cta_href'],
    optionalProps: ['subtext', 'hero_image_url'],
    responsiveBehavior: 'Stacks vertically on mobile (image below text).',
    accessibilityNotes: 'Image has descriptive alt text.',
    themeTokens: ['--primary', '--surface-container'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: ['hero_image_url'],
    fallbackBehavior: 'Image column replaced with emerald geometric pattern.',
  },
  {
    id: 'hero-v3-centered-minimal',
    name: 'Centered Minimal Hero',
    componentType: 'hero',
    catalogVersion: 'v1.0',
    description: 'Dark background, centered headline + subtext + CTA. No image required. Clean and fast.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['home_top'],
    requiredProps: ['headline', 'cta_label', 'cta_href'],
    optionalProps: ['subtext', 'badge_label'],
    responsiveBehavior: 'Same layout at all breakpoints; font scales with viewport.',
    accessibilityNotes: 'Sufficient contrast on dark background guaranteed by tokens.',
    themeTokens: ['--primary', '--secondary', '--surface-container-lowest'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: [],
    fallbackBehavior: 'N/A — no image dependency.',
  },
  {
    id: 'hero-v4-video-loop',
    name: 'Muted Video Loop Hero',
    componentType: 'hero',
    catalogVersion: 'v1.0',
    description: 'Autoplaying muted looped background video with text overlay and CTA. Pauses on reduced-motion.',
    availability: 'priority_optional',
    supportedCategories: ['fashion', 'food', 'beauty'],
    pageSlots: ['home_top'],
    requiredProps: ['headline', 'cta_label', 'cta_href', 'video_url'],
    optionalProps: ['subtext', 'poster_image_url'],
    responsiveBehavior: 'Video replaced by poster image on mobile to save bandwidth.',
    accessibilityNotes: 'prefers-reduced-motion: paused; play/pause control visible.',
    themeTokens: ['--primary', '--on-surface'],
    compatibleWith: [],
    incompatibleWith: ['hero-v3-centered-minimal'],
    requiresData: ['video_url'],
    fallbackBehavior: 'Falls back to hero-v1 fullbleed with poster_image_url.',
  },
  {
    id: 'hero-v5-carousel-hero',
    name: 'Auto-Rotating Banner Carousel',
    componentType: 'hero',
    catalogVersion: 'v1.0',
    description: 'Multiple slides with image, headline, and CTA. Dots navigation. Auto-rotates every 5 s.',
    availability: 'priority_optional',
    supportedCategories: [],
    pageSlots: ['home_top'],
    requiredProps: ['slides'],
    optionalProps: [],
    responsiveBehavior: 'Touch swipe on mobile; keyboard arrow navigation.',
    accessibilityNotes: 'aria-live=polite for slide changes; pause on hover.',
    themeTokens: ['--primary', '--outline', '--surface'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: ['slides'],
    fallbackBehavior: 'Shows first slide only if < 2 slides provided.',
  },
];

// ============================================================
// PRODUCT CARDS (FR-7.1 step 4 — 5 options; extended)
// ============================================================
export const PRODUCT_CARD_VARIANTS: VariantDefinition[] = [
  {
    id: 'product-card-v1-standard',
    name: 'Standard Card',
    componentType: 'product_card',
    catalogVersion: 'v1.0',
    description: 'Image top, product name, price, add-to-cart button. Clean and universal.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['product_grid', 'featured_products', 'search_results'],
    requiredProps: ['name', 'price', 'currency', 'image_url'],
    optionalProps: ['sale_price', 'badge', 'rating', 'stock_state'],
    responsiveBehavior: 'Full width on mobile (1 col); 2 col tablet; 3-4 col desktop.',
    accessibilityNotes: 'Product name as heading; keyboard focus ring on card.',
    themeTokens: ['--surface-container', '--primary', '--on-surface'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: ['product_catalog'],
    fallbackBehavior: 'Image placeholder shown if image_url absent.',
  },
  {
    id: 'product-card-v2-horizontal',
    name: 'Horizontal List Card',
    componentType: 'product_card',
    catalogVersion: 'v1.0',
    description: 'Image left, product info right. Ideal for list view or search results.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['product_grid', 'search_results'],
    requiredProps: ['name', 'price', 'currency'],
    optionalProps: ['image_url', 'description_short', 'badge'],
    responsiveBehavior: 'Stacks vertically on mobile.',
    accessibilityNotes: 'Consistent tab order; sr-only price label.',
    themeTokens: ['--surface-container-high', '--on-surface'],
    compatibleWith: [],
    incompatibleWith: ['product-card-v1-standard'],
    requiresData: [],
    fallbackBehavior: 'Text-only card without image.',
  },
  {
    id: 'product-card-v3-overlay-cta',
    name: 'Image Overlay CTA',
    componentType: 'product_card',
    catalogVersion: 'v1.0',
    description: 'Full-image card; name and add-to-cart overlay appears on hover/focus. Modern fashion aesthetic.',
    availability: 'core',
    supportedCategories: ['fashion', 'beauty', 'craft'],
    pageSlots: ['product_grid', 'featured_products'],
    requiredProps: ['name', 'price', 'currency', 'image_url'],
    optionalProps: ['sale_price', 'wishlist_enabled'],
    responsiveBehavior: 'Overlay always visible on touch devices (no hover).',
    accessibilityNotes: 'Focus-within triggers overlay; button accessible without mouse.',
    themeTokens: ['--primary', '--on-primary', '--surface-container-lowest'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: ['product_catalog'],
    fallbackBehavior: 'Degrades to v1-standard if image_url absent.',
  },
  {
    id: 'product-card-v4-compact-grid',
    name: 'Compact Dense Grid Card',
    componentType: 'product_card',
    catalogVersion: 'v1.0',
    description: 'Smaller footprint card for high-density grids (4-6 cols desktop). Minimal info, fast scan.',
    availability: 'core',
    supportedCategories: ['electronics', 'general', 'wholesale'],
    pageSlots: ['product_grid'],
    requiredProps: ['name', 'price', 'currency'],
    optionalProps: ['image_url', 'badge'],
    responsiveBehavior: '2 col mobile; 4 col tablet; 6 col desktop.',
    accessibilityNotes: 'Sufficient touch target size maintained (min 44px).',
    themeTokens: ['--surface-container', '--on-surface-variant'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: [],
    fallbackBehavior: 'No image placeholder shown.',
  },
  {
    id: 'product-card-v5-featured-wide',
    name: 'Featured Wide Card',
    componentType: 'product_card',
    catalogVersion: 'v1.0',
    description: 'Double-width card for spotlighted products; large image, extended description, prominent CTA.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['featured_products', 'home_spotlight'],
    requiredProps: ['name', 'price', 'currency', 'description_short'],
    optionalProps: ['image_url', 'badge'],
    responsiveBehavior: 'Full width on mobile; spans 2 grid columns on desktop.',
    accessibilityNotes: 'Heading hierarchy maintained; CTA has descriptive label.',
    themeTokens: ['--primary', '--surface-container-high'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: ['product_catalog'],
    fallbackBehavior: 'Gradient background if image absent.',
  },
];

// ============================================================
// PRODUCT GRIDS (layout step — 4 options per SRS; extended)
// ============================================================
export const PRODUCT_GRID_VARIANTS: VariantDefinition[] = [
  {
    id: 'grid-v1-3col-uniform',
    name: '3-Column Uniform Grid',
    componentType: 'product_grid',
    catalogVersion: 'v1.0',
    description: 'Standard 3-column masonry-free grid. All cards same height. Best for uniform catalog.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['page_listing', 'home_featured'],
    requiredProps: ['products'],
    optionalProps: ['show_filters', 'show_sort'],
    responsiveBehavior: '1 col mobile, 2 col tablet, 3 col desktop.',
    accessibilityNotes: 'List role; each card aria-label with product name.',
    themeTokens: ['--surface-container'],
    compatibleWith: ['product-card-v1-standard', 'product-card-v3-overlay-cta'],
    incompatibleWith: [],
    requiresData: ['product_catalog'],
    fallbackBehavior: 'Empty-state panel shown if no products.',
  },
  {
    id: 'grid-v2-4col-dense',
    name: '4-Column Dense Grid',
    componentType: 'product_grid',
    catalogVersion: 'v1.0',
    description: '4-column grid optimized for large catalogs.',
    availability: 'core',
    supportedCategories: ['electronics', 'general'],
    pageSlots: ['page_listing'],
    requiredProps: ['products'],
    optionalProps: ['show_filters', 'show_sort'],
    responsiveBehavior: '2 col mobile, 3 col tablet, 4 col desktop.',
    accessibilityNotes: 'As grid-v1.',
    themeTokens: ['--surface-container'],
    compatibleWith: ['product-card-v4-compact-grid'],
    incompatibleWith: [],
    requiresData: ['product_catalog'],
    fallbackBehavior: 'Empty-state panel shown if no products.',
  },
  {
    id: 'grid-v3-masonry',
    name: 'Pinterest-Style Masonry Grid',
    componentType: 'product_grid',
    catalogVersion: 'v1.0',
    description: 'CSS columns masonry for varied image heights. Great for craft, art, or handmade goods.',
    availability: 'priority_optional',
    supportedCategories: ['craft', 'fashion', 'beauty'],
    pageSlots: ['page_listing', 'home_featured'],
    requiredProps: ['products'],
    optionalProps: ['columns'],
    responsiveBehavior: '1 col mobile, 2 col tablet, 3 col desktop.',
    accessibilityNotes: 'Reading order preserved with CSS only masonry approach.',
    themeTokens: ['--surface-container'],
    compatibleWith: ['product-card-v1-standard', 'product-card-v3-overlay-cta'],
    incompatibleWith: ['product-card-v4-compact-grid'],
    requiresData: ['product_catalog'],
    fallbackBehavior: 'Graceful degradation to grid-v1 on browsers without column support.',
  },
  {
    id: 'grid-v4-list-view',
    name: 'List View',
    componentType: 'product_grid',
    catalogVersion: 'v1.0',
    description: 'Vertical list of horizontal product cards. More info per item; good for comparison.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['page_listing', 'search_results'],
    requiredProps: ['products'],
    optionalProps: ['show_filters'],
    responsiveBehavior: 'Horizontal card stacks vertically on mobile.',
    accessibilityNotes: 'As grid-v1.',
    themeTokens: ['--surface-container-high'],
    compatibleWith: ['product-card-v2-horizontal'],
    incompatibleWith: ['product-card-v3-overlay-cta'],
    requiresData: ['product_catalog'],
    fallbackBehavior: 'Empty-state panel shown if no products.',
  },
];

// ============================================================
// FOOTERS (FR-7.1 step 2 — navbar/footer; 5 variants)
// ============================================================
export const FOOTER_VARIANTS: VariantDefinition[] = [
  {
    id: 'footer-v1-standard-columns',
    name: 'Standard Multi-Column Footer',
    componentType: 'footer',
    catalogVersion: 'v1.0',
    description: 'Dark footer with logo, 3-4 link columns (shop, info, legal), and copyright row.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['global_shell'],
    requiredProps: ['store_name', 'nav_sections'],
    optionalProps: ['logo_url', 'social_links', 'contact_email'],
    responsiveBehavior: 'Columns collapse to accordion on mobile.',
    accessibilityNotes: 'nav landmark; all links have descriptive text.',
    themeTokens: ['--surface-container-lowest', '--on-surface-variant', '--primary'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: [],
    fallbackBehavior: 'Renders minimal single-column footer.',
  },
  {
    id: 'footer-v2-emerald-gradient-footer',
    name: 'Emerald Gradient Top Footer',
    componentType: 'footer',
    catalogVersion: 'v1.0',
    description: 'Footer with emerald-to-teal gradient top border, links, newsletter field, and social icons.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['global_shell'],
    requiredProps: ['store_name', 'nav_sections'],
    optionalProps: ['social_links', 'newsletter_preview'],
    responsiveBehavior: 'Stacks columns on mobile.',
    accessibilityNotes: 'Newsletter preview labeled as disabled until configured.',
    themeTokens: ['--primary', '--secondary', '--surface-container-lowest'],
    compatibleWith: ['header-v4-emerald-gradient-bar'],
    incompatibleWith: [],
    requiresData: [],
    fallbackBehavior: 'Gradient omitted if CSS vars not loaded.',
  },
  {
    id: 'footer-v3-minimal-centered',
    name: 'Minimal Centered Footer',
    componentType: 'footer',
    catalogVersion: 'v1.0',
    description: 'Single centered row: logo, minimal links, copyright. Best for boutique/brand stores.',
    availability: 'core',
    supportedCategories: ['fashion', 'beauty', 'craft'],
    pageSlots: ['global_shell'],
    requiredProps: ['store_name'],
    optionalProps: ['logo_url', 'policy_links'],
    responsiveBehavior: 'Same at all breakpoints; links wrap.',
    accessibilityNotes: 'Sufficient link touch targets.',
    themeTokens: ['--surface-container', '--on-surface-variant'],
    compatibleWith: ['header-v3-minimal-bar'],
    incompatibleWith: ['footer-v1-standard-columns'],
    requiresData: [],
    fallbackBehavior: 'N/A.',
  },
  {
    id: 'footer-v4-contact-highlighted',
    name: 'Contact-Highlighted Footer',
    componentType: 'footer',
    catalogVersion: 'v1.0',
    description: 'Footer with prominent contact block (address, phone, email), map area, and standard link columns.',
    availability: 'core',
    supportedCategories: ['food', 'services', 'general'],
    pageSlots: ['global_shell'],
    requiredProps: ['store_name', 'contact_email', 'nav_sections'],
    optionalProps: ['address', 'phone', 'social_links'],
    responsiveBehavior: 'Contact block full width mobile; inline desktop.',
    accessibilityNotes: 'Address uses address element.',
    themeTokens: ['--surface-container-lowest', '--primary'],
    compatibleWith: ['header-v5-split-utility'],
    incompatibleWith: [],
    requiresData: [],
    fallbackBehavior: 'Omits map/address block if address absent.',
  },
  {
    id: 'footer-v5-dark-magazine',
    name: 'Dark Magazine Footer',
    componentType: 'footer',
    catalogVersion: 'v1.0',
    description: 'Rich footer with brand statement, wide column layout, newsletter, and social row. Editorial style.',
    availability: 'priority_optional',
    supportedCategories: ['fashion', 'beauty', 'lifestyle'],
    pageSlots: ['global_shell'],
    requiredProps: ['store_name', 'brand_tagline', 'nav_sections'],
    optionalProps: ['logo_url', 'social_links', 'newsletter_preview'],
    responsiveBehavior: 'Columns to single stack on mobile.',
    accessibilityNotes: 'Heading within footer for brand statement.',
    themeTokens: ['--surface-container-lowest', '--primary', '--on-surface'],
    compatibleWith: [],
    incompatibleWith: ['footer-v3-minimal-centered'],
    requiresData: [],
    fallbackBehavior: 'Newsletter shown as preview-only if provider unconfigured.',
  },
];

// ============================================================
// ANNOUNCEMENT BARS
// ============================================================
export const ANNOUNCEMENT_BAR_VARIANTS: VariantDefinition[] = [
  {
    id: 'announcement_bar-v1-scrolling-text',
    name: 'Scrolling Text Bar',
    componentType: 'announcement_bar',
    catalogVersion: 'v1.0',
    description: 'Marquee-style scrolling announcement. Pauses on hover/prefers-reduced-motion.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['above_header'],
    requiredProps: ['message'],
    optionalProps: ['cta_label', 'cta_href'],
    responsiveBehavior: 'Same at all breakpoints; shorter message on mobile.',
    accessibilityNotes: 'aria-live=off on marquee; static fallback text.',
    themeTokens: ['--primary-container', '--on-primary'],
    compatibleWith: ['header-v4-emerald-gradient-bar'],
    incompatibleWith: [],
    requiresData: [],
    fallbackBehavior: 'Static single-line display if animation unavailable.',
  },
  {
    id: 'announcement_bar-v2-static-dismissible',
    name: 'Static Dismissible Bar',
    componentType: 'announcement_bar',
    catalogVersion: 'v1.0',
    description: 'Single-line bar with dismiss (X) button. Preference stored in sessionStorage.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['above_header'],
    requiredProps: ['message'],
    optionalProps: ['cta_label', 'cta_href'],
    responsiveBehavior: 'Full width at all sizes.',
    accessibilityNotes: 'Dismiss button has aria-label="Dismiss announcement".',
    themeTokens: ['--secondary-container', '--on-secondary'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: [],
    fallbackBehavior: 'N/A.',
  },
];

// ============================================================
// FAQ ACCORDIONS (Priority 1 Optional)
// ============================================================
export const FAQ_ACCORDION_VARIANTS: VariantDefinition[] = [
  {
    id: 'faq-v1-simple-bordered',
    name: 'Simple Bordered Accordion',
    componentType: 'faq_accordion',
    catalogVersion: 'v1.0',
    description: 'Bordered rows, single expand at a time, plus/minus icon.',
    availability: 'priority_optional',
    supportedCategories: [],
    pageSlots: ['page_faq', 'home_section'],
    requiredProps: ['items'],
    optionalProps: ['allow_multiple'],
    responsiveBehavior: 'Full width at all sizes.',
    accessibilityNotes: 'details/summary HTML; keyboard expandable.',
    themeTokens: ['--outline-variant', '--surface-container', '--on-surface'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: [],
    fallbackBehavior: 'Empty state if items array empty.',
  },
  {
    id: 'faq-v2-filled-cards',
    name: 'Filled Card Accordion',
    componentType: 'faq_accordion',
    catalogVersion: 'v1.0',
    description: 'Each FAQ item is a filled card; expands with smooth height animation.',
    availability: 'priority_optional',
    supportedCategories: [],
    pageSlots: ['page_faq'],
    requiredProps: ['items'],
    optionalProps: [],
    responsiveBehavior: 'Full width at all sizes.',
    accessibilityNotes: 'ARIA expanded state on button trigger.',
    themeTokens: ['--surface-container-high', '--primary'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: [],
    fallbackBehavior: 'Empty state if items array empty.',
  },
];

// ============================================================
// PROMOTIONAL BANNERS
// ============================================================
export const PROMOTIONAL_BANNER_VARIANTS: VariantDefinition[] = [
  {
    id: 'promo-v1-full-width-cta',
    name: 'Full-Width CTA Banner',
    componentType: 'promotional_banner',
    catalogVersion: 'v1.0',
    description: 'Dark background with emerald text, bold offer text, and prominent CTA.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['home_section', 'page_listing_top'],
    requiredProps: ['headline', 'cta_label', 'cta_href'],
    optionalProps: ['subtext', 'badge_label'],
    responsiveBehavior: 'Stacked text on mobile, side-by-side on desktop.',
    accessibilityNotes: 'CTA has descriptive aria-label.',
    themeTokens: ['--primary', '--on-primary', '--surface-container-lowest'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: [],
    fallbackBehavior: 'N/A.',
  },
  {
    id: 'promo-v2-split-image-offer',
    name: 'Split Image Offer Banner',
    componentType: 'promotional_banner',
    catalogVersion: 'v1.0',
    description: 'Image left panel, offer text + CTA right panel.',
    availability: 'priority_optional',
    supportedCategories: [],
    pageSlots: ['home_section'],
    requiredProps: ['headline', 'cta_label', 'cta_href'],
    optionalProps: ['image_url', 'subtext'],
    responsiveBehavior: 'Stacks vertically on mobile.',
    accessibilityNotes: 'Image alt describes the product shown.',
    themeTokens: ['--primary', '--surface-container'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: ['hero_image_url'],
    fallbackBehavior: 'Falls back to promo-v1 if no image.',
  },
];

// ============================================================
// BUTTONS (small primitives — SRS note: limited meaningful variants)
// Note: Buttons have documented limit per prompt §9; 6 meaningful variants provided.
// Reason: Additional variants would differ only in color, not layout/composition.
// ============================================================
export const BUTTON_VARIANTS: VariantDefinition[] = [
  { id: 'btn-v1-primary-filled', name: 'Primary Filled', componentType: 'button', catalogVersion: 'v1.0', description: 'Emerald filled button, default CTA.', availability: 'core', supportedCategories: [], pageSlots: ['all'], requiredProps: ['label'], optionalProps: ['icon', 'disabled', 'loading'], responsiveBehavior: 'Full width on mobile when in form context.', accessibilityNotes: 'Disabled state communicated via aria-disabled.', themeTokens: ['--primary', '--on-primary'], compatibleWith: [], incompatibleWith: [], requiresData: [], fallbackBehavior: 'N/A.' },
  { id: 'btn-v2-outlined', name: 'Outlined', componentType: 'button', catalogVersion: 'v1.0', description: 'Transparent with emerald border.', availability: 'core', supportedCategories: [], pageSlots: ['all'], requiredProps: ['label'], optionalProps: ['icon'], responsiveBehavior: 'Same.', accessibilityNotes: 'Visible focus ring.', themeTokens: ['--primary', '--outline'], compatibleWith: [], incompatibleWith: [], requiresData: [], fallbackBehavior: 'N/A.' },
  { id: 'btn-v3-ghost', name: 'Ghost / Text', componentType: 'button', catalogVersion: 'v1.0', description: 'No border, text-only, hover underline.', availability: 'core', supportedCategories: [], pageSlots: ['all'], requiredProps: ['label'], optionalProps: [], responsiveBehavior: 'Same.', accessibilityNotes: 'Sufficient touch target maintained.', themeTokens: ['--primary'], compatibleWith: [], incompatibleWith: [], requiresData: [], fallbackBehavior: 'N/A.' },
  { id: 'btn-v4-icon-only', name: 'Icon Button', componentType: 'button', catalogVersion: 'v1.0', description: 'Icon-only button (cart, wishlist, search).', availability: 'core', supportedCategories: [], pageSlots: ['all'], requiredProps: ['icon', 'aria_label'], optionalProps: ['badge_count'], responsiveBehavior: 'Same.', accessibilityNotes: 'aria-label required prop.', themeTokens: ['--on-surface', '--primary'], compatibleWith: [], incompatibleWith: [], requiresData: [], fallbackBehavior: 'N/A.' },
  { id: 'btn-v5-danger', name: 'Danger / Destructive', componentType: 'button', catalogVersion: 'v1.0', description: 'Red-tinted button for destructive actions (remove, cancel).', availability: 'core', supportedCategories: [], pageSlots: ['cart', 'admin'], requiredProps: ['label'], optionalProps: ['confirmation_required'], responsiveBehavior: 'Same.', accessibilityNotes: 'Confirmation dialog recommended.', themeTokens: ['--error', '--on-error'], compatibleWith: [], incompatibleWith: [], requiresData: [], fallbackBehavior: 'N/A.' },
  { id: 'btn-v6-loading-spinner', name: 'Loading Spinner Button', componentType: 'button', catalogVersion: 'v1.0', description: 'Primary button with inline spinner for async operations.', availability: 'core', supportedCategories: [], pageSlots: ['all'], requiredProps: ['label', 'loading'], optionalProps: [], responsiveBehavior: 'Same.', accessibilityNotes: 'aria-busy=true when loading.', themeTokens: ['--primary', '--on-primary'], compatibleWith: [], incompatibleWith: [], requiresData: [], fallbackBehavior: 'N/A.' },
];

// ============================================================
// PAGE TEMPLATES
// ============================================================
export const PAGE_TEMPLATE_VARIANTS: VariantDefinition[] = [
  {
    id: 'page-home-v1-standard',
    name: 'Standard Home Page',
    componentType: 'page_home',
    catalogVersion: 'v1.0',
    description: 'Hero → Featured Categories → Featured Products → CTA Banner.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['home'],
    requiredProps: ['store_name'],
    optionalProps: ['hero_image_url', 'featured_products', 'categories'],
    responsiveBehavior: 'Sections stack vertically; section padding adjusts.',
    accessibilityNotes: 'Single h1 on page; landmark regions for each section.',
    themeTokens: ['--surface', '--primary', '--on-surface'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: [],
    fallbackBehavior: 'Empty states shown per missing section.',
  },
  {
    id: 'page-listing-v1-filtered',
    name: 'Category Listing with Filters',
    componentType: 'page_listing',
    catalogVersion: 'v1.0',
    description: 'Filter sidebar left, product grid right. Sort dropdown top.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['listing'],
    requiredProps: ['category_name'],
    optionalProps: ['products', 'filters'],
    responsiveBehavior: 'Filter sidebar becomes bottom sheet on mobile.',
    accessibilityNotes: 'Filters announced via aria-live when applied.',
    themeTokens: ['--surface-container', '--primary'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: ['product_catalog'],
    fallbackBehavior: 'Empty state with "no products" message.',
  },
  {
    id: 'page-pdp-v1-standard',
    name: 'Standard Product Detail Page',
    componentType: 'page_product_detail',
    catalogVersion: 'v1.0',
    description: 'Gallery left, product info right. Add to cart, description, related products.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['product_detail'],
    requiredProps: ['product_name', 'price', 'currency'],
    optionalProps: ['images', 'description', 'variants', 'related_products'],
    responsiveBehavior: 'Gallery above info on mobile.',
    accessibilityNotes: 'Image gallery keyboard navigable; aria-live on cart confirmation.',
    themeTokens: ['--primary', '--surface-container'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: ['product_catalog'],
    fallbackBehavior: 'Placeholder image; description shows "No description provided."',
  },
  {
    id: 'page-cart-v1-drawer',
    name: 'Cart Side Drawer (Preview)',
    componentType: 'page_cart',
    catalogVersion: 'v1.0',
    description: 'Slide-in cart drawer with line items, subtotal, and checkout preview CTA.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['overlay'],
    requiredProps: [],
    optionalProps: ['items'],
    responsiveBehavior: 'Full-width bottom sheet on mobile.',
    accessibilityNotes: 'Focus trap when open; aria-modal=true.',
    themeTokens: ['--surface-container-low', '--primary'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: [],
    fallbackBehavior: 'Empty cart state with continue-shopping CTA.',
  },
  {
    id: 'page-checkout-preview-v1',
    name: 'COD Checkout Preview',
    componentType: 'page_checkout_preview',
    catalogVersion: 'v1.0',
    description: 'Name, phone, address form + order summary. COD only. Preview-only — no real payment.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['checkout'],
    requiredProps: [],
    optionalProps: [],
    responsiveBehavior: 'Single column on mobile; 2-col on desktop.',
    accessibilityNotes: 'Form labels associated; error messages linked via aria-describedby.',
    themeTokens: ['--surface-container', '--primary', '--error'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: [],
    fallbackBehavior: 'Preview label clearly shown: "Order placement deferred."',
  },
  {
    id: 'page-about-v1',
    name: 'About Us Page',
    componentType: 'page_about',
    catalogVersion: 'v1.0',
    description: 'Brand story, team (optional), values section.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['about'],
    requiredProps: ['store_name'],
    optionalProps: ['brand_story', 'team_members'],
    responsiveBehavior: 'Sections stack on mobile.',
    accessibilityNotes: 'Semantic section headings.',
    themeTokens: ['--surface', '--primary'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: [],
    fallbackBehavior: 'Generic "About us" placeholder copy shown; marked as draft.',
  },
  {
    id: 'page-contact-v1',
    name: 'Contact Page with Form',
    componentType: 'page_contact',
    catalogVersion: 'v1.0',
    description: 'Contact form (name, email, message) + contact details block.',
    availability: 'priority_optional',
    supportedCategories: [],
    pageSlots: ['contact'],
    requiredProps: ['contact_email'],
    optionalProps: ['address', 'phone', 'social_links'],
    responsiveBehavior: 'Full width on mobile.',
    accessibilityNotes: 'Form validation errors linked with aria-describedby.',
    themeTokens: ['--surface-container', '--primary'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: ['contact_email'],
    fallbackBehavior: 'Form hidden; shows contact details only if email configured.',
  },
  {
    id: 'page-not-found-v1',
    name: '404 Not Found Page',
    componentType: 'page_not_found',
    catalogVersion: 'v1.0',
    description: 'Friendly 404 with back-to-store and search suggestion.',
    availability: 'core',
    supportedCategories: [],
    pageSlots: ['error'],
    requiredProps: [],
    optionalProps: [],
    responsiveBehavior: 'Centered at all sizes.',
    accessibilityNotes: 'h1 states the error; focus set on load.',
    themeTokens: ['--primary', '--on-surface'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: [],
    fallbackBehavior: 'N/A.',
  },
];

// ============================================================
// NEWSLETTER SIGNUP (Priority 1 Optional — preview-only if unconfigured)
// ============================================================
export const NEWSLETTER_VARIANTS: VariantDefinition[] = [
  {
    id: 'newsletter-v1-inline-bar',
    name: 'Inline Email Bar',
    componentType: 'newsletter_signup',
    catalogVersion: 'v1.0',
    description: 'Single-line email input + subscribe button. Preview-only unless email provider configured.',
    availability: 'priority_optional',
    supportedCategories: [],
    pageSlots: ['home_section', 'footer'],
    requiredProps: ['headline'],
    optionalProps: ['subtext', 'provider_configured'],
    responsiveBehavior: 'Input and button stack vertically on mobile.',
    accessibilityNotes: 'Input has visible label; required field marked.',
    themeTokens: ['--primary', '--surface-container'],
    compatibleWith: [],
    incompatibleWith: [],
    requiresData: [],
    fallbackBehavior: 'Shows "Coming soon – email signup" if provider_configured=false.',
  },
];

// ============================================================
// MASTER CATALOG
// ============================================================
export const VARIANT_CATALOG: VariantDefinition[] = [
  ...HEADER_VARIANTS,
  ...HERO_VARIANTS,
  ...PRODUCT_CARD_VARIANTS,
  ...PRODUCT_GRID_VARIANTS,
  ...FOOTER_VARIANTS,
  ...ANNOUNCEMENT_BAR_VARIANTS,
  ...FAQ_ACCORDION_VARIANTS,
  ...PROMOTIONAL_BANNER_VARIANTS,
  ...BUTTON_VARIANTS,
  ...PAGE_TEMPLATE_VARIANTS,
  ...NEWSLETTER_VARIANTS,
];

export function getVariantById(id: string): VariantDefinition | undefined {
  return VARIANT_CATALOG.find((v) => v.id === id);
}

export function getVariantsByType(type: ComponentType): VariantDefinition[] {
  return VARIANT_CATALOG.filter((v) => v.componentType === type);
}

export function validateVariantId(id: string): boolean {
  return VARIANT_CATALOG.some((v) => v.id === id);
}

/**
 * Validates a proposed manifest against the catalog.
 * Returns list of violations (empty = valid).
 */
export function validateManifest(manifest: Record<string, string>): string[] {
  const violations: string[] = [];
  for (const [slot, variantId] of Object.entries(manifest)) {
    if (!validateVariantId(variantId)) {
      violations.push(`Unknown variant ID "${variantId}" for slot "${slot}".`);
    }
  }
  // Check incompatibility
  const variantIds = Object.values(manifest);
  for (const id of variantIds) {
    const def = getVariantById(id);
    if (!def) continue;
    for (const incompatId of def.incompatibleWith) {
      if (variantIds.includes(incompatId)) {
        violations.push(`Variant "${id}" is incompatible with "${incompatId}".`);
      }
    }
  }
  return violations;
}

// ============================================================
// TEMPLATE PRESETS (MCQ questionnaire → recommended manifest)
// ============================================================
export const TEMPLATE_PRESETS: Record<string, {
  id: string;
  name: string;
  supportedCategories: string[];
  defaultManifest: Record<string, string>;
  description: string;
}> = {
  'boutique-elegant': {
    id: 'boutique-elegant',
    name: 'Boutique Elegant',
    supportedCategories: ['fashion', 'beauty', 'craft'],
    defaultManifest: {
      header: 'header-v3-minimal-bar',
      hero: 'hero-v2-split-text-image',
      product_card: 'product-card-v3-overlay-cta',
      product_grid: 'grid-v1-3col-uniform',
      footer: 'footer-v3-minimal-centered',
      announcement_bar: 'announcement_bar-v2-static-dismissible',
    },
    description: 'Refined layout for boutique and lifestyle brands.',
  },
  'modern-urban': {
    id: 'modern-urban',
    name: 'Modern Urban',
    supportedCategories: ['electronics', 'fashion', 'general'],
    defaultManifest: {
      header: 'header-v2-left-logo-full-nav',
      hero: 'hero-v1-fullbleed-image',
      product_card: 'product-card-v1-standard',
      product_grid: 'grid-v1-3col-uniform',
      footer: 'footer-v1-standard-columns',
      announcement_bar: 'announcement_bar-v1-scrolling-text',
    },
    description: 'Bold and contemporary for urban markets.',
  },
  'emerald-brand': {
    id: 'emerald-brand',
    name: 'Emerald Brand',
    supportedCategories: [],
    defaultManifest: {
      header: 'header-v4-emerald-gradient-bar',
      hero: 'hero-v3-centered-minimal',
      product_card: 'product-card-v1-standard',
      product_grid: 'grid-v1-3col-uniform',
      footer: 'footer-v2-emerald-gradient-footer',
      announcement_bar: 'announcement_bar-v1-scrolling-text',
    },
    description: 'Signature Syntropic Emerald theme. Works for all categories.',
  },
  'high-density-catalog': {
    id: 'high-density-catalog',
    name: 'High-Density Catalog',
    supportedCategories: ['electronics', 'general', 'wholesale'],
    defaultManifest: {
      header: 'header-v5-split-utility',
      hero: 'hero-v3-centered-minimal',
      product_card: 'product-card-v4-compact-grid',
      product_grid: 'grid-v2-4col-dense',
      footer: 'footer-v4-contact-highlighted',
    },
    description: 'Optimized for large product catalogs and utility-focused browsing.',
  },
};

export function recommendTemplate(category: string, answers: Record<string, string>): string {
  // Style preference answer drives primary template selection
  const styleAnswer = answers['style_preference'] ?? '';
  if (styleAnswer === 'elegant' || category === 'fashion' || category === 'beauty') {
    return 'boutique-elegant';
  }
  if (styleAnswer === 'dense' || category === 'electronics' || category === 'wholesale') {
    return 'high-density-catalog';
  }
  if (styleAnswer === 'brand') {
    return 'emerald-brand';
  }
  return 'modern-urban'; // universal fallback
}
