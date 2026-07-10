# Visit Report Template Fields

Use these Jinja fields in your DOCX template (for `docxtpl`).

## Top-level fields
- `{{ generated_at }}`
- `{{ project_id }}`
- `{{ project_name }}`
- `{{ project_manager }}`
- `{{ project_client }}`

## Project fields
- `{{ project.id }}`
- `{{ project.name }}`
- `{{ project.client }}`
- `{{ project.manager }}`
- `{{ project.address }}`

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

## Sample table loop
Use this in a Word table row:

```jinja
{% for s in samples %}
{{ s.sample_id }} | {{ s.series_model }} | {{ s.system_type }} | {{ s.elevation }} | {{ s.unit_number }} | {{ s.pressure_psf }} | {{ s.result }}
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
