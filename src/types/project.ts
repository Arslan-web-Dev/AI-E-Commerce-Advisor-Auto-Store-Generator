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

export const PREDEFINED_CATEGORIES: StoreCategoryOption[] = [
  {
    id: 'apparel-fashion',
    name: 'Apparel & Fashion',
    tagline: 'High Demand',
    badge: 'High Demand',
    icon: 'apparel',
    description: 'Eastern & western wear, footwear, contemporary accessories & ready-to-wear lines.'
  },
  {
    id: 'consumer-electronics',
    name: 'Consumer Electronics',
    tagline: 'Fast Moving',
    badge: 'Fast Moving',
    icon: 'devices',
    description: 'Mobile accessories, smart home hardware, audio gear & personal micro-electronics.'
  },
  {
    id: 'cosmetics-skincare',
    name: 'Cosmetics & Skincare',
    tagline: 'High Margin',
    badge: 'High Margin',
    icon: 'auto_fix_high',
    description: 'Organic skincare, dermatological beauty, hair wellness & custom perfumery.'
  },
  {
    id: 'grocery-gourmet',
    name: 'Grocery & Gourmet Food',
    tagline: 'Local Footprint',
    badge: 'Local Footprint',
    icon: 'nutrition',
    description: 'Organic honey, mountain dry fruits, cold-pressed oils & artisanal regional pantry snacks.'
  },
  {
    id: 'home-decor',
    name: 'Home Decor & Living',
    tagline: 'Emerging',
    badge: 'Emerging',
    icon: 'deck',
    description: 'Artisan pottery, architectural lamps, sustainable rugs & handcrafted wooden furniture.'
  },
  {
    id: 'other-niche',
    name: 'Other Niche Venture',
    tagline: 'Custom Model',
    badge: 'Custom Model',
    icon: 'explore',
    description: 'Specialized sports equipment, pet boutique supplies, or experiential subscription models.'
  }
];

export interface CommercialHubPreset {
  name: string;
  city: string;
  lat: number;
  lng: number;
  label: string;
}

export const COMMERCIAL_HUB_PRESETS: CommercialHubPreset[] = [
  { name: 'Gulberg III, Lahore', city: 'Lahore', lat: 31.5204, lng: 74.3587, label: 'Lahore Retail & Fashion Hub' },
  { name: 'DHA Phase 5 & 6, Lahore', city: 'Lahore', lat: 31.4722, lng: 74.4093, label: 'Lahore Affluent Residential Commercial' },
  { name: 'Anarkali & Mall Road, Lahore', city: 'Lahore', lat: 31.5657, lng: 74.3142, label: 'Lahore Historic Central Bazaar' },
  { name: 'Model Town / Johar Town, Lahore', city: 'Lahore', lat: 31.4697, lng: 74.2728, label: 'Lahore High-Density Suburban Hub' },
  { name: 'Clock Tower / D-Ground, Faisalabad', city: 'Faisalabad', lat: 31.4187, lng: 73.0791, label: 'Faisalabad Textile & Wholesale Hub' },
  { name: 'Saddar Commercial, Rawalpindi', city: 'Rawalpindi', lat: 33.5973, lng: 73.0479, label: 'Rawalpindi Central Business District' },
  { name: 'Bahria Town Commercial, Rawalpindi', city: 'Rawalpindi', lat: 33.5186, lng: 73.1094, label: 'Rawalpindi / Islamabad Twin Cities Modern Retail' },
  { name: 'Hussain Agahi & Cantt, Multan', city: 'Multan', lat: 30.1984, lng: 71.4687, label: 'South Punjab Trade Hub' },
  { name: 'Model Town / GT Road, Gujranwala', city: 'Gujranwala', lat: 32.1877, lng: 74.1945, label: 'Gujranwala Manufacturing & Retail Strip' },
  { name: 'Paris Road / Shahab Pura, Sialkot', city: 'Sialkot', lat: 32.4945, lng: 74.5229, label: 'Sialkot Export & Commercial Center' },
  { name: 'Circular Road, Bahawalpur', city: 'Bahawalpur', lat: 29.3956, lng: 71.6836, label: 'Bahawalpur City Center' },
  { name: 'Blue Area, Islamabad', city: 'Islamabad', lat: 33.7153, lng: 73.0673, label: 'Federal Capital Corporate Hub' },
  { name: 'F-7 / F-10 Markaz, Islamabad', city: 'Islamabad', lat: 33.7208, lng: 73.0564, label: 'Islamabad Prime Retail Markaz' },
  { name: 'Clifton & Defence, Karachi', city: 'Karachi', lat: 24.8138, lng: 67.0305, label: 'Karachi Coastal Commercial' },
  { name: 'Saddar Commercial, Karachi', city: 'Karachi', lat: 24.8569, lng: 67.0264, label: 'Karachi Central Wholesale District' },
];

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
