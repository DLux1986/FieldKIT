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


def _sample_row(sample: dict[str, Any]) -> dict[str, Any]:
    sample_details = sample.get("sampleDetails") or {}
    sample_location = sample.get("sampleLocation") or {}
    test_params = sample.get("testParameters") or {}

    pressure_value = _to_number(test_params.get("pressure_psf") if isinstance(test_params, dict) else None)
    if pressure_value is None:
        pressure_value = _to_number(sample.get("pressure_psf"))

    return {
        "sample_id": _sample_id(sample),
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
        "result": str(sample.get("result") or ""),
    }


def _first_non_empty(values: list[str]) -> str:
    for value in values:
        v = str(value or "").strip()
        if v:
            return v
    return ""


def build_context(
    *,
    project_id: str,
    visit_id: str,
    projects: list[dict[str, Any]],
    visits: list[dict[str, Any]],
    samples: list[dict[str, Any]],
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

    return {
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "project_id": _project_id(project or {}) or _project_id(visit),
        "project_name": str((project or {}).get("name") or ""),
        "project_manager": str((project or {}).get("manager") or ""),
        "project_client": str((project or {}).get("client") or ""),
        "project": {
            "id": _project_id(project or {}) or _project_id(visit),
            "name": str((project or {}).get("name") or ""),
            "client": str((project or {}).get("client") or ""),
            "manager": str((project or {}).get("manager") or ""),
            "address": str((project or {}).get("address") or ""),
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
    parser.add_argument("--dump-context", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if DocxTemplate is None:
        raise SystemExit("docxtpl is not installed. Run: pip install -r requirements.txt")

    projects = _load_json_array(args.projects_json)
    visits = _load_json_array(args.visits_json)
    samples = _load_json_array(args.samples_json)

    context = build_context(
        project_id=args.project_id,
        visit_id=args.visit_id,
        projects=projects,
        visits=visits,
        samples=samples,
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
