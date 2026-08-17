from django.db import migrations


def uncap_xray_roles(apps, schema_editor):
    FileRole = apps.get_model('FileManager', 'FileRole')
    FileRole.objects.filter(
        slug__in=['DICOM_XRAY_FRONTAL', 'DICOM_XRAY_SAGITTAL']
    ).update(max_count=None)


def recap_xray_roles(apps, schema_editor):
    FileRole = apps.get_model('FileManager', 'FileRole')
    FileRole.objects.filter(
        slug__in=['DICOM_XRAY_FRONTAL', 'DICOM_XRAY_SAGITTAL']
    ).update(max_count=1)


class Migration(migrations.Migration):
    """Data migration matching create_xray_file_roles_if_not_exists.py's new
    default (max_count=None) -- without this, an already-deployed environment
    keeps its existing max_count=1 rows until someone manually reruns that
    command with --force."""

    dependencies = [
        ('Dicom', '0006_remove_dicomfile_one_file_per_study_role'),
        ('FileManager', '0002_alter_casfile_path'),
    ]

    operations = [
        migrations.RunPython(uncap_xray_roles, recap_xray_roles),
    ]
