# Permissions

Custom `BasePermission` subclasses live in `<App>/permissions.py` or `common/permissions/`.
Declare them per-action in `get_permissions()` — the concrete permission for each action is
spelled out at the call site, not hidden behind an action-keyed dict on the permission class
itself:

```python
# Profile/v1/views/profiles.py
def get_permissions(self):
    if self.action == "get_me":
        return [IsAuthenticated()]
    elif self.action == "list":
        return [HasPermCodename('Profile.view_profile')]
    elif self.action == "destroy":
        return [HasPermCodename('Profile.delete_profile'), ManagedCompanyPermission()]
    elif self.action == "partial_update":
        return [CanChangeProfilePermission()]
    return [AllowAny()]
```

## `managed_companies`-scoped company access

`common/permissions/company.py`'s `ManagedCompanyPermission` is **the sole company-scoping
mechanism** — there is no unscoped "any company" bypass tier anywhere in this system. It passes iff
the object's company is among the caller's `Profile.managed_companies`:

```python
class ManagedCompanyPermission(BasePermission):
    def __init__(self, is_company_row: bool = False):
        self.is_company_row = is_company_row

    def has_object_permission(self, request, view, obj):
        profile = getattr(request.user, 'profile', None)
        if profile is None:
            return False
        target_id = obj.pk if self.is_company_row else obj.company_id
        return profile.managed_companies.filter(pk=target_id).exists()
```

`is_company_row=True` checks the object itself (a `Company` row, e.g. `CompanyViewSet.retrieve`);
otherwise the object is assumed to carry a `company_id` FK (e.g. a `Profile`, `destroy` above).
Like every object-level check, it is **not** called automatically by adrf's async dispatch — call
it explicitly after fetching the object:

```python
profile = await Profile.objects.select_related('user').aget(user_id=user_id)
await sync_to_async(self.check_object_permissions)(request, profile)
```

For a `list()` action, the equivalent queryset-level scoping is `common/utils/company.py`'s
`scope_queryset_to_managed_companies(user, qs, company_field='company')` (filters to rows whose
company is in `managed_companies`; pass `company_field='pk'` when `qs` is itself a `Company`
queryset) and `resolve_managed_company_slug_filter(user, slug)` (resolves an explicit
`?company_slug=<slug>` filter param, raising `PermissionError` if it's outside the caller's scope
— checked before `Company.DoesNotExist` so a caller can't use it to probe which slugs exist).
`scope_queryset_to_managed_companies` caches the managed-company id list per profile
(`Profile.models`' `clear_managed_companies_cache` invalidates it on the M2M's `m2m_changed`
signal) — don't bypass it by re-querying `profile.managed_companies.all()` directly in a hot path.

`common/permissions/base.py`'s `HasPermCodename(codename)` is the generic `has_perm()` gate — fully
generic, not tied to any one app/model, used wherever a view needs a per-action permission-codename
check with no company-scoping or object-level component of its own.

## Roles are M2M — a profile can hold several at once

`Profile.roles` is a `ManyToManyField` to `Role` (each `Role` wraps a `Group` one-to-one, adding a
slug/translatable name). A profile is not restricted to exactly one role; app code checks
`request.user.has_perm(...)` or `profile.roles`, never a single `profile.role`. Which roles exist
and which permissions each carries is data, not code spread across the codebase —
`Profile/management/commands/sync_roles.py`'s `ROLE_DEFINITIONS` dict is the single source of
truth (role slug → group name, `[(app_label, codename), ...]`, translations). Read that file for
the current roles/permissions — don't duplicate the table here, it drifts.

Changing a profile's roles (`ProfilesViewSet.partial_update`) takes a full-replacement
`role_slugs: List[str]` — not an add/remove diff — since `Profile.roles` is M2M:

```python
new_roles = [r async for r in Role.objects.select_related('group').filter(slug__in=payload.role_slugs)]
...
profile.roles.set(new_roles)
user.groups.set([r.group for r in new_roles])
```

`user.groups` is always set to exactly the new roles' groups (not added to) — group membership
must mirror `Profile.roles` exactly, since Django's own permission resolution reads `user.groups`,
and this app never uses a Group for anything other than a Role's permission set.

## Coarse view gate + fine per-field check in the body

Editing a profile needs a check that depends on *which fields* changed — too specific for a single
`BasePermission` to express generically. The pattern is a coarse view-level gate ("does the caller
hold *any* permission that could let them touch *some* field of this kind") plus precise checks in
the view body once the payload and target are both known:

```python
# Profile/permissions.py -- coarse gate: self-edit always allowed, else any
# Profile.change_profile* permission
class CanChangeProfilePermission(BasePermission):
    SENSITIVE_PERMS = (
        'Profile.change_profile_role', 'Profile.change_profile_company', 'Profile.reset_profile_password',
    )
    def has_permission(self, request, view):
        ...
        return (
            request.user.has_perm('Profile.change_profile')
            or any(request.user.has_perm(perm) for perm in self.SENSITIVE_PERMS)
        )
```

`Profile/v1/views/profiles.py`'s `partial_update` is the fine half — four independently-gated field
groups, each checked only if that group's fields actually changed:

| Field(s) | Permission | Extra check |
|---|---|---|
| `first_name`/`last_name`/`patronymic`/`email` (on someone else) | `Profile.change_profile` (Django's own default `change_<model>`, reused — see the "no `_any_company`" note above) | — |
| `role_slugs` (full-replacement list, on anyone including self) | `Profile.change_profile_role` | every requested slug must be in the caller's own roles' combined `assignable` set (below) |
| `company_slug` (on anyone including self) | `Profile.change_profile_company` | the new company must be in the caller's own `managed_companies` |
| `password` (on someone else) | `Profile.reset_profile_password` | — |

Self-edit of any field needs no permission at all; resubmitting a profile's current
`role_slugs`/`company_slug` unchanged doesn't count as "changing" it either.

## Role-grant validation (`Role.assignable`)

`Role.assignable` is a self-referential M2M (`symmetrical=False`) — which roles a profile holding
this role may *grant* to another profile via `role_slugs`. It's data-driven, set by
`sync_roles.py`'s `ASSIGNABLE` dict (`{"admin": ["viewer", "doctor", "admin"]}` today — only
`admin` may grant roles at all; `doctor`/`viewer` have an empty `assignable` set and can never
change anyone's `role_slugs`, even though nothing else stops them from holding
`change_profile_role` in principle). The check in `partial_update`:

```python
def _assignable_slugs():
    actor_profile = getattr(request.user, 'profile', None)
    if actor_profile is None:
        return set()
    assignable_ids = set()
    for role in actor_profile.roles.all():
        assignable_ids.update(role.assignable.values_list('pk', flat=True))
    return set(Role.objects.filter(pk__in=assignable_ids).values_list('slug', flat=True))

disallowed = set(payload.role_slugs) - assignable_slugs
if disallowed:
    return ...403...
```

Because `assignable` only ever points at real `Role` rows, a nonexistent role slug can never be in
anyone's assignable set — it always trips this 403 before the later "role(s) do not exist" 400
check ever runs. Same shape for `company_slug`: a slug outside `managed_companies` 403s before the
"company does not exist" 400 check, for the same never-leak-existence reason as
`resolve_managed_company_slug_filter`.

## Rules

- **There is no `_any_company` permission tier.** Every codename in this system (`view_profile`,
  `delete_profile`, `Company.view_company`, etc.) is `managed_companies`-scoped by construction —
  don't reintroduce an unscoped bypass permission or a `HasPermCodename(...) | HasPermCodename(...)`
  dual-tier check. If a caller needs to see more than one company's data, that's expressed by
  adding more companies to their `Profile.managed_companies`, not by a broader permission.
- **Avoid `DjangoModelPermissions`** — prefer custom classes. It doesn't support instance-level or
  company-scoping checks.
- Object-level permissions must be called explicitly in async views (see `views.md`).
- **Every action needs an explicit, named permission decision** — see `schemas.md`'s "every
  endpoint gets its own named permission decision" rule. A bare
  `return [IsAuthenticated()]`/`[AllowAny()]` fallback should only be reached by actions that
  genuinely need nothing more specific.
