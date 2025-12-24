# Templates

Templates customize the appearance and structure of exported Word documents.

## Templates Page

The Templates page (`/dashboard/templates`) shows:
- **Your uploaded templates** - Custom templates you've created
- **Default templates** - Built-in templates to start from

## Default Templates

Five default templates matching document formats:

| Template | For Document Type |
|----------|------------------|
| step-doc | Step-by-step Doc |
| quick-guide | Quick Guide |
| reference | Reference Document |
| summary | Executive Summary |
| default-doc | Legacy docs |

## Template Syntax

Templates use Jinja2-style syntax with variables and control structures.

---

## Global Variables (All Formats)

Available in every template:

| Variable | Description |
|----------|-------------|
| `title` | Doc title |
| `doc_id` | Doc identifier |
| `language` | Language code (e.g., "en") |
| `language_upper` | Language uppercase (e.g., "EN") |
| `generated_at` | Full timestamp (YYYY-MM-DD HH:MM) |
| `generated_date` | Date only (YYYY-MM-DD) |
| `generated_time` | Time only (HH:MM) |
| `target_audience` | Target audience (if set during generation) |
| `target_objective` | Doc objective (if set during generation) |
| `document_format` | Format type (step-doc, quick-guide, etc.) |
| `video_name` | Source video filename |
| `video_duration` | Source video duration |
| `step_count` | Number of steps |
| `screenshot_count` | Number of screenshots |

---

## Step-by-step Doc Variables

### Semantic Steps
Loop through `semantic_steps`:

| Variable | Description |
|----------|-------------|
| `step.number` | Step number |
| `step.title` | Step title |
| `step.description` | Step description |
| `step.image` | Screenshot (InlineImage) |
| `step.has_image` | Boolean: has image |

### Other Content
| Variable | Description |
|----------|-------------|
| `introduction` | Introduction text |
| `conclusion` | Conclusion text |
| `notes` | List of notes |

### Notes
Loop through `notes`:

| Variable | Description |
|----------|-------------|
| `note.type` | Type: `warning`, `tip`, or `info` |
| `note.content` | Note content |

### Example Template
```jinja
{{ title }}
Step-by-step Doc | {{ generated_date }} | {{ language_upper }}

{% if introduction %}
Introduction
{{ introduction }}
{% endif %}

{% for step in semantic_steps %}
Step {{ step.number }}: {{ step.title }}
{{ step.description }}
{% if step.image %}{{ step.image }}{% endif %}
{% endfor %}

{% for note in notes %}
{% if note.type == 'warning' %}⚠️ Warning: {{ note.content }}
{% elif note.type == 'tip' %}💡 Tip: {{ note.content }}
{% else %}ℹ️ {{ note.content }}{% endif %}
{% endfor %}

{% if conclusion %}
Conclusion
{{ conclusion }}
{% endif %}
```

---

## Quick Guide Variables

| Variable | Description |
|----------|-------------|
| `overview` | Overview text |
| `keypoints` | List of key points |
| `tips` | List of tips |

### Key Points
Loop through `keypoints`:

| Variable | Description |
|----------|-------------|
| `kp.number` | Key point number |
| `kp.title` | Key point title |
| `kp.content` | Key point content |
| `kp.image` | Screenshot (InlineImage) |
| `kp.has_image` | Boolean: has image |

### Tips
Loop through `tips`:

| Variable | Description |
|----------|-------------|
| `tip.content` | Tip content |
| `tip.image` | Screenshot (InlineImage) |
| `tip.has_image` | Boolean: has image |

### Example Template
```jinja
{{ title }}
Quick Guide | {{ generated_date }} | {{ language_upper }}

{% if overview %}
Overview
{{ overview }}
{% endif %}

{% if keypoints %}
Key Points
{% for kp in keypoints %}
{% if kp.title %}{{ kp.title }}{% endif %}
{{ kp.content }}
{% if kp.image %}{{ kp.image }}{% endif %}
{% endfor %}
{% endif %}

{% if tips %}
Tips
{% for tip in tips %}
💡 {{ tip.content }}
{% if tip.image %}{{ tip.image }}{% endif %}
{% endfor %}
{% endif %}
```

---

## Reference Document Variables

| Variable | Description |
|----------|-------------|
| `sections` | List of sections |
| `definitions` | List of definitions |
| `examples` | List of examples |

### Sections
Loop through `sections`:

| Variable | Description |
|----------|-------------|
| `section.title` | Section title |
| `section.content` | Section content |
| `section.image` | Screenshot (InlineImage) |
| `section.has_image` | Boolean: has image |

### Definitions
Loop through `definitions`:

| Variable | Description |
|----------|-------------|
| `def.term` | Term being defined |
| `def.content` | Definition content |

### Examples
Loop through `examples`:

| Variable | Description |
|----------|-------------|
| `ex.title` | Example title |
| `ex.content` | Example content |
| `ex.image` | Screenshot (InlineImage) |
| `ex.has_image` | Boolean: has image |

### Example Template
```jinja
{{ title }}
Reference Document | {{ generated_date }} | {{ language_upper }}

{% for section in sections %}
{% if section.title %}{{ section.title }}{% endif %}
{{ section.content }}
{% if section.image %}{{ section.image }}{% endif %}
{% endfor %}

{% if definitions %}
Definitions
{% for def in definitions %}
{{ def.term }}: {{ def.content }}
{% endfor %}
{% endif %}

{% if examples %}
Examples
{% for ex in examples %}
{% if ex.title %}{{ ex.title }}{% endif %}
{{ ex.content }}
{% if ex.image %}{{ ex.image }}{% endif %}
{% endfor %}
{% endif %}
```

---

## Executive Summary Variables

| Variable | Description |
|----------|-------------|
| `highlights` | Key highlights text |
| `findings` | List of findings |
| `recommendations` | List of recommendations |

### Findings
Loop through `findings`:

| Variable | Description |
|----------|-------------|
| `finding.number` | Finding number |
| `finding.title` | Finding title |
| `finding.content` | Finding content |
| `finding.image` | Screenshot (InlineImage) |
| `finding.has_image` | Boolean: has image |

### Recommendations
Loop through `recommendations`:

| Variable | Description |
|----------|-------------|
| `rec.number` | Recommendation number |
| `rec.title` | Recommendation title |
| `rec.content` | Recommendation content |

### Example Template
```jinja
{{ title }}
Executive Summary | {{ generated_date }} | {{ language_upper }}

{% if highlights %}
Key Highlights
{{ highlights }}
{% endif %}

{% if findings %}
Findings
{% for finding in findings %}
{% if finding.title %}{{ finding.title }}{% else %}Finding {{ finding.number }}{% endif %}
{{ finding.content }}
{% if finding.image %}{{ finding.image }}{% endif %}
{% endfor %}
{% endif %}

{% if recommendations %}
Recommendations
{% for rec in recommendations %}
{% if rec.title %}{{ rec.title }}{% else %}Recommendation {{ rec.number }}{% endif %}
{{ rec.content }}
{% endfor %}
{% endif %}
```

---

## Uploading Custom Templates

1. Go to **Templates** page (`/dashboard/templates`)
2. Click **Upload Template** button
3. File picker opens - select your `.docx` template file
4. Enter a name for your template
5. Template is now available for Word exports

## Using Templates

When exporting a doc to Word:
1. Click Export → Word
2. Select your template from the dropdown
3. Export applies your template formatting

## Tips

- Use the correct variables for your document format
- Start from a default template and modify
- Test templates with different docs
- Use conditionals (`{% if %}`) to handle optional content
- Images are InlineImage objects - just use `{{ step.image }}`
