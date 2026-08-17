from django.core.management.base import BaseCommand

from Dicom.utils.constants import DICOM_XRAY_FRONTAL_ROLE_SLUG, DICOM_XRAY_SAGITTAL_ROLE_SLUG
from FileManager.models import FileRole

ROLES = [
    (DICOM_XRAY_FRONTAL_ROLE_SLUG, {'en-us': 'Frontal X-Ray', 'ru': 'Фронтальный рентген'}),
    (DICOM_XRAY_SAGITTAL_ROLE_SLUG, {'en-us': 'Sagittal X-Ray', 'ru': 'Сагиттальный рентген'}),
]
ALLOWED_EXTENSIONS = ['.dcm', '.dicom']


class Command(BaseCommand):
    help = ("Idempotently seeds the DICOM_XRAY_FRONTAL/DICOM_XRAY_SAGITTAL FileRoles, "
            "each capped at max_count=1 -- at most one file per role per Series "
            "(Dicom.DicomFile.Meta.constraints enforces this at the DB level). Scoped to "
            "Series, not Study: a Study is shared infra any number of UserRecentStudies "
            "sessions can reference, so capping there would collide independent sessions "
            "against each other; a Series is the actual one-acquisition granularity this "
            "cap is meant to protect (see Dicom.models.DicomFile's docstring). Pass "
            "--force to resync translations/max_count back to canonical even if the "
            "role already exists.")

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true',
                             help="Resync translations/max_count even if the role already exists.")

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
