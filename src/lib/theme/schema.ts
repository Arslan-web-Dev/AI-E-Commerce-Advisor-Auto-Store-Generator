/** Strict Module 7 theme schema. Only data IDs, hex colours and bounded labels are accepted. */

import {
  HERO_IDS,
  NAVBAR_IDS,
  PALETTE_IDS,
  PRODUCT_GRID_IDS,
  isHeroStyleId,
  isNavbarStyleId,
  isPaletteId,
  isProductGridId,
  type HeroStyleId,
  type NavbarStyleId,
  type PaletteId,
  type ProductGridId,
} from './options';

export const THEME_SCHEMA_VERSION = 'theme.v1';
export const THEME_PROMPT_VERSION = 'theme-prompt-v1';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const COLOR_TOKENS = ['primary', 'secondary', 'surface', 'onPrimary', 'onSurface'] as const;
const CONTRAST_KEYS = ['primaryOnSurface', 'secondaryOnSurface', 'onPrimaryOnPrimary', 'onSurfaceOnSurface'] as const;

export type ThemeAnswers = {
  paletteId: PaletteId;
  navbarStyle: NavbarStyleId;
  heroStyle: HeroStyleId;
  productGrid: ProductGridId;
};

export type ThemeColors = {
  primary: string;
  secondary: string;
  surface: string;
  onPrimary: string;
  onSurface: string;
};

export type ThemeGeneration = {
  provider: 'groq' | 'rule_fallback';
  model: string;
  fallback: boolean;
  promptVersion: string;
  generatedAt: string;
  attempts: number;
  adjustedColors: string[];
  contrast: Record<(typeof CONTRAST_KEYS)[number], number>;
  originalColors: ThemeColors;
};

export type ThemeConfiguration = {
  schemaVersion: typeof THEME_SCHEMA_VERSION;
  storeName: string;
  storeCategory: string;
  answers: ThemeAnswers;
  colors: ThemeColors;
  generation: ThemeGeneration;
};

export type ThemeModelOutput = {
  paletteId: PaletteId;
  navbarStyle: NavbarStyleId;
  heroStyle: HeroStyleId;
  productGrid: ProductGridId;
  primaryColor: string;
  secondaryColor: string;
  surfaceColor: string;
};

/** Schema passed to the shared gateway before semantic validation. */
export const THEME_OUTPUT_SCHEMA = {
  type: 'object',
  required: [
    'paletteId',
    'navbarStyle',
    'heroStyle',
    'productGrid',
    'primaryColor',
    'secondaryColor',
    'surfaceColor',
  ],
  additionalProperties: false,
  properties: {
    paletteId: { enum: [...PALETTE_IDS] },
    navbarStyle: { enum: [...NAVBAR_IDS] },
    heroStyle: { enum: [...HERO_IDS] },
    productGrid: { enum: [...PRODUCT_GRID_IDS] },
    primaryColor: { type: 'string', minLength: 7, maxLength: 7, pattern: '^#[0-9A-Fa-f]{6}$' },
    secondaryColor: { type: 'string', minLength: 7, maxLength: 7, pattern: '^#[0-9A-Fa-f]{6}$' },
    surfaceColor: { type: 'string', minLength: 7, maxLength: 7, pattern: '^#[0-9A-Fa-f]{6}$' },
  },
} as const;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value);
  const missing = expected.filter((key) => !actual.includes(key));
  const extra = actual.filter((key) => !expected.includes(key));
  if (missing.length || extra.length) {
    throw new Error(`${label} has invalid properties.`);
  }
}

function assertSafeLabel(value: unknown, label: string, minimum: number, maximum: number): asserts value is string {
  if (typeof value !== 'string' || value.length < minimum || value.length > maximum) {
    throw new Error(`${label} has invalid length.`);
  }
  if (/[<>\u0000-\u001F\u007F]/.test(value) || /javascript:|on[a-z]+\s*=/i.test(value)) {
    throw new Error(`${label} contains unsafe content.`);
  }
}

export function assertValidAnswers(value: unknown): asserts value is ThemeAnswers {
  assertObject(value, 'Theme answers');
  assertExactKeys(value, ['paletteId', 'navbarStyle', 'heroStyle', 'productGrid'], 'Theme answers');
  if (!isPaletteId(value.paletteId)) throw new Error('Invalid palette selection.');
  if (!isNavbarStyleId(value.navbarStyle)) throw new Error('Invalid navbar selection.');
  if (!isHeroStyleId(value.heroStyle)) throw new Error('Invalid hero selection.');
  if (!isProductGridId(value.productGrid)) throw new Error('Invalid product grid selection.');
}

export function assertValidThemeOutput(value: unknown): asserts value is ThemeModelOutput {
  assertObject(value, 'Theme output');
  assertExactKeys(
    value,
    ['paletteId', 'navbarStyle', 'heroStyle', 'productGrid', 'primaryColor', 'secondaryColor', 'surfaceColor'],
    'Theme output',
  );
  if (!isPaletteId(value.paletteId)) throw new Error('Theme output has an invalid palette.');
  if (!isNavbarStyleId(value.navbarStyle)) throw new Error('Theme output has an invalid navbar.');
  if (!isHeroStyleId(value.heroStyle)) throw new Error('Theme output has an invalid hero.');
  if (!isProductGridId(value.productGrid)) throw new Error('Theme output has an invalid product grid.');
  for (const key of ['primaryColor', 'secondaryColor', 'surfaceColor'] as const) {
    if (!isHexColor(value[key])) throw new Error(`Theme output has an invalid ${key}.`);
  }
}

function assertColors(value: unknown): asserts value is ThemeColors {
  assertObject(value, 'Theme colors');
  assertExactKeys(value, COLOR_TOKENS, 'Theme colors');
  for (const key of COLOR_TOKENS) {
    if (!isHexColor(value[key])) throw new Error(`Theme color ${key} is not a six-digit hex value.`);
  }
}

export function assertValidThemeConfiguration(value: unknown): asserts value is ThemeConfiguration {
  assertObject(value, 'Theme configuration');
  assertExactKeys(value, ['schemaVersion', 'storeName', 'storeCategory', 'answers', 'colors', 'generation'], 'Theme configuration');
  if (value.schemaVersion !== THEME_SCHEMA_VERSION) throw new Error('Unsupported theme schema version.');
  assertSafeLabel(value.storeName, 'Store name', 2, 80);
  assertSafeLabel(value.storeCategory, 'Store category', 2, 80);
  assertValidAnswers(value.answers);
  assertColors(value.colors);

  const generation = value.generation as Record<string, unknown>;
  assertObject(generation, 'Theme generation metadata');
  assertExactKeys(
    generation,
    ['provider', 'model', 'fallback', 'promptVersion', 'generatedAt', 'attempts', 'adjustedColors', 'contrast', 'originalColors'],
    'Theme generation metadata',
  );
  if (generation.provider !== 'groq' && generation.provider !== 'rule_fallback') {
    throw new Error('Invalid generation provider disclosure.');
  }
  if (typeof generation.model !== 'string' || generation.model.length < 1 || generation.model.length > 80) {
    throw new Error('Invalid generation model.');
  }
  if (typeof generation.fallback !== 'boolean') throw new Error('Invalid fallback disclosure.');
  if (generation.promptVersion !== THEME_PROMPT_VERSION) throw new Error('Invalid prompt version.');
  if (typeof generation.generatedAt !== 'string' || !Number.isFinite(Date.parse(generation.generatedAt))) {
    throw new Error('Invalid generated timestamp.');
  }
  const attempts = generation.attempts;
  if (typeof attempts !== 'number' || !Number.isInteger(attempts) || attempts < 0 || attempts > 10) {
    throw new Error('Invalid attempt count.');
  }
  if (!Array.isArray(generation.adjustedColors)
    || generation.adjustedColors.some((token) => !COLOR_TOKENS.includes(token as (typeof COLOR_TOKENS)[number]))) {
    throw new Error('Invalid adjusted-colour list.');
  }
  assertObject(generation.contrast, 'Contrast report');
  assertExactKeys(generation.contrast, CONTRAST_KEYS, 'Contrast report');
  for (const key of CONTRAST_KEYS) {
    const ratio = generation.contrast[key];
    if (typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio < 1 || ratio > 21) {
      throw new Error(`Invalid contrast ratio for ${key}.`);
    }
  }
  assertColors(generation.originalColors);
}

export function assertValidAnswerDraft(value: unknown): asserts value is Partial<ThemeAnswers> {
  assertObject(value, 'Theme answer draft');
  const allowed = ['paletteId', 'navbarStyle', 'heroStyle', 'productGrid'] as const;
  if (Object.keys(value).some((key) => !allowed.includes(key as (typeof allowed)[number]))) {
    throw new Error('Theme answer draft has an unsupported property.');
  }
  if ('paletteId' in value && !isPaletteId(value.paletteId)) throw new Error('Invalid saved palette selection.');
  if ('navbarStyle' in value && !isNavbarStyleId(value.navbarStyle)) throw new Error('Invalid saved navbar selection.');
  if ('heroStyle' in value && !isHeroStyleId(value.heroStyle)) throw new Error('Invalid saved hero selection.');
  if ('productGrid' in value && !isProductGridId(value.productGrid)) throw new Error('Invalid saved product grid selection.');
}

export function isValidAnswerDraft(value: unknown): value is Partial<ThemeAnswers> {
  try {
    assertValidAnswerDraft(value);
    return true;
  } catch {
    return false;
  }
}

export function isValidAnswers(value: unknown): value is ThemeAnswers {
  try {
    assertValidAnswers(value);
    return true;
  } catch {
    return false;
  }
}

export function isValidThemeConfiguration(value: unknown): value is ThemeConfiguration {
  try {
    assertValidThemeConfiguration(value);
    return true;
  } catch {
    return false;
  }
}

export function answersEqual(left: ThemeAnswers, right: ThemeAnswers): boolean {
  return left.paletteId === right.paletteId
    && left.navbarStyle === right.navbarStyle
    && left.heroStyle === right.heroStyle
    && left.productGrid === right.productGrid;
}
