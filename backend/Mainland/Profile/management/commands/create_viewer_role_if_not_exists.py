from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand

from Profile.models import Role

GROUP_NAME = 'Viewer'
ROLE_SLUG = 'viewer'
ROLE_NAMES = {'en-us': 'Viewer', 'ru': 'Наблюдатель'}


class Command(BaseCommand):
    help = ("Idempotently seeds the Viewer Group/Role -- the default role a new "
            "Profile gets assigned (see Profile/models.py's assign_default_role "
            "signal). Intentionally granted no permissions. Pass --force to "
            "resync translations (and clear any permissions manually added to "
            "the group) back to canonical even if the role already exists.")

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true',
                             help="Resync translations (and clear permissions) even if the role already exists.")

    def handle(self, *args, **options):
        force = options['force']

        group, _ = Group.objects.get_or_create(name=GROUP_NAME)
        role, created = Role.objects.get_or_create(slug=ROLE_SLUG, defaults={'group': group})

        if created or force:
            role.group.permissions.clear()
            for lang, name in ROLE_NAMES.items():
                role.translations.update_or_create(language_code=lang, defaults={'name': name})
            self.stdout.write(self.style.SUCCESS(f"Role '{ROLE_SLUG}' seeded/resynced."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Role '{ROLE_SLUG}' already exists, skipping."))
