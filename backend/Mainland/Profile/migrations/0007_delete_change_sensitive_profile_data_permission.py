from django.db import migrations


def delete_change_sensitive_profile_data_permission(apps, schema_editor):
    Permission = apps.get_model('auth', 'Permission')
    Permission.objects.filter(
        codename='change_sensitive_profile_data', content_type__app_label='Profile',
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('Profile', '0006_alter_profile_options_role_assignable'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RunPython(delete_change_sensitive_profile_data_permission, migrations.RunPython.noop),
    ]
