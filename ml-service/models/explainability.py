from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.inspection import permutation_importance

def compute_global_feature_importances(model, feature_names: List[str], X_val=None, y_val=None) -> List[Dict[str, Any]]:
    """
    Computes normalized global feature importance scores across transformed features.
    """
    importances = None

    # Tree-based ensemble
    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
    # Linear models
    elif hasattr(model, 'coef_'):
        coef = model.coef_
        if coef.ndim > 1:
            importances = np.mean(np.abs(coef), axis=0)
        else:
            importances = np.abs(coef)
    # Permutation importance fallback for kernel/KNN models
    elif X_val is not None and y_val is not None:
        try:
            r = permutation_importance(model, X_val, y_val, n_repeats=3, random_state=42)
            importances = np.maximum(0, r.importances_mean)
        except Exception:
            importances = None

    if importances is None or len(importances) == 0:
        return []

    # Normalize to 0-100%
    total = np.sum(importances)
    if total > 0:
        normalized = (importances / total) * 100.0
    else:
        normalized = np.zeros_like(importances)

    results = []
    for idx, name in enumerate(feature_names[:len(normalized)]):
        results.append({
            "feature": name,
            "importance": round(float(normalized[idx]), 2),
            "raw_weight": round(float(importances[idx]), 4)
        })

    # Sort descending
    results.sort(key=lambda x: x["importance"], reverse=True)
    return results

def compute_local_prediction_factors(
    input_dict: Dict[str, Any],
    global_importances: List[Dict[str, Any]],
    prediction_result: Any,
    confidence_score: Optional[float] = None
) -> List[Dict[str, Any]]:
    """
    Generates transparent, human-readable local explanation factors
    explaining why the model made a specific feasibility prediction.
    """
    factors = []
    importance_map = {item["feature"]: item["importance"] for item in global_importances}

    # Factor 1: Runway / Financial buffer
    capital = float(input_dict.get("initial_capital_pkr", 0))
    burn = float(input_dict.get("monthly_burn_budget_pkr", 1))
    runway = input_dict.get("runway_months", (capital / max(burn, 1.0)))
    
    if runway >= 12.0:
        factors.append({
            "factor": "Capital Runway",
            "impact": "positive",
            "strength": "high",
            "explanation": f"Healthy runway of {runway:.1f} months protects cash flow during initial retail setup."
        })
    elif runway <= 5.0:
        factors.append({
            "factor": "Capital Runway",
            "impact": "negative",
            "strength": "high",
            "explanation": f"Short runway of {runway:.1f} months increases early liquidity risk before breakeven."
        })

    # Factor 2: Commercial Rent vs Regional Average
    rent = float(input_dict.get("commercial_rent_sqft_pkr", 0))
    if rent > 0:
        if rent > 250:
            factors.append({
                "factor": "Commercial Rent",
                "impact": "negative",
                "strength": "medium",
                "explanation": f"Commercial rent of PKR {rent:.0f}/sqft places heavy fixed overhead on margins."
            })
        elif rent < 120:
            factors.append({
                "factor": "Commercial Rent",
                "impact": "positive",
                "strength": "medium",
                "explanation": f"Favorable commercial rent of PKR {rent:.0f}/sqft minimizes baseline occupancy costs."
            })

    # Factor 3: Online Demand & Search Interest
    search = float(input_dict.get("online_search_interest", 50))
    if search >= 70:
        factors.append({
            "factor": "Consumer Search Demand",
            "impact": "positive",
            "strength": "high",
            "explanation": f"Strong consumer search interest ({search:.0f}/100) indicates growing market intent."
        })
    elif search <= 35:
        factors.append({
            "factor": "Consumer Search Demand",
            "impact": "negative",
            "strength": "medium",
            "explanation": f"Subdued search volume ({search:.0f}/100) suggests niche or uneducated market segment."
        })

    # Factor 4: Competitor density
    comp = float(input_dict.get("competitor_density_1km", 10))
    if comp > 25:
        factors.append({
            "factor": "Local Competitor Saturation",
            "impact": "negative",
            "strength": "medium",
            "explanation": f"High competitor cluster ({int(comp)} outlets within 1km) requires strong product differentiation."
        })
    elif comp <= 5:
        factors.append({
            "factor": "Competitor Vacuum",
            "impact": "positive",
            "strength": "medium",
            "explanation": f"Low competitor density ({int(comp)} competitors within 1km) leaves unserved market demand."
        })

    # Factor 5: Purchasing Power Index
    ppi = float(input_dict.get("purchasing_power_index", 70))
    if ppi >= 80:
        factors.append({
            "factor": "Regional Purchasing Power",
            "impact": "positive",
            "strength": "high",
            "explanation": f"High purchasing power index ({ppi:.1f}/100) supports healthy retail basket sizes."
        })

    return factors
