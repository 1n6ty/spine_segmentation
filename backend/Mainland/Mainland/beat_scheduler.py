from django.db import close_old_connections
from django_celery_beat.schedulers import DatabaseScheduler


class CloseConnectionsScheduler(DatabaseScheduler):
    """DatabaseScheduler polls the schedule table on its own internal tick
    loop, independent of any Celery task or Django request. Closing before each tick
    forces a fresh connection instead of leaving that reap to chance."""

    def tick(self, *args, **kwargs):
        close_old_connections()
        return super().tick(*args, **kwargs)
