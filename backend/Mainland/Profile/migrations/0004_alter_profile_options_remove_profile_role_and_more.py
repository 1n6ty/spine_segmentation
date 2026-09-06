from django.db import migrations, models


def backfill_roles_m2m(apps, schema_editor):
    Profile = apps.get_model('Profile', 'Profile')
    ThroughModel = Profile.roles.through
    ThroughModel.objects.bulk_create(
        (
            ThroughModel(profile_id=profile_id, role_id=role_id)
            for profile_id, role_id in Profile.objects.exclude(role_id=None).values_list('user_id', 'role_id')
        ),
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('Profile', '0003_backfill_managed_companies'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='profile',
            options={'permissions': [('change_sensitive_profile_data', 'Can change role, company, and identity fields on any profile')], 'verbose_name': 'Profile', 'verbose_name_plural': 'Profiles'},
        ),
        migrations.AddField(
            model_name='profile',
            name='roles',
            field=models.ManyToManyField(blank=True, related_name='profiles', to='Profile.role'),
        ),
        migrations.RunPython(backfill_roles_m2m, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='profile',
            name='role',
        ),
    ]
