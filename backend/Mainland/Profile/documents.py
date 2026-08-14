from django.contrib.auth.models import User
from django_elasticsearch_dsl import Document, fields
from django_elasticsearch_dsl.registries import registry

from .models import Profile


@registry.register_document
class UserDocument(Document):
    email = fields.TextField()
    first_name = fields.TextField()
    last_name = fields.TextField()
    patronymic = fields.TextField()

    class Index:
        name = 'users'

    class Django:
        model = User
        related_models = [Profile]

    def get_queryset(self):
        return super().get_queryset().select_related('profile')

    def prepare_patronymic(self, instance):
        profile = getattr(instance, 'profile', None)
        return profile.patronymic if profile else ''

    def get_instances_from_related(self, related_instance):
        if isinstance(related_instance, Profile):
            return related_instance.user
