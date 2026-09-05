from django.conf import settings
from django.contrib.auth.models import Group
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from parler.models import TranslatableModel, TranslatedFields
from phonenumber_field.modelfields import PhoneNumberField


class Role(TranslatableModel):
    """A company-scoped role (admin, doctor, or viewer). Permissions live on
    `group` as usual -- this just adds a client-facing slug and an i18n
    display name on top, mirroring Company's TranslatedFields pattern."""
    translations = TranslatedFields(
        name=models.CharField(max_length=100)
    )
    slug = models.SlugField(unique=True, blank=False, null=False)
    group = models.OneToOneField(Group, on_delete=models.PROTECT, related_name='role', primary_key=True)

    class Meta:
        verbose_name = "Role"
        verbose_name_plural = "Roles"

    def __str__(self):
        return self.safe_translation_getter('name', any_language=True) or self.slug


class Profile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
        primary_key=True
    )
    company = models.ForeignKey(
        'Company.Company',
        on_delete=models.PROTECT,
        related_name='profiles',
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='profiles',
    )
    patronymic = models.CharField(max_length=150, blank=True, default='')
    phone = PhoneNumberField(
        verbose_name="Phone Number",
        blank=True,
        null=True
    )

    class Meta:
        verbose_name = "Profile"
        verbose_name_plural = "Profiles"
        permissions = [
            ("view_profile_any_company", "Can view profiles/users across all companies"),
            ("delete_profile_any_company", "Can remove/deactivate profiles/users across all companies"),
            ("change_sensitive_profile_data", "Can change role, company, and identity fields on any profile"),
        ]

    def __str__(self):
        return self.user.get_username()


@receiver(post_save, sender=Profile)
def assign_default_role(sender, instance, created, **kwargs):
    if not created or instance.role_id is not None:
        return
    try:
        viewer_role = Role.objects.select_related('group').get(slug='viewer')
    except Role.DoesNotExist:
        return
    instance.role = viewer_role
    instance.save(update_fields=['role'])
    instance.user.groups.add(viewer_role.group)
