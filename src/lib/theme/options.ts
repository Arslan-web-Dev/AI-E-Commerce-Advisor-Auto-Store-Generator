/** Approved, server-owned Module 7 MCQ options. No model-generated variant IDs. */

export const PALETTE_OPTIONS = [
  {
    id: 'emerald_night',
    label: 'Emerald Night',
    description: 'Deep green surface with fresh mint and sky accents.',
    swatches: ['#34D399', '#38BDF8', '#07130F'],
    colors: { primary: '#34D399', secondary: '#38BDF8', surface: '#07130F' },
  },
  {
    id: 'ocean_blue',
    label: 'Ocean Blue',
    description: 'Navy surface with blue and violet highlights.',
    swatches: ['#38BDF8', '#A78BFA', '#071427'],
    colors: { primary: '#38BDF8', secondary: '#A78BFA', surface: '#071427' },
  },
  {
    id: 'amber_sand',
    label: 'Amber Sand',
    description: 'Warm dark surface with amber and coral accents.',
    swatches: ['#F59E0B', '#FB7185', '#1C1205'],
    colors: { primary: '#F59E0B', secondary: '#FB7185', surface: '#1C1205' },
  },
  {
    id: 'rose_brand',
    label: 'Rose Brand',
    description: 'Plum surface with rose and lilac accents.',
    swatches: ['#FB7185', '#C084FC', '#1B0710'],
    colors: { primary: '#FB7185', secondary: '#C084FC', surface: '#1B0710' },
  },
] as const;

export const NAVBAR_OPTIONS = [
  { id: 'centered', label: 'Centered', description: 'Brand mark centred above compact links.', preview: 'centered' },
  { id: 'left_aligned', label: 'Left aligned', description: 'Traditional left-logo navigation bar.', preview: 'left' },
  { id: 'split', label: 'Split', description: 'Brand left, primary action right.', preview: 'split' },
  { id: 'floating', label: 'Floating', description: 'Rounded bar floating over the hero.', preview: 'floating' },
] as const;

export const HERO_OPTIONS = [
  { id: 'split_focus', label: 'Split focus', description: 'Headline beside a representative image block.', preview: 'split' },
  { id: 'full_width', label: 'Full width', description: 'Centred headline over a wide banner.', preview: 'full' },
  { id: 'editorial', label: 'Editorial', description: 'Large serif-style statement with small supporting text.', preview: 'editorial' },
  { id: 'minimal', label: 'Minimal', description: 'Compact headline and single call to action.', preview: 'minimal' },
] as const;

export const PRODUCT_GRID_OPTIONS = [
  { id: 'two_column', label: 'Two columns', description: 'Large cards suitable for detailed products.', preview: 'two' },
  { id: 'three_column', label: 'Three columns', description: 'Balanced catalogue grid.', preview: 'three' },
  { id: 'four_column', label: 'Four columns', description: 'Dense catalogue for many items.', preview: 'four' },
  { id: 'featured_strip', label: 'Featured strip', description: 'One large featured card with smaller cards below.', preview: 'featured' },
] as const;

export const PALETTE_IDS = PALETTE_OPTIONS.map((option) => option.id);
export const NAVBAR_IDS = NAVBAR_OPTIONS.map((option) => option.id);
export const HERO_IDS = HERO_OPTIONS.map((option) => option.id);
export const PRODUCT_GRID_IDS = PRODUCT_GRID_OPTIONS.map((option) => option.id);

export type PaletteId = (typeof PALETTE_OPTIONS)[number]['id'];
export type NavbarStyleId = (typeof NAVBAR_OPTIONS)[number]['id'];
export type HeroStyleId = (typeof HERO_OPTIONS)[number]['id'];
export type ProductGridId = (typeof PRODUCT_GRID_OPTIONS)[number]['id'];

export function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === 'string' && PALETTE_IDS.includes(value as PaletteId);
}

export function isNavbarStyleId(value: unknown): value is NavbarStyleId {
  return typeof value === 'string' && NAVBAR_IDS.includes(value as NavbarStyleId);
}

export function isHeroStyleId(value: unknown): value is HeroStyleId {
  return typeof value === 'string' && HERO_IDS.includes(value as HeroStyleId);
}

export function isProductGridId(value: unknown): value is ProductGridId {
  return typeof value === 'string' && PRODUCT_GRID_IDS.includes(value as ProductGridId);
}

export function findPalette(id: string) {
  return PALETTE_OPTIONS.find((option) => option.id === id) ?? PALETTE_OPTIONS[0];
}

export const MODULE7_OPTION_COUNTS = {
  palette: PALETTE_OPTIONS.length,
  navbar: NAVBAR_OPTIONS.length,
  hero: HERO_OPTIONS.length,
  productGrid: PRODUCT_GRID_OPTIONS.length,
} as const;
