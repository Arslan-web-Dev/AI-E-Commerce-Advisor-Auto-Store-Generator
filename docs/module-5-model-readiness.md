# Module 5: Model Readiness Assessment

## 1. Objective
Assess the availability, quality, and suitability of data for training a supervised Machine Learning (ML) model to predict e-commerce feasibility success, as required by FR-5.1.

## 2. Data Inspection
- **Source Data**: The current system relies on mock/synthetic datasets and API integrations (Google Places, Trends, Census) to collect live data (Module 3) and process it into features (Module 4). 
- **Labeled Outcomes**: There is currently NO historical dataset of e-commerce store launches with verified outcomes (success/failure) tracked over a sufficient observation period (e.g., 12-24 months) available in the project repository or database.
- **SRS Dummy Data**: The dummy dataset provided in the SRS appendix contains synthetic examples intended for illustration, not for training a generalized real-world predictive model.

## 3. Evaluation against Supervised ML Requirements
To train a supervised model (e.g., XGBoost, Random Forest) that outputs a calibrated probability of success, the following is required:
- A representative dataset of past projects with the exact feature schema (`competitors_count`, `category_saturation`, `budget_ratio`, `avg_demand_index`, `trend_slope_score`).
- Ground-truth labels indicating business success (e.g., achieved profitability, stayed open > 1 year).
- Sufficient volume to allow for training, validation, and test splits without severe overfitting.

**Conclusion**: The requirements for supervised ML are **NOT MET**.

## 4. Decision & Fallback Strategy
Given the absence of real-world labeled training data, we cannot defensibly deploy a supervised model or claim to output a "probability of success." Doing so would violate the integrity rules of the system.

**Action Plan**:
1. **Scoring Mode**: The system will default to `provisional_mcda` (Multi-Criteria Decision Analysis).
2. **Score Output**: The score will be a normalized index [0, 1] calculated using transparent, configurable heuristic weights applied to the Module 4 engineered features. 
3. **Labeling**: The UI and APIs will clearly label this score as a "Provisional MCDA Index" and explicitly state that it is NOT a calibrated probability.
4. **Future ML Pathway**: The system will include a model registry foundation (`model_registry` table) restricted to Admins. When sufficient labeled data is collected, a true `supervised_model` can be trained, registered, and activated without changing the core inference workflow.
