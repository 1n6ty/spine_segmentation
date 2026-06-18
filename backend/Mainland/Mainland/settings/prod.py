from .base import *

DEBUG = False

# Hardening not previously set anywhere in this project — meaningful now that
# Traefik actually terminates TLS in front of nginx.
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
