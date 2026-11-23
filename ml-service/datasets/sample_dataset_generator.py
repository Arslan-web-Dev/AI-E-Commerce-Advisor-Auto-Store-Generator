"""
Punjab Retail & SME Business Feasibility Dataset Generator
Generates realistic, representative sample datasets based on empirical benchmarks from:
- Pakistan Bureau of Statistics (PBS 2023 Census & Household Integrated Economic Survey)
- Punjab Development Statistics 2023
- Punjab commercial real estate rental averages (Lahore, Rawalpindi, Faisalabad, Multan, Gujranwala, Sialkot, etc.)
- SME failure/success empirical factors in Pakistan retail commerce
"""

import numpy as np
import pandas as pd
from pathlib import Path

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

CATEGORIES = {
    "Fashion & Apparel": {"margin_base": 0.42, "capital_min": 1000000, "capital_max": 8000000, "burn_ratio": 0.12},
    "Electronics & Mobile": {"margin_base": 0.18, "capital_min": 1500000, "capital_max": 12000000, "burn_ratio": 0.08},
    "Grocery & Gourmet": {"margin_base": 0.15, "capital_min": 800000, "capital_max": 6000000, "burn_ratio": 0.14},
    "Health & Beauty": {"margin_base": 0.38, "capital_min": 700000, "capital_max": 5000000, "burn_ratio": 0.10},
    "Home & Living": {"margin_base": 0.35, "capital_min": 1200000, "capital_max": 9000000, "burn_ratio": 0.09},
    "Specialty Crafts": {"margin_base": 0.45, "capital_min": 500000, "capital_max": 4000000, "burn_ratio": 0.07},
}

AUDIENCES = ["Mass Market", "Middle Income", "Premium & Affluent", "Youth & Students"]

def generate_punjab_feasibility_dataset(num_samples: int = 1500, random_seed: int = 42) -> pd.DataFrame:
    """
    Synthesizes a realistic, empirically grounded dataset of Punjab retail feasibility evaluations.
    """
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

        # Financial variables
        capital_pkr = round(np.random.uniform(cat_meta["capital_min"], cat_meta["capital_max"]), -4)
        burn_budget_pkr = round(capital_pkr * np.random.uniform(cat_meta["burn_ratio"] * 0.7, cat_meta["burn_ratio"] * 1.3), -3)

        # Operational & Location features
        rent_sqft_pkr = max(35.0, round(np.random.normal(dist_meta["rent_mean"], dist_meta["rent_std"]), 1))
        comp_density = max(0, int(np.random.poisson(dist_meta["comp_mean"])))
        search_interest = round(min(100.0, max(10.0, np.random.normal(55.0, 18.0))), 1)
        urbanization = dist_meta["urban_rate"]
        purchasing_power = dist_meta["ppi"]
        logistics_score = round(min(10.0, max(3.0, np.random.normal(dist_meta["logistics"], 0.6))), 1)
        digital_payment_adoption = round(min(90.0, max(15.0, purchasing_power * 0.7 + np.random.normal(10.0, 5.0))), 1)
        
        runway_months = round(capital_pkr / max(burn_budget_pkr, 10000.0), 1)

        # Calculate a realistic underlying feasibility continuous score (0.0 to 1.0)
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

        # Discrete classification target
        if feasibility_score >= 0.72:
            feasibility_class = "High Feasibility"
        elif feasibility_score >= 0.52:
            feasibility_class = "Medium Feasibility"
        elif feasibility_score >= 0.35:
            feasibility_class = "Low Feasibility"
        else:
            feasibility_class = "Not Feasible"

        records.append({
            "district": district_name,
            "business_category": category,
            "target_audience": audience,
            "initial_capital_pkr": capital_pkr,
            "monthly_burn_budget_pkr": burn_budget_pkr,
            "commercial_rent_sqft_pkr": rent_sqft_pkr,
            "competitor_density_1km": comp_density,
            "online_search_interest": search_interest,
            "urbanization_rate": urbanization,
            "purchasing_power_index": purchasing_power,
            "logistics_accessibility_score": logistics_score,
            "digital_payment_adoption_pct": digital_payment_adoption,
            "runway_months": runway_months,
            "feasibility_score": feasibility_score,
            "feasibility_class": feasibility_class
        })

    df = pd.DataFrame(records)
    return df

def save_sample_dataset(output_path: Path, num_samples: int = 1500) -> Path:
    """
    Save a generated sample dataset to the given output_path.
    Allows specifying the number of samples via ``num_samples``.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df = generate_punjab_feasibility_dataset(num_samples=num_samples)
    df.to_csv(output_path, index=False)
    return output_path

if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "data" / "datasets" / "punjab_retail_feasibility_v1.csv"
    save_sample_dataset(out)
    print(f"Generated sample dataset at {out} with shape {pd.read_csv(out).shape}")
