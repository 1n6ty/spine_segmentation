from django.contrib import admin
from parler.admin import TranslatableAdmin

from .models import Profile, Role


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'company', 'roles_display')
    list_filter = ('company', 'roles')
    search_fields = ('user__username', 'user__email', 'company__translations__name')
    autocomplete_fields = ('user', 'company')
    filter_horizontal = ('roles', 'managed_companies')

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user').prefetch_related('roles')

    def roles_display(self, obj):
        return ", ".join(role.slug for role in obj.roles.all())
    roles_display.short_description = "roles"


@admin.register(Role)
class RoleAdmin(TranslatableAdmin):
    list_display = ('name', 'slug', 'group')
    search_fields = ('translations__name', 'slug')
    filter_horizontal = ('assignable',)
