# Module 6: Strategic Advisory, Budget Allocation, and Location Recommendations

## 1. Overview & Objective
Module 6 translates the parsed Module 4 features and Module 5 Feasibility Score into structured, human-readable, strategic business advice. 

The objective is to present business owners with actionable insights regarding Market Demand, Saturation, and Budget without making fabricated probability claims or location recommendations that lack supporting spatial POI datasets. 

## 2. Dynamic Budget Allocation
- **Data Integrity**: The budget relies strictly on the `projects.budget_amount` and `projects.budget_currency` defined in Module 2. 
- **Planning Scenario**: The allocation is presented as an interactive slider interface. It defaults to an illustrative weighting (40% Inventory, 25% Marketing, 20% Operations, 15% Contingency).
- **Disclaimer**: It is clearly marked as an illustrative planning scenario, explicitly avoiding guarantees or "AI-optimized" claims because we lack verified market cost benchmarking at a local granular scale.

## 3. Strategic Insights 
Insights are generated entirely deterministically based on MCDA processing run features (`avg_demand_index`, `category_saturation`, `budget_ratio`).
- They are segmented into **Strengths**, **Risk Factors**, and **Immediate Action Items**.
- Generating rules run on the server side (`generateAdvisoryReport`). Client tampering is explicitly disabled.
- **Language Models (LLM)** are omitted from core insight generation. 

## 4. Location Recommendations
Due to a lack of compatible, verified spatial datasets (e.g. rent-to-traffic ratio benchmarks for local Pakistani commercial hubs like Liberty Market Lahore or Tariq Road Karachi), the system safely returns a **"Location recommendations unavailable"** state. It preserves data integrity and refuses to generate LLM hallucinations.

## 5. Bilingual Support
A fully functional `English` / `Roman Urdu` toggle is provided on the frontend.
- Translation mappings are stored deterministically on the server side.
- No dynamic on-the-fly LLM translation is used, ensuring latency is 0 and output is structurally verified. 

## 6. Security and Persistence
- **Table**: `project_advisory_reports` captures the UUID link to the `feasibility_run_id` and `processing_run_id`.
- **Security**: Supabase Row-Level Security explicitly limits reads/writes to project owners.
- **Idempotency**: Fetching the report GETs the most recent linked run. Repeated POSTs safely version a new instance of the report if a user wishes to recalculate against new processing baselines.
