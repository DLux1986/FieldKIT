#!/usr/bin/env python3
"""Export a visit report DOCX from JSON data using docxtpl.

Usage example:
  python tools/export_visit_report.py \
    --project-id 2305-1004 \
    --visit-id 9b0e4f93-7fbb-4bc2-b178-56f3060a1142 \
    --template templates/visit_report_template.docx \
    --output reports/2305-1004-WT01-draft.docx \
    --projects-json data/projects.json \
    --visits-json assets/data/visits.json \
    --samples-json assets/data/samples.json \
    --dump-context reports/2305-1004-WT01-context.json
"""

from __future__ import annotations

import argparse
import json
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from docxtpl import DocxTemplate
except ImportError:  # pragma: no cover
    DocxTemplate = None


def _load_json_array(path: Path) -> list[dict[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return [x for x in raw if isinstance(x, dict)]

    if isinstance(raw, dict):
        for key in ("projects", "visits", "samples", "events", "body"):
            value = raw.get(key)
            if isinstance(value, list):
                return [x for x in value if isinstance(x, dict)]
    return []


def _load_manager_info(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []

    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return [x for x in raw if isinstance(x, dict)]

    if isinstance(raw, dict):
        for key in ("manager", "managers", "pm", "pm_info"):
            value = raw.get(key)
            if isinstance(value, list):
                return [x for x in value if isinstance(x, dict)]
    return []


def _sample_id(sample: dict[str, Any]) -> str:
    return str(sample.get("sample_id") or sample.get("sampleId") or "")


def _visit_id(visit: dict[str, Any]) -> str:
    return str(visit.get("id") or visit.get("visit_id") or "")


def _project_id(obj: dict[str, Any]) -> str:
    return str(obj.get("project_id") or obj.get("projectId") or obj.get("id") or "")


def _to_number(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _visit_label(visit: dict[str, Any]) -> str:
    test_type = str(visit.get("test_type") or "").strip().upper()
    visit_number = str(visit.get("visit_number") or "").strip()
    combined = f"{test_type}{visit_number}".strip()
    return combined or _visit_id(visit)


_SYSTEM_TYPE_LABELS: dict[str, str] = {
    "FIXD": "Fixed Window",
    "AWNG": "Awning Window",
    "CASE": "Casement Window",
    "HUNG": "Single / Double Hung Window",
    "SLDR": "Sliding Window",
    "TILT": "Tilt-Turn Window",
    "PCTR": "Picture Window",
    "PIVT": "Pivot Window",
    "CWOF": "Curtain Wall (Operable Fenestration)",
    "CWFX": "Curtain Wall (Fixed)",
    "WWAL": "Window Wall",
    "STFR": "Storefront System",
    "SING": "Single Swing Door",
    "DUBL": "Double Swing Door",
    "SLGD": "Sliding Glass Door",
    "TDRR": "Terrace Door",
}

_NUMBER_WORDS: dict[int, str] = {
    0: "zero",
    1: "one",
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    9: "nine",
    10: "ten",
    11: "eleven",
    12: "twelve",
    13: "thirteen",
    14: "fourteen",
    15: "fifteen",
    16: "sixteen",
    17: "seventeen",
    18: "eighteen",
    19: "nineteen",
    20: "twenty",
}


def _normalize_space(value: str) -> str:
    return " ".join(str(value or "").split())


def _normalize_product_type(value: str) -> str:
    text = _normalize_space(value)
    if not text:
        return ""
    mapped = _SYSTEM_TYPE_LABELS.get(text.upper())
    return mapped or text


def _singularize_type_label(value: str) -> str:
    text = _normalize_product_type(value)
    lower = text.lower()
    if lower.endswith(" windows"):
        return text[:-1]
    if lower.endswith(" doors"):
        return text[:-1]
    if lower.endswith(" systems"):
        return text[:-1]
    return text


def _pluralize_type_label(value: str) -> str:
    text = _normalize_space(value)
    lower = text.lower()
    if lower.endswith(" window"):
        return f"{text}s"
    if lower.endswith(" door"):
        return f"{text}s"
    if lower.endswith(" system"):
        return f"{text}s"
    if lower.endswith("s"):
        return text
    return f"{text}s"


def _count_word(value: int) -> str:
    return _NUMBER_WORDS.get(value, str(value))


def _join_with_and(parts: list[str]) -> str:
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0]
    if len(parts) == 2:
        return f"{parts[0]} and {parts[1]}"
    return f"{', '.join(parts[:-1])} and {parts[-1]}"


def _sample_product_type(sample: dict[str, Any]) -> str:
    sample_details = sample.get("sampleDetails") or {}
    candidates: list[Any] = [
        sample_details.get("productType") if isinstance(sample_details, dict) else None,
        sample.get("product_type"),
        sample.get("productType"),
        sample.get("window_type"),
        sample.get("system_type"),
    ]
    for candidate in candidates:
        normalized = _normalize_product_type(str(candidate or ""))
        if normalized:
            return normalized
    return ""


def _build_product_type_summary(samples: list[dict[str, Any]]) -> dict[str, Any]:
    grouped: "OrderedDict[str, dict[str, Any]]" = OrderedDict()
    for sample in samples:
        raw_type = _sample_product_type(sample)
        if not raw_type:
            continue

        singular_label = _singularize_type_label(raw_type)
        canonical = singular_label.lower()
        if canonical not in grouped:
            grouped[canonical] = {
                "singular_title": singular_label.title(),
                "singular_sentence": singular_label.lower(),
                "count": 0,
            }
        grouped[canonical]["count"] += 1

    product_types: list[dict[str, Any]] = []
    sentence_parts: list[str] = []
    for item in grouped.values():
        count = int(item["count"])
        singular_title = str(item["singular_title"])
        singular_sentence = str(item["singular_sentence"])
        list_label = singular_title if count == 1 else _pluralize_type_label(singular_title)
        sentence_label = singular_sentence if count == 1 else _pluralize_type_label(singular_sentence)

        product_types.append(
            {
                "count": count,
                "label": list_label,
                "line": f"({count}) {list_label}",
            }
        )
        sentence_parts.append(f"{_count_word(count)} {sentence_label}")

    product_types_list_text = "\n".join(item["line"] for item in product_types)
    product_types_sentence = _join_with_and(sentence_parts)
    if product_types_sentence:
        product_types_sentence = product_types_sentence[0].upper() + product_types_sentence[1:]

    return {
        "product_types": product_types,
        "product_types_list_text": product_types_list_text,
        "product_types_sentence": product_types_sentence,
    }


def _sample_row(sample: dict[str, Any]) -> dict[str, Any]:
    sample_details = sample.get("sampleDetails") or {}
    sample_location = sample.get("sampleLocation") or {}
    test_params = sample.get("testParameters") or {}
    failure = sample.get("failure") if isinstance(sample.get("failure"), dict) else {}

    result_text = str(sample.get("result") or "")
    is_fail = result_text.upper() == "FAIL"

    cycle_value = failure.get("cycleFailureOccurred") if isinstance(failure, dict) else None
    cycle_text = str(cycle_value or "").strip() if is_fail else ""
    time_text = str((failure.get("timeOfFailure") if isinstance(failure, dict) else "") or "").strip() if is_fail else ""
    mode_text = str((failure.get("modeOfFailure") if isinstance(failure, dict) else "") or "").strip() if is_fail else ""
    location_text = str((failure.get("failureLocation") if isinstance(failure, dict) else "") or "").strip() if is_fail else ""

    failure_parts: list[str] = []
    if cycle_text:
        failure_parts.append(f"Cycle {cycle_text}")
    if time_text:
        failure_parts.append(f"Time {time_text}")
    if mode_text:
        failure_parts.append(mode_text)
    if location_text:
        failure_parts.append(location_text)

    failure_summary = " | ".join(failure_parts) if failure_parts else ("Recorded failure" if is_fail else "")
    failure_display = failure_summary if is_fail else "-"

    pressure_value = _to_number(test_params.get("pressure_psf") if isinstance(test_params, dict) else None)
    if pressure_value is None:
        pressure_value = _to_number(sample.get("pressure_psf"))

    return {
        "sample_id": _sample_id(sample),
        "test_date": str(sample.get("testDate") or sample.get("test_date") or ""),
        "test_time": str(sample.get("testTime") or sample.get("test_time") or ""),
        "test_phase": str(sample.get("testPhase") or sample.get("test_phase") or ""),
        "series_model": str(
            (sample_details.get("seriesModel") if isinstance(sample_details, dict) else None)
            or sample.get("seriesModel")
            or sample.get("series_model")
            or ""
        ),
        "system_type": str(sample.get("window_type") or sample.get("system_type") or ""),
        "elevation": str(
            (sample_location.get("elevation") if isinstance(sample_location, dict) else None)
            or sample.get("elevation")
            or ""
        ),
        "unit_number": str(
            (sample_location.get("unitNumber") if isinstance(sample_location, dict) else None)
            or sample.get("unit_number")
            or ""
        ),
        "pressure_psf": f"{pressure_value:.2f}" if pressure_value is not None else "",
        "result": result_text,
        "failure_cycle": cycle_text,
        "failure_time": time_text,
        "failure_mode": mode_text,
        "failure_location": location_text,
        "failure_summary": failure_summary,
        "failure_display": failure_display,
    }


def _first_non_empty(values: list[str]) -> str:
    for value in values:
        v = str(value or "").strip()
        if v:
            return v
    return ""


def _normalize_name_key(value: str) -> str:
    parts = ["".join(ch for ch in token.lower() if ch.isalpha()) for token in str(value or "").split()]
    return " ".join(part for part in parts if part)


def _normalize_name_key_without_middle_initials(value: str) -> str:
    tokens = _normalize_name_key(value).split()
    filtered = [token for token in tokens if len(token) > 1]
    return " ".join(filtered)


def _lookup_manager_entry(manager_name: str, manager_info: list[dict[str, Any]]) -> dict[str, str]:
    base = {"pm_name": str(manager_name or "").strip(), "pm_info": "", "pm_title": ""}
    if not manager_name:
        return base

    exact_key = _normalize_name_key(manager_name)
    reduced_key = _normalize_name_key_without_middle_initials(manager_name)

    for entry in manager_info:
        candidate_name = str(entry.get("pm_name") or entry.get("name") or "").strip()
        if not candidate_name:
            continue

        candidate_exact = _normalize_name_key(candidate_name)
        candidate_reduced = _normalize_name_key_without_middle_initials(candidate_name)

        if exact_key and candidate_exact == exact_key:
            return {
                "pm_name": candidate_name,
                "pm_info": str(entry.get("pm_info") or entry.get("suffix") or "").strip(),
                "pm_title": str(entry.get("pm_title") or entry.get("title") or "").strip(),
            }

        if reduced_key and candidate_reduced == reduced_key:
            return {
                "pm_name": candidate_name,
                "pm_info": str(entry.get("pm_info") or entry.get("suffix") or "").strip(),
                "pm_title": str(entry.get("pm_title") or entry.get("title") or "").strip(),
            }

    return base


def build_context(
    *,
    project_id: str,
    visit_id: str,
    projects: list[dict[str, Any]],
    visits: list[dict[str, Any]],
    samples: list[dict[str, Any]],
    manager_info: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    project = next((p for p in projects if _project_id(p) == project_id), None)
    visit = next((v for v in visits if _visit_id(v) == visit_id), None)

    if not visit:
        raise ValueError(f"Visit not found: {visit_id}")

    if not project and _project_id(visit):
        project = next((p for p in projects if _project_id(p) == _project_id(visit)), None)

    visit_samples = [s for s in samples if str(s.get("visit_id") or s.get("visitId") or "") == visit_id]
    rows = [_sample_row(s) for s in visit_samples]

    lead_technician = _first_non_empty([
        str((s.get("personnel") or {}).get("leadTechnician") if isinstance(s.get("personnel"), dict) else "")
        or str(s.get("lead_technician") or "")
        for s in visit_samples
    ])
    technician_2 = _first_non_empty([
        str((s.get("personnel") or {}).get("technician2") if isinstance(s.get("personnel"), dict) else "")
        or str(s.get("technician_2") or "")
        for s in visit_samples
    ])

    def witness_field(field: str) -> str:
        return _first_non_empty([
            str((s.get("witnesses") or {}).get(field) if isinstance(s.get("witnesses"), dict) else "")
            or str(s.get(field) or "")
            for s in visit_samples
        ])

    witnesses = {
        "witness_name_1": witness_field("witness_name_1"),
        "witness_company_1": witness_field("witness_company_1"),
        "witness_role_1": witness_field("witness_role_1"),
        "witness_name_2": witness_field("witness_name_2"),
        "witness_company_2": witness_field("witness_company_2"),
        "witness_role_2": witness_field("witness_role_2"),
    }

    pass_count = sum(1 for r in rows if r["result"].upper() == "PASS")
    fail_count = sum(1 for r in rows if r["result"].upper() == "FAIL")
    product_type_summary = _build_product_type_summary(visit_samples)
    test_date = _first_non_empty([
        str(s.get("testDate") or s.get("test_date") or "")
        for s in visit_samples
    ])
    test_time = _first_non_empty([
        str(s.get("testTime") or s.get("test_time") or "")
        for s in visit_samples
    ])
    test_phase = _first_non_empty([
        str(s.get("testPhase") or s.get("test_phase") or "")
        for s in visit_samples
    ])
    project_manager_name = str((project or {}).get("manager") or "")
    manager = _lookup_manager_entry(project_manager_name, manager_info or [])

    pm_info = manager.get("pm_info", "")
    manager_name_with_info = manager.get("pm_name", "")
    if pm_info:
        manager_name_with_info = f"{manager_name_with_info}{pm_info}"

    return {
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "project_id": _project_id(project or {}) or _project_id(visit),
        "project_name": str((project or {}).get("name") or ""),
        "project_manager": project_manager_name,
        "project_client": str((project or {}).get("client") or ""),
        "testDate": test_date,
        "testTime": test_time,
        "testPhase": test_phase,
        "project": {
            "id": _project_id(project or {}) or _project_id(visit),
            "name": str((project or {}).get("name") or ""),
            "client": str((project or {}).get("client") or ""),
            "manager": str((project or {}).get("manager") or ""),
            "address": str((project or {}).get("address") or ""),
        },
        "manager": {
            "pm_name": manager.get("pm_name", ""),
            "pm_info": manager.get("pm_info", ""),
            "pm_title": manager.get("pm_title", ""),
            "pm_name_with_info": manager_name_with_info,
        },
        "visit": {
            "id": _visit_id(visit),
            "label": _visit_label(visit),
            "date": str(visit.get("date") or ""),
            "test_type": str(visit.get("test_type") or ""),
            "visit_number": str(visit.get("visit_number") or ""),
            "notes": str(visit.get("notes") or ""),
        },
        "personnel": {
            "lead_technician": lead_technician,
            "technician_2": technician_2,
        },
        "witnesses": witnesses,
        "summary": {
            "sample_count": len(rows),
            "pass_count": pass_count,
            "fail_count": fail_count,
            "product_types": product_type_summary["product_types"],
            "product_types_list_text": product_type_summary["product_types_list_text"],
            "product_types_sentence": product_type_summary["product_types_sentence"],
        },
        "samples": rows,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render visit report DOCX from FieldKIT JSON")
    parser.add_argument("--project-id", required=True)
    parser.add_argument("--visit-id", required=True)
    parser.add_argument("--template", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--projects-json", default=Path("data/projects.json"), type=Path)
    parser.add_argument("--visits-json", default=Path("assets/data/visits.json"), type=Path)
    parser.add_argument("--samples-json", default=Path("assets/data/samples.json"), type=Path)
    parser.add_argument("--manager-info-json", default=Path("data/project-manager-info.json"), type=Path)
    parser.add_argument("--dump-context", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if DocxTemplate is None:
        raise SystemExit("docxtpl is not installed. Run: pip install -r requirements.txt")

    projects = _load_json_array(args.projects_json)
    visits = _load_json_array(args.visits_json)
    samples = _load_json_array(args.samples_json)
    manager_info = _load_manager_info(args.manager_info_json)

    context = build_context(
        project_id=args.project_id,
        visit_id=args.visit_id,
        projects=projects,
        visits=visits,
        samples=samples,
        manager_info=manager_info,
    )

    if args.dump_context:
        args.dump_context.parent.mkdir(parents=True, exist_ok=True)
        args.dump_context.write_text(json.dumps(context, indent=2), encoding="utf-8")

    args.output.parent.mkdir(parents=True, exist_ok=True)

    tpl = DocxTemplate(str(args.template))
    tpl.render(context)
    tpl.save(str(args.output))

    print(f"Rendered report: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
