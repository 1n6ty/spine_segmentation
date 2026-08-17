import common.storages
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('Dicom', '0004_remove_dicomimage_dicom_file_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='UserRecentStudies',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('side_polygons', models.JSONField(blank=True, default=list)),
                ('frontal_polygons', models.JSONField(blank=True, default=list)),
                ('thumbnail', models.ImageField(blank=True, null=True, storage=common.storages.PrivateMediaStorage(), upload_to='session-thumbnails/')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_accessed', models.DateTimeField(auto_now=True)),
                ('frontal_image', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='Dicom.dicomimage')),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='recent_studies', to=settings.AUTH_USER_MODEL)),
                ('side_image', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='Dicom.dicomimage')),
            ],
            options={
                'verbose_name': 'User Recent Study',
                'verbose_name_plural': 'User Recent Studies',
                'ordering': ['-last_accessed'],
            },
        ),
    ]
