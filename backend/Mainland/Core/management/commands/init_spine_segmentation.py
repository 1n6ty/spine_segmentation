from django.core.management import call_command
from django.core.management.base import BaseCommand

# Names always resynced on every bootstrap run, regardless of the CLI --force
# flag -- sync_roles' group.permissions.set(...) must keep tracking
# ROLE_DEFINITIONS as it evolves, so it resyncs unconditionally. Statuses/types
# are create-once by design.
_ALWAYS_RESYNC = {'sync_roles'}

commands_to_run = [
    'create_superuser_if_not_exists',
    'sync_roles',
    'create_segmentation_statuses',
    'create_projections',
    'create_xray_file_roles_if_not_exists',
]


class Command(BaseCommand):
    help = ("Idempotently bootstraps spine-segmentation: runs every seeder in "
            "commands_to_run, in dependency order. Pass --force to resync every "
            "seeder's fields back to canonical, undoing manual DB drift.")

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true',
                             help="Resync every seeder's fields even if the rows already exist.")

    def handle(self, *args, **options):
        full_force = options['force']

        for cmd_name in commands_to_run:
            force = full_force or cmd_name in _ALWAYS_RESYNC
            self.stdout.write(self.style.MIGRATE_HEADING(f"Running {cmd_name}..."))
            call_command(cmd_name, force=force, stdout=self.stdout, stderr=self.stderr)

        self.stdout.write(self.style.SUCCESS("spine-segmentation bootstrap complete."))
