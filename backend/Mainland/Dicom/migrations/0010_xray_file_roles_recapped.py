from django.db import migrations


def recap_xray_roles(apps, schema_editor):
    FileRole = apps.get_model('FileManager', 'FileRole')
    FileRole.objects.filter(
        slug__in=['DICOM_XRAY_FRONTAL', 'DICOM_XRAY_SAGITTAL']
    ).update(max_count=1)


def uncap_xray_roles(apps, schema_editor):
    FileRole = apps.get_model('FileManager', 'FileRole')
    FileRole.objects.filter(
        slug__in=['DICOM_XRAY_FRONTAL', 'DICOM_XRAY_SAGITTAL']
    ).update(max_count=None)


class Migration(migrations.Migration):
    """Reverts 0007_xray_file_roles_uncapped.py's max_count=None back to 1, now
    that the cap is correctly scoped to Series rather than Study (see
    0008_dicomfile_series.py and Dicom.models.DicomFile's docstring)."""

    dependencies = [
        ('Dicom', '0009_userrecentstudies_study'),
        ('FileManager', '0002_alter_casfile_path'),
    ]

    operations = [
        migrations.RunPython(recap_xray_roles, uncap_xray_roles),
    ]
