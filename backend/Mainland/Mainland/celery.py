import os

from celery import Celery

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Mainland.settings')

app = Celery('Mainland')

app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()


from metrics_python.celery import setup_celery_metrics
from metrics_python.django.celery import setup_celery_database_metrics

setup_celery_metrics()
setup_celery_database_metrics()

from celery.signals import beat_init, worker_init
from metrics_python.prometheus import start_prometheus_background_server


@worker_init.connect
def _start_metrics_server_worker(**kwargs):
    start_prometheus_background_server(multiprocess=True)


@beat_init.connect
def _start_metrics_server_beat(**kwargs):
    start_prometheus_background_server(multiprocess=True)

from celery.signals import task_revoked
from prometheus_client import Counter

CELERY_TASK_REVOKED_TOTAL = Counter(
    "spine-segmentation_celery_task_revoked_total",
    "Number of tasks revoked, by task name and how they were revoked.",
    ["task", "terminated", "expired"],
)


@task_revoked.connect
def _track_task_revoked(sender=None, terminated=None, expired=None, **kwargs):
    CELERY_TASK_REVOKED_TOTAL.labels(
        task=getattr(sender, "name", "unknown"),
        terminated=str(bool(terminated)).lower(),
        expired=str(bool(expired)).lower(),
    ).inc()

import threading
import time

from prometheus_client import Gauge

CELERY_PROCESS_HEARTBEAT = Gauge(
    "spine-segmentation_celery_process_heartbeat_timestamp_seconds",
    "Unix timestamp of the last liveness tick from this worker/beat process.",
)

_HEARTBEAT_INTERVAL_SECONDS = 15

def _heartbeat_loop():
    while True:
        CELERY_PROCESS_HEARTBEAT.set_to_current_time()
        time.sleep(_HEARTBEAT_INTERVAL_SECONDS)


def _start_heartbeat_thread(**kwargs):
    threading.Thread(target=_heartbeat_loop, daemon=True).start()


worker_init.connect(_start_heartbeat_thread)
beat_init.connect(_start_heartbeat_thread)

from celery.signals import task_postrun, task_prerun
from django.db import close_old_connections

task_prerun.connect(close_old_connections)
task_postrun.connect(close_old_connections)