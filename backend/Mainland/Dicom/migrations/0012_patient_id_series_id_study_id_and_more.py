import uuid
import django.db.models.deletion
from django.db import migrations, models


def _wipe_dicom_data(apps, schema_editor):
    """Patient/Study/Series switch from a natural-key (DICOM UID) primary key to
    a surrogate BigAutoField id (see those models' docstrings). Every FK that
    targeted one of the old PKs has to be dropped and recreated against the new
    one -- MySQL (this project's real backend) refuses to even drop a column's
    PRIMARY KEY while a FK constraint still depends on it ("Cannot drop index
    'PRIMARY': needed in a foreign key constraint"), so the dependent FK columns
    must be gone *before* their parent's PK swap, then recreated after. Dropping
    a NOT NULL FK column and recreating it needs an empty table to avoid a
    backfill-default prompt, and per explicit product decision (this app is
    still in development) losing today's seeded DICOM data to get there is
    acceptable -- Patient cascades through Study/Series/DicomImage/DicomFile/
    DicomThumbnail; UserRecentStudies has no CASCADE to Patient so it's cleared
    explicitly."""
    UserRecentStudies = apps.get_model('Dicom', 'UserRecentStudies')
    Patient = apps.get_model('Dicom', 'Patient')
    UserRecentStudies.objects.all().delete()
    Patient.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('Dicom', '0011_remove_userrecentstudies_thumbnail_dicomthumbnail'),
    ]

    operations = [
        migrations.RunPython(_wipe_dicom_data, migrations.RunPython.noop),

        # --- Patient: patient_id (DICOM UID, or a random-UUID fallback)
        # becomes a unique natural key instead of the PK. Study.patient (the
        # only FK targeting it) has to be gone first -- MySQL won't drop a
        # PRIMARY KEY a FK constraint still depends on.
        migrations.RemoveField(model_name='study', name='patient'),
        migrations.AlterField(
            model_name='patient',
            name='patient_id',
            field=models.CharField(default=uuid.uuid4, max_length=64, unique=True),
        ),
        migrations.AddField(
            model_name='patient',
            name='id',
            field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID'),
        ),
        migrations.AddField(
            model_name='study',
            name='patient',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, related_name='studies', to='Dicom.patient',
            ),
            preserve_default=False,
        ),

        # --- Study: study_instance_uid becomes a unique natural key instead
        # of the PK. Series.study and UserRecentStudies.study (the two FKs
        # targeting it) have to be gone first, same reason as above.
        migrations.RemoveField(model_name='series', name='study'),
        migrations.RemoveField(model_name='userrecentstudies', name='study'),
        migrations.AlterField(
            model_name='study',
            name='study_instance_uid',
            field=models.CharField(max_length=64, unique=True),
        ),
        migrations.AddField(
            model_name='study',
            name='id',
            field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID'),
        ),
        migrations.AddField(
            model_name='series',
            name='study',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, related_name='series', to='Dicom.study',
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='userrecentstudies',
            name='study',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='recent_studies', to='Dicom.study',
            ),
        ),

        # --- Series: series_instance_uid becomes a unique natural key instead
        # of the PK. DicomImage.series and DicomFile.series (the two FKs
        # targeting it) have to be gone first, same reason as above.
        # DicomFile.series is also part of the dicom_one_file_per_series_role
        # UniqueConstraint, which must itself be dropped before the column it
        # references and recreated once the column is back.
        migrations.RemoveField(model_name='dicomimage', name='series'),
        migrations.RemoveConstraint(model_name='dicomfile', name='dicom_one_file_per_series_role'),
        migrations.RemoveField(model_name='dicomfile', name='series'),
        migrations.AlterField(
            model_name='series',
            name='series_instance_uid',
            field=models.CharField(max_length=64, unique=True),
        ),
        migrations.AddField(
            model_name='series',
            name='id',
            field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID'),
        ),
        migrations.AddField(
            model_name='dicomimage',
            name='series',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, related_name='images', to='Dicom.series',
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='dicomfile',
            name='series',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, related_name='xray_files', to='Dicom.series',
            ),
            preserve_default=False,
        ),
        migrations.AddConstraint(
            model_name='dicomfile',
            constraint=models.UniqueConstraint(fields=('series', 'role'), name='dicom_one_file_per_series_role'),
        ),
    ]
