import { PREDEFINED_CATEGORIES, BudgetCurrency, BusinessScale, BusinessModel, StorefrontFootprint, ProjectFormData } from '@/types/project';

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateProjectStep(step: number, data: Partial<ProjectFormData> | Record<string, unknown>): ValidationResult {
  const errors: Record<string, string> = {};

  // Step 1 or Complete Validation (Idea & Category)
  if (step === 1 || step === 5 || step === 3) {
    const category = typeof data.category === 'string' ? data.category.trim() : '';
    if (!category) {
      errors.category = 'Please select a store commercial category.';
    } else {
      const allowedNames = PREDEFINED_CATEGORIES.map((c) => c.name);
      if (!allowedNames.includes(category)) {
        errors.category = `Invalid category selected. Must be one of: ${allowedNames.join(', ')}`;
      }
      if (category === 'Other Niche Venture') {
        const customCat = typeof data.custom_category === 'string' ? data.custom_category.trim() : '';
        if (!customCat || customCat.length < 3) {
          errors.custom_category = 'Please describe your custom niche commercial category (min 3 characters).';
        }
      }
    }

    if (data.product_description && typeof data.product_description === 'string') {
      if (data.product_description.length > 2000) {
        errors.product_description = 'Product description cannot exceed 2000 characters.';
      }
    }
  }

  // Step 2 or Complete Validation (Location & Target Market & Budget)
  if (step === 2 || step === 5 || step === 3) {
    const location = typeof data.target_location === 'string' ? data.target_location.trim() : '';
    if (!location) {
      errors.target_location = 'Please enter a target city, commercial hub, or postal/ZIP code in Pakistan.';
    } else if (location.length < 3) {
      errors.target_location = 'Location description must be at least 3 characters.';
    } else if (location.length > 255) {
      errors.target_location = 'Location input cannot exceed 255 characters.';
    }

    // Country validation: Platform is strictly dedicated to Pakistan commercial markets
    if (data.country && typeof data.country === 'string' && data.country.trim().toLowerCase() !== 'pakistan') {
      errors.country = 'The platform currently supports commercial feasibility analysis only within Pakistan.';
    }

    // Latitude and Longitude validation (Pakistan bounding box)
    if (data.lat !== undefined && data.lat !== null && data.lng !== undefined && data.lng !== null) {
      const lat = Number(data.lat);
      const lng = Number(data.lng);
      if (isNaN(lat) || isNaN(lng)) {
        errors.coordinates = 'Coordinates must be valid numbers.';
      } else if (lat < 23.5 || lat > 37.2 || lng < 60.8 || lng > 77.9) {
        errors.coordinates = 'Coordinates must be located within Pakistan territory (Lat: 23.5–37.2, Lng: 60.8–77.9).';
      }
    }

    if (data.radius_km !== undefined && data.radius_km !== null) {
      const radius = Number(data.radius_km);
      if (isNaN(radius) || radius < 5 || radius > 15) {
        errors.radius_km = 'Analysis radius must be between 5 km and 15 km (10 km recommended default).';
      }
    }

    // Budget Validation (FR-2.4: Rs. 10,000–50,000,000 PKR canonical)
    if (data.budget_amount !== undefined && data.budget_amount !== null) {
      const budget = Number(data.budget_amount);
      const currency = (data.budget_currency as BudgetCurrency) || 'PKR';

      if (isNaN(budget) || !isFinite(budget)) {
        errors.budget_amount = 'Please enter a valid numeric budget amount.';
      } else if (budget <= 0) {
        errors.budget_amount = 'Budget must be greater than zero.';
      } else if (currency === 'USD') {
        if (budget < 50) {
          errors.budget_amount = 'Minimum initial capital allocation for USD is $50.';
        } else if (budget > 200_000) {
          errors.budget_amount = 'Budget exceeds the safe upper limit of $200,000 USD (equivalent to Rs. 50,000,000 PKR).';
        }
      } else if (currency === 'PKR') {
        if (budget < 10_000) {
          errors.budget_amount = 'Minimum initial capital allocation is Rs. 10,000 PKR.';
        } else if (budget > 50_000_000) {
          errors.budget_amount = 'Budget exceeds the maximum platform limit of Rs. 50,000,000 PKR.';
        }
      }
    }
  }

  // Advanced Options Validation (Audience, Scale, Model, Footprint)
  if (step === 3 || step === 4 || step === 5) {
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
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateCompleteProject(data: Partial<ProjectFormData> | Record<string, unknown>): ValidationResult {
  const result = validateProjectStep(5, data);
  const errors = { ...result.errors };

  // Mandatory checks on final submission
  if (!data.category) errors.category = 'Category selection is required.';
  if (!data.target_location) errors.target_location = 'Target location is required.';
  if (!data.budget_amount || Number(data.budget_amount) < 10000) {
    if ((data.budget_currency as string) === 'USD' && Number(data.budget_amount) >= 50) {
      // valid USD
    } else if ((data.budget_currency as string) !== 'USD' && Number(data.budget_amount) < 10000) {
      errors.budget_amount = 'Minimum budget of Rs. 10,000 PKR is required.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
