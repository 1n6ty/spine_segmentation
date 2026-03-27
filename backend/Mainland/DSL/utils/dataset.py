from DSL.datasets.schema import DatasetSpec
from DSL.datasets.list import DATASETS

from django.db import models

from functools import lru_cache
from typing import Dict, Set

@lru_cache
def map_dataset_to_spec(dataset: str) -> DatasetSpec | None:
    for d in DATASETS:
        if d.name == dataset:
            return d
    return None

def get_orm_fields(
    spec: str | DatasetSpec,
    *,
    max_depth: int = 5,
) -> Dict[str, models.Field]:
    dataset = spec
    if isinstance(spec, str):
        dataset = map_dataset_to_spec(spec)
        if dataset is None:
            return {}

    model = dataset.model
    fields: Dict[str, models.Field] = {}

    def walk(
        current_model: type[models.Model],
        prefix: str = "",
        depth: int = 0,
        visited: Set[type[models.Model]] | None = None,
    ):
        if depth > max_depth:
            return

        if visited is None:
            visited = set()

        visited.add(current_model)

        for field in current_model._meta.concrete_fields:
            name = f"{prefix}{field.name}" if prefix else field.name
            fields[name] = field

            if (
                field.is_relation
                and field.related_model
                and field.related_model not in visited
            ):
                walk(
                    field.related_model,
                    prefix=f"{name}__",
                    depth=depth + 1,
                    visited=visited.copy(),
                )

        # many-to-many fields (THIS is what you’re missing)
        for field in current_model._meta.many_to_many:
            name = f"{prefix}{field.name}" if prefix else field.name
            fields[name] = field

            if field.related_model and field.related_model not in visited:
                walk(
                    field.related_model,
                    prefix=f"{name}__",
                    depth=depth + 1,
                    visited=visited.copy(),
                )

    walk(model)
    return fields

def get_dataset_fields(spec: str | DatasetSpec) -> list[str]:
    dataset = spec
    if isinstance(spec, str):
        dataset = map_dataset_to_spec(spec)
        if dataset is None:
            return []
        
    return list(dataset.fields.keys())

def get_dataset_sources(spec: str | DatasetSpec) -> list[str]:
    dataset = spec
    if isinstance(spec, str):
        dataset = map_dataset_to_spec(spec)
        if dataset is None:
            return []
        
    return [dataset.fields[i].source for i in dataset.fields.keys()]