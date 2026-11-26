"""
Synthetic Punjab retail sandbox dataset generator (pipeline validation ONLY).

District rent, purchasing-power and logistics anchors are illustrative fixture
parameters, not a verified empirical dataset. Every row is labelled
``data_source = synthetic`` and the historical rule-generated targets have no
supervisor approval (OI-6); see docs/module-4-label-approval-proposal.md.
"""

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd

from config import (
    BASE_DIR,
    DATASET_SCHEMA_VERSION,
    SYNTHETIC_DATA_SOURCE,
    TRAINING_RANDOM_SEED,
)

DISTRICT_DATA = {
    "Lahore": {"pop_urban": 13000000, "urban_rate": 100.0, "rent_mean": 240.0, "rent_std": 60.0, "ppi": 88.5, "comp_mean": 24, "logistics": 9.5},
    "Rawalpindi": {"pop_urban": 3105000, "urban_rate": 56.1, "rent_mean": 195.0, "rent_std": 45.0, "ppi": 82.0, "comp_mean": 18, "logistics": 8.8},
    "Faisalabad": {"pop_urban": 3692000, "urban_rate": 41.8, "rent_mean": 150.0, "rent_std": 35.0, "ppi": 75.0, "comp_mean": 16, "logistics": 8.0},
    "Multan": {"pop_urban": 2315000, "urban_rate": 43.2, "rent_mean": 130.0, "rent_std": 30.0, "ppi": 68.0, "comp_mean": 14, "logistics": 7.5},
    "Gujranwala": {"pop_urban": 3100000, "urban_rate": 51.8, "rent_mean": 140.0, "rent_std": 30.0, "ppi": 74.0, "comp_mean": 15, "logistics": 8.2},
    "Sialkot": {"pop_urban": 1520000, "urban_rate": 33.8, "rent_mean": 145.0, "rent_std": 35.0, "ppi": 79.0, "comp_mean": 13, "logistics": 8.1},
    "Bahawalpur": {"pop_urban": 1280000, "urban_rate": 29.9, "rent_mean": 95.0, "rent_std": 20.0, "ppi": 58.0, "comp_mean": 9, "logistics": 6.5},
    "Sargodha": {"pop_urban": 1480000, "urban_rate": 32.2, "rent_mean": 105.0, "rent_std": 25.0, "ppi": 62.0, "comp_mean": 10, "logistics": 6.8},
    "Sahiwal": {"pop_urban": 720000, "urban_rate": 25.0, "rent_mean": 90.0, "rent_std": 20.0, "ppi": 60.0, "comp_mean": 8, "logistics": 6.9},
    "Sheikhupura": {"pop_urban": 1420000, "urban_rate": 35.1, "rent_mean": 100.0, "rent_std": 22.0, "ppi": 64.0, "comp_mean": 11, "logistics": 7.8},
}

# Five approved priority categories (Task 3 / SRS FR-2). The legacy
# six-category list is deliberately removed; no unapproved category may be
# generated or accepted at inference time.
CATEGORIES = {
    "Grocery / General Stores": {"margin_base": 0.15, "capital_min": 800000, "capital_max": 6000000, "burn_ratio": 0.14},
    "Clothing / Footwear": {"margin_base": 0.42, "capital_min": 1000000, "capital_max": 8000000, "burn_ratio": 0.12},
    "Mobile Phones / Accessories": {"margin_base": 0.18, "capital_min": 1500000, "capital_max": 12000000, "burn_ratio": 0.08},
    "Restaurants / Cafes": {"margin_base": 0.35, "capital_min": 1200000, "capital_max": 9000000, "burn_ratio": 0.09},
    "Pharmacies / Medical Stores": {"margin_base": 0.38, "capital_min": 700000, "capital_max": 5000000, "burn_ratio": 0.10},
}

AUDIENCES = ["Mass Market", "Middle Income", "Premium & Affluent", "Youth & Students"]
LOCATION_TYPES = ["High Street", "Shopping Mall", "Neighborhood", "Markaz"]

DATASET_VERSION = "synthetic-fr4-v2"

PROVENANCE_COLUMNS = ("data_source", "dataset_version", "schema_version")

NUMERIC_RANGES = {
    "initial_capital_pkr": (1.0, 1e12),
    "monthly_burn_budget_pkr": (1.0, 1e12),
    "monthly_operating_cost_pkr": (1.0, 1e12),
    "expected_monthly_revenue_pkr": (0.0, 1e12),
    "estimated_monthly_profit_pkr": (-1e12, 1e12),
    "break_even_months": (0.0, 1200.0),
    "commercial_rent_sqft_pkr": (0.0, 1e7),
    "estimated_monthly_rent_pkr": (0.0, 1e10),
    "shop_area_sqft": (1.0, 1e7),
    "rent_to_budget_ratio": (0.0, 1e6),
    "competitor_count_1km": (0.0, 1e6),
    "competitor_density_1km": (0.0, 1e6),
    "nearest_competitor_distance_m": (0.0, 1e6),
    "nearby_business_concentration": (0.0, 100.0),
    "competition_intensity_index": (0.0, 1.0),
    "online_search_interest": (0.0, 100.0),
    "demand_index": (0.0, 100.0),
    "category_demand_factor": (0.0, 1.5),
    "urbanization_rate": (0.0, 100.0),
    "purchasing_power_index": (0.0, 100.0),
    "logistics_accessibility_score": (0.0, 10.0),
    "digital_payment_adoption_pct": (0.0, 100.0),
    "runway_months": (0.0, 1200.0),
    "feasibility_score": (0.0, 1.0),
    "distance_to_city_center_km": (0.0, 100.0),
}

# Generated columns that may intentionally contain NaN in a missing-value
# scenario. Provenance, geography identity and targets are never blanked.
OPTIONAL_MISSING_COLUMNS = (
    "commercial_rent_sqft_pkr",
    "estimated_monthly_rent_pkr",
    "nearest_competitor_distance_m",
    "nearby_business_concentration",
    "online_search_interest",
    "demand_index",
    "expected_monthly_revenue_pkr",
)


def dataset_schema() -> Dict[str, Any]:
    """Machine-readable column dictionary for the synthetic sandbox."""
    return {
        "schema_version": DATASET_SCHEMA_VERSION,
        "dataset_version": DATASET_VERSION,
        "data_source": SYNTHETIC_DATA_SOURCE,
        "primary_key": None,
        "provenance_columns": list(PROVENANCE_COLUMNS),
        "target_columns": ["feasibility_class", "feasibility_score"],
        "target_approval": "BLOCKED_OI6",
        "generated_target_usage": "experimental_sandbox_only",
        "groups": {
            "provenance": list(PROVENANCE_COLUMNS),
            "geography": [
                "province", "administrative_region", "district", "city_locality",
                "population_context", "latitude", "longitude",
                "distance_to_city_center_km", "business_category", "target_audience",
            ],
            "competition": [
                "competitor_count_1km", "competitor_density_1km",
                "nearest_competitor_distance_m", "nearby_business_concentration",
                "competition_intensity_index",
            ],
            "rental": [
                "commercial_rent_sqft_pkr", "estimated_monthly_rent_pkr",
                "shop_area_sqft", "location_type", "rent_to_budget_ratio",
            ],
            "financial": [
                "initial_capital_pkr", "monthly_burn_budget_pkr",
                "monthly_operating_cost_pkr", "expected_monthly_revenue_pkr",
                "estimated_monthly_profit_pkr", "break_even_months",
            ],
            "demand": [
                "online_search_interest", "demand_index", "category_demand_factor",
                "demand_freshness_status", "demand_availability_status",
            ],
            "market_context": [
                "urbanization_rate", "purchasing_power_index",
                "logistics_accessibility_score", "digital_payment_adoption_pct",
                "runway_months",
            ],
        },
        "numeric_ranges": {key: list(value) for key, value in NUMERIC_RANGES.items()},
        "missing_value_scenarios": list(OPTIONAL_MISSING_COLUMNS),
        "no_verified_records": True,
    }


def _dataset_fingerprint(df: pd.DataFrame) -> str:
    canonical = df.to_csv(index=False).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def validate_dataset(df: pd.DataFrame) -> Dict[str, Any]:
    """Validate schema, category integrity, ranges, duplicates and source."""
    schema = dataset_schema()
    all_columns = [column for group in schema["groups"].values() for column in group]
    required = all_columns + ["feasibility_class", "feasibility_score"]
    missing_required = [column for column in required if column not in df.columns]

    invalid_values: Dict[str, int] = {}
    for column, (lower, upper) in NUMERIC_RANGES.items():
        if column not in df.columns:
            continue
        series = pd.to_numeric(df[column], errors="coerce")
        invalid = int((series.notna() & ((series < lower) | (series > upper))).sum())
        if invalid:
            invalid_values[column] = invalid

    categories = set(df["business_category"].dropna().unique()) if "business_category" in df.columns else set()
    invalid_categories = sorted(categories - set(CATEGORIES.keys()))
    sources = set(df["data_source"].dropna().astype(str).unique()) if "data_source" in df.columns else set()

    duplicate_rows = int(df.duplicated().sum()) if len(df.columns) else 0
    target_nulls = {
        column: int(df[column].isna().sum())
        for column in ("feasibility_class", "feasibility_score")
        if column in df.columns
    }

    valid = (
        not missing_required
        and not invalid_values
        and not invalid_categories
        and sources == {SYNTHETIC_DATA_SOURCE}
        and duplicate_rows == 0
        and all(count == 0 for count in target_nulls.values())
    )
    return {
        "valid": valid,
        "schema_version": DATASET_SCHEMA_VERSION,
        "row_count": int(len(df)),
        "missing_required_columns": missing_required,
        "invalid_numeric_values": invalid_values,
        "invalid_categories": invalid_categories,
        "data_sources": sorted(sources),
        "duplicate_rows": duplicate_rows,
        "target_nulls": target_nulls,
        "warnings": [] if valid else ["Synthetic dataset failed validation; see explicit validation fields."],
    }


def assert_synthetic_only(df: pd.DataFrame) -> None:
    """Reject any dataset that mixes synthetic rows with another source."""
    sources = set(df.get("data_source", pd.Series(dtype=str)).dropna().astype(str).unique())
    if sources != {SYNTHETIC_DATA_SOURCE}:
        raise ValueError(
            "Synthetic dataset contains non-synthetic or missing data_source values: "
            f"{sorted(sources) or ['<missing>']}. Synthetic and verified records must not be mixed."
        )


def generate_punjab_feasibility_dataset(
    num_samples: int = 1500,
    random_seed: int = TRAINING_RANDOM_SEED,
    missing_rate: float = 0.01,
) -> pd.DataFrame:
    """
    Synthetic sandbox rows for pipeline validation ONLY.

    The rule-generated label formula and weights below are preserved verbatim
    from the pre-Task-5 generator. They have NO supervisor approval record
    (OI-6 is open), so targets produced here must never train a production
    feasibility model. See docs/module-4-label-approval-proposal.md.
    """
    if num_samples < 1:
        raise ValueError("num_samples must be at least 1.")
    if not 0 <= missing_rate < 0.2:
        raise ValueError("missing_rate must be in [0, 0.2).")

    np.random.seed(random_seed)
    districts = list(DISTRICT_DATA.keys())
    categories = list(CATEGORIES.keys())

    records = []
    for _ in range(num_samples):
        district_name = np.random.choice(districts, p=[0.25, 0.16, 0.14, 0.10, 0.09, 0.07, 0.05, 0.05, 0.04, 0.05])
        dist_meta = DISTRICT_DATA[district_name]

        category = np.random.choice(categories)
        cat_meta = CATEGORIES[category]

        audience = np.random.choice(AUDIENCES, p=[0.35, 0.40, 0.12, 0.13])
        location_type = np.random.choice(LOCATION_TYPES)

        # Financial variables
        capital_pkr = round(np.random.uniform(cat_meta["capital_min"], cat_meta["capital_max"]), -4)
        burn_budget_pkr = round(capital_pkr * np.random.uniform(cat_meta["burn_ratio"] * 0.7, cat_meta["burn_ratio"] * 1.3), -3)
        monthly_operating_cost_pkr = round(burn_budget_pkr * np.random.uniform(0.85, 1.15), -3)
        expected_revenue_pkr = round(capital_pkr * cat_meta["margin_base"] * np.random.uniform(0.12, 0.28), -3)
        estimated_profit_pkr = round(expected_revenue_pkr - monthly_operating_cost_pkr, -3)
        break_even_months = round(max(0.0, capital_pkr / max(estimated_profit_pkr, 100000.0)), 1)

        # Operational & Location features
        rent_sqft_pkr = max(35.0, round(np.random.normal(dist_meta["rent_mean"], dist_meta["rent_std"]), 1))
        shop_area_sqft = int(max(120, min(4000, np.random.normal(650, 220))))
        estimated_monthly_rent_pkr = round(rent_sqft_pkr * shop_area_sqft, -2)
        rent_to_budget_ratio = round(estimated_monthly_rent_pkr / max(monthly_operating_cost_pkr, 1.0), 4)
        comp_density = max(0, int(np.random.poisson(dist_meta["comp_mean"])))
        nearest_comp_distance = round(float(np.random.exponential(900.0)), 1)
        nearby_concentration = round(min(100.0, comp_density * np.random.uniform(1.8, 4.2)), 1)
        competition_intensity = round(min(1.0, comp_density / max(dist_meta["comp_mean"] * 1.8, 1.0)), 4)
        area_km2 = np.pi * (1.0 ** 2)
        competitor_density = round(comp_density / area_km2, 4)

        search_interest = round(min(100.0, max(10.0, np.random.normal(55.0, 18.0))), 1)
        category_demand_factor = round(float(np.random.uniform(0.6, 1.15)), 4)
        demand_index = round(min(100.0, search_interest * category_demand_factor), 2)
        demand_freshness_status = np.random.choice(["fresh", "cached", "unavailable"], p=[0.82, 0.11, 0.07])
        demand_availability_status = "available" if demand_freshness_status != "unavailable" else "unavailable"
        urbanization = dist_meta["urban_rate"]
        purchasing_power = dist_meta["ppi"]
        logistics_score = round(min(10.0, max(3.0, np.random.normal(dist_meta["logistics"], 0.6))), 1)
        digital_payment_adoption = round(min(90.0, max(15.0, purchasing_power * 0.7 + np.random.normal(10.0, 5.0))), 1)

        runway_months = round(capital_pkr / max(burn_budget_pkr, 10000.0), 1)
        distance_to_center = round(float(np.random.uniform(0.5, 18.0)), 2)
        latitude = round(31.55 + np.random.normal(0, 0.45), 6)
        longitude = round(74.34 + np.random.normal(0, 0.55), 6)

        # UNAPPROVED rule-label formula (OI-6). Preserved verbatim; do not
        # silently change weights or thresholds. Calculate a synthetic
        # continuous score (0.0 to 1.0) for sandbox validation only.
        # Financial health factor (0.35 weight)
        fin_factor = min(1.0, max(0.0, (runway_months - 4.0) / 14.0))

        # Market demand & purchasing power factor (0.25 weight)
        market_factor = (search_interest / 100.0 * 0.5) + (purchasing_power / 100.0 * 0.5)

        # Competition & Rent burden factor (0.25 weight)
        rent_burden = min(1.0, rent_sqft_pkr / (dist_meta["rent_mean"] * 1.6))
        comp_pressure = min(1.0, comp_density / (dist_meta["comp_mean"] * 1.8))
        cost_pressure_factor = 1.0 - (0.5 * rent_burden + 0.5 * comp_pressure)
        cost_pressure_factor = max(0.0, min(1.0, cost_pressure_factor))

        # Digital readiness & logistics factor (0.15 weight)
        infra_factor = (logistics_score / 10.0 * 0.5) + (digital_payment_adoption / 100.0 * 0.5)

        raw_score = (
            0.35 * fin_factor +
            0.25 * market_factor +
            0.25 * cost_pressure_factor +
            0.15 * infra_factor +
            np.random.normal(0, 0.04) # slight empirical variance
        )
        feasibility_score = round(max(0.05, min(0.98, raw_score)), 4)

        # Discrete classification target — legacy boundaries preserved.
        if feasibility_score >= 0.72:
            feasibility_class = "High Feasibility"
        elif feasibility_score >= 0.52:
            feasibility_class = "Medium Feasibility"
        elif feasibility_score >= 0.35:
            feasibility_class = "Low Feasibility"
        else:
            feasibility_class = "Not Feasible"

        records.append({
            "data_source": SYNTHETIC_DATA_SOURCE,
            "dataset_version": DATASET_VERSION,
            "schema_version": DATASET_SCHEMA_VERSION,
            "province": "Punjab",
            "administrative_region": district_name,
            "district": district_name,
            "city_locality": f"{district_name} - {location_type}",
            "population_context": dist_meta["pop_urban"],
            "latitude": latitude,
            "longitude": longitude,
            "distance_to_city_center_km": distance_to_center,
            "business_category": category,
            "target_audience": audience,
            "initial_capital_pkr": capital_pkr,
            "monthly_burn_budget_pkr": burn_budget_pkr,
            "monthly_operating_cost_pkr": monthly_operating_cost_pkr,
            "expected_monthly_revenue_pkr": expected_revenue_pkr,
            "estimated_monthly_profit_pkr": estimated_profit_pkr,
            "break_even_months": break_even_months,
            "commercial_rent_sqft_pkr": rent_sqft_pkr,
            "estimated_monthly_rent_pkr": estimated_monthly_rent_pkr,
            "shop_area_sqft": shop_area_sqft,
            "location_type": location_type,
            "rent_to_budget_ratio": rent_to_budget_ratio,
            "competitor_count_1km": comp_density,
            "competitor_density_1km": competitor_density,
            "nearest_competitor_distance_m": nearest_comp_distance,
            "nearby_business_concentration": nearby_concentration,
            "competition_intensity_index": competition_intensity,
            "online_search_interest": search_interest,
            "demand_index": demand_index,
            "category_demand_factor": category_demand_factor,
            "demand_freshness_status": demand_freshness_status,
            "demand_availability_status": demand_availability_status,
            "urbanization_rate": urbanization,
            "purchasing_power_index": purchasing_power,
            "logistics_accessibility_score": logistics_score,
            "digital_payment_adoption_pct": digital_payment_adoption,
            "runway_months": runway_months,
            "feasibility_score": feasibility_score,
            "feasibility_class": feasibility_class,
        })

    df = pd.DataFrame(records)

    # Deterministic missing-value scenarios for preprocessing tests. Targets
    # and provenance are never blanked, so source identity remains unambiguous.
    if missing_rate and len(df):
        rng = np.random.default_rng(random_seed + 1)
        for column in OPTIONAL_MISSING_COLUMNS:
            mask = rng.random(len(df)) < missing_rate
            if mask.any():
                df.loc[mask, column] = np.nan

    return df


def metadata_path_for(dataset_path: Path) -> Path:
    return dataset_path.with_suffix(dataset_path.suffix + ".meta.json")


def save_sample_dataset(
    output_path: Path,
    num_samples: int = 1500,
    random_seed: int = TRAINING_RANDOM_SEED,
    missing_rate: float = 0.01,
) -> Path:
    """Save the synthetic CSV plus a provenance/fingerprint sidecar."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df = generate_punjab_feasibility_dataset(
        num_samples=num_samples, random_seed=random_seed, missing_rate=missing_rate
    )
    assert_synthetic_only(df)
    validation = validate_dataset(df)
    if not validation["valid"]:
        raise ValueError(f"Generated synthetic dataset failed validation: {validation}")

    df.to_csv(output_path, index=False)
    fingerprint = hashlib.sha256(output_path.read_bytes()).hexdigest()
    metadata = {
        "schema_version": DATASET_SCHEMA_VERSION,
        "dataset_version": DATASET_VERSION,
        "data_source": SYNTHETIC_DATA_SOURCE,
        "dataset_fingerprint": fingerprint,
        "generated_at": pd.Timestamp.utcnow().isoformat(),
        "generator": "ml-service/datasets/sample_dataset_generator.py",
        "random_seed": random_seed,
        "num_samples": num_samples,
        "missing_rate": missing_rate,
        "categories": sorted(CATEGORIES.keys()),
        "validation": validation,
        "schema": dataset_schema(),
        "approved_for_production": False,
        "label_approval_status": "BLOCKED_OI6",
        "disclaimer": "Synthetic sandbox data only; not real-world market evidence.",
    }
    metadata_path_for(output_path).write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return output_path


def load_dataset_metadata(dataset_path: Path) -> Dict[str, Any]:
    sidecar = metadata_path_for(Path(dataset_path))
    if not sidecar.exists():
        return {
            "data_source": "uploaded_unverified",
            "dataset_provenance": {
                "data_source": "uploaded_unverified",
                "note": "No synthetic sidecar; uploaded data is not treated as verified market evidence.",
            },
        }
    payload = json.loads(sidecar.read_text(encoding="utf-8"))
    return {
        "data_source": payload.get("data_source", SYNTHETIC_DATA_SOURCE),
        "dataset_fingerprint": payload.get("dataset_fingerprint"),
        "dataset_version": payload.get("dataset_version"),
        "schema_version": payload.get("schema_version"),
        "dataset_provenance": payload,
    }


if __name__ == "__main__":
    out = BASE_DIR / "data" / "datasets" / "punjab_retail_feasibility_v1.csv"
    save_sample_dataset(out)
    print(f"Generated synthetic sandbox dataset at {out} with shape {pd.read_csv(out).shape}")
