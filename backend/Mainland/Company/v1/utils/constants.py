# Shared by Company/v1/urls.py's route patterns and the ViewSets' own
# lookup_url_kwarg/lookup_value_regex -- single source of truth so the two
# can't drift apart.
COMPANY_ID_URL_KWARG = 'company_id'
COMPANY_ID_URL_REGEX = r'[0-9]+'
