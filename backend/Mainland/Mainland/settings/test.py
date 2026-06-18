import os
from .base import *

DEBUG = True

# Database settings — in-memory SQLite, no need for MySQL/ProxySQL in tests
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'db.sqlite3'),
    }
}

# Cache settings — no need for Redis/RedisProxy in tests
CACHES = {
    'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'},
}
SESSION_ENGINE = 'django.contrib.sessions.backends.db'

# logging

LOGGING["root"]["level"] = "DEBUG"
