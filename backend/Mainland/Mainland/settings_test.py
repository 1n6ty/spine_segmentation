import os
from Mainland.settings import *

DEBUG = True

# Database settings

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'db.sqlite3'),
    }
}

# logging

LOGGING["root"]["level"] = "DEBUG"