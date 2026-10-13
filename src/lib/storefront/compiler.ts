/**
 * Module 7 — Manifest Compiler
 * Validates MCQ answers + variant selections into an immutable manifest.
 * Never executes AI-generated code; uses only allowlisted variant IDs.
 */

import {
  validateManifest,
  recommendTemplate,
  TEMPLATE_PRESETS,
  getVariantById,
  VARIANT_CATALOG,
} from './variant-catalog';

export interface WizardAnswers {
  style_preference: 'elegant' | 'modern' | 'dense' | 'brand';
  audience: 'general' | 'youth' | 'professional' | 'family';
  product_presentation: 'image_heavy' | 'info_heavy' | 'balanced';
  optional_features: string[];   // e.g. ['faq', 'newsletter_preview', 'announcement_bar']
  schema_version: string;
}

export interface StoreManifest {
  manifest_version: string;
  template_id: string;
  variants: Record<string, string>;  // slot -> variant_id
  pages: string[];
  theme_tokens: {
    primary: string;
    secondary: string;
    surface: string;
    font_display: string;
    font_body: string;
    border_radius: string;
  };
  optional_sections: string[];
  disabled_integration_sections: string[];
  content_slots: Record<string, string>;  // slot -> source description
  missing_requirements: string[];
  compatibility_violations: string[];
  generated_at: string;
}

const PALETTE_MAP: Record<string, { primary: string; secondary: string }> = {
  emerald_dark:  { primary: '#4edea3', secondary: '#4cd7f6' },
  teal_night:    { primary: '#2dd4bf', secondary: '#818cf8' },
  amber_warm:    { primary: '#f59e0b', secondary: '#fb923c' },
  rose_brand:    { primary: '#f43f5e', secondary: '#c084fc' },
};

function paletteFromAnswers(answers: WizardAnswers): { primary: string; secondary: string } {
  if (answers.style_preference === 'brand') return PALETTE_MAP.emerald_dark;
  if (answers.style_preference === 'elegant') return PALETTE_MAP.teal_night;
  if (answers.audience === 'youth') return PALETTE_MAP.rose_brand;
  return PALETTE_MAP.emerald_dark;
}

export function compileManifest(
  answers: WizardAnswers,
  category: string,
  customVariants?: Record<string, string>,
): StoreManifest {
  const templateId = recommendTemplate(category, answers);
  const preset = TEMPLATE_PRESETS[templateId] ?? TEMPLATE_PRESETS['modern-urban'];

  // Merge preset defaults with any user-selected overrides
  const mergedVariants: Record<string, string> = {
    ...preset.defaultManifest,
    ...(customVariants ?? {}),
  };

  // Validate every variant ID against the allowlist
  const violations = validateManifest(mergedVariants);

  // Collect missing requirements
  const missingRequirements: string[] = [];
  for (const [slot, variantId] of Object.entries(mergedVariants)) {
    const def = getVariantById(variantId);
    if (!def) continue;
    for (const req of def.requiresData) {
      // Check if the data requirement is flagged as a missing slot in content_slots
      // In production this would check actual project data completeness
      // Here we flag it for the manifest consumer to handle
      missingRequirements.push(`Slot "${slot}" (${variantId}) requires data: ${req}`);
    }
  }

  // Optional sections requested by answers
  const optionalSections: string[] = [];
  if (answers.optional_features.includes('faq')) optionalSections.push('faq-v01-simple-clean');
  if (answers.optional_features.includes('newsletter_preview')) optionalSections.push('newsletter-v01-inline-bar');
  if (answers.optional_features.includes('announcement_bar')) {
    mergedVariants['announcement_bar'] = mergedVariants['announcement_bar'] ?? 'announcement-v02-static-dismissible';
  }

  const { primary, secondary } = paletteFromAnswers(answers);

  const pages = [
    'page-home-v1-standard',
    'page-listing-v1-filtered',
    'page-pdp-v1-standard',
    'page-cart-v1-drawer',
    'page-checkout-preview-v1',
    'page-about-v1',
    'page-not-found-v1',
  ];

  if (answers.optional_features.includes('contact')) {
    pages.push('page-contact-v1');
  }

  return {
    manifest_version: 'v1.0',
    template_id: preset.id,
    variants: mergedVariants,
    pages,
    theme_tokens: {
      primary,
      secondary,
      surface: '#0b1326',
      font_display: 'Plus Jakarta Sans',
      font_body: 'Inter',
      border_radius: answers.style_preference === 'elegant' ? '16px' : '8px',
    },
    optional_sections: optionalSections,
    disabled_integration_sections: [
      'newsletter_submit',    // requires email provider
      'payment_methods',      // requires payment integration
      'live_stock',           // requires inventory system
      'order_tracking',       // requires order system
      'product_reviews',      // requires verified review source
    ],
    content_slots: {
      hero_image_url: 'owner_provided',
      product_catalog: 'owner_managed',
      brand_story: 'owner_provided',
      contact_email: 'owner_provided',
    },
    missing_requirements: missingRequirements,
    compatibility_violations: violations,
    generated_at: new Date().toISOString(),
  };
}
