import django.db.models.deletion
from django.db import migrations, models


def populate_study(apps, schema_editor):
    UserRecentStudies = apps.get_model('Dicom', 'UserRecentStudies')
    for row in UserRecentStudies.objects.select_related(
        'side_image__series', 'frontal_image__series'
    ).all():
        # Prefers the side image's Study, falling back to frontal's -- same
        # fallback order the removed _merged_patient_brief() used.
        image = row.side_image or row.frontal_image
        if image is not None:
            row.study_id = image.series.study_id
            row.save(update_fields=['study_id'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    """UserRecentStudies now links to one Study (the DICOM-level real-world
    study) instead of two per-projection DicomImage FKs -- which SopInstance is
    "the side/frontal image" for that Study is derived at read time via
    DicomFile.role (Dicom/v1/utils/session_images.py), not stored redundantly
    here. See Dicom.models.UserRecentStudies's docstring."""

    dependencies = [
        ('Dicom', '0008_dicomfile_series'),
    ]

    operations = [
        migrations.AddField(
            model_name='userrecentstudies',
            name='study',
            field=models.ForeignKey(
                null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='recent_studies', to='Dicom.study',
            ),
        ),
        migrations.RunPython(populate_study, noop_reverse),
        migrations.RemoveField(
            model_name='userrecentstudies',
            name='side_image',
        ),
        migrations.RemoveField(
            model_name='userrecentstudies',
            name='frontal_image',
        ),
    ]
