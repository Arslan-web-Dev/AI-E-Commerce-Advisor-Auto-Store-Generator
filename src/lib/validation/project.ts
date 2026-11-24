import {
  PREDEFINED_CATEGORIES,
  PUNJAB_PROVINCE,
  PUNJAB_DISTRICTS,
  PUNJAB_CITIES,
  BudgetCurrency,
  BusinessScale,
  BusinessModel,
  StorefrontFootprint,
  ProjectFormData,
} from '@/types/project';

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const ALLOWED_CATEGORY_NAMES = PREDEFINED_CATEGORIES.map((c) => c.name);
const ALLOWED_DISTRICT_NAMES = PUNJAB_DISTRICTS.map((d) => d.name);

function isProvided(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

/**
 * Field-level validation.
 *
 * Validates only the fields that are actually supplied, so partial drafts can be
 * persisted while every supplied value is still validated on the server (Task 3
 * §6 and §8: draft updates must not bypass server validation).
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

  // Province (fixed Punjab) and country (fixed Pakistan)
  if (typeof data.region === 'string' && data.region.trim() !== '' && data.region.trim() !== PUNJAB_PROVINCE) {
    errors.region = 'Only Punjab province is supported for this feasibility scope.';
  }
  if (
    typeof data.country === 'string' &&
    data.country.trim() !== '' &&
    data.country.trim().toLowerCase() !== 'pakistan'
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

  // District and City — validated against the authoritative Punjab dataset
  const district = typeof data.district === 'string' ? data.district.trim() : '';
  const city = typeof data.city === 'string' ? data.city.trim() : '';
  if (district !== '' && !ALLOWED_DISTRICT_NAMES.includes(district)) {
    errors.district = `Unsupported district. Must be one of: ${ALLOWED_DISTRICT_NAMES.join(', ')}`;
  }
  if (city !== '' && !PUNJAB_CITIES.includes(city)) {
    errors.city = `Unsupported city. Must be one of: ${PUNJAB_CITIES.join(', ')}`;
  }
  if (district !== '' && city !== '' && !errors.district && !errors.city) {
    const match = PUNJAB_DISTRICTS.find((d) => d.name === district);
    if (match && !match.cities.includes(city)) {
      errors.city = `City "${city}" does not belong to district "${district}".`;
    }
  }

  // Coordinates (Pakistan bounding box)
  if (isProvided(data.lat) && isProvided(data.lng)) {
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      errors.coordinates = 'Coordinates must be finite numbers.';
    } else if (lat < 23.5 || lat > 37.2 || lng < 60.8 || lng > 77.9) {
      errors.coordinates = 'Coordinates must be located within Pakistan territory (Lat: 23.5–37.2, Lng: 60.8–77.9).';
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
      errors.target_location = 'Please enter the target locality or address in Punjab.';
    }
    if (!(typeof data.district === 'string' && data.district.trim() !== '') && !errors.district) {
      errors.district = 'Please select a district in Punjab.';
    }
    if (!(typeof data.city === 'string' && data.city.trim() !== '') && !errors.city) {
      errors.city = 'Please select a city in Punjab.';
    }
    const hasCoordinates =
      isProvided(data.lat) && isProvided(data.lng);
    if (!hasCoordinates && !errors.coordinates) {
      errors.coordinates = 'Please select a verified commercial hub to attach Punjab coordinates.';
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
