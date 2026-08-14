from django.core.management.base import BaseCommand

from FileManager.models import FileRole

ROLES = [
    ('DICOM_XRAY_FRONTAL', {'en-us': 'Frontal X-Ray', 'ru': 'Фронтальный рентген'}),
    ('DICOM_XRAY_SAGITTAL', {'en-us': 'Sagittal X-Ray', 'ru': 'Сагиттальный рентген'}),
]
ALLOWED_EXTENSIONS = ['.dcm', '.dicom']


class Command(BaseCommand):
    help = ("Idempotently seeds the DICOM_XRAY_FRONTAL/DICOM_XRAY_SAGITTAL FileRoles, "
            "each capped at max_count=1 -- at most one file per role per Study "
            "(Dicom.DicomFile.Meta.constraints enforces this at the DB level). Pass "
            "--force to resync translations/constraints back to canonical even if the "
            "role already exists.")

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true',
                             help="Resync translations/constraints even if the role already exists.")

    def handle(self, *args, **options):
        force = options['force']
        for slug, names in ROLES:
            role, created = FileRole.objects.get_or_create(
                slug=slug,
                defaults={'max_count': 1, 'allowed_extensions': ALLOWED_EXTENSIONS},
            )
            if created or force:
                role.max_count = 1
                role.allowed_extensions = ALLOWED_EXTENSIONS
                role.save()
                for lang, name in names.items():
                    role.translations.update_or_create(language_code=lang, defaults={'name': name})
                self.stdout.write(self.style.SUCCESS(f"FileRole '{slug}' seeded/resynced."))
            else:
                self.stdout.write(self.style.SUCCESS(f"FileRole '{slug}' already exists, skipping."))
