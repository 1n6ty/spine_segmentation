from django.db import migrations


def delete_view_company_any_company_permission(apps, schema_editor):
    Permission = apps.get_model('auth', 'Permission')
    Permission.objects.filter(
        codename='view_company_any_company', content_type__app_label='Company',
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('Company', '0001_initial'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='company',
            options={'verbose_name': 'Company', 'verbose_name_plural': 'Companies'},
        ),
        migrations.RunPython(delete_view_company_any_company_permission, migrations.RunPython.noop),
    ]
