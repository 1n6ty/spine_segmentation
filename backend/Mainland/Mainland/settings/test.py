from .base import *

DEBUG = False

PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_PROXY_SSL_HEADER = None

LOGGING = {
    'version': 1,
    'disable_existing_loggers': True,
    'handlers': {'null': {'class': 'logging.NullHandler'}},
    'root': {'handlers': ['null'], 'level': 'CRITICAL'},
}
