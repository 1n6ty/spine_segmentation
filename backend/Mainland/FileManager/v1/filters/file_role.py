import django_filters

from FileManager.models import FileRole


class FileRoleFilterSet(django_filters.FilterSet):
    slug = django_filters.CharFilter(field_name='slug')

    class Meta:
        model = FileRole
        fields = []
