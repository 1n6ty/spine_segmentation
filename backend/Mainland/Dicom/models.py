import uuid
from django.db import models

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

class DicomImage(models.Model):
    PROJECTION_CHOICES = [
        ('frontal', 'Frontal'),
        ('sagittal', 'Sagittal'),
    ]
    
    sop_instance_uid = models.CharField(max_length=64, primary_key=True)
    series = models.ForeignKey(Series, on_delete=models.CASCADE, related_name='images')
    projection = models.CharField(max_length=16, choices=PROJECTION_CHOICES, null=True, blank=True)
    
    reference_points = models.JSONField(null=True, blank=True, default=dict)

    # Image Metadata
    rows = models.IntegerField(null=True, blank=True)
    cols = models.IntegerField(null=True, blank=True)
    slope = models.FloatField(default=1.0)
    intercept = models.FloatField(default=0.0)
    window_center = models.FloatField(default=0.0)
    window_width = models.FloatField(default=0.0)
    is_signed = models.BooleanField(default=False)
    mm_per_pixel = models.FloatField(default=1.0)

    dicom_file = models.FileField(upload_to='private/dicom_files/', null=True, blank=True)
    file_hash = models.CharField(max_length=64, null=True, blank=True)

    def __str__(self):
        return self.sop_instance_uid
