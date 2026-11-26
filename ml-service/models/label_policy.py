"""OI-6 gate for rule-generated feasibility labels (Task 5 / FR-4.8).

No supervisor approval for the rule-generated label formula or its weights is
recorded in this repository. This module is the single server-side gate that
prevents those labels from producing a production feasibility artifact.

Task 5 explicitly permits *experimental sandbox* training on these rule labels;
only production activation and customer-facing scoring are blocked while OI-6
is open. An approval is honoured only when ALL of status, approved_by,
approved_at and evidence_reference are genuine, non-placeholder values.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from config import BASE_DIR, LABEL_POLICY_PATH

APPROVED_MODULE4_CATEGORIES = (
    "Grocery / General Stores",
    "Clothing / Footwear",
    "Mobile Phones / Accessories",
    "Restaurants / Cafes",
    "Pharmacies / Medical Stores",
)

RULE_LABEL_TARGETS = frozenset({"feasibility_class", "feasibility_score"})

_PLACEHOLDERS = {"", "null", "none", "n/a", "na", "pending", "tbd", "unknown", "unapproved", "-"}


class LabelApprovalBlocked(RuntimeError):
    """Raised when a rule-generated target is activated without OI-6 approval."""

    def __init__(self, policy: Dict[str, Any], target_col: str):
        self.policy = policy
        self.target_col = target_col
        super().__init__(
            "FR-4 production activation blocked (OI-6): the rule-generated label "
            f"formula and weights for '{target_col}' have no complete supervisor "
            "approval record. Experimental sandbox training is unaffected."
        )


def _meaningful_text(value: Any) -> bool:
    return isinstance(value, str) and value.strip().lower() not in _PLACEHOLDERS


def evaluate_label_policy(policy: Dict[str, Any], target_col: Optional[str] = None) -> Dict[str, Any]:
    """Validate every OI-6 field independently; never infer approval."""
    reasons: List[str] = []
    status = policy.get("status")
    if not isinstance(status, str) or status.strip().upper() != "APPROVED":
        reasons.append("status must be exactly APPROVED")
    if not _meaningful_text(policy.get("approved_by")):
        reasons.append("approved_by must name a real approver")
    if not _meaningful_text(policy.get("approved_at")):
        reasons.append("approved_at must be a real timestamp")
    else:
        raw_timestamp = str(policy["approved_at"]).strip().replace("Z", "+00:00")
        try:
            datetime.fromisoformat(raw_timestamp)
        except ValueError:
            reasons.append("approved_at must be an ISO-8601 timestamp")
    if not _meaningful_text(policy.get("evidence_reference")):
        reasons.append("evidence_reference must point to a genuine approval record")
    if target_col is not None and is_rule_generated_target(target_col):
        scope = policy.get("target_scope") or []
        if not isinstance(scope, list) or str(target_col) not in {str(item) for item in scope}:
            reasons.append(f"target_scope does not include {target_col}")

    approved = not reasons
    return {
        "status": "APPROVED" if approved else "BLOCKED",
        "oi_id": policy.get("oi_id", "OI-6"),
        "approved": approved,
        "reasons": reasons,
        "approved_by": policy.get("approved_by") if approved else None,
        "approved_at": policy.get("approved_at") if approved else None,
        "evidence_reference": policy.get("evidence_reference") if approved else None,
        "documented_proposal": policy.get("documented_proposal"),
        "reason": policy.get("reason"),
    }


def load_label_policy() -> Dict[str, Any]:
    """Load the raw policy file plus a strictly validated OI-6 summary."""
    with open(LABEL_POLICY_PATH, "r", encoding="utf-8") as handle:
        policy = json.load(handle)
    summary = evaluate_label_policy(policy)
    result = dict(policy)
    result["status"] = summary["status"]
    result["oi6_validation"] = summary
    return result


def is_rule_generated_target(target_col: str) -> bool:
    normalized = str(target_col).strip().lower()
    return normalized in RULE_LABEL_TARGETS


def assert_training_allowed(target_col: str, dataset_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Describe training permission without blocking experimental sandbox runs.

    Production eligibility is reported separately and is never implied by a
    successful experimental fit.
    """
    policy = load_label_policy()
    validation = policy["oi6_validation"]
    if not is_rule_generated_target(target_col):
        return {
            "status": "ALLOWED_EXPERIMENTAL_SANDBOX",
            "target_col": target_col,
            "oi6_applicable": False,
            "approved_for_production": False,
            "production_block_reasons": ["Generic target is not an approved production feasibility label."],
            "note": "Generic ML target; not a production feasibility label.",
        }

    return {
        "status": "ALLOWED_EXPERIMENTAL_SANDBOX" if not validation["approved"] else "ALLOWED_APPROVED",
        "target_col": target_col,
        "oi6_applicable": True,
        "oi_id": policy.get("oi_id", "OI-6"),
        "approved_for_production": validation["approved"],
        "production_block_reasons": [] if validation["approved"] else validation["reasons"],
        "approved_by": validation["approved_by"],
        "approved_at": validation["approved_at"],
        "evidence_reference": validation["evidence_reference"],
        "dataset_is_sample": bool((dataset_info or {}).get("is_sample")),
        "note": "Rule-generated label; experimental sandbox only unless OI-6 is genuinely approved.",
    }


def assert_production_approval(target_col: str) -> Dict[str, Any]:
    """Fail closed when a rule-generated target is requested for production."""
    if not is_rule_generated_target(target_col):
        return {
            "status": "NOT_APPLICABLE",
            "approved_for_production": False,
            "note": "Generic target is never a production feasibility label.",
        }
    policy = load_label_policy()
    validation = policy["oi6_validation"]
    if not validation["approved"]:
        raise LabelApprovalBlocked(policy, target_col)
    return validation


def target_derived_columns(target_col: str, columns: Iterable[str]) -> List[str]:
    """Return only known target companions, preserving unrelated features.

    The previous implementation dropped every column containing "score", which
    accidentally removed `logistics_accessibility_score` from classification.
    """
    normalized = str(target_col).strip().lower()
    companions = {
        "feasibility_class": {"feasibility_score"},
        "feasibility_score": {"feasibility_class"},
    }.get(normalized, set())
    return [column for column in columns if column.lower() in companions]


def artifact_ready_for_serving(bundle: Dict[str, Any]) -> bool:
    """Only explicitly promoted, versioned, leakage-free artifacts may serve.

    The live policy is re-read here. An artifact stamped APPROVED while OI-6 was
    open must not become servable after the decision is revoked or found
    incomplete.
    """
    if bundle.get("artifact_version") != "v2.0-fr4":
        return False
    if not bundle.get("cv_metrics") or not bundle.get("feature_columns"):
        return False
    if bundle.get("approved_for_production") is not True:
        return False
    if bundle.get("training_mode") != "production":
        return False

    target_col = str(bundle.get("target_col", ""))
    feature_names = [str(name) for name in bundle.get("feature_names", [])]
    if target_derived_columns(target_col, feature_names):
        return False
    if not is_rule_generated_target(target_col):
        return True

    frozen_status = str(bundle.get("label_approval_status", "BLOCKED")).upper()
    if frozen_status != "APPROVED":
        return False
    validation = evaluate_label_policy(
        bundle.get("label_approval_snapshot") or {}, target_col=target_col
    )
    if not validation["approved"]:
        return False
    live_validation = load_label_policy()["oi6_validation"]
    if not live_validation["approved"]:
        return False
    # A rule-generated label learned from the synthetic sandbox is pipeline
    # validation evidence, not a production feasibility outcome dataset.
    provenance = bundle.get("training_provenance") or {}
    if isinstance(provenance, dict) and (
        provenance.get("dataset_is_sample") is True
        or provenance.get("data_source") == "synthetic"
    ):
        return False
    return True
