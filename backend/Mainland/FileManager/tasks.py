from celery import shared_task
from django.core.management import call_command


@shared_task
def clean_orphaned_files():
    call_command('clean_orphaned_files', verbosity=0)
