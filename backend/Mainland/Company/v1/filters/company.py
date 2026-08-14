import django_filters

from Company.models import Company


class CompanyFilterSet(django_filters.FilterSet):
    slug = django_filters.CharFilter(field_name='slug')

    class Meta:
        model = Company
        fields = []
