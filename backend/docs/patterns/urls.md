# URLs

```python
# Core/v1/urls.py -- one app, two ViewSets, both registered on the same bare prefix
from Core.v1.views.health import HealthViewSet
from Core.v1.views.auth import AuthViewSet

from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'', AuthViewSet, basename="Core-auth")
router.register(r'', HealthViewSet, basename="Core-health")

urlpatterns = router.urls
```

- **Name convention:** router `basename` becomes the `AppName-action` prefix DRF generates route
  names from — e.g. `basename="Core-auth"` gives `Core-auth-login`/`Core-auth-me`; `basename="Dicom"`
  (`Dicom/v1/urls.py`) gives `Dicom-parse`/`Dicom-file`/`Dicom-segment-events`.
- **A non-integer, non-slug detail-route PK needs its own `lookup_value_regex`** — DRF's router
  default (`[^/.]+`) excludes `.`, which silently breaks a dotted PK like a DICOM SOP Instance UID.
  See `Dicom/v1/views/dcmparse.py`'s `DcmViewSet.lookup_value_regex` and `docs/gotchas.md`.
- **Register a more specific route before a catch-all `''` registration**, and any literal
  `path()` entries before both — no app currently needs more than one router registration per
  `urls.py`, but if one ever does (e.g. a `types/` sub-resource alongside the main resource), the
  more specific prefix goes first, same reasoning as Django's normal URL-ordering rule.

**WS routes follow the same app-ownership + `v1/`-and-bare double-mount shape** — see
`websockets.md`'s "WS URL routing".
