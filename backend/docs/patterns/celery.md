# Celery Tasks

Tasks live in `<App>/tasks.py`, or `<App>/tasks/` once that outgrows one file (`Dicom/tasks/` is a
package: `segmentation.py` plus a `weights/` dir of `.onnx` model files). The Celery app discovers
them automatically via `autodiscover_tasks()` — no manual import needed.

```python
# Dicom/tasks/segmentation.py
from celery import shared_task

@shared_task(queue='db', ignore_result=True)
def segment_vertebraes(sop_instance_uid: str):
    ...
```

Triggered from `Dicom/utils/parse.py` after a DICOM upload finishes parsing
(`segment_vertebraes.delay(sop_uid)`); publishes progress to the `Dicom.segment.{uid}` Channels
group as it runs, which `Dicom/v1/views/dcmparse.py`'s `events` SSE action tails.

- Use `@shared_task` — it binds to the active app and works in both test and prod contexts
- Keep tasks thin — delegate wholesale to a management command when the task wraps an existing
  bulk/seed operation, otherwise write short logic directly in the task body rather than
  manufacturing a service-function indirection
- **Only route tasks to queues declared in `compose.dev.yml`** — the `api-celery` worker consumes
  `ws`,`db` only (`-Q ws,db`); a task with no explicit `queue=` on `@shared_task` defaults to
  Celery's own `"celery"` queue and would sit unconsumed forever, exactly what
  `Mainland/settings/modules/celery.py`'s `CELERY_TASK_ROUTES` exists to route around for
  `django_elasticsearch_dsl`'s own signal tasks.
- `CELERY_BEAT_SCHEDULE` is currently empty — no periodic/scheduled tasks exist yet.
- To list all registered tasks without a running worker, see discovery commands in `AGENTS.md`
