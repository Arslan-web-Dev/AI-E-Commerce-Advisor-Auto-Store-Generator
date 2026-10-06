import { PREDEFINED_CATEGORIES, BudgetCurrency, BusinessScale, BusinessModel, StorefrontFootprint, ProjectFormData } from '@/types/project';

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateProjectStep(step: number, data: Partial<ProjectFormData> | Record<string, unknown>): ValidationResult {
  const errors: Record<string, string> = {};

  if (step === 1 || step === 5) {
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
  }

  if (step === 2 || step === 5) {
    const location = typeof data.target_location === 'string' ? data.target_location.trim() : '';
    if (!location) {
      errors.target_location = 'Please enter a target city, commercial hub, or postal/ZIP code.';
    } else if (location.length < 3) {
      errors.target_location = 'Location description must be at least 3 characters.';
    } else if (location.length > 255) {
      errors.target_location = 'Location input cannot exceed 255 characters.';
    }

    if (data.radius_km !== undefined) {
      const radius = Number(data.radius_km);
      if (isNaN(radius) || radius < 1 || radius > 50) {
        errors.radius_km = 'Buffer radius must be between 1 km and 50 km.';
      }
    }
  }

  if (step === 3 || step === 5) {
    const budget = Number(data.budget_amount);
    const currency = (data.budget_currency as BudgetCurrency) || 'USD';

    if (data.budget_amount === undefined || data.budget_amount === null || isNaN(budget) || !isFinite(budget)) {
      errors.budget_amount = 'Please enter a valid numeric budget amount.';
    } else if (budget <= 0) {
      errors.budget_amount = 'Budget must be greater than zero.';
    } else if (currency === 'USD') {
      if (budget < 100) {
        errors.budget_amount = 'Minimum initial capital allocation for USD is $100.';
      } else if (budget > 10_000_000) {
        errors.budget_amount = 'Budget exceeds the safe upper limit of $10,000,000.';
      }
    } else if (currency === 'PKR') {
      if (budget < 10_000) {
        errors.budget_amount = 'Minimum initial capital allocation for PKR is Rs. 10,000.';
      } else if (budget > 500_000_000) {
        errors.budget_amount = 'Budget exceeds the safe upper limit of PKR 500,000,000.';
      }
    }
  }

  if (step === 4 || step === 5) {
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

    if (data.product_description && typeof data.product_description === 'string') {
      if (data.product_description.length > 2000) {
        errors.product_description = 'Product description cannot exceed 2000 characters.';
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateCompleteProject(data: Partial<ProjectFormData> | Record<string, unknown>): ValidationResult {
  return validateProjectStep(5, data);
}
