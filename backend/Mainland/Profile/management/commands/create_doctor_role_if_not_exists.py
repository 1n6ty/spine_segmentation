from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand

from Profile.models import Role

GROUP_NAME = 'Doctor'
ROLE_SLUG = 'doctor'
ROLE_NAMES = {'en-us': 'Doctor', 'ru': 'Врач'}


class Command(BaseCommand):
    help = ("Idempotently seeds the Doctor Group/Role, with every Permission in "
            "the system assigned to the group (same full set as Admin, for now). "
            "Pass --force to resync the group's permissions and role translations "
            "back to canonical even if the role already exists.")

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true',
                             help="Resync permissions/translations even if the role already exists.")

    def handle(self, *args, **options):
        force = options['force']

        group, _ = Group.objects.get_or_create(name=GROUP_NAME)
        role, created = Role.objects.get_or_create(slug=ROLE_SLUG, defaults={'group': group})

        if created or force:
            role.group.permissions.set(Permission.objects.all())
            for lang, name in ROLE_NAMES.items():
                role.translations.update_or_create(language_code=lang, defaults={'name': name})
            self.stdout.write(self.style.SUCCESS(f"Role '{ROLE_SLUG}' seeded/resynced."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Role '{ROLE_SLUG}' already exists, skipping."))
