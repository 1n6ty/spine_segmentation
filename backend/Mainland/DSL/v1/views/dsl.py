from common.schema.v1 import ApiResponse, Issue
from common.viewsets.v1 import StdViewSet

from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny

from DSL.utils.dsl import build_queryset_from_json_dsl
from DSL.utils.dataset import map_dataset_to_spec, get_orm_fields, get_dataset_fields, get_dataset_sources
from DSL.utils.permissions import DatasetPermission, get_allowed_fields
from DSL.utils.docs import generate_dataset_examples_and_schema
from DSL.v1.schemas.dsl import DSL_POST_Schema
from DSL.v1.paginations.dsl import DSL_Pagination

from pydantic import ValidationError
from drf_spectacular.utils import extend_schema

class DSL_ViewSet(StdViewSet):

    pagination_class = DSL_Pagination

    

    dataset_description, dataset_examples = generate_dataset_examples_and_schema()

    @extend_schema(
        request=DSL_POST_Schema,
        responses=DSL_POST_Schema,
        examples=dataset_examples,
        description=(
            "Dynamic DSL select endpoint.\n\n"
            "Use this endpoint to query datasets with filters, group_by, aggregates, and computed_fields.\n\n"
            f"{dataset_description}\n\n"
        ),
    )
    @action(detail=False, methods=["post"], url_path="select", url_name="dsl-select")
    async def select(self, request: Request) -> Response:
        response = ApiResponse()

        dataset = request.data.get('dataset', None)
        if not dataset:
            return response.add_issue(
                Issue(
                    status="error",
                    code=400,
                    message="`dataset` field must be provided.",
                    field="dataset"
                )
            ).set_status(
                status="error", code=400
            ).drf_response
        
        spec = map_dataset_to_spec(dataset)
        if spec is None:
            return response.add_issue(
                Issue(
                    status="error",
                    code=404,
                    message=f"dataset {dataset} does not exist.",
                    field="dataset"
                )
            ).set_status(
                status="error", code=404
            ).drf_response

        computed_fields = request.data.get('computed_fields', [])
        if computed_fields and isinstance(computed_fields, dict):
            computed_fields = list(computed_fields.keys())

        aggregates_fields = request.data.get('aggregates', [])
        if aggregates_fields and isinstance(aggregates_fields, dict):
            aggregates_fields = list(aggregates_fields.keys())

        try:
            dsl_data = DSL_POST_Schema.model_validate(
                request.data, 
                context={
                    "spec": spec,
                    "allowed_fields": get_allowed_fields(request, spec, self),
                    "orm_fields": get_orm_fields(spec),
                    "dataset_fields": get_dataset_fields(spec),
                    "computed_fields": computed_fields,
                    "aggregates_fields": aggregates_fields
                }
            )
        except ValidationError as e:
            for err in e.errors():
                field = ".".join(map(str, err["loc"]))
                response.add_issue(
                    Issue(
                        status="error",
                        code=400,
                        field=field,
                        message=f"Field '{field}' {err['msg']}"
                    ) if field else Issue(
                        status="error",
                        code=400,
                        message=err['msg']
                    )
                )
            return response.set_status(
                status="error",
                code=400
            ).drf_response
        
        try:
            queryset = build_queryset_from_json_dsl(
                queryset=spec.model.objects.filter(spec.default_filters),
                query_json=dsl_data.model_dump(),
                dataset_sources=get_dataset_sources(spec)
            )
        except Exception as e:
            return response.add_issue(
                Issue(
                    status="error",
                    code=400,
                    message="Something went wrong..."
                )
            ).set_status(
                status="error", code=400
            ).drf_response
        
        paginator = self.pagination_class()
        page = await paginator.paginate_queryset(queryset, request, view=self)
        if page == None:
            return paginator.custom_error

        return await paginator.get_paginated_response(page, spec)