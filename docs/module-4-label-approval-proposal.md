# OI-6 — Supervised Feasibility Label Approval Proposal (Task 5 / FR-4.3)

**Status: BLOCKED — no supervisor decision is recorded.**

This document preserves the pre-existing rule-generated label construction
verbatim so reviewers can approve, reject or amend it explicitly. It is **not**
approval evidence. Until a recorded decision exists, training targets
`feasibility_class` and `feasibility_score` are rejected by the Python service
(`ml-service/models/label_policy.py`) and by the Next.js admin training route.

## 1. Existing rule-generated labels (preserved, unapproved)

Source: `ml-service/datasets/sample_dataset_generator.py`.

The synthetic sandbox generates a continuous target:

```
fin_factor          = clamp((runway_months - 4) / 14, 0, 1)
market_factor       = 0.5 * (online_search_interest / 100) + 0.5 * (purchasing_power_index / 100)
rent_burden         = min(1, rent_sqft_pkr / (district_rent_mean * 1.6))
comp_pressure       = min(1, competitor_density_1km / (district_comp_mean * 1.8))
cost_pressure_factor= clamp(1 - (0.5 * rent_burden + 0.5 * comp_pressure), 0, 1)
infra_factor        = 0.5 * (logistics_score / 10) + 0.5 * (digital_payment_adoption_pct / 100)

raw_score = 0.35*fin_factor + 0.25*market_factor + 0.25*cost_pressure_factor
          + 0.15*infra_factor + N(0, 0.04)
feasibility_score = clamp(raw_score, 0.05, 0.98)
```

The class target uses **different, legacy boundaries**:

```
>= 0.72  -> "High Feasibility"
>= 0.52  -> "Medium Feasibility"
>= 0.35  -> "Low Feasibility"
 < 0.35  -> "Not Feasible"
```

These boundaries conflict with the SRS FR-4.4 risk bands (`0.75 / 0.55 / 0.35`)
and are one reason a supervisor decision is required. No weight or threshold in
this section has been changed by Task 5.

## 2. Known limitations to decide on

1. Labels are **self-generated from the same inputs the model sees**. A model
   trained on them learns the formula, not observed business outcomes. The
   previously committed `gradient_boosting` artifact reported a 100% leak from
   `feasibility_score` and perfect test metrics; it is not a valid model.
2. The sample dataset is **synthetic** and Punjab-first. It is not a labelled
   outcome dataset for Pakistan nationwide, and its rent values are estimates
   rather than audited transactions.
3. Class boundaries (0.72/0.52/0.35) do not match the SRS risk bands
   (0.75/0.55/0.35). `High Feasibility` corresponds to `Low risk`; the semantics
   must be stated explicitly in any approval.
4. MCDA config version `v1.0-mcda` is provisional product scoring, **not**
   supervisor approval for supervised labels.

## 3. Decision requested from OI-6 / supervisor

Approve **one** of the following, with an evidence reference (decision log ID,
signed review or ticket URL):

- **Option A — Approve the existing formula and weights as sandbox-only.**
  Training remains non-production; no report may claim a calibrated supervised
  probability. Update `ml-service/config/label_approval.json` status,
  `approved_at`, `approved_by` and `evidence_reference`.
- **Option B — Approve amended formula/weights and class boundaries.**
  Record the exact replacement formula, weights and alignment with FR-4.4
  bands in this document *before* changing the generator, then update the
  approval file.
- **Option C — Reject rule-generated labels.** Supervised feasibility training
  stays blocked until an outcome-labelled dataset is supplied under a new OI.

## 4. Gate implementation

- `ml-service/config/label_approval.json` defaults to `BLOCKED` and is
  fail-closed: an incomplete approval (missing timestamp or evidence) is
  treated as `BLOCKED`.
- `ml-service/models/label_policy.py::assert_training_allowed` raises
  `LabelApprovalBlocked` for `feasibility_class` / `feasibility_score` while
  blocked; generic sandbox targets are allowed.
- `src/app/api/ml/train/route.ts` checks the same policy before queuing a job.
- `artifact_ready_for_serving` re-reads the live policy and blocks activation of
  unversioned, metric-less, leaky or unapproved-label artifacts, including a
  stale `APPROVED` stamp and any rule-label bundle derived from the synthetic
  sandbox.
- `/api/ml/predict` applies the same serving gate even when an explicit
  `model_id` is supplied, and uses admin-supplied validated thresholds so the
  sandbox risk bands cannot drift from project reports.

No production feasibility model is trained, activated or reported as validated
in this Task 5 delivery.
