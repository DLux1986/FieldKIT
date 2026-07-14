# Visit Report Template Fields

Use these Jinja fields in your DOCX template (for `docxtpl`).

## Top-level fields
- `{{ generated_at }}`
- `{{ project_id }}`
- `{{ project_name }}`
- `{{ project_manager }}`
- `{{ project_client }}`
- `{{ testDate }}`
- `{{ testTime }}`
- `{{ testPhase }}`

## Project fields
- `{{ project.id }}`
- `{{ project.name }}`
- `{{ project.client }}`
- `{{ project.manager }}`
- `{{ project.address }}`

## Manager fields
- `{{ manager.pm_name }}`
- `{{ manager.pm_info }}`
- `{{ manager.pm_title }}`
- `{{ manager.pm_name_with_info }}`

## Visit fields
- `{{ visit.id }}`
- `{{ visit.label }}`
- `{{ visit.date }}`
- `{{ visit.test_type }}`
- `{{ visit.visit_number }}`
- `{{ visit.notes }}`

## Personnel fields
- `{{ personnel.lead_technician }}`
- `{{ personnel.technician_2 }}`

## Witness fields
- `{{ witnesses.witness_name_1 }}`
- `{{ witnesses.witness_company_1 }}`
- `{{ witnesses.witness_role_1 }}`
- `{{ witnesses.witness_name_2 }}`
- `{{ witnesses.witness_company_2 }}`
- `{{ witnesses.witness_role_2 }}`

Blank witness fields are valid when only one witness is present.

## Summary fields
- `{{ summary.sample_count }}`
- `{{ summary.pass_count }}`
- `{{ summary.fail_count }}`
- `{{ summary.product_types_sentence }}`
- `{{ summary.product_types_list_text }}`

Product type loop fields:

```jinja
{% for p in summary.product_types %}
{{ p.line }}
{% endfor %}
```

Available fields per `p`:
- `{{ p.count }}`
- `{{ p.label }}`
- `{{ p.line }}`

## Sample table loop
Use this in a Word table row:

```jinja
{% for s in samples %}
{{ s.sample_id }} | {{ s.test_date }} | {{ s.test_time }} | {{ s.test_phase }} | {{ s.series_model }} | {{ s.system_type }} | {{ s.elevation }} | {{ s.unit_number }} | {{ s.pressure_psf }} | {{ s.result }} | {{ s.failure_display }}
{% endfor %}
```

Recommended table columns:
- Sample ID
- Series / Model
- System Type
- Elevation
- Unit Number
- Test Pressure (psf)
- Pass/Fail
- Failure Details

Available fields per `s`:
- `{{ s.sample_id }}`
- `{{ s.test_date }}`
- `{{ s.test_time }}`
- `{{ s.test_phase }}`
- `{{ s.series_model }}`
- `{{ s.system_type }}`
- `{{ s.elevation }}`
- `{{ s.unit_number }}`
- `{{ s.pressure_psf }}`
- `{{ s.result }}`
- `{{ s.failure_cycle }}`
- `{{ s.failure_time }}`
- `{{ s.failure_mode }}`
- `{{ s.failure_location }}`
- `{{ s.failure_summary }}`
- `{{ s.failure_display }}`

`{{ s.failure_display }}` is the recommended bulletproof field for table cells:
- FAIL rows: same value as `{{ s.failure_summary }}`
- Non-FAIL rows: `-`

Example with expanded conditional failure fields:

```jinja
{% for s in samples %}
{{ s.sample_id }} | {{ s.result }} |
{% if s.result == "FAIL" %}
Cycle {{ s.failure_cycle }} | Time {{ s.failure_time }} | {{ s.failure_mode }} | {{ s.failure_location }}
{% else %}
-
{% endif %}
{% endfor %}
```
