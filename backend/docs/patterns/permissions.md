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
        return [HasPermCodename('Profile.view_profile_any_company')]
    elif self.action == "destroy":
        return [HasPermCodename('Profile.delete_profile_any_company')]
    elif self.action == "partial_update":
        return [CanChangeProfilePermission()]
    return [AllowAny()]
```

**Company-scoped object checks** subclass `common/permissions/company.py`'s
`IsOwnCompanyPermission`, setting `any_company_perm` as a **class attribute** — not passed as a
constructor argument, and not a class-level `{action: perm}` dict on the base:

```python
# Company/permissions.py
from common.permissions.company import IsOwnCompanyPermission

class CompanyRetrievePermission(IsOwnCompanyPermission):
    """own company or Company.view_company_any_company."""
    any_company_perm = 'Company.view_company_any_company'
```

```python
# Company/v1/views/company.py
def get_permissions(self):
    if self.action == 'retrieve':
        return [IsAuthenticated(), CompanyRetrievePermission()]
    elif self.action == 'list':
        return [IsAuthenticated(), HasPermCodename('Company.view_company_any_company')]
    return [IsAuthenticated()]
```

`IsOwnCompanyPermission.has_object_permission` bypasses company scoping if the user holds the
given `any_company_perm`, otherwise requires `obj.pk == caller's company pk` (via
`common/utils/company.py`'s `get_user_company`). Must be invoked explicitly via
`check_object_permissions()` (see `views.md`) — adrf's dispatch doesn't call it automatically.
`common/permissions/base.py`'s `HasPermCodename(codename)` is the generic equivalent for a plain
view-level `has_perm()` gate with no company-scoping tier — takes the codename as a constructor
argument (unlike `IsOwnCompanyPermission`, since it has no per-subclass object-level check to vary).

- **Avoid `DjangoModelPermissions`** — prefer custom classes. It doesn't support instance-level or
  company-scoping checks.
- Object-level permissions must be called explicitly in async views (see `views.md`).
- **Every action needs an explicit, named permission decision** — see `schemas.md`'s "every
  endpoint gets its own named permission decision" rule. A bare
  `return [IsAuthenticated()]`/`[AllowAny()]` fallback should only be reached by actions that
  genuinely need nothing more specific.
