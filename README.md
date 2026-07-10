# BEE-FieldKIT
A kit of tools to use while field testing

## Visit Report Draft Export (DOCX)

This repo now includes a first-pass DOCX report renderer using `docxtpl`.

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Prepare a DOCX template

Use Jinja placeholders in your template. See `docs/report-template-fields.md`.

### 3. Render a visit draft

```bash
python tools/export_visit_report.py \
	--project-id 2305-1004 \
	--visit-id <visit-id> \
	--template templates/visit_report_template.docx \
	--output reports/2305-1004-WT01-draft.docx \
	--projects-json data/projects.json \
	--visits-json assets/data/visits.json \
	--samples-json assets/data/samples.json \
	--dump-context reports/2305-1004-WT01-context.json
```

`--dump-context` is optional and useful for template debugging.
