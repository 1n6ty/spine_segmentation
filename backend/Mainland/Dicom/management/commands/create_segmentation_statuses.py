from django.core.management.base import BaseCommand

from Dicom.models import SegmentationStatus

STATUSES = [
    ('pending', {'en-us': 'Pending', 'ru': 'Ожидает'}),
    ('processing', {'en-us': 'Processing', 'ru': 'Обработка'}),
    ('saving', {'en-us': 'Saving', 'ru': 'Сохранение'}),
    ('done', {'en-us': 'Done', 'ru': 'Готово'}),
    ('error', {'en-us': 'Error', 'ru': 'Ошибка'}),
]


class Command(BaseCommand):
    help = ("Idempotently seeds SegmentationStatus records. Pass --force to resync "
            "translations back to canonical even if the status already exists.")

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true',
                             help="Resync translations even if the status already exists.")

    def handle(self, *args, **options):
        force = options['force']
        for slug, names in STATUSES:
            status, created = SegmentationStatus.objects.get_or_create(slug=slug)
            if created or force:
                for lang, name in names.items():
                    status.translations.update_or_create(language_code=lang, defaults={'name': name})
