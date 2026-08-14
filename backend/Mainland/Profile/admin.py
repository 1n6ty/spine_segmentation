from django.contrib import admin
from parler.admin import TranslatableAdmin

from .models import Profile, Role


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'company', 'role')
    list_filter = ('company', 'role')
    search_fields = ('user__username', 'user__email', 'company__translations__name')
    autocomplete_fields = ('user', 'company', 'role')

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user', 'role')


@admin.register(Role)
class RoleAdmin(TranslatableAdmin):
    list_display = ('name', 'slug', 'group')
    search_fields = ('translations__name', 'slug')
