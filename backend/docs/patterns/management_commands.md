# Management Commands

```python
# Core/management/commands/create_segmentation_statuses.py-style single-entity seeder
from django.core.management.base import BaseCommand
from Dicom.models import SegmentationStatus

SLUG = 'done'
NAMES = {'en-us': 'Done', 'ru': 'Готово'}

class Command(BaseCommand):
    help = ("Idempotently seeds the 'done' SegmentationStatus. Pass --force to "
            "resync translations back to canonical even if the row already exists.")

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true',
                             help="Resync translations even if the row already exists.")

    def handle(self, *args, **options):
        force = options['force']
        status, created = SegmentationStatus.objects.get_or_create(slug=SLUG)
        if created or force:
            for lang, name in NAMES.items():
                status.translations.update_or_create(language_code=lang, defaults={'name': name})
```

**Naming pattern:** `create_<entity>_if_not_exists.py`, one command per row. **Exception:**
`Profile/management/commands/sync_roles.py` seeds all of Doctor/Admin/Viewer from one
`ROLE_DEFINITIONS` dict in a single command — the three roles' permission sets are cross-referenced
and reviewed together often enough (see `docs/patterns/permissions.md`) that one file per role
would just fragment that review, unlike genuinely independent rows like segmentation statuses or
projections.

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
