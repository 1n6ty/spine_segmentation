# Translations (django-parler)

Models using `TranslatableModel` (`Company.Company`, `Profile.Role`, `Dicom.Projection`,
`Dicom.SegmentationStatus`) store translated fields in a separate table.

**Always `prefetch_related('translations')` before calling `safe_translation_getter()`.** Without
the prefetch, parler issues a synchronous DB query → `SynchronousOnlyOperation` in async views.

```python
qs = User.objects.select_related('profile', 'profile__company', 'profile__role').prefetch_related(
    'profile__company__translations',
    'profile__role__translations',
).order_by('email')

async for user in qs:
    name = user.profile.role.safe_translation_getter('name', any_language=True)
```

(Real example, `Profile/v1/views/profiles.py`'s `ProfilesViewSet.list`.)

**In management commands** — save a translation only on `created=True` (or `--force`) to avoid
overwriting manually set names:

```python
group, _ = Group.objects.get_or_create(name='Doctor')
role, created = Role.objects.get_or_create(slug='doctor', defaults={'group': group})
if created or force:  # force: from the command's own --force arg, see management_commands.md
    for lang, name in {'en-us': 'Doctor', 'ru': 'Врач'}.items():
        role.translations.update_or_create(language_code=lang, defaults={'name': name})
```

**In tests** — never `set_current_language()` + `save()` inside `setUp`/`setUpClass` (parler cache
goes stale across savepoints under 3+ colliding fixture callers — see `docs/gotchas.md`). Always:

```python
instance.translations.update_or_create(language_code='en-us', defaults={'name': 'Preview'})
```
