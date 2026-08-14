from django.contrib import admin
from parler.admin import TranslatableAdmin

from .models import Company


@admin.register(Company)
class CompanyAdmin(TranslatableAdmin):
    list_display = ('name', 'slug', 'email', 'created_at')
    search_fields = ('translations__name', 'slug', 'email')
