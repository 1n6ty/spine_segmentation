from django.core.management.base import BaseCommand

from common.storages import PrivateMediaStorage
from FileManager.models import CasFile


class Command(BaseCommand):
    help = (
        "Deletes CasFile rows (and their physical objects) whose ref_count is 0 -- "
        "orphans the post_delete handler missed, e.g. from a crash or a rollback "
        "after the physical write but before the row's own transaction committed."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help="List orphaned files without deleting them.",
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        storage = PrivateMediaStorage()

        stale = CasFile.objects.filter(ref_count=0)
        deleted = 0
        for cas in stale:
            if dry_run:
                self.stdout.write(f"[dry-run] ref_count=0 orphan: {cas.path}")
            else:
                storage.delete(cas.path)
                cas.delete()
                self.stdout.write(f"deleted: {cas.path}")
            deleted += 1

        noun = "orphan(s) found (dry-run)" if dry_run else "orphan(s) deleted"
        self.stdout.write(self.style.SUCCESS(f"{deleted} {noun}."))
