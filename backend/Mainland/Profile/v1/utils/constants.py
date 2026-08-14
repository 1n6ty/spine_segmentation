# Shared by ProfilesViewSet's own lookup_url_kwarg/lookup_value_regex (DRF's
# DefaultRouter builds the detail-route regex from these automatically, so
# there's no separate urls.py literal to sync against today -- but
# Profile/permissions.py's CanChangeProfilePermission reads view.lookup_url_kwarg
# dynamically, and any future explicit sub-resource re_path would need the
# same values, so this stays the single source of truth).
USER_ID_URL_KWARG = 'user_id'
USER_ID_URL_REGEX = r'[0-9]+'
