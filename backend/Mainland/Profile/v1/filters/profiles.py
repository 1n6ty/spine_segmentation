import django_filters
from django.contrib.auth.models import User

from common.utils.company import resolve_company_slug_filter
from Profile.v1.utils.search import search_users


class ProfileFilterSet(django_filters.FilterSet):
    company_slug = django_filters.CharFilter(method='filter_company')
    role_slug    = django_filters.CharFilter(method='filter_role')
    is_active    = django_filters.BooleanFilter(field_name='is_active')
    q            = django_filters.CharFilter(method='filter_q')

    class Meta:
        model = User
        fields = []

    def filter_company(self, queryset, name, value):
        company = resolve_company_slug_filter(
            self.request.user, value, any_company_perm='Profile.view_profile_any_company',
        )
        return queryset.filter(profile__company=company)

    def filter_role(self, queryset, name, value):
        slugs = [s.strip() for s in value.split(',') if s.strip()]
        return queryset.filter(profile__role__slug__in=slugs)

    def filter_q(self, queryset, name, value):
        return queryset.filter(pk__in=search_users(value))
