from django.db import migrations


def delete_any_company_permissions(apps, schema_editor):
    Permission = apps.get_model('auth', 'Permission')
    Permission.objects.filter(
        codename__in=('view_profile_any_company', 'delete_profile_any_company'),
        content_type__app_label='Profile',
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('Profile', '0004_alter_profile_options_remove_profile_role_and_more'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RunPython(delete_any_company_permissions, migrations.RunPython.noop),
    ]
