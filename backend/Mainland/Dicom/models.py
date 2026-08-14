import uuid
from django.db import models
from django_cleanup.cleanup import cleanup_ignore
from parler.models import TranslatableModel, TranslatedFields

from FileManager.models import CasFileMixin

class Patient(models.Model):
    patient_id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4)
    name = models.CharField(max_length=255, null=True, blank=True)
    birth_date = models.CharField(max_length=32, null=True, blank=True)
    sex = models.CharField(max_length=16, null=True, blank=True)
    last_access_time = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name or 'Unknown'} ({self.patient_id})"

class Study(models.Model):
    study_instance_uid = models.CharField(max_length=64, primary_key=True)
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
    series_instance_uid = models.CharField(max_length=64, primary_key=True)
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
    one dedicated *File model per file-holding entity, FK'd to its owner. `study` is
    denormalized off `image.series.study` purely so the uniqueness constraint below can
    reference it directly (UniqueConstraint can't traverse a relation)."""
    image = models.OneToOneField(DicomImage, on_delete=models.CASCADE, related_name='xray_file')
    study = models.ForeignKey(Study, on_delete=models.CASCADE, related_name='xray_files')

    class Meta:
        constraints = [
            # NULL never conflicts with NULL in a unique index (true for both SQLite
            # and MySQL), so role=None (unclassified projection) rows never collide --
            # only role-classified files are capped at one per Study.
            models.UniqueConstraint(fields=['study', 'role'], name='dicom_one_file_per_study_role'),
        ]
        verbose_name = "DICOM File"
        verbose_name_plural = "DICOM Files"

    def __str__(self):
        return f"{self.image_id} / {self.role_id} / {self.name}"
