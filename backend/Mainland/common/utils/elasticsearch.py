from django_elasticsearch_dsl.registries import registry
from django_elasticsearch_dsl.signals import CelerySignalProcessor


class FilteredCelerySignalProcessor(CelerySignalProcessor):
    """
    Stock CelerySignalProcessor.handle_save/handle_delete dispatch a Celery
    task unconditionally for EVERY model save/delete in the whole project --
    unlike RealTimeSignalProcessor, they skip the "is this model actually
    registered with django-elasticsearch-dsl" check before dispatching (that
    check only happens later, inside the task, on the worker). That couples
    every write anywhere in the app -- including Django's own internal
    migration recorder -- to the Celery broker being reachable.

    This filters using the registry's cheap in-memory `model in registry`
    check before dispatching, so only models actually registered (or related
    to a registered Document) ever touch Celery at all.
    """

    def handle_save(self, sender, instance, **kwargs):
        if instance.__class__ in registry:
            super().handle_save(sender, instance, **kwargs)

    def handle_delete(self, sender, instance, **kwargs):
        if instance.__class__ in registry:
            super().handle_delete(sender, instance, **kwargs)
