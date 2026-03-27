from drf_spectacular.utils import OpenApiExample

from DSL.datasets.list import DATASETS

def generate_dataset_examples_and_schema():
    """
    Returns examples and a schema description string for all datasets
    """
    examples = []
    description_lines = []

    for dataset in DATASETS:
        # Build textual description of dataset and its fields
        description_lines.append(f"### Dataset: {dataset.name}")
        description_lines.append(f"{dataset.description}\n")
        description_lines.append("Fields:")

        for field_name, field_spec in dataset.fields.items():
            perms = [p.__name__ for p in field_spec.permissions] or ["No restriction"]
            description_lines.append(
                f"- `{field_name}` ({field_spec.type}) - {field_spec.description}, Permissions: {', '.join(perms)}"
            )

        description_lines.append("")  # newline

        # Build example JSON DSL
        example_json = {
            "dataset": dataset.name,
            "select": list(dataset.fields.keys())[:2],  # pick first 2 fields
            "filter": {
                "and": [
                    {"field": list(dataset.fields.keys())[0], "op": "eq", "value": "<value>"}
                ]
            }
        }

        examples.append(
            OpenApiExample(
                name=dataset.name,
                description=dataset.description,
                value=example_json,
                response_only=False,
                status_codes=[200]
            )
        )

    return "\n".join(description_lines), examples