# Management Commands

```python
# Profile/management/commands/create_doctor_role_if_not_exists.py
from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand
from Profile.models import Role

GROUP_NAME = 'Doctor'
ROLE_SLUG = 'doctor'
ROLE_NAMES = {'en-us': 'Doctor', 'ru': 'Врач'}

class Command(BaseCommand):
    help = ("Idempotently seeds the Doctor Group/Role, with every Permission in "
            "the system assigned to the group. Pass --force to resync the "
            "group's permissions and role translations back to canonical even "
            "if the role already exists.")

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
```

- Always use `get_or_create` / `update_or_create` — never unconditional `create`
- **Idempotent by default, `--force` to resync.** A command's default run (no flag) must be a true
  no-op if the row already exists — every write, not just translations, gated behind
  `if created or options['force']:`. `--force` overwrites the row's fields back to the
  command's canonical values, undoing manual DB drift.
- After writing a new seeder, add it to `Core/management/commands/init_spine_segmentation.py`'s
  `commands_to_run` list in dependency order. If the seeder owns a field that should be
  resynced on every bootstrap (e.g. a permission-group's `.permissions.set(...)`), add its name to
  `init_spine_segmentation.py`'s `_ALWAYS_RESYNC` set so `init_spine_segmentation` calls it with `force=True`; otherwise
  it's called with `force=False` (create-once). `init_spine_segmentation --force` overrides the whole table
  to full-resync.
- In tests, call seeders with `verbosity=0` to suppress output
- **Exceptions:** `Core/management/commands/seed_dev_data.py` is dev-only, already fully
  upsert/diff-based on every run, and has no `--force`.
