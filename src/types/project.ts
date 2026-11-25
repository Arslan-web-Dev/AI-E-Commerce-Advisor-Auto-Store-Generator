export type ProjectStatus = 'draft' | 'submitted' | 'analyzing' | 'completed' | 'failed';
export type BusinessScale = 'small' | 'medium' | 'large';
export type BusinessModel = 'd2c' | 'hybrid' | 'physical';
export type StorefrontFootprint = 'kiosk' | 'boutique' | 'commercial' | 'flagship';
export type BudgetCurrency = 'USD' | 'PKR';

export interface TargetAudience {
  age_group?: string;
  gender?: string;
  income_level?: string;
}

export interface Project {
  id: string;
  owner_id: string;
  title: string | null;
  category: string;
  custom_category: string | null;
  target_location: string;
  city: string | null;
  district: string | null;
  region: string | null;
  country: string | null;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
  radius_km: number;
  budget_amount: number;
  budget_currency: BudgetCurrency;
  budget_pkr: number | null;
  target_audience: TargetAudience;
  business_scale: BusinessScale;
  business_model: BusinessModel;
  storefront_footprint: StorefrontFootprint;
  product_description: string | null;
  product_types: string[];
  product_file_url: string | null;
  product_file_name: string | null;
  product_file_size: number | null;
  current_step: number;
  form_version: number;
  metadata: Record<string, unknown>;
  status: ProjectStatus;
  report_id: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
}

export interface ProjectFormData {
  title: string;
  category: string;
  custom_category: string;
  target_location: string;
  city: string;
  district: string;
  region: string;
  country: string;
  postal_code: string;
  lat?: number;
  lng?: number;
  radius_km: number;
  budget_amount: number;
  budget_currency: BudgetCurrency;
  target_audience: TargetAudience;
  business_scale: BusinessScale;
  business_model: BusinessModel;
  storefront_footprint: StorefrontFootprint;
  product_description: string;
  product_types: string[];
  product_file_url?: string;
  product_file_name?: string;
  product_file_size?: number;
  current_step: number;
}

export interface StoreCategoryOption {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  icon: string;
  description: string;
}

// Five approved priority categories (Task 3 §3). These identifiers are the
// single source of truth shared by the wizard, the API validation layer, the
// database `projects.category` value and downstream provider payloads.
// `APPROVED_CATEGORIES` is the canonical display-name list consumed by ML
// validation so the Python sandbox and the UI cannot drift apart.
export const APPROVED_CATEGORIES: string[] = [
  'Grocery / General Stores',
  'Clothing / Footwear',
  'Mobile Phones / Accessories',
  'Restaurants / Cafes',
  'Pharmacies / Medical Stores',
];

export const PREDEFINED_CATEGORIES: StoreCategoryOption[] = [
  {
    id: 'grocery-general-stores',
    name: 'Grocery / General Stores',
    tagline: 'Essential Daily Demand',
    badge: 'Essential',
    icon: 'local_grocery_store',
    description: 'Kirana & general stores, mini-marts, daily-need convenience and household retail.'
  },
  {
    id: 'clothing-footwear',
    name: 'Clothing / Footwear',
    tagline: 'High Demand',
    badge: 'High Demand',
    icon: 'apparel',
    description: 'Ready-to-wear apparel, unstitched fabric, footwear and fashion accessories.'
  },
  {
    id: 'mobile-phones-accessories',
    name: 'Mobile Phones / Accessories',
    tagline: 'Fast Moving',
    badge: 'Fast Moving',
    icon: 'devices',
    description: 'Mobile handsets, repair services, chargers, covers and everyday phone accessories.'
  },
  {
    id: 'restaurants-cafes',
    name: 'Restaurants / Cafes',
    tagline: 'Experience Led',
    badge: 'Growing',
    icon: 'restaurant',
    description: 'Dine-in restaurants, fast food outlets, bakeries and specialty cafes.'
  },
  {
    id: 'pharmacies-medical-stores',
    name: 'Pharmacies / Medical Stores',
    tagline: 'Essential Footprint',
    badge: 'Essential',
    icon: 'local_pharmacy',
    description: 'Retail pharmacies, medical stores, surgical supplies and everyday wellness retail.'
  }
];

// Geographic IDENTITY is maintained in a single, version-controlled national
// dataset (src/lib/geo/pakistan-geography.ts) covering all of Pakistan, with
// Punjab as the initial verified-data coverage region. These re-exports keep the
// existing import surface stable; add new regions in the dataset, not here.
export {
  PAKISTAN_COUNTRY,
  PAKISTAN_COUNTRY_CODE,
  DEFAULT_REGION_NAME,
  PAKISTAN_BOUNDS,
  PAKISTAN_REGIONS,
  PAKISTAN_REGION_NAMES,
  PAKISTAN_REGION_CODES,
  COMMERCIAL_HUB_PRESETS,
} from '@/lib/geo/pakistan-geography';

export type {
  PakistanRegion,
  GeoDistrict,
  GeoCoverageStatus,
  CommercialHubPreset,
} from '@/lib/geo/pakistan-geography';

export const AGE_GROUP_OPTIONS = [
  'All Ages / General Demographic',
  'Gen Z (18-24 years)',
  'Young Professionals (25-34 years)',
  'Families & Middle-Aged (35-50 years)',
  'Mature & Seniors (50+ years)',
  'Prefer not to specify'
];

export const GENDER_OPTIONS = [
  'All Genders / Unisex',
  'Female-Skewed',
  'Male-Skewed',
  'Neutral / Household'
];

export const INCOME_LEVEL_OPTIONS = [
  'Value / Budget Conscious (Affordable)',
  'Middle Income / Mass Market',
  'Affluent / Upper Middle Class',
  'Luxury / High Net Worth',
  'All Income Segments'
];

export const BUSINESS_SCALE_OPTIONS: { id: BusinessScale; label: string; desc: string }[] = [
  { id: 'small', label: 'Small / Boutique Startup', desc: '1-3 initial SKUs, single fulfillment location, bootstrap capital.' },
  { id: 'medium', label: 'Medium / Commercial Scale', desc: '10-50 SKUs, multi-channel reach, established supplier accounts.' },
  { id: 'large', label: 'Large / Regional Retail Venture', desc: '50+ SKUs, omnichannel storefront, warehousing & dedicated logistics.' }
];

export const FOOTPRINT_OPTIONS: { id: StorefrontFootprint; label: string; sub: string }[] = [
  { id: 'kiosk', label: 'Kiosk / Booth', sub: '<150 sq.ft' },
  { id: 'boutique', label: 'Boutique', sub: '150 - 400 sq.ft' },
  { id: 'commercial', label: 'Commercial Outlet', sub: '400 - 1,000 sq.ft' },
  { id: 'flagship', label: 'Flagship Space', sub: '>1,000 sq.ft' }
];

// Helper to convert PKR / USD
// Fixed illustrative conversion used by the current wizard; this is not a live FX quote.
export const EXCHANGE_RATE_USD_TO_PKR = 278;
