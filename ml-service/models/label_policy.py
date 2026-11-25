"""OI-6 gate for rule-generated feasibility labels.

No supervisor approval for the rule-generated label formula or its weights is
recorded in this repository. This module is the single server-side gate that
prevents those labels from producing a production feasibility artifact.
"""

import json
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


class LabelApprovalBlocked(RuntimeError):
    """Raised when a feasibility target is trained before OI-6 is closed."""

    def __init__(self, policy: Dict[str, Any], target_col: str):
        self.policy = policy
        self.target_col = target_col
        super().__init__(
            "FR-4 training blocked (OI-6): the rule-generated label formula and "
            f"weights for '{target_col}' have no recorded supervisor approval."
        )


def load_label_policy() -> Dict[str, Any]:
    with open(LABEL_POLICY_PATH, "r", encoding="utf-8") as handle:
        policy = json.load(handle)
    status = str(policy.get("status", "BLOCKED")).upper()
    # Fail closed even if the file is edited incompletely.
    if status != "APPROVED" or not policy.get("approved_at") or not policy.get("evidence_reference"):
        policy["status"] = "BLOCKED"
    else:
        policy["status"] = "APPROVED"
    return policy


def is_rule_generated_target(target_col: str) -> bool:
    normalized = str(target_col).strip().lower()
    return normalized in RULE_LABEL_TARGETS


def assert_training_allowed(target_col: str, dataset_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Allow generic sandbox targets; block unapproved feasibility labels."""
    if not is_rule_generated_target(target_col):
        return {
            "status": "ALLOWED_GENERIC_SANDBOX",
            "target_col": target_col,
            "note": "Generic ML target; not a production feasibility label.",
        }

    policy = load_label_policy()
    if policy["status"] != "APPROVED":
        raise LabelApprovalBlocked(policy, target_col)

    return {
        "status": "APPROVED",
        "target_col": target_col,
        "oi_id": policy.get("oi_id"),
        "approved_by": policy.get("approved_by"),
        "evidence_reference": policy.get("evidence_reference"),
        "dataset_is_sample": bool((dataset_info or {}).get("is_sample")),
    }


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
    """Existing legacy and unapproved artifacts must never auto-activate.

    The live policy is re-read here. An artifact stamped APPROVED while OI-6 was
    open must not become servable after the decision is revoked or found
    incomplete.
    """
    if not bundle.get("artifact_version") or not bundle.get("cv_metrics"):
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
    live_policy = load_label_policy()
    if live_policy["status"] != "APPROVED":
        return False
    if not live_policy.get("approved_at") or not live_policy.get("evidence_reference"):
        return False
    # A rule-generated label learned from the synthetic sandbox is pipeline
    # validation evidence, not a production feasibility outcome dataset.
    provenance = bundle.get("training_provenance") or {}
    if isinstance(provenance, dict) and provenance.get("dataset_is_sample") is True:
        return False
    return True
