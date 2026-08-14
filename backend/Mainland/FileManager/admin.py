from django.contrib import admin
from parler.admin import TranslatableAdmin

from FileManager.models import CasFile, FileRole


@admin.register(CasFile)
class CasFileAdmin(admin.ModelAdmin):
    list_display = ('path', 'ref_count')
    search_fields = ('path',)


@admin.register(FileRole)
class FileRoleAdmin(TranslatableAdmin):
    list_display = ('name', 'slug', 'max_count')
    search_fields = ('translations__name', 'slug')
