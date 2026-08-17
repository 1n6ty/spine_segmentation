from django.contrib import admin
from parler.admin import TranslatableAdmin

from Dicom.models import (
    DicomFile,
    DicomImage,
    DicomThumbnail,
    Patient,
    Projection,
    SegmentationStatus,
    Series,
    Study,
    UserRecentStudies,
)


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ('patient_id', 'name', 'birth_date', 'sex', 'last_access_time')
    search_fields = ('patient_id', 'name')


@admin.register(Study)
class StudyAdmin(admin.ModelAdmin):
    list_display = (
        'study_instance_uid', 'patient', 'study_date', 'description',
        'physician_name', 'institution_name', 'last_access_time',
    )
    list_select_related = ('patient',)
    search_fields = ('study_instance_uid', 'patient__patient_id', 'patient__name', 'description')
    autocomplete_fields = ('patient',)


@admin.register(Series)
class SeriesAdmin(admin.ModelAdmin):
    list_display = ('series_instance_uid', 'study', 'modality', 'body_part')
    list_select_related = ('study',)
    list_filter = ('modality',)
    search_fields = ('series_instance_uid', 'study__study_instance_uid')
    autocomplete_fields = ('study',)


@admin.register(DicomImage)
class DicomImageAdmin(admin.ModelAdmin):
    list_display = (
        'sop_instance_uid', 'series', 'projection', 'segmentation_status',
        'rows', 'cols', 'mm_per_pixel',
    )
    list_select_related = ('series', 'projection', 'segmentation_status')
    list_filter = ('projection', 'segmentation_status')
    search_fields = ('sop_instance_uid', 'series__series_instance_uid')
    autocomplete_fields = ('series', 'projection', 'segmentation_status')


@admin.register(Projection)
class ProjectionAdmin(TranslatableAdmin):
    list_display = ('name', 'slug')
    search_fields = ('translations__name', 'slug')


@admin.register(SegmentationStatus)
class SegmentationStatusAdmin(TranslatableAdmin):
    list_display = ('name', 'slug')
    search_fields = ('translations__name', 'slug')


@admin.register(DicomFile)
class DicomFileAdmin(admin.ModelAdmin):
    list_display = ('image', 'series', 'role', 'name', 'size', 'created_at')
    list_select_related = ('image', 'series', 'role')
    list_filter = ('role',)
    search_fields = ('image__sop_instance_uid', 'series__series_instance_uid', 'name', 'hash')
    autocomplete_fields = ('image', 'series', 'role')


@admin.register(DicomThumbnail)
class DicomThumbnailAdmin(admin.ModelAdmin):
    list_display = ('image', 'name', 'size', 'created_at')
    list_select_related = ('image',)
    search_fields = ('image__sop_instance_uid', 'name', 'hash')
    autocomplete_fields = ('image',)


@admin.register(UserRecentStudies)
class UserRecentStudiesAdmin(admin.ModelAdmin):
    list_display = ('id', 'owner', 'study', 'last_accessed', 'created_at')
    list_select_related = ('owner', 'study')
    search_fields = ('owner__username', 'owner__email', 'study__study_instance_uid')
    autocomplete_fields = ('owner', 'study')
