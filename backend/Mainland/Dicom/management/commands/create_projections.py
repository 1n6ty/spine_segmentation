from django.core.management.base import BaseCommand

from Dicom.models import Projection

PROJECTIONS = [
    ('frontal', {'en-us': 'Frontal', 'ru': 'Фронтальная'}),
    ('sagittal', {'en-us': 'Sagittal', 'ru': 'Сагиттальная'}),
]


class Command(BaseCommand):
    help = ("Idempotently seeds Projection records. Pass --force to resync "
            "translations back to canonical even if the projection already exists.")

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true',
                             help="Resync translations even if the projection already exists.")

    def handle(self, *args, **options):
        force = options['force']
        for slug, names in PROJECTIONS:
            projection, created = Projection.objects.get_or_create(slug=slug)
            if created or force:
                for lang, name in names.items():
                    projection.translations.update_or_create(language_code=lang, defaults={'name': name})
