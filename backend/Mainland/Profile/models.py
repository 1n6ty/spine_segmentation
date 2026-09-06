from django.conf import settings
from django.contrib.auth.models import Group
from django.db import models
from django.db.models.signals import m2m_changed, post_save
from django.dispatch import receiver
from parler.models import TranslatableModel, TranslatedFields
from phonenumber_field.modelfields import PhoneNumberField

from common.utils.company import invalidate_managed_companies_cache


class Role(TranslatableModel):
    """A company-scoped role (admin, doctor, or viewer). Permissions live on
    `group` as usual -- this just adds a client-facing slug and an i18n
    display name on top, mirroring Company's TranslatedFields pattern."""
    translations = TranslatedFields(
        name=models.CharField(max_length=100)
    )
    slug = models.SlugField(unique=True, blank=False, null=False)
    group = models.OneToOneField(Group, on_delete=models.PROTECT, related_name='role', primary_key=True)
    assignable = models.ManyToManyField(
        'self', symmetrical=False, blank=True,
        help_text="Roles a profile holding this role may grant to another profile via "
                  "Profile.change_profile_role. Data-driven, set by "
                  "Profile.management.commands.sync_roles' ASSIGNABLE dict -- not derived "
                  "from anything else.",
    )

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
    roles = models.ManyToManyField(
        Role,
        blank=True,
        related_name='profiles',
    )
    managed_companies = models.ManyToManyField(
        'Company.Company',
        related_name='managed_by_profiles',
        blank=True,
        help_text="Companies this profile has role-scoped access to (e.g. for "
                  "Profile listing/management). Seeded to {company} once at "
                  "Profile creation (see seed_managed_companies below); freely "
                  "editable after that -- there is no ongoing re-pin invariant.",
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
            ("change_profile_role", "Can change which roles a profile holds"),
            ("change_profile_company", "Can change a profile's company"),
            ("reset_profile_password", "Can reset another profile's password"),
        ]
        # NOTE: "view"/"delete"/"change" access is Django's own auto-generated
        # default `Profile.view_profile` / `Profile.delete_profile` /
        # `Profile.change_profile` permissions (the add/change/delete/view_
        # <model> set) -- managed_companies-scoped via ManagedCompanyPermission/
        # scope_queryset_to_managed_companies, with no unscoped "any company"
        # tier. Declaring a custom permission reusing one of those bare
        # codenames raises auth.E005 (clashes with a builtin permission).
        # `change_profile` specifically gates editing another profile's basic
        # (non-role/company/password) fields -- see CanChangeProfilePermission.

    def __str__(self):
        return self.user.get_username()


@receiver(post_save, sender=Profile)
def assign_default_role(sender, instance, created, **kwargs):
    if not created or instance.roles.exists():
        return
    try:
        viewer_role = Role.objects.select_related('group').get(slug='viewer')
    except Role.DoesNotExist:
        return
    instance.roles.add(viewer_role)
    instance.user.groups.add(viewer_role.group)


@receiver(post_save, sender=Profile)
def seed_managed_companies(sender, instance, created, **kwargs):
    """One-time default at Profile creation: managed_companies = {company}, so
    a brand-new profile isn't scoped to nothing. Not an ongoing invariant --
    nothing re-pins this on later saves; it's freely edited after that."""
    if not created:
        return
    instance.managed_companies.set([instance.company_id])


@receiver(m2m_changed, sender=Profile.managed_companies.through)
def clear_managed_companies_cache(sender, instance, action, reverse, pk_set, **kwargs):
    """scope_queryset_to_managed_companies caches the managed-company id list
    per profile -- any edit to the relation (admin, API, or the seeding signal
    above) must drop that cache rather than leave it stale until TTL expiry.

    Forward edits (profile.managed_companies.*, the only direction this
    codebase's admin/API actually uses) give `instance` as the Profile itself.
    Reverse edits (company.managed_by_profiles.*) give `instance` as the
    Company and the affected profile ids in `pk_set` -- not available on
    post_clear, since Django doesn't report which rows a clear removed."""
    if action not in ('post_add', 'post_remove', 'post_clear'):
        return
    if not reverse:
        invalidate_managed_companies_cache(instance.pk)
    elif pk_set:
        for profile_id in pk_set:
            invalidate_managed_companies_cache(profile_id)
