/**
 * National geographic dataset for Pakistan.
 *
 * This module is the single, centrally maintained, version-controlled source of
 * truth for the application's *geographic identity* layer:
 *
 *   Country  →  Province / Administrative Region  →  District  →  City / Tehsil / Locality
 *
 * Two concepts are deliberately kept separate:
 *
 *   1. Geographic IDENTITY  — where a project is located. This is **nationwide**
 *      (all of Pakistan). Recognising a province/district never depends on
 *      whether feasibility data exists for it.
 *   2. Geographic COVERAGE  — whether *verified* feasibility data (benchmarks,
 *      seasonal trends, regional statistics) exists for a region. Coverage is
 *      surfaced via `coverage` / `analysis_enabled` / `supported_categories` and
 *      is **NOT** an identity restriction: a recognised region stays selectable
 *      even when its coverage is `none`.
 *
 * Data integrity rules (see docs/GEOGRAPHIC_ARCHITECTURE_AUDIT.md):
 *   - Administrative records are only included where an authoritative record is
 *     available. No records are fabricated.
 *   - `district_registry_complete` is `true` only for regions whose district list
 *     is an authoritative, verified registry (currently Punjab). For regions with
 *     a partial or not-yet-included registry the flag is `false` and callers must
 *     accept user-provided district/city text under the recognised region.
 *   - Coverage is Punjab-first: Punjab is `verified`; every other region is `none`
 *     until authoritative feasibility data is added (see the expansion procedure
 *     in the audit document).
 *
 * Extensibility: this dataset is intentionally a plain module so a database-backed
 * registry can replace/wrap it later behind the same helper functions without
 * rewriting the wizard, validation, APIs or providers.
 */

/** Fixed country scope for the application. */
export const PAKISTAN_COUNTRY = 'Pakistan';

/** ISO 3166-1 alpha-2 country code. */
export const PAKISTAN_COUNTRY_CODE = 'PK';

/** Default (fully data-supported) region; Punjab is the Punjab-first launch region. */
export const DEFAULT_REGION_NAME = 'Punjab';

/** Geographic bounds used for coordinate validation (Pakistan territory). */
export const PAKISTAN_BOUNDS = {
  minLat: 23.5,
  maxLat: 37.2,
  minLng: 60.8,
  maxLng: 77.9,
} as const;

/**
 * Verified-data coverage status for a region.
 *  - `verified` — authoritative feasibility data exists (benchmarks, trends, stats)
 *  - `limited`  — partial authoritative data exists
 *  - `none`     — recognised region, no verified feasibility data yet
 */
export type GeoCoverageStatus = 'verified' | 'limited' | 'none';

/**
 * A district and the cities/tehsils/localities recognised beneath it.
 * `tehsils` and `localities` are optional so differently-structured regions are
 * supported without inventing intermediate records.
 */
export interface GeoDistrict {
  name: string;
  cities: string[];
  tehsils?: string[];
  localities?: string[];
}

/** A province or administrative territory of Pakistan. */
export interface PakistanRegion {
  /** Human-readable region name (e.g. `Punjab`). Persisted in `projects.region`. */
  name: string;
  /** ISO 3166-2 code (e.g. `PK-PB`). Persisted in `projects.metadata.geo.region_code`. */
  code: string;
  /** Verified feasibility-data coverage for this region. */
  coverage: GeoCoverageStatus;
  /** Whether curated feasibility analysis providers may run for this region. */
  analysis_enabled: boolean;
  /** Categories with verified coverage (empty when `analysis_enabled` is false). */
  supported_categories: string[];
  /** Whether `districts` is a complete, authoritative registry for the region. */
  district_registry_complete: boolean;
  /** Provenance / coverage note shown to users and stored in coverage snapshots. */
  source_note: string;
  districts: GeoDistrict[];
}

/**
 * The five approved Task 3 categories. Kept as literals here (rather than
 * importing from `@/types/project`) to avoid a circular import; a regression test
 * asserts these stay in sync with `PREDEFINED_CATEGORIES`.
 */
const VERIFIED_PUNJAB_CATEGORIES: string[] = [
  'Grocery / General Stores',
  'Clothing / Footwear',
  'Mobile Phones / Accessories',
  'Restaurants / Cafes',
  'Pharmacies / Medical Stores',
];

/**
 * Authoritative Punjab district registry — sourced from the verified
 * `PUNJAB_DISTRICT_BENCHMARKS` corpus (PBS Census 2023 / Punjab Development
 * Statistics). Each district's headquarters city shares the district name.
 */
const PUNJAB_DISTRICTS_VERIFIED: GeoDistrict[] = [
  { name: 'Lahore', cities: ['Lahore'] },
  { name: 'Rawalpindi', cities: ['Rawalpindi'] },
  { name: 'Faisalabad', cities: ['Faisalabad'] },
  { name: 'Multan', cities: ['Multan'] },
  { name: 'Gujranwala', cities: ['Gujranwala'] },
  { name: 'Sialkot', cities: ['Sialkot'] },
  { name: 'Bahawalpur', cities: ['Bahawalpur'] },
  { name: 'Sargodha', cities: ['Sargodha'] },
  { name: 'Sahiwal', cities: ['Sahiwal'] },
  { name: 'Sheikhupura', cities: ['Sheikhupura'] },
];

/**
 * Recognised provinces and administrative territories of Pakistan.
 *
 * Only Punjab carries a complete, verified registry and coverage in this version.
 * The remaining regions are recognised nationally so their locations stay
 * selectable; their district lists are an explicitly partial subset of
 * well-established district names (flagged `district_registry_complete: false`).
 * No feasibility coverage is claimed for them.
 */
export const PAKISTAN_REGIONS: PakistanRegion[] = [
  {
    name: 'Punjab',
    code: 'PK-PB',
    coverage: 'verified',
    analysis_enabled: true,
    supported_categories: VERIFIED_PUNJAB_CATEGORIES,
    district_registry_complete: true,
    source_note:
      'Verified Punjab feasibility coverage (PBS Census 2023 / Punjab Development Statistics benchmarks, seasonal trends and regional statistics).',
    districts: PUNJAB_DISTRICTS_VERIFIED,
  },
  {
    name: 'Sindh',
    code: 'PK-SD',
    coverage: 'none',
    analysis_enabled: false,
    supported_categories: [],
    district_registry_complete: false,
    source_note:
      'Sindh is recognised nationally. A complete authoritative district registry and verified feasibility data are not yet included; user-provided district/city text is accepted.',
    districts: [
      { name: 'Karachi', cities: ['Karachi'] },
      { name: 'Hyderabad', cities: ['Hyderabad'] },
      { name: 'Sukkur', cities: ['Sukkur'] },
      { name: 'Larkana', cities: ['Larkana'] },
      { name: 'Mirpur Khas', cities: ['Mirpur Khas'] },
      { name: 'Shaheed Benazirabad', cities: ['Nawabshah'] },
    ],
  },
  {
    name: 'Khyber Pakhtunkhwa',
    code: 'PK-KP',
    coverage: 'none',
    analysis_enabled: false,
    supported_categories: [],
    district_registry_complete: false,
    source_note:
      'Khyber Pakhtunkhwa is recognised nationally. A complete authoritative district registry and verified feasibility data are not yet included; user-provided district/city text is accepted.',
    districts: [
      { name: 'Peshawar', cities: ['Peshawar'] },
      { name: 'Mardan', cities: ['Mardan'] },
      { name: 'Abbottabad', cities: ['Abbottabad'] },
      { name: 'Swat', cities: ['Mingora'] },
      { name: 'Kohat', cities: ['Kohat'] },
      { name: 'Bannu', cities: ['Bannu'] },
      { name: 'Dera Ismail Khan', cities: ['Dera Ismail Khan'] },
    ],
  },
  {
    name: 'Balochistan',
    code: 'PK-BA',
    coverage: 'none',
    analysis_enabled: false,
    supported_categories: [],
    district_registry_complete: false,
    source_note:
      'Balochistan is recognised nationally. A complete authoritative district registry and verified feasibility data are not yet included; user-provided district/city text is accepted.',
    districts: [
      { name: 'Quetta', cities: ['Quetta'] },
      { name: 'Gwadar', cities: ['Gwadar'] },
      { name: 'Khuzdar', cities: ['Khuzdar'] },
      { name: 'Sibi', cities: ['Sibi'] },
      { name: 'Zhob', cities: ['Zhob'] },
      { name: 'Kech', cities: ['Turbat'] },
    ],
  },
  {
    name: 'Islamabad Capital Territory',
    code: 'PK-IS',
    coverage: 'none',
    analysis_enabled: false,
    supported_categories: [],
    district_registry_complete: false,
    source_note:
      'Islamabad Capital Territory is recognised nationally. Verified feasibility data is not yet included for this territory.',
    districts: [{ name: 'Islamabad', cities: ['Islamabad'] }],
  },
  {
    name: 'Azad Jammu and Kashmir',
    code: 'PK-AK',
    coverage: 'none',
    analysis_enabled: false,
    supported_categories: [],
    district_registry_complete: false,
    source_note:
      'Azad Jammu and Kashmir is recognised nationally. A complete authoritative district registry and verified feasibility data are not yet included; user-provided district/city text is accepted.',
    districts: [
      { name: 'Muzaffarabad', cities: ['Muzaffarabad'] },
      { name: 'Mirpur', cities: ['Mirpur'] },
      { name: 'Poonch', cities: ['Rawalakot'] },
      { name: 'Kotli', cities: ['Kotli'] },
    ],
  },
  {
    name: 'Gilgit-Baltistan',
    code: 'PK-GB',
    coverage: 'none',
    analysis_enabled: false,
    supported_categories: [],
    district_registry_complete: false,
    source_note:
      'Gilgit-Baltistan is recognised nationally. A complete authoritative district registry and verified feasibility data are not yet included; user-provided district/city text is accepted.',
    districts: [
      { name: 'Gilgit', cities: ['Gilgit'] },
      { name: 'Skardu', cities: ['Skardu'] },
      { name: 'Diamer', cities: ['Chilas'] },
      { name: 'Astore', cities: ['Astore'] },
    ],
  },
];

/** All recognised region names. */
export const PAKISTAN_REGION_NAMES: string[] = PAKISTAN_REGIONS.map((r) => r.name);

/** All recognised ISO 3166-2 region codes. */
export const PAKISTAN_REGION_CODES: string[] = PAKISTAN_REGIONS.map((r) => r.code);

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

/** Resolve a region by its display name or ISO 3166-2 code (case-insensitive). */
export function getRegion(nameOrCode: string | null | undefined): PakistanRegion | null {
  if (!nameOrCode) return null;
  const key = normalise(nameOrCode);
  return (
    PAKISTAN_REGIONS.find((r) => normalise(r.name) === key || normalise(r.code) === key) || null
  );
}

/** True when the value identifies a recognised region (name or ISO code). */
export function isRecognisedRegion(nameOrCode: string | null | undefined): boolean {
  return getRegion(nameOrCode) !== null;
}

/** The canonical region name for a name-or-code value, or `null` when unrecognised. */
export function canonicalRegionName(nameOrCode: string | null | undefined): string | null {
  return getRegion(nameOrCode)?.name ?? null;
}

/** Resolve the region that a district belongs to, searching the curated lists. */
export function getRegionForDistrict(district: string | null | undefined): PakistanRegion | null {
  if (!district) return null;
  const key = normalise(district);
  return (
    PAKISTAN_REGIONS.find((r) => r.districts.some((d) => normalise(d.name) === key)) || null
  );
}

/** Find a district record inside a specific region (name or code). */
export function getDistrict(
  regionNameOrCode: string | null | undefined,
  district: string | null | undefined
): GeoDistrict | null {
  const region = getRegion(regionNameOrCode);
  if (!region || !district) return null;
  const key = normalise(district);
  return region.districts.find((d) => normalise(d.name) === key) || null;
}

/**
 * Whether a district is recognised for the region.
 *
 * A district is recognised when either (a) the region lists it explicitly, or
 * (b) the region has no complete authoritative registry — in which case any
 * non-empty user-provided district under the recognised region is accepted
 * (coverage-limited), because recognition must not be coupled to coverage.
 */
export function isRecognisedDistrict(
  regionNameOrCode: string | null | undefined,
  district: string | null | undefined
): boolean {
  const region = getRegion(regionNameOrCode);
  if (!region || !district || district.trim() === '') return false;
  if (getDistrict(region.name, district)) return true;
  return !region.district_registry_complete;
}

/** Whether a city is recognised for the region (and district when curated). */
export function isRecognisedCity(
  regionNameOrCode: string | null | undefined,
  district: string | null | undefined,
  city: string | null | undefined
): boolean {
  const region = getRegion(regionNameOrCode);
  if (!region || !city || city.trim() === '') return false;
  const districtRecord = getDistrict(region.name, district);
  if (districtRecord) {
    return districtRecord.cities.some((c) => normalise(c) === normalise(city));
  }
  // Region without a curated registry for this district: accept user-provided text.
  return !region.district_registry_complete;
}

/** Cities recognised beneath a district, or `[]` when the district isn't curated. */
export function getCitiesForDistrict(
  regionNameOrCode: string | null | undefined,
  district: string | null | undefined
): string[] {
  return getDistrict(regionNameOrCode, district)?.cities ?? [];
}

/** Convenience accessor for a region's working districts list. */
export function getDistrictsForRegion(regionNameOrCode: string | null | undefined): GeoDistrict[] {
  return getRegion(regionNameOrCode)?.districts ?? [];
}

/** Coverage/analysis metadata for a region. */
export function getRegionCoverage(regionNameOrCode: string | null | undefined): {
  coverage: GeoCoverageStatus;
  analysis_enabled: boolean;
  supported_categories: string[];
  source_note: string;
} | null {
  const region = getRegion(regionNameOrCode);
  if (!region) return null;
  return {
    coverage: region.coverage,
    analysis_enabled: region.analysis_enabled,
    supported_categories: region.supported_categories,
    source_note: region.source_note,
  };
}

/**
 * Coverage snapshot persisted inside the existing `projects.metadata` JSONB.
 * Keeps geographic IDENTITY and DATA COVERAGE explicitly separate in storage.
 */
export interface GeoCoverageSnapshot {
  country: string;
  region: string | null;
  region_code: string | null;
  district: string | null;
  city: string | null;
  coverage: GeoCoverageStatus | 'unrecognised';
  analysis_enabled: boolean;
  supported_categories: string[];
  source_note: string;
  captured_at: string;
}

export function buildCoverageSnapshot(input: {
  region?: string | null;
  district?: string | null;
  city?: string | null;
  now?: Date;
}): GeoCoverageSnapshot {
  const region = getRegion(input.region);
  return {
    country: PAKISTAN_COUNTRY,
    region: region?.name ?? (input.region?.trim() || null),
    region_code: region?.code ?? null,
    district: input.district?.trim() || null,
    city: input.city?.trim() || null,
    coverage: region ? region.coverage : 'unrecognised',
    analysis_enabled: region?.analysis_enabled ?? false,
    supported_categories: region?.supported_categories ?? [],
    source_note: region?.source_note ?? 'Region not recognised in the national geographic dataset.',
    captured_at: (input.now ?? new Date()).toISOString(),
  };
}

/**
 * A verified commercial hub preset. Hub presets are **coverage-backed** and only
 * exist for locations with verified coordinates (currently Punjab).
 */
export interface CommercialHubPreset {
  name: string;
  province: string;
  district: string;
  city: string;
  lat: number;
  lng: number;
  label: string;
}

/**
 * Punjab commercial hub presets with verified coordinates (Task 3 §4).
 * Non-Punjab hubs are intentionally omitted because no verified coordinates are
 * included in this version; recognised non-Punjab locations remain selectable
 * without a hub preset.
 */
export const COMMERCIAL_HUB_PRESETS: CommercialHubPreset[] = [
  { name: 'Gulberg III, Lahore', province: 'Punjab', district: 'Lahore', city: 'Lahore', lat: 31.5204, lng: 74.3587, label: 'Lahore Retail & Fashion Hub' },
  { name: 'DHA Phase 5 & 6, Lahore', province: 'Punjab', district: 'Lahore', city: 'Lahore', lat: 31.4722, lng: 74.4093, label: 'Lahore Affluent Residential Commercial' },
  { name: 'Anarkali & Mall Road, Lahore', province: 'Punjab', district: 'Lahore', city: 'Lahore', lat: 31.5657, lng: 74.3142, label: 'Lahore Historic Central Bazaar' },
  { name: 'Model Town / Johar Town, Lahore', province: 'Punjab', district: 'Lahore', city: 'Lahore', lat: 31.4697, lng: 74.2728, label: 'Lahore High-Density Suburban Hub' },
  { name: 'Clock Tower / D-Ground, Faisalabad', province: 'Punjab', district: 'Faisalabad', city: 'Faisalabad', lat: 31.4187, lng: 73.0791, label: 'Faisalabad Textile & Wholesale Hub' },
  { name: 'Saddar Commercial, Rawalpindi', province: 'Punjab', district: 'Rawalpindi', city: 'Rawalpindi', lat: 33.5973, lng: 73.0479, label: 'Rawalpindi Central Business District' },
  { name: 'Bahria Town Commercial, Rawalpindi', province: 'Punjab', district: 'Rawalpindi', city: 'Rawalpindi', lat: 33.5186, lng: 73.1094, label: 'Rawalpindi Modern Retail Corridor' },
  { name: 'Hussain Agahi & Cantt, Multan', province: 'Punjab', district: 'Multan', city: 'Multan', lat: 30.1984, lng: 71.4687, label: 'South Punjab Trade Hub' },
  { name: 'Model Town / GT Road, Gujranwala', province: 'Punjab', district: 'Gujranwala', city: 'Gujranwala', lat: 32.1877, lng: 74.1945, label: 'Gujranwala Manufacturing & Retail Strip' },
  { name: 'Paris Road / Shahab Pura, Sialkot', province: 'Punjab', district: 'Sialkot', city: 'Sialkot', lat: 32.4945, lng: 74.5229, label: 'Sialkot Export & Commercial Center' },
  { name: 'Circular Road, Bahawalpur', province: 'Punjab', district: 'Bahawalpur', city: 'Bahawalpur', lat: 29.3956, lng: 71.6836, label: 'Bahawalpur City Center' },
];

/** Hub presets filtered to a single region. */
export function getHubPresetsForRegion(regionNameOrCode: string | null | undefined): CommercialHubPreset[] {
  const region = getRegion(regionNameOrCode);
  if (!region) return [];
  return COMMERCIAL_HUB_PRESETS.filter((h) => normalise(h.province) === normalise(region.name));
}
