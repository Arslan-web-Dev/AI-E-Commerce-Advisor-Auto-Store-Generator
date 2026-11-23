from typing import Dict, Any, List
from trends.google_trends import fetch_google_trends

def compute_market_demand_analysis(
    primary_keyword: str,
    district_data: Dict[str, Any],
    comparison_keywords: List[str] = None,
    geo: str = "PK"
) -> Dict[str, Any]:
    """
    Combines search momentum, demographic purchasing power, rent burden,
    and competitor saturation into an advanced market demand feasibility index.
    """
    keywords = [primary_keyword]
    if comparison_keywords:
        keywords.extend(comparison_keywords[:4])

    trends_result = fetch_google_trends(keywords=keywords, geo=geo, timeframe="today 12-m")
    analytics = trends_result.get("analytics", {})
    primary_analytics = analytics.get(primary_keyword, {})

    avg_search = primary_analytics.get("average_interest", 50.0)
    slope = primary_analytics.get("trend_slope", 0.0)
    direction = primary_analytics.get("trend_direction", "stable")
    peak_season = primary_analytics.get("peak_month", "N/A")

    # Demographic indicators
    ppi = float(district_data.get("purchasing_power_index", 70.0))
    urban_rate = float(district_data.get("urbanization_rate", 50.0))
    rent_avg = float(district_data.get("commercial_rent_sqft_avg", 150.0))
    retail_density = float(district_data.get("retail_density_score", 70.0))

    # Demand Index Components
    # 1. Search Intent Score (0 - 35 pts)
    search_score = (avg_search / 100.0) * 28.0 + (max(-5.0, min(7.0, slope * 10.0)))
    search_score = max(5.0, min(35.0, search_score))

    # 2. Purchasing Power & Demographic Score (0 - 35 pts)
    demo_score = (ppi / 100.0) * 20.0 + (urban_rate / 100.0) * 15.0
    demo_score = max(5.0, min(35.0, demo_score))

    # 3. Market Room / Saturation Balance (0 - 30 pts)
    # Higher density or extreme rent decreases score
    rent_penalty = min(15.0, (rent_avg / 300.0) * 15.0)
    saturation_penalty = min(15.0, (retail_density / 100.0) * 12.0)
    market_room_score = max(5.0, 30.0 - (rent_penalty * 0.5 + saturation_penalty * 0.5))

    composite_demand_index = round(search_score + demo_score + market_room_score, 1)

    if composite_demand_index >= 75.0:
        recommendation = "High Market Opportunity: Strong consumer search velocity aligned with high regional purchasing power."
        status = "favorable"
    elif composite_demand_index >= 55.0:
        recommendation = "Moderate Market Opportunity: Healthy fundamentals; focus on unique product positioning and controlled overhead."
        status = "moderate"
    else:
        recommendation = "High Barrier / Saturated: Cautious entry recommended due to high rent burden or low localized search demand."
        status = "challenging"

    return {
        "primary_keyword": primary_keyword,
        "geo": geo,
        "composite_demand_index": composite_demand_index,
        "status": status,
        "recommendation": recommendation,
        "search_momentum": {
            "average_interest": avg_search,
            "trend_slope": slope,
            "trend_direction": direction,
            "peak_season": peak_season
        },
        "score_breakdown": {
            "search_score": round(search_score, 1),
            "demographic_score": round(demo_score, 1),
            "market_room_score": round(market_room_score, 1)
        },
        "trends_data": trends_result
    }
