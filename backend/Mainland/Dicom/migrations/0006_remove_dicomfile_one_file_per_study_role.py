from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('Dicom', '0005_userrecentstudies'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='dicomfile',
            name='dicom_one_file_per_study_role',
        ),
    ]
