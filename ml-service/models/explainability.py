from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.inspection import permutation_importance


def compute_global_feature_importances(model, feature_names: List[str], X_val=None, y_val=None) -> List[Dict[str, Any]]:
    """Compute normalized global feature importance scores across transformed features.

    These are model-derived importances (tree gain, absolute coefficient, or
    permutation importance fallback). They are not SHAP values and must not be
    described as SHAP in product copy.
    """
    importances = None

    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
    elif hasattr(model, 'coef_'):
        coef = model.coef_
        if coef.ndim > 1:
            importances = np.mean(np.abs(coef), axis=0)
        else:
            importances = np.abs(coef)
    elif X_val is not None and y_val is not None:
        try:
            r = permutation_importance(model, X_val, y_val, n_repeats=3, random_state=42)
            importances = np.maximum(0, r.importances_mean)
        except Exception:
            importances = None

    if importances is None or len(importances) == 0:
        return []

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
            "raw_weight": round(float(importances[idx]), 4),
        })

    results.sort(key=lambda item: item["importance"], reverse=True)
    return results


def _safe_float(value: Any) -> Optional[float]:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if np.isfinite(parsed) else None


def compute_local_prediction_factors(
    input_dict: Dict[str, Any],
    global_importances: List[Dict[str, Any]],
    prediction_result: Any,
    confidence_score: Optional[float] = None
) -> List[Dict[str, Any]]:
    """Return honest, rule-based local context factors.

    These factors are explanatory heuristics, not per-prediction SHAP/gain
    contributions. Missing values are reported as unavailable rather than
    imputed into a confident narrative.
    """
    factors: List[Dict[str, Any]] = []
    importance_map = {
        str(item.get("feature")): float(item.get("importance", 0))
        for item in global_importances
        if isinstance(item, dict)
    }

    def add(
        factor: str,
        impact: str,
        strength: str,
        explanation: str,
        source_feature: Optional[str] = None,
    ) -> None:
        entry: Dict[str, Any] = {
            "factor": factor,
            "impact": impact,
            "strength": strength,
            "explanation": explanation,
            "method": "documented_rule_context",
        }
        if source_feature and source_feature in importance_map:
            entry["global_importance"] = round(importance_map[source_feature], 2)
        factors.append(entry)

    runway = _safe_float(input_dict.get("runway_months"))
    if runway is None:
        capital = _safe_float(input_dict.get("initial_capital_pkr"))
        burn = _safe_float(input_dict.get("monthly_burn_budget_pkr"))
        runway = capital / burn if capital is not None and burn is not None and burn > 0 else None
    if runway is None:
        add("Capital Runway", "neutral", "low", "Capital runway is unavailable; no value was imputed for this explanation.", "runway_months")
    elif runway >= 12.0:
        add("Capital Runway", "positive", "high", f"Healthy runway of {runway:.1f} months protects cash flow during initial retail setup.", "runway_months")
    elif runway <= 5.0:
        add("Capital Runway", "negative", "high", f"Short runway of {runway:.1f} months increases early liquidity risk before breakeven.", "runway_months")

    rent = _safe_float(input_dict.get("commercial_rent_sqft_pkr"))
    if rent is None:
        add("Commercial Rent", "neutral", "low", "Sourced rent is unavailable; no regional value was substituted.", "commercial_rent_sqft_pkr")
    elif rent > 250:
        add("Commercial Rent", "negative", "medium", f"Commercial rent of PKR {rent:.0f}/sqft places heavy fixed overhead on margins.", "commercial_rent_sqft_pkr")
    elif rent < 120:
        add("Commercial Rent", "positive", "medium", f"Favorable commercial rent of PKR {rent:.0f}/sqft minimizes baseline occupancy costs.", "commercial_rent_sqft_pkr")

    search = _safe_float(input_dict.get("online_search_interest"))
    if search is None:
        add("Consumer Search Demand", "neutral", "low", "Demand trend is unavailable; no synthetic demand value was imputed.", "online_search_interest")
    elif search >= 70:
        add("Consumer Search Demand", "positive", "high", f"Strong consumer search interest ({search:.0f}/100) indicates growing market intent.", "online_search_interest")
    elif search <= 35:
        add("Consumer Search Demand", "negative", "medium", f"Subdued search volume ({search:.0f}/100) suggests a niche or under-researched segment.", "online_search_interest")

    comp = _safe_float(input_dict.get("competitor_density_1km"))
    if comp is None:
        add("Local Competitor Density", "neutral", "low", "Competitor density is unavailable; no value was imputed.", "competitor_density_1km")
    elif comp > 25:
        add("Local Competitor Saturation", "negative", "medium", f"High competitor cluster ({int(comp)} outlets within 1km) requires strong product differentiation.", "competitor_density_1km")
    elif comp <= 5:
        add("Competitor Vacuum", "positive", "medium", f"Low competitor density ({int(comp)} competitors within 1km) leaves unserved market demand.", "competitor_density_1km")

    ppi = _safe_float(input_dict.get("purchasing_power_index"))
    if ppi is None:
        add("Regional Purchasing Power", "neutral", "low", "Purchasing power index is unavailable; no benchmark was substituted.", "purchasing_power_index")
    elif ppi >= 80:
        add("Regional Purchasing Power", "positive", "high", f"High purchasing power index ({ppi:.1f}/100) supports healthy retail basket sizes.", "purchasing_power_index")

    factors.sort(key=lambda item: item.get("global_importance", 0), reverse=True)
    factors.append({
        "factor": "Explanation Method",
        "impact": "neutral",
        "strength": "low",
        "explanation": "Local factors are documented rule context, not SHAP or per-prediction gain attribution. Global importances are model-derived.",
        "method": "disclosure",
    })
    return factors
