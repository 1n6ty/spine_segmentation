import django.db.models.deletion
from django.db import migrations, models


def populate_series(apps, schema_editor):
    DicomFile = apps.get_model('Dicom', 'DicomFile')
    for file in DicomFile.objects.select_related('image').all():
        file.series_id = file.image.series_id
        file.save(update_fields=['series_id'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    """Replaces DicomFile.study (denormalized off image.series.study) with
    DicomFile.series (denormalized off image.series) -- the file-role cap
    (0010_xray_file_roles_recapped.py) is being rescoped from per-Study to
    per-Series, and a UniqueConstraint can't traverse a relation, so the FK it
    references has to live directly on the model. See Dicom.models.DicomFile's
    docstring for why Series (not Study) is the correct cap granularity."""

    dependencies = [
        ('Dicom', '0007_xray_file_roles_uncapped'),
    ]

    operations = [
        migrations.AddField(
            model_name='dicomfile',
            name='series',
            field=models.ForeignKey(
                null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name='xray_files', to='Dicom.series',
            ),
        ),
        migrations.RunPython(populate_series, noop_reverse),
        migrations.AlterField(
            model_name='dicomfile',
            name='series',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='xray_files', to='Dicom.series',
            ),
        ),
        migrations.RemoveField(
            model_name='dicomfile',
            name='study',
        ),
        migrations.AddConstraint(
            model_name='dicomfile',
            constraint=models.UniqueConstraint(
                fields=('series', 'role'), name='dicom_one_file_per_series_role',
            ),
        ),
    ]
