# Module A & Module B: Machine Learning Pipeline & Punjab Market Intelligence

## Project Overview
**Application:** AI-Powered E-Commerce Feasibility Advisor & Auto Store Generator — Punjab, Pakistan  
**Standard:** Enterprise ML Model Lifecycle & Market Intelligence Architecture  

---

## 1. Module A: Multiple-Model Machine Learning Pipeline

### Architecture
- **Framework:** Python 3.14 + FastAPI + scikit-learn + pandas + joblib
- **Service Location:** `ml-service/`
- **Port:** `8000` (`http://127.0.0.1:8000`)
- **Integration:** Next.js API Routes (`/api/ml/*`) and typed TypeScript client (`src/lib/ml-client.ts`)

### Candidate Algorithms Supported
The pipeline evaluates multiple algorithms simultaneously on the same hold-out and cross-validation splits:
1. **Random Forest Classifier / Regressor**: Ensemble bagging trees with bootstrap aggregation.
2. **Gradient Boosting Classifier / Regressor**: Sequential gradient-boosted decision trees.
3. **Extra Trees Classifier / Regressor**: Extremely randomized trees with variance reduction.
4. **Logistic Regression / Ridge / Lasso**: Regularized linear baselines for linear relationships.
5. **Decision Tree Classifier / Regressor**: Single partitioned decision tree.
6. **Support Vector Classifier (SVC)**: Non-linear radial basis margin boundary classifier.
7. **K-Nearest Neighbors (KNN)**: Distance metric neighborhood classifier.

### Zero Data Leakage Guarantee
- Preprocessing pipeline (`ColumnTransformer`) fits strictly on training folds:
  - Numeric columns: `SimpleImputer(strategy='median')` followed by `StandardScaler()`.
  - Categorical columns: `SimpleImputer(strategy='most_frequent')` followed by `OneHotEncoder(handle_unknown='ignore')`.
- Target column and any collinear duplicates are completely isolated prior to feature extraction.

### Model Comparison & Leaderboard
- Evaluates candidate algorithms using **Stratified K-Fold Cross-Validation** (Classification) or **K-Fold** (Regression).
- Computes comprehensive validation metrics:
  - Classification: Test F1, Precision, Recall, Accuracy, ROC-AUC, Confusion Matrix, and CV Mean & Std Dev.
  - Regression: $R^2$, MAE, MSE, RMSE, Explained Variance.
- Automatically serializes and saves the best-performing model pipeline (`.joblib`) into `ml-service/artifacts/`.
- Allows administrators to compare models and switch or rollback active inference models with one click.

### Feature Attribution & Explainability
- **Global Feature Importance:** Computes normalized feature impact weights across transformed features.
- **Local Prediction Drivers:** Identifies positive and negative contributing factors for every individual feasibility prediction:
  - Capital Runway (months of burn buffer)
  - Commercial Rent Burden vs. regional benchmark
  - Consumer Search Momentum
  - Competitor Saturation within 1km radius
  - Regional Purchasing Power Index (PPI)

---

## 2. Module B: Google Trends & Punjab Market Intelligence

### Live Google Trends Integration
- Direct integration with Google Trends via `pytrends` with local 24-hour disk/memory caching (`data/cache/trends_cache.json`).
- Resilient rate-limiting handling with exponential backoff and empirical baseline fallback for Pakistan retail categories.
- Features:
  - Multi-keyword interest over time curves (`geo='PK'` or `'PK-PB'`).
  - Linear regression slope ($m$) and trend direction classification: `rising`, `rapidly_rising`, `falling`, `rapidly_falling`, `stable`.
  - Peak seasonal month detection.
  - Related top and breakout queries.

### Punjab Regional Demographic & Economic Benchmarks
- Pre-seeded empirical data sourced from **Pakistan Bureau of Statistics (PBS 2023 7th Population Census)** and **Punjab Development Statistics 2023**:
  1. **Lahore** (Pop: 13.0M, Urban: 100%, PPI: 88.5, Rent: PKR 120 - 450/sqft, Avg: 240)
  2. **Rawalpindi** (Pop: 5.54M, Urban: 56.1%, PPI: 82.0, Rent: PKR 90 - 350/sqft, Avg: 195)
  3. **Faisalabad** (Pop: 8.84M, Urban: 41.8%, PPI: 75.0, Rent: PKR 70 - 280/sqft, Avg: 150)
  4. **Multan** (Pop: 5.36M, Urban: 43.2%, PPI: 68.0, Rent: PKR 60 - 240/sqft, Avg: 130)
  5. **Gujranwala** (Pop: 5.99M, Urban: 51.8%, PPI: 74.0, Rent: PKR 65 - 260/sqft, Avg: 140)
  6. **Sialkot** (Pop: 4.50M, Urban: 33.8%, PPI: 79.0, Rent: PKR 70 - 270/sqft, Avg: 145)
  7. **Bahawalpur** (Pop: 4.28M, Urban: 29.9%, PPI: 58.0, Rent: PKR 45 - 180/sqft, Avg: 95)
  8. **Sargodha** (Pop: 4.60M, Urban: 32.2%, PPI: 62.0, Rent: PKR 50 - 200/sqft, Avg: 105)
  9. **Sahiwal** (Pop: 2.88M, Urban: 25.0%, PPI: 60.0, Rent: PKR 40 - 170/sqft, Avg: 90)
  10. **Sheikhupura** (Pop: 4.05M, Urban: 35.1%, PPI: 64.0, Rent: PKR 45 - 190/sqft, Avg: 100)

### Composite Demand Feasibility Index
Synthesizes:
1. **Search Momentum Score** (0 to 35 pts): 12-month Google Trends volume and trajectory slope.
2. **Demographics & Purchasing Power Score** (0 to 35 pts): PBS urbanization rate and purchasing power index.
3. **Market Room Score** (0 to 30 pts): Penalty for extreme commercial rent or competitor saturation.
- Output: Composite Index (0 to 100) with status classification: `favorable` (>= 75), `moderate` (55 - 74), or `challenging` (< 55).

---

## 3. UI Dashboards

1. **ML Pipeline Studio (`/admin/ml`)**:
   - Dataset Manager: Upload CSV/XLSX, load 1,500-record Punjab retail sample, data quality health score, missing values, column distribution stats.
   - Training Studio: Target selection, candidate algorithm selector, K-Fold CV controls, live training progress.
   - Model Leaderboard: Algorithm ranking by Test F1, CV score, accuracy, precision, recall, active model badge, and promotion controls.
   - Predictor Sandbox: Live feasibility evaluation with instant predicted class, confidence, and explainability factors.
2. **Market Intelligence Explorer (`/market-intelligence`)**:
   - Google Trends Explorer: Multi-keyword search, Pakistan/Punjab geo selection, interactive SVG line chart, trajectory analytics, related queries.
   - Punjab District Benchmarks: Complete commercial profile, population, urbanization, rent spectrum (min, avg, max), primary retail hubs, economic drivers.
   - Demand Index Calculator: Instant composite market opportunity rating for any retail product and Punjab district.

---

## 4. How to Run Locally

### Start ML FastAPI Service:
```bash
# In project root:
.\.venv\Scripts\uvicorn.exe ml-service.main:app --host 127.0.0.1 --port 8000 --reload
# Or run the batch helper:
.\ml-service\run_service.bat
```

### Start Next.js Web Application:
```bash
npm run dev
```

Navigate to:
- Admin ML Studio: `http://localhost:3000/admin/ml`
- Market Intelligence: `http://localhost:3000/market-intelligence`
