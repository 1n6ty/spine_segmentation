import os
from celery.schedules import crontab

REDIS_PASSWORD     = os.getenv("REDIS_PASSWORD")
REDIS_HOST         = os.getenv("REDIS_HOST", "redis-proxy")
CELERY_REDIS_PORT  = 6381
CELERY_REDIS_INDEX = int(os.getenv("CELERY_REDIS_INDEX", 0))

CELERY_BROKER_URL      = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{CELERY_REDIS_PORT}/{CELERY_REDIS_INDEX}"
CELERY_ACCEPT_CONTENT  = ['json']
CELERY_TASK_SERIALIZER = 'json'

# See the REDIS_HEALTH_CHECK_INTERVAL comment in modules/database.py -- same
# redis-proxy idle-timeout issue applies to the broker connection.
CELERY_BROKER_TRANSPORT_OPTIONS = {
    'health_check_interval': 30,
}

# django-elasticsearch-dsl's CelerySignalProcessor tasks have no routing rule of
# their own and default to Celery's "celery" queue -- the api-celery worker only
# consumes "ws"/"db", so without this they'd queue forever and never run,
# silently letting the search index drift out of sync with the database.
CELERY_TASK_ROUTES = {
    'django_elasticsearch_dsl.signals.registry_update_task': {'queue': 'db'},
    'django_elasticsearch_dsl.signals.registry_update_related_task': {'queue': 'db'},
    'django_elasticsearch_dsl.signals.registry_delete_task': {'queue': 'db'}
}

CELERY_WORKER_CANCEL_LONG_RUNNING_TASKS_ON_CONNECTION_LOSS = True

CELERY_BEAT_SCHEDULE = {
    'clean-orphaned-files': {
        'task': 'FileManager.tasks.clean_orphaned_files',
        'schedule': crontab(hour=0, minute=0, day_of_week=0),
        'options': {'queue': 'db'},
    },
}
