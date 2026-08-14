from django.conf import settings
from django.core.files.storage import storages
from django.db import models, transaction
from django.db.models import F
from django.db.models.signals import post_delete, post_save

from parler.models import TranslatableModel, TranslatedFields

from common.storages import PrivateMediaStorage


class FileRole(TranslatableModel):
    slug = models.SlugField(unique=True, blank=False, null=False)
    translations = TranslatedFields(
        name=models.CharField(max_length=100, blank=False, null=False)
    )
    allowed_content_types = models.JSONField(
        default=list, blank=True,
        help_text='MIME types allowed for this role, e.g. ["image/jpeg"]. Empty = allow all.'
    )
    allowed_extensions = models.JSONField(
        default=list, blank=True,
        help_text='File extensions allowed for this role, e.g. [".jpg"]. Empty = allow all.'
    )
    max_count = models.PositiveIntegerField(
        null=True, blank=True, default=None,
        help_text='Max files with this role per entity (order/product). Null = unlimited.',
    )

    class Meta:
        ordering = ['slug']
        verbose_name = "File Role"
        verbose_name_plural = "File Roles"

    def __str__(self):
        return self.slug


class CasFile(models.Model):
    """Tracks every unique physical file in CAS storage and how many records reference it."""
    path = models.CharField(
        # build_cas_path() (FileManager/utils.py) always returns "files/" + a SHA-512
        # hexdigest -- a fixed 6 + 128 = 134-char ASCII string, never anything else.
        # 150 leaves headroom while keeping this comfortably under MySQL's unique-index
        # byte limit (150 * 4 bytes/char under utf8mb4 = 600 bytes, under even the old,
        # universal 767-byte cap) regardless of MySQL version/row-format config.
        max_length=150, unique=True, db_index=True, verbose_name="CAS Path"
    )
    ref_count = models.PositiveIntegerField(default=0, verbose_name="Reference Count")

    class Meta:
        verbose_name = "CAS File"
        verbose_name_plural = "CAS Files"

    def __str__(self):
        return f"{self.path} (×{self.ref_count})"


# ─── Signal handlers ──────────────────────────────────────────────────────────

def _cas_post_save(sender, instance, created, using, **kwargs):
    """On creation: get-or-create CasFile for this path and increment ref_count atomically."""
    if not created:
        return
    path = instance.file.name
    if not path:
        return
    cas, _ = CasFile.objects.get_or_create(path=path, defaults={'ref_count': 0})
    CasFile.objects.filter(pk=cas.pk).update(ref_count=F('ref_count') + 1)
    if instance.cas_file_id != cas.pk:
        # Back-fill the FK without re-triggering post_save.
        sender._default_manager.filter(pk=instance.pk).update(cas_file=cas)
        instance.cas_file_id = cas.pk
        instance.cas_file = cas


def _cas_post_delete(sender, instance, using, **kwargs):
    """After commit: decrement ref_count; when it hits 0 delete the physical file."""
    cas_id = instance.cas_file_id
    if cas_id is None:
        # Record predates ref-counting (cas_file_id NULL); leave the file alone.
        return

    def _handle():
        updated = CasFile.objects.filter(
            pk=cas_id, ref_count__gt=0
        ).update(ref_count=F('ref_count') - 1)
        if not updated:
            # Already at 0 or another concurrent handler ran first.
            return
        try:
            cas = CasFile.objects.get(pk=cas_id)
        except CasFile.DoesNotExist:
            return
        if cas.ref_count <= 0:
            PrivateMediaStorage().delete(cas.path)
            cas.delete()

    transaction.on_commit(_handle, using=using)


# ─── Abstract mixin ───────────────────────────────────────────────────────────

class CasFileMixin(models.Model):
    """Abstract base for all CAS-backed file records.

    Extracts all common fields. Each concrete subclass adds only:
    - Its parent FK (product / approved_version / order)
    - Meta (unique_together, verbose names)
    - __str__

    __init_subclass__ fires at class-definition time (before ModelBase sets up
    _meta). It:
      1. Applies the django-cleanup ignore attribute manually, since
         cleanup_ignore(cls) requires _meta which isn't available yet.
         The mangled name is computed from cls.__name__ and cls.__module__,
         matching exactly what django-cleanup's cache.get_mangled_ignore() builds.
      2. Connects post_save / post_delete signals for ref_count maintenance.

    Each concrete class should ALSO be decorated with @cleanup_ignore as
    belt-and-suspenders (fires after _meta is set, uses the official API).
    """
    cas_file = models.ForeignKey(
        CasFile,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='+',
        verbose_name="CAS File record",
    )
    file = models.FileField(
        upload_to='', storage=storages["private"], max_length=500, verbose_name="File"
    )
    name = models.CharField(max_length=255, verbose_name="Name")
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Creator",
        # related_name='+' disables the reverse accessor. Django requires unique
        # related_names across all concrete subclasses of the same abstract parent.
        # The three concrete models have inconsistent names; no code uses reverse
        # access on this FK anyway.
        related_name='+',
    )
    content_type = models.CharField(max_length=100, default='application/octet-stream')
    size = models.PositiveIntegerField(verbose_name="Size in bytes")
    hash = models.CharField(max_length=128, verbose_name="Hash (SHA-512)", db_index=True)
    role = models.ForeignKey(
        'FileManager.FileRole',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Role",
        related_name='+',  # same reason as creator
    )
    local_path = models.CharField(
        verbose_name="Local Path", max_length=256, null=False, blank=False, default='/'
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        # cls._meta is NOT available here — ModelBase attaches it AFTER
        # type.__new__ returns, and __init_subclass__ fires inside type.__new__.
        # Compute the mangled attribute name the same way django-cleanup does:
        #   f'_{opt.model_name}__{opt.app_label}_cleanup_ignore'
        # opt.model_name == cls.__name__.lower()
        # opt.app_label  == cls.__module__.split('.')[0]  (the top-level package)
        model_name = cls.__name__.lower()
        app_label = cls.__module__.split('.')[0]
        setattr(cls, f'_{model_name}__{app_label}_cleanup_ignore', None)

        post_save.connect(
            _cas_post_save, sender=cls,
            dispatch_uid=f'cas_post_save_{cls.__qualname__}',
        )
        post_delete.connect(
            _cas_post_delete, sender=cls,
            dispatch_uid=f'cas_post_delete_{cls.__qualname__}',
        )
