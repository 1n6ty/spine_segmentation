from datetime import datetime
from typing import Any, List, Literal, Optional, TYPE_CHECKING

from pydantic import BaseModel, Field

from common.schemas.v1.errors import NotFoundResponse, _NotFoundIssue
from common.schemas.v1.pagination import Pagination_Meta_Schema
from common.schemas.v1.response import OkResponse

if TYPE_CHECKING:
    from Dicom.models import UserRecentStudies


class UserRecentStudies_Ref_Schema(BaseModel):
    id: int = Field(description="UserRecentStudies primary key.", examples=[7])
    patient_name: Optional[str] = Field(None, description="Patient name.", examples=["John Doe"])
    patient_birth_date: Optional[str] = Field(None, description="Patient birth date.", examples=["19800101"])
    patient_uid: Optional[str] = Field(None, description="Patient ID.", examples=["P123"])
    thumbnail: Optional[str] = Field(
        None, description="Data URI of the saved session thumbnail, or null if none was saved yet.",
    )
    side_present: bool = Field(description="Whether a side/sagittal projection is attached.", examples=[True])
    frontal_present: bool = Field(description="Whether a frontal projection is attached.", examples=[False])
    last_accessed: datetime = Field(description="When this session was last touched.")

    @classmethod
    def from_model(
        cls, row: "UserRecentStudies", *, thumbnail_data_uri: Optional[str] = None,
        side_sop_instance_uid: Optional[str] = None, frontal_sop_instance_uid: Optional[str] = None,
    ) -> "UserRecentStudies_Ref_Schema":
        # row.study must already be select_related('study__patient') on the
        # queryset this row came from -- see Dicom/v1/views/user_recent_studies.py.
        # side/frontal_sop_instance_uid come from
        # Dicom.v1.utils.session_images.resolve_session_images(row.study), resolved
        # by the caller (view), not queried here -- schemas stay DB-query-free,
        # same pattern as thumbnail_data_uri.
        patient = row.study.patient if row.study_id else None
        return cls(
            id=row.pk,
            patient_name=patient.name if patient else None,
            patient_birth_date=patient.birth_date if patient else None,
            patient_uid=patient.patient_id if patient else None,
            thumbnail=thumbnail_data_uri,
            side_present=side_sop_instance_uid is not None,
            frontal_present=frontal_sop_instance_uid is not None,
            last_accessed=row.last_accessed,
        )


class UserRecentStudies_Item_Schema(UserRecentStudies_Ref_Schema):
    side_sop_instance_uid: Optional[str] = Field(None, examples=["1.2.840.10008.5.1.4.1.1.7.1.99.887.1"])
    side_polygons: List[Any] = Field(
        default_factory=list, description="Current (possibly manually edited) Polygon[] for the side slot.",
    )
    side_segments: List[Any] = Field(
        default_factory=list, description="Current SegmentDefinition[] for the side slot.",
    )
    frontal_sop_instance_uid: Optional[str] = Field(None, examples=["1.2.840.10008.5.1.4.1.1.7.1.99.887.2"])
    frontal_polygons: List[Any] = Field(
        default_factory=list, description="Current (possibly manually edited) Polygon[] for the frontal slot.",
    )
    frontal_segments: List[Any] = Field(
        default_factory=list, description="Current SegmentDefinition[] for the frontal slot.",
    )

    @classmethod
    def from_model(
        cls, row: "UserRecentStudies", *, thumbnail_data_uri: Optional[str] = None,
        side_sop_instance_uid: Optional[str] = None, frontal_sop_instance_uid: Optional[str] = None,
    ) -> "UserRecentStudies_Item_Schema":
        ref = UserRecentStudies_Ref_Schema.from_model(
            row, thumbnail_data_uri=thumbnail_data_uri,
            side_sop_instance_uid=side_sop_instance_uid, frontal_sop_instance_uid=frontal_sop_instance_uid,
        )
        return cls(
            **ref.model_dump(),
            side_sop_instance_uid=side_sop_instance_uid,
            side_polygons=row.side_polygons or [],
            side_segments=row.side_segments or [],
            frontal_sop_instance_uid=frontal_sop_instance_uid,
            frontal_polygons=row.frontal_polygons or [],
            frontal_segments=row.frontal_segments or [],
        )


class UserRecentStudies_GET_Schema(BaseModel):
    page: Optional[int] = Field(None, examples=[1])
    page_size: Optional[int] = Field(None, examples=[20])


class UserRecentStudies_Projection_PATCH_Schema(BaseModel):
    sop_instance_uid: Optional[str] = Field(
        None, description="Attach the already-parsed DicomImage with this SOP Instance UID to this slot.",
        examples=["1.2.840.10008.5.1.4.1.1.7.1.99.887.1"],
    )
    polygons: Optional[List[Any]] = Field(
        None, description="Replace this slot's current Polygon[] with this value.",
    )
    segments: Optional[List[Any]] = Field(
        None, description="Replace this slot's current SegmentDefinition[] with this value.",
    )


class _UserRecentStudiesNotFoundIssue(_NotFoundIssue):
    field: str = Field('id', description="Always 'id' for this issue.", examples=['id'])
    message: str = Field(
        "UserRecentStudies 123 does not exist.",
        description="Fixed not-found message for this resource.",
        examples=["UserRecentStudies 123 does not exist."],
    )


class UserRecentStudies_NotFound_Response(NotFoundResponse):
    """Doubles as the actual runtime response builder (not just the OpenAPI
    doc declaration) -- call .from_pk(pk).drf_response at the call site
    instead of hand-building an equivalent ApiResponse/Issue pair, so the
    documented shape and the wire response can never drift apart."""
    details: List[_UserRecentStudiesNotFoundIssue] = Field(
        default_factory=lambda: [_UserRecentStudiesNotFoundIssue()],
        description="The single not-found issue.",
    )

    @classmethod
    def from_pk(cls, pk: Any) -> "UserRecentStudies_NotFound_Response":
        return cls(details=[_UserRecentStudiesNotFoundIssue(message=f"UserRecentStudies {pk} does not exist.")])


class _UserRecentStudiesNoneExistIssue(_NotFoundIssue):
    message: str = Field(
        "No recent studies exist for this user yet.",
        description="Fixed message when the requesting user has no UserRecentStudies rows at all "
                    "(as opposed to one specific id not existing/not being owned by them).",
        examples=["No recent studies exist for this user yet."],
    )


class UserRecentStudies_NoneExist_Response(NotFoundResponse):
    """The `latest` action's 404 when the user has zero UserRecentStudies rows --
    distinct from UserRecentStudies_NotFound_Response above (that one is keyed to
    one id that doesn't exist/isn't owned by the caller; this one has no id at
    all). Invariant response, no .from_pk-style constructor needed -- call
    UserRecentStudies_NoneExist_Response().drf_response directly."""
    details: List[_UserRecentStudiesNoneExistIssue] = Field(
        default_factory=lambda: [_UserRecentStudiesNoneExistIssue()],
        description="The single 'no recent studies at all' issue.",
    )


class UserRecentStudies_LIST_Data_Schema(BaseModel):
    meta: Pagination_Meta_Schema
    recent_studies: List[UserRecentStudies_Ref_Schema] = Field(description="Recent studies for this page.")


class UserRecentStudies_LIST_Response_OK(OkResponse):
    code: Literal[200] = Field(200, description="HTTP status code of the response.", examples=[200])
    data: UserRecentStudies_LIST_Data_Schema


class UserRecentStudies_RETRIEVE_Response_OK(OkResponse):
    """Doubles as the actual runtime response builder (not just the OpenAPI doc
    declaration) -- call .from_model(row, ...).drf_response at the call site,
    same convention as UserRecentStudies_NotFound_Response.from_pk above."""
    code: Literal[200] = Field(200, description="HTTP status code of the response.", examples=[200])
    data: UserRecentStudies_Item_Schema

    @classmethod
    def from_model(
        cls, row: "UserRecentStudies", *, thumbnail_data_uri: Optional[str] = None,
        side_sop_instance_uid: Optional[str] = None, frontal_sop_instance_uid: Optional[str] = None,
    ) -> "UserRecentStudies_RETRIEVE_Response_OK":
        return cls(data=UserRecentStudies_Item_Schema.from_model(
            row, thumbnail_data_uri=thumbnail_data_uri,
            side_sop_instance_uid=side_sop_instance_uid, frontal_sop_instance_uid=frontal_sop_instance_uid,
        ))


class UserRecentStudies_CREATE_Data_Schema(BaseModel):
    id: int = Field(description="Newly created UserRecentStudies id.", examples=[7])

    @classmethod
    def from_model(cls, row: "UserRecentStudies") -> "UserRecentStudies_CREATE_Data_Schema":
        return cls(id=row.pk)


class UserRecentStudies_CREATE_Response_OK(OkResponse):
    """Doubles as the actual runtime response builder -- see
    UserRecentStudies_RETRIEVE_Response_OK above."""
    code: Literal[201] = Field(201, description="HTTP status code of the response.", examples=[201])
    data: UserRecentStudies_CREATE_Data_Schema

    @classmethod
    def from_model(cls, row: "UserRecentStudies") -> "UserRecentStudies_CREATE_Response_OK":
        return cls(data=UserRecentStudies_CREATE_Data_Schema.from_model(row))
