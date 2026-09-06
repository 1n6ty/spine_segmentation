from django.db import migrations


def seed_managed_companies(apps, schema_editor):
    Profile = apps.get_model('Profile', 'Profile')
    ThroughModel = Profile.managed_companies.through
    ThroughModel.objects.bulk_create(
        (
            ThroughModel(profile_id=profile_id, company_id=company_id)
            for profile_id, company_id in Profile.objects.values_list('user_id', 'company_id')
        ),
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('Profile', '0002_profile_managed_companies'),
    ]

    operations = [
        migrations.RunPython(seed_managed_companies, migrations.RunPython.noop),
    ]
