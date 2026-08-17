from typing import NamedTuple, Optional

from django.db.models.fields.files import FieldFile

from Dicom.models import DicomFile, Study
from Dicom.utils.constants import DICOM_XRAY_FRONTAL_ROLE_SLUG, DICOM_XRAY_SAGITTAL_ROLE_SLUG


class SessionImages(NamedTuple):
    side_sop_instance_uid: Optional[str]
    frontal_sop_instance_uid: Optional[str]
    thumbnail_field_file: Optional[FieldFile]


async def resolve_session_images(study: Optional[Study]) -> SessionImages:
    """Resolves 'the side image' / 'the frontal image' for a UserRecentStudies
    row's Study -- derived via DicomFile.role, not stored as a redundant FK on
    UserRecentStudies itself (see its docstring). One query for both roles
    (role__slug__in=[...]), split in Python -- not two separate afirst()
    calls -- since this runs once per row in a paginated list, and per-row
    round trips add up. Ordered by series_id purely for determinism, not to
    paper over a real ambiguity: Dicom.v1.views.user_recent_studies's
    `projection` action already enforces that a row's side and frontal images
    share one Series once both are attached, so in the common case there's
    only ever one candidate per role to find here anyway.

    Also resolves the session's preview thumbnail: the side image's (falling
    back to the frontal image's) server-generated, CAS-deduplicated
    DicomThumbnail -- side-preferred, matching every other side/frontal merge
    convention in this app (e.g. SessionService.mergedPatient on the
    frontend). getattr(..., None) is safe here even without select_related
    actually caching the miss -- Django's RelatedObjectDoesNotExist for a
    missing reverse OneToOne is a subclass of AttributeError specifically so
    getattr's default kicks in instead of raising."""
    if study is None:
        return SessionImages(None, None, None)

    files = DicomFile.objects.filter(
        series__study=study, role__slug__in=(DICOM_XRAY_SAGITTAL_ROLE_SLUG, DICOM_XRAY_FRONTAL_ROLE_SLUG),
    ).select_related('role', 'image__thumbnail_file').order_by('series_id')

    side = frontal = None
    async for file in files:
        if file.role.slug == DICOM_XRAY_SAGITTAL_ROLE_SLUG and side is None:
            side = file
        elif file.role.slug == DICOM_XRAY_FRONTAL_ROLE_SLUG and frontal is None:
            frontal = file
        if side is not None and frontal is not None:
            break

    primary = side or frontal
    thumbnail_field_file = None
    if primary is not None:
        thumbnail = getattr(primary.image, 'thumbnail_file', None)
        thumbnail_field_file = thumbnail.file if thumbnail else None

    return SessionImages(
        side.image_id if side else None,
        frontal.image_id if frontal else None,
        thumbnail_field_file,
    )
