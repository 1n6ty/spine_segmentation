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

        # get_fields() returns both forward and reverse relations
        for field in current_model._meta.get_fields():
            
            # Determine the name to use in the lookup (e.g., 'author' or 'book_set')
            # Reverse relations use 'get_accessor_name()'
            if hasattr(field, 'get_accessor_name'):
                name = field.get_accessor_name()
            else:
                name = field.name

            full_name = f"{prefix}{name}" if prefix else name
            
            # Avoid duplicate processing and infinite loops
            if full_name in fields:
                continue
                
            fields[full_name] = field

            # Check for related model to continue walking
            related_model = getattr(field, 'related_model', None)
            
            if (
                related_model 
                and related_model not in visited
            ):
                walk(
                    related_model,
                    prefix=f"{full_name}__",
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