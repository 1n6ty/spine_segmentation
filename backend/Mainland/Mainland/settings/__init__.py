import os

# Detect environment from DJANGO_ENV variable, default to 'prod'
env = os.getenv('DJANGO_ENV', 'prod')

if env == 'prod':
    from .prod import *
elif env == 'test':
    from .test import *
else:
    from .dev import *
