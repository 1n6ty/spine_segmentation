from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand

from Profile.models import Role

# Single source of truth for every Role/Group in the system, replacing the
# three separate create_<role>_role_if_not_exists commands. Each entry's
# `permissions` is a list of (app_label, codename) pairs -- `view_profile`/
# `delete_profile`/`change_profile` are Django's own auto-generated default
# permissions, reused as the managed_companies-scoped access tier rather than
# redeclared (see Profile.models.Profile.Meta's comment). There is no
# unscoped "any company" tier anywhere in this system --
# ManagedCompanyPermission/scope_queryset_to_managed_companies via
# Profile.managed_companies is the sole company-scoping mechanism.
ROLE_DEFINITIONS = {
    "viewer": {
        "group_name": "Viewer",
        "permissions": [],
        "translations": {"en-us": "Viewer", "ru": "Наблюдатель"},
    },
    "doctor": {
        "group_name": "Doctor",
        "permissions": [
            ("Dicom", "access_studies"),
            ("Company", "view_company"),
            ("Profile", "view_profile"),
        ],
        "translations": {"en-us": "Doctor", "ru": "Врач"},
    },
    "admin": {
        "group_name": "Admin",
        "permissions": [
            ("Profile", "view_profile"),
            ("Profile", "delete_profile"),
            ("Profile", "change_profile"),
            ("Profile", "change_profile_role"),
            ("Profile", "change_profile_company"),
            ("Profile", "reset_profile_password"),
            ("Company", "view_company"),
        ],
        "translations": {"en-us": "Admin", "ru": "Администратор"},
    },
}

# admin is the only role permitted to grant roles to other profiles (via
# Profile.change_profile_role); doctor/viewer are deliberately excluded --
# grantable only via Django admin, matching Lambumiz-plus's ASSIGNABLE.
ASSIGNABLE = {
    "admin": ["viewer", "doctor", "admin"],
}


class Command(BaseCommand):
    help = ("Idempotently seeds/resyncs every Role/Group in ROLE_DEFINITIONS -- "
            "the single source of truth for role permission sets, replacing the "
            "old per-role create_<role>_role_if_not_exists commands. Pass "
            "--force to resync permissions/translations back to canonical even "
            "if a role already exists (this is the default behavior needed "
            "whenever ROLE_DEFINITIONS itself changes).")

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true',
                             help="Resync permissions/translations even if the role already exists.")

    def handle(self, *args, **options):
        force = options['force']
        roles = {}

        for slug, definition in ROLE_DEFINITIONS.items():
            group, _ = Group.objects.get_or_create(name=definition["group_name"])
            role, created = Role.objects.get_or_create(slug=slug, defaults={'group': group})
            roles[slug] = role

            if not (created or force):
                self.stdout.write(self.style.SUCCESS(f"Role '{slug}' already exists, skipping."))
                continue

            permissions = [
                Permission.objects.get(codename=codename, content_type__app_label=app_label)
                for app_label, codename in definition["permissions"]
            ]
            role.group.permissions.set(permissions)
            for lang, name in definition["translations"].items():
                role.translations.update_or_create(language_code=lang, defaults={'name': name})
            self.stdout.write(self.style.SUCCESS(f"Role '{slug}' seeded/resynced."))

        for slug, assignable_slugs in ASSIGNABLE.items():
            roles[slug].assignable.set([roles[s] for s in assignable_slugs])
            self.stdout.write(self.style.SUCCESS(f"Role '{slug}'.assignable = {assignable_slugs}"))
