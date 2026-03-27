from __future__ import annotations
from pydantic import BaseModel, field_validator, model_validator, Field
from typing import Optional, Literal
import re

from DSL.utils.compute import COMPUTE_OP
from DSL.utils.filter import OP_MAP as FILTER_OP
from DSL.utils.aggregate import AGGREGATE_OP

from django.conf import settings

class _Paginator(BaseModel):
    page: Optional[int] = None
    page_size: Optional[int] = None

    @field_validator('page')
    def page_validator(cls, v):
        if v is None:
            return v
        if v < 1:
            raise ValueError("shoud be >= 1.")
        return v
    
    @field_validator('page_size')
    def page_size_validator(cls, v):
        if v is None:
            return v
        if v < 1 or v > settings.API_MANIFEST["limits"]["page_size_max"]:
            raise ValueError(f"shoud be in [1, {settings.API_MANIFEST['limits']['page_size_max']}].")
        return v

VALID_COMPUTED_FIELD_EXP = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")

class _PreField(BaseModel):
    field: str

    @field_validator('field')
    def _field_validator(cls, v, info):
        if v in info.context["orm_fields"]:
            raise ValueError(f"{v} name was reserved.")
        
        if v in info.context["allowed_fields"]:
            return info.context["spec"].fields[v].source
        if v in info.context["computed_fields"]:
            return v

        raise ValueError(f"You can't use {v} here.")
    
class _PostField(_PreField):
    @field_validator('field')
    def _field_validator(cls, v, info):
        if v in info.context["orm_fields"]:
            raise ValueError(f"{v} name was reserved.")
        
        if v in info.context["allowed_fields"]:
            return info.context["spec"].fields[v].source
        if v in info.context["computed_fields"] or v in info.context["aggregates_fields"]:
            return v
        
        raise ValueError(f"You can't use {v} here.")

class _Computed_Expr(BaseModel):
    op: str
    args: list[str | int | float | _Computed_Expr | _PreField]
    
    @field_validator('op')
    def op_validator(cls, v):
        if not (v in list(COMPUTE_OP.keys())):
            raise ValueError(f"Unsupported operator {v}")
        return v

class _Filter_Node(BaseModel):
    field: str
    op: str
    value: str | int | float | list[str | int | float] | _PreField

    @field_validator('op')
    def op_validator(cls, v):
        if not (v in list(FILTER_OP.keys())):
            raise ValueError(f"Unsupported operator {v}")
        return v
    
    @field_validator('field')
    def _field_validator(cls, v, info):
        if v in info.context["computed_fields"]:
            raise ValueError(f"{v} is a computed field, use it in `having`")
        if v in info.context["orm_fields"]:
            raise ValueError(f"{v} name was reserved.")
        
        if v in info.context["allowed_fields"]:
            return info.context["spec"].fields[v].source
        
        raise ValueError(f"You can't use {v} here.")

class _Filter_Or(BaseModel):
    or_: list[_Filter_And | _Filter_Or | _Filter_Node] = Field(default=[], alias="or")

class _Filter_And(BaseModel):
    and_: list[_Filter_And | _Filter_Or | _Filter_Node] = Field(default=[], alias="and")

class _Aggregate_Node(BaseModel):
    field: str
    op: str
    args: Optional[list[int | float | str]] = None

    @field_validator('field')
    def _field_validator(cls, v, info):
        if v in info.context["orm_fields"]:
            raise ValueError(f"{v} name was reserved.")
        
        if v in info.context["allowed_fields"]:
            return info.context["spec"].fields[v].source
        if v in info.context["computed_fields"]:
            return v
        
        raise ValueError(f"You can't use {v} here.")
    
    @field_validator('op')
    def op_validator(cls, v):
        if not (v in list(AGGREGATE_OP.keys())):
            raise ValueError(f"Unsupported operator {v}")
        return v

class _Having_Node(BaseModel):
    field: str
    op: str
    value: str | int | float | list[str | int | float] | _PostField

    @field_validator('op')
    def op_validator(cls, v):
        if not (v in list(FILTER_OP.keys())):
            raise ValueError(f"Unsupported operator {v}")
        return v
    
    @field_validator('field')
    def _field_validator(cls, v, info):
        if v in info.context["orm_fields"]:
            raise ValueError(f"{v} name was reserved.")
        
        if v in info.context["allowed_fields"]:
            return info.context["spec"].fields[v].source
        if v in info.context["computed_fields"] or v in info.context["aggregates_fields"]:
            return v
        
        raise ValueError(f"You can't use {v} here.")

class _Sort_Node(BaseModel):
    direction: Literal["desc", "asc"]
    field: str

    @field_validator('field')
    def _field_validator(cls, v, info):
        if v in info.context["orm_fields"]:
            raise ValueError(f"{v} name was reserved.")
        
        if v in info.context["allowed_fields"]:
            return info.context["spec"].fields[v].source
        if v in info.context["computed_fields"] or v in info.context["aggregates_fields"]:
            return v
        
        raise ValueError(f"You can't use {v} here.")

class DSL_POST_Schema(BaseModel):
    dataset: str # Actually validated before this (necessary to validate fields)
    computed_fields: Optional[dict[str, _Computed_Expr]] = None
    filter: Optional[_Filter_And | _Filter_Or | _Filter_Node] = None
    exclude: Optional[_Filter_And | _Filter_Or | _Filter_Node] = None
    aggregates: Optional[dict[str, _Aggregate_Node]] = None
    having: Optional[list[_Having_Node] | _Having_Node] = None
    sort: Optional[list[_Sort_Node]] = None
    select: Optional[list[str]] = None
    pagination: Optional[_Paginator] = None

    @field_validator("computed_fields")
    def validate_computed_fields(cls, v, info):
        if v is None:
            return v
        for name in v.keys():
            if not VALID_COMPUTED_FIELD_EXP.match(name):
                raise ValueError(f"Invalid computed field name: {name}")
            if (name in info.context["orm_fields"]) or (name in info.context["dataset_fields"]):
                raise ValueError(f"{name} name was reserved.")
        return v
    
    @field_validator("aggregates")
    def validate_aggregates(cls, v, info):
        if v is None:
            return v
        for name in v.keys():
            if not VALID_COMPUTED_FIELD_EXP.match(name):
                raise ValueError(f"Invalid computed field name: {name}")
            if (name in info.context["orm_fields"]) or (name in info.context["dataset_fields"]):
                raise ValueError(f"{name} name was reserved.")
            if name in info.context["computed_fields"]:
                raise ValueError(f"{name} name was already taken.")
        return v
        
    @field_validator("select")
    def validate_select(cls, v, info):
        if v is None:
            return v
        
        resolved = []
        for field in v:
            if field in info.context["computed_fields"] or field in info.context["aggregates_fields"]:
                resolved.append(field)
            elif field in info.context["allowed_fields"]:
                resolved.append(info.context["spec"].fields[field].source)
            elif field in info.context["orm_fields"]:
                raise ValueError(f"{field} name was reserved.")
            else:
                raise ValueError(f"Not enough permissions to use {field}.")

        return resolved
    
    @model_validator(mode="after")
    def validate_model(self, info):
        # Nothing to do if select is None
        if not self.select:
            return self

        # Build allowed fields for select
        allowed = set()
        if self.aggregates:
            allowed.update(agg_key for agg_key, _ in self.aggregates.items())
        if self.computed_fields:
            allowed.update(self.computed_fields.keys())
        allowed.update(info.context["orm_fields"])
        # Check each select field
        for field in self.select:
            if field not in allowed:
                raise ValueError(
                    f"Select field '{field}' is not in aggregates or computed_fields."
                )

        return self
