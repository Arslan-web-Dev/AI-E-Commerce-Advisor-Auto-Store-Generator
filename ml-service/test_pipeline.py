import sys
sys.path.insert(0, 'ml-service')
import main
from main import TrainRequest, PredictRequest

def run_test():
    print("=== Testing Training Pipeline ===")
    req = TrainRequest(
        dataset_id='punjab_retail_feasibility_v1',
        target_column='feasibility_class',
        problem_type='classification',
        candidate_algorithms=['random_forest', 'gradient_boosting', 'logistic_regression'],
        cv_folds=3
    )
    job = main.start_training(req, None)
    print("Job Status:", job["status"])
    print("Best Model ID:", job["best_model_id"])
    
    results = job["results"]
    print("\n=== Model Comparison Leaderboard ===")
    for m in results["leaderboard"]:
        print(f"  {m['name']}: F1={m['test_metrics']['f1']} | CV={m['cv_score']} | Acc={m['test_metrics']['accuracy']}")

    print("\n=== Testing Real-time Feasibility Prediction ===")
    pred_req = PredictRequest(
        model_id=job["best_model_id"],
        input_features={
            "district": "Lahore",
            "business_category": "Fashion & Apparel",
            "target_audience": "Middle Income",
            "initial_capital_pkr": 3500000,
            "monthly_burn_budget_pkr": 250000,
            "commercial_rent_sqft_pkr": 180,
            "competitor_density_1km": 15,
            "online_search_interest": 78,
            "urbanization_rate": 100.0,
            "purchasing_power_index": 88.5,
            "logistics_accessibility_score": 9.2,
            "digital_payment_adoption_pct": 72.0,
            "runway_months": 14.0
        }
    )
    pred_res = main.predict_feasibility(pred_req)
    print("Prediction Output:")
    print("  Predicted Feasibility:", pred_res["prediction"])
    print("  Confidence Score:", pred_res["confidence_score"])
    print("  Probabilities:", pred_res["class_probabilities"])
    print("\n=== Explainability Driving Factors ===")
    for f in pred_res["local_explanation_factors"]:
        print(f"  [{f['impact'].upper()}] {f['factor']}: {f['explanation']}")

    print("\n=== Testing Market Trends & Demand Analysis ===")
    from trends.google_trends import fetch_google_trends
    trends = fetch_google_trends(keywords=["lawn suits", "mens wear"], geo="PK")
    print("Trends Source:", trends["source"])
    print("Keywords:", trends["keywords"])
    print("Analytics Trajectories:", trends.get("analytics"))
    print("\nALL MODULE A & MODULE B TESTS PASSED!")

if __name__ == "__main__":
    run_test()
