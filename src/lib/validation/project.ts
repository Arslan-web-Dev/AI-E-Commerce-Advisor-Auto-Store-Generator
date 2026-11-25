import {
  PREDEFINED_CATEGORIES,
  BudgetCurrency,
  BusinessScale,
  BusinessModel,
  StorefrontFootprint,
  ProjectFormData,
} from '@/types/project';
import {
  PAKISTAN_COUNTRY,
  PAKISTAN_BOUNDS,
  PAKISTAN_REGION_NAMES,
  canonicalRegionName,
  getDistrict,
  getRegion,
  getRegionForDistrict,
  isRecognisedDistrict,
  isRecognisedCity,
} from '@/lib/geo/pakistan-geography';

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const ALLOWED_CATEGORY_NAMES = PREDEFINED_CATEGORIES.map((c) => c.name);

function isProvided(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Resolve the region (province/administrative territory) for a payload.
 *
 * Prefers an explicitly selected region; otherwise infers it from a recognised
 * district. Inferring keeps valid records workable if `region` is omitted, while
 * an unrecognised region name is never silently replaced by Punjab.
 */
function resolveRegionName(data: Partial<ProjectFormData> | Record<string, unknown>): string | null {
  const explicit = canonicalRegionName(asTrimmedString(data.region));
  if (explicit) return explicit;
  const district = asTrimmedString(data.district);
  if (district) return getRegionForDistrict(district)?.name ?? null;
  return null;
}

/**
 * Field-level validation.
 *
 * Validates only the fields that are actually supplied, so partial drafts can be
 * persisted while every supplied value is still validated on the server (Task 3
 * §6 and §8: draft updates must not bypass server validation).
 *
 * Geographic scope is national (all of Pakistan). Recognition is decoupled from
 * data coverage: a recognised region/district/city is accepted even when no
 * verified feasibility data exists for it. Punjab remains the fully-supported
 * region. Omission of a geographic value is allowed here (drafts); completeness
 * is enforced per step in `validateProjectStep`.
 *
 * A neutral `budget_amount` of 0 is treated as "not yet entered" rather than a
 * rejected value, because 0 is the wizard's documented neutral default. Negative,
 * non-finite, malformed and out-of-range values are always rejected.
 */
export function validateProjectFields(
  data: Partial<ProjectFormData> | Record<string, unknown>
): ValidationResult {
  const errors: Record<string, string> = {};

  // Category — must be one of the five approved categories (Task 3 §3)
  if (typeof data.category === 'string' && data.category.trim() !== '') {
    const category = data.category.trim();
    if (!ALLOWED_CATEGORY_NAMES.includes(category)) {
      errors.category = `Unsupported category. Must be one of: ${ALLOWED_CATEGORY_NAMES.join(', ')}`;
    }
  }

  // Business description
  if (typeof data.product_description === 'string' && data.product_description.length > 2000) {
    errors.product_description = 'Product description cannot exceed 2000 characters.';
  }

  // Region (province / administrative territory) — any recognised region of
  // Pakistan is accepted regardless of its data coverage.
  const regionInput = asTrimmedString(data.region);
  if (regionInput !== '' && !canonicalRegionName(regionInput)) {
    errors.region = `Unsupported region. Must be a recognised province or administrative region of Pakistan: ${PAKISTAN_REGION_NAMES.join(', ')}.`;
  }

  // Country — fixed to Pakistan (national scope)
  if (
    typeof data.country === 'string' &&
    data.country.trim() !== '' &&
    data.country.trim().toLowerCase() !== PAKISTAN_COUNTRY.toLowerCase()
  ) {
    errors.country = 'The platform supports commercial feasibility analysis only within Pakistan.';
  }

  // Target location / locality description
  if (typeof data.target_location === 'string' && data.target_location.trim() !== '') {
    const location = data.target_location.trim();
    if (location.length < 3) {
      errors.target_location = 'Location description must be at least 3 characters.';
    } else if (location.length > 255) {
      errors.target_location = 'Location input cannot exceed 255 characters.';
    }
  }

  // District and City — validated against the selected region when it has a
  // curated registry; user-provided text is accepted for recognised regions
  // without one (recognition must not be coupled to coverage).
  const regionName = resolveRegionName(data);
  const district = asTrimmedString(data.district);
  const city = asTrimmedString(data.city);

  if (district !== '') {
    if (!regionName) {
      errors.district =
        'Unrecognised district. Select a recognised province/region of Pakistan first.';
    } else if (!isRecognisedDistrict(regionName, district)) {
      const region = getRegion(regionName);
      errors.district =
        region && region.district_registry_complete
          ? `Unsupported district for ${region.name}. Must be one of: ${region.districts.map((d) => d.name).join(', ')}.`
          : `Unrecognised district for ${regionName}.`;
    }
  }

  if (city !== '') {
    if (!regionName) {
      errors.city = 'Unrecognised city. Select a recognised province/region of Pakistan first.';
    } else if (!isRecognisedCity(regionName, district, city)) {
      const districtRecord = district ? getDistrict(regionName, district) : null;
      if (districtRecord) {
        errors.city = `Unsupported city for ${districtRecord.name}. Must be one of: ${districtRecord.cities.join(', ')}.`;
      } else {
        errors.city = `City "${city}" does not belong to district "${district}" in ${regionName}.`;
      }
    }
  }

  // Coordinates (Pakistan bounding box)
  if (isProvided(data.lat) && isProvided(data.lng)) {
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      errors.coordinates = 'Coordinates must be finite numbers.';
    } else if (
      lat < PAKISTAN_BOUNDS.minLat ||
      lat > PAKISTAN_BOUNDS.maxLat ||
      lng < PAKISTAN_BOUNDS.minLng ||
      lng > PAKISTAN_BOUNDS.maxLng
    ) {
      errors.coordinates = `Coordinates must be located within Pakistan territory (Lat: ${PAKISTAN_BOUNDS.minLat}–${PAKISTAN_BOUNDS.maxLat}, Lng: ${PAKISTAN_BOUNDS.minLng}–${PAKISTAN_BOUNDS.maxLng}).`;
    }
  }

  // Competitor analysis radius
  if (isProvided(data.radius_km)) {
    const radius = Number(data.radius_km);
    if (!Number.isFinite(radius) || radius < 5 || radius > 15) {
      errors.radius_km = 'Analysis radius must be between 5 km and 15 km (10 km recommended default).';
    }
  }

  // Budget (FR-2.4: Rs. 10,000–50,000,000 PKR canonical)
  if (isProvided(data.budget_amount)) {
    const budget = Number(data.budget_amount);
    const currency = (data.budget_currency as BudgetCurrency) || 'PKR';

    if (!Number.isFinite(budget)) {
      errors.budget_amount = 'Please enter a valid numeric budget amount.';
    } else if (budget < 0) {
      errors.budget_amount = 'Budget cannot be negative.';
    } else if (budget === 0) {
      // Neutral unset default — allowed for drafts, rejected at submission.
    } else if (currency === 'USD') {
      if (budget < 50) {
        errors.budget_amount = 'Minimum initial capital allocation for USD is $50.';
      } else if (budget > 200_000) {
        errors.budget_amount =
          'Budget exceeds the safe upper limit of $200,000 USD (equivalent to Rs. 50,000,000 PKR).';
      }
    } else if (budget < 10_000) {
      errors.budget_amount = 'Minimum initial capital allocation is Rs. 10,000 PKR.';
    } else if (budget > 50_000_000) {
      errors.budget_amount = 'Budget exceeds the maximum platform limit of Rs. 50,000,000 PKR.';
    }
  }

  // Operational enumerations
  if (data.business_scale !== undefined && data.business_scale !== null) {
    const validScales: BusinessScale[] = ['small', 'medium', 'large'];
    if (!validScales.includes(data.business_scale as BusinessScale)) {
      errors.business_scale = 'Business scale must be Small, Medium, or Large.';
    }
  }

  if (data.business_model !== undefined && data.business_model !== null) {
    const validModels: BusinessModel[] = ['d2c', 'hybrid', 'physical'];
    if (!validModels.includes(data.business_model as BusinessModel)) {
      errors.business_model = 'Business model must be Online Only (D2C), Hybrid, or Physical.';
    }
  }

  if (data.storefront_footprint !== undefined && data.storefront_footprint !== null) {
    const validFootprints: StorefrontFootprint[] = ['kiosk', 'boutique', 'commercial', 'flagship'];
    if (!validFootprints.includes(data.storefront_footprint as StorefrontFootprint)) {
      errors.storefront_footprint = 'Invalid storefront footprint selection.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Step completeness validation for wizard navigation.
 *
 * Step 1 — Business Profile & Location
 * Step 2 — Financial & Operational Information
 * Step 3 (and 5, legacy alias) — complete review before submission
 *
 * Geographic completeness is national: a region and a district/city are required,
 * but coordinates are only mandatory for regions that carry verified coverage
 * (Punjab). For recognised regions without verified local data the project may
 * still be submitted; analysis providers report "coverage unavailable" instead of
 * substituting Punjab observations.
 */
export function validateProjectStep(
  step: number,
  data: Partial<ProjectFormData> | Record<string, unknown>
): ValidationResult {
  // Start from field-level checks so every provided value is still validated.
  const errors: Record<string, string> = { ...validateProjectFields(data).errors };

  const includeProfile = step === 1 || step === 3 || step === 5;
  const includeFinancial = step === 2 || step === 3 || step === 5;

  if (includeProfile) {
    if (!(typeof data.category === 'string' && data.category.trim() !== '') && !errors.category) {
      errors.category = 'Please select one of the five approved business categories.';
    }
    if (!(typeof data.target_location === 'string' && data.target_location.trim() !== '') && !errors.target_location) {
      errors.target_location = 'Please enter the target locality or address in Pakistan.';
    }

    const regionName = resolveRegionName(data);
    if (!regionName && !errors.region) {
      errors.region = 'Please select a province or administrative region of Pakistan.';
    }

    if (!(typeof data.district === 'string' && data.district.trim() !== '') && !errors.district) {
      errors.district = 'Please select or enter a district.';
    }
    if (!(typeof data.city === 'string' && data.city.trim() !== '') && !errors.city) {
      errors.city = 'Please select or enter a city / tehsil.';
    }

    // Coordinates are required only where verified coverage exists (Punjab hubs).
    // Uncovered recognised regions may be submitted without coordinates.
    const region = getRegion(regionName);
    const regionHasCoverage = region?.analysis_enabled === true;
    const hasCoordinates = isProvided(data.lat) && isProvided(data.lng);
    if (regionHasCoverage && !hasCoordinates && !errors.coordinates) {
      errors.coordinates =
        'Please select a verified commercial hub, or provide coordinates, for this region.';
    }
  }

  if (includeFinancial) {
    const hasBudget =
      isProvided(data.budget_amount) && Number(data.budget_amount) > 0;
    if (!hasBudget && !errors.budget_amount) {
      errors.budget_amount = 'Please enter your planned initial investment budget.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateCompleteProject(data: Partial<ProjectFormData> | Record<string, unknown>): ValidationResult {
  return validateProjectStep(5, data);
}
