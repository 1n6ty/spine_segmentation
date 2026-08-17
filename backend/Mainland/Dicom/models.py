import uuid
from django.conf import settings
from django.db import models
from django_cleanup.cleanup import cleanup_ignore
from parler.models import TranslatableModel, TranslatedFields

from FileManager.models import CasFileMixin

class Patient(models.Model):
    """`patient_id` is a natural key (DICOM PatientID, or a random-UUID fallback
    when a file omits that tag -- see Dicom.utils.parse) -- kept unique+indexed
    for the aupdate_or_create-by-UID dedup lookups, but not the PK. A natural
    key used as PK would make every child table (Study.patient, and everything
    chained further through Series/DicomImage/DicomFile) carry a duplicate copy
    of this string in its FK column instead of a compact int; using the default
    surrogate BigAutoField id keeps those FKs small and their indexes dense
    regardless of how patient_id's values happen to be distributed."""
    patient_id = models.CharField(max_length=64, unique=True, default=uuid.uuid4)
    name = models.CharField(max_length=255, null=True, blank=True)
    birth_date = models.CharField(max_length=32, null=True, blank=True)
    sex = models.CharField(max_length=16, null=True, blank=True)
    last_access_time = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name or 'Unknown'} ({self.patient_id})"

class Study(models.Model):
    """study_instance_uid: natural key (DICOM StudyInstanceUID), unique+indexed
    for the same dedup-lookup reason as Patient.patient_id -- see that model's
    docstring for why it isn't the PK."""
    study_instance_uid = models.CharField(max_length=64, unique=True)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='studies')
    study_date = models.CharField(max_length=32, null=True, blank=True)
    description = models.CharField(max_length=255, null=True, blank=True)
    physician_name = models.CharField(max_length=255, null=True, blank=True)
    last_access_time = models.DateTimeField(auto_now=True)
    
    # Facility information
    institution_name = models.CharField(max_length=255, null=True, blank=True)
    institution_address = models.CharField(max_length=255, null=True, blank=True)
    station_name = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return self.study_instance_uid

class Series(models.Model):
    """series_instance_uid: natural key (DICOM SeriesInstanceUID), unique+indexed
    for the same dedup-lookup reason as Patient.patient_id -- see that model's
    docstring for why it isn't the PK."""
    series_instance_uid = models.CharField(max_length=64, unique=True)
    study = models.ForeignKey(Study, on_delete=models.CASCADE, related_name='series')
    modality = models.CharField(max_length=32, null=True, blank=True)
    body_part = models.CharField(max_length=64, null=True, blank=True)

    def __str__(self):
        return self.series_instance_uid

class Projection(TranslatableModel):
    translations = TranslatedFields(
        name=models.CharField(max_length=64)
    )
    slug = models.SlugField(unique=True)

    def __str__(self):
        return self.slug

class SegmentationStatus(TranslatableModel):
    translations = TranslatedFields(
        name=models.CharField(max_length=64)
    )
    slug = models.SlugField(unique=True)

    class Meta:
        verbose_name = "Segmentation Status"
        verbose_name_plural = "Segmentation Statuses"

    def __str__(self):
        return self.slug

class DicomImage(models.Model):
    sop_instance_uid = models.CharField(max_length=64, primary_key=True)
    series = models.ForeignKey(Series, on_delete=models.CASCADE, related_name='images')
    projection = models.ForeignKey(Projection, on_delete=models.PROTECT, null=True, blank=True, related_name='images')

    reference_points = models.JSONField(null=True, blank=True, default=dict)

    segmentation_status = models.ForeignKey(SegmentationStatus, on_delete=models.PROTECT, null=True, blank=True, related_name='dicom_images')
    segmentation_error = models.TextField(null=True, blank=True)

    # Image Metadata
    rows = models.IntegerField(null=True, blank=True)
    cols = models.IntegerField(null=True, blank=True)
    slope = models.FloatField(default=1.0)
    intercept = models.FloatField(default=0.0)
    window_center = models.FloatField(default=0.0)
    window_width = models.FloatField(default=0.0)
    is_signed = models.BooleanField(default=False)
    mm_per_pixel = models.FloatField(default=1.0)

    def __str__(self):
        return self.sop_instance_uid


@cleanup_ignore
class DicomFile(CasFileMixin):
    """CAS-backed record of the raw DICOM file behind a DicomImage. A separate model
    (not fields merged onto DicomImage) matching how CasFileMixin is used elsewhere --
    one dedicated *File model per file-holding entity, FK'd to its owner. `series` is
    denormalized off `image.series` purely so the uniqueness constraint below can
    reference it directly (UniqueConstraint can't traverse a relation).

    Capped at one file per (series, role) -- not per Study. A Study is shared,
    content-addressed infra any number of UserRecentStudies sessions (same user or
    different users) can reference; capping there (an earlier version of this
    constraint did) meant two independent sessions needing distinct images that
    happened to share a real DICOM StudyInstanceUID (not unusual with templated/
    synthetic test data) would collide on a global cap that had nothing to do with
    either session's own state. Series is the right granularity: normal usage is one
    acquisition, one relevant Series holding up to one sagittal + one frontal
    instance -- matching lambumiz-plus's FileManager pattern of always scoping
    check_role_max_count() to the specific parent entity a file attaches to (e.g.
    `OrderFile.objects.filter(order=order, role=role)`), never a shared ancestor.

    This UniqueConstraint -- not check_role_max_count() -- is what actually enforces the
    cap under concurrency (the count-then-insert check alone is racy). It only works
    because DICOM_XRAY_FRONTAL/DICOM_XRAY_SAGITTAL are max_count=1: a UniqueConstraint
    can express "at most one", never "at most N>1". See docs/patterns/media-serving.md's
    "Enforcing FileRole.max_count" section before ever raising either role's max_count."""
    image = models.OneToOneField(DicomImage, on_delete=models.CASCADE, related_name='xray_file')
    series = models.ForeignKey(Series, on_delete=models.CASCADE, related_name='xray_files')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['series', 'role'], name='dicom_one_file_per_series_role'),
        ]
        verbose_name = "DICOM File"
        verbose_name_plural = "DICOM Files"

    def __str__(self):
        return f"{self.image_id} / {self.role_id} / {self.name}"


@cleanup_ignore
class DicomThumbnail(CasFileMixin):
    """CAS-backed 128x128 JPEG preview of a DicomImage's pixel data, rendered
    server-side once per image content (Dicom.utils.thumbnail) instead of
    being uploaded by the frontend. Content-addressed exactly like DicomFile:
    since the JPEG is a deterministic function of the source pixel bytes, two
    DicomImages that happen to share identical content (e.g. the same
    physical image re-uploaded under a different SOPInstanceUID) produce a
    byte-identical JPEG and therefore transparently share the same physical
    file via CasFile's own ref-counting -- no bespoke reuse lookup needed,
    unlike parse_and_store_dicom's segmentation-result reuse."""
    image = models.OneToOneField(DicomImage, on_delete=models.CASCADE, related_name='thumbnail_file')

    class Meta:
        verbose_name = "DICOM Thumbnail"
        verbose_name_plural = "DICOM Thumbnails"

    def __str__(self):
        return f"{self.image_id} thumbnail"


class UserRecentStudies(models.Model):
    """A doctor's per-user 'recent studies' entry -- the access-control boundary
    for persisted sessions. Does NOT duplicate or own Patient/Study/Series/
    DicomImage/DicomFile -- those stay shared/content-addressed exactly as
    everywhere else in this app; this model only references them. Ownership
    lives here, not on those rows, since they're legitimately deduped across
    the whole practice (e.g. Patient.patient_id is DICOM-tag-derived, not
    user-scoped).

    Links to one Study -- the DICOM-level real-world study -- not to specific
    per-projection images. Which SopInstance is "the side one" / "the frontal
    one" for that Study is derived at read time via DicomFile.role (see
    Dicom/v1/utils/session_images.py), not stored as a redundant FK here.
    Dicom.v1.views.user_recent_studies's `projection` action enforces that a
    row's side and frontal images share the same Series (the same real
    acquisition) once the first one is attached -- rejects the PATCH
    otherwise, rather than silently mixing images from unrelated Series.

    side_polygons/frontal_polygons hold the frontend's own (possibly manually
    edited) Polygon[] shape verbatim -- deliberately separate from
    DicomImage.reference_points (the AI's original, unedited-by-any-user seed)
    so two different users annotating the same underlying image never clobber
    each other, and so the AI baseline stays recoverable on demand.

    No thumbnail field here -- the session's preview is derived at read time
    from its side (falling back to frontal) DicomImage's own DicomThumbnail
    (see Dicom/v1/utils/session_images.py), the same way side/frontal
    SopInstance identity is. Storing a thumbnail per-row would duplicate the
    server-generated, CAS-deduplicated image already owned by DicomImage."""

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='recent_studies')

    study = models.ForeignKey(Study, on_delete=models.SET_NULL, null=True, blank=True, related_name='recent_studies')
    side_polygons = models.JSONField(default=list, blank=True)
    frontal_polygons = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    last_accessed = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Recent Study"
        verbose_name_plural = "User Recent Studies"
        ordering = ['-last_accessed']

    def __str__(self):
        return f"{self.owner_id} / {self.pk}"
