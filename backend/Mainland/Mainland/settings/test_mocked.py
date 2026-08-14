from .test import *

DATABASES = {
    'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'},
    'logs':    {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'},
}

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://fake-mocked-redis/0',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'CONNECTION_FACTORY': 'common.testing.redis.FakeConnectionFactory',
        },
    },
    'session_cache': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://fake-mocked-redis/1',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'CONNECTION_FACTORY': 'common.testing.redis.FakeConnectionFactory',
        },
    },
}

# Safe now that CACHES["session_cache"] has a working (if fake) backend.
SESSION_CACHE_ALIAS = 'session_cache'
SESSION_ENGINE = 'django.contrib.sessions.backends.cached_db'

# Unrelated to the CACHES/get_redis_connection fix above -- Channels
# group_send/group_add just need an in-process layer for tests.
CHANNEL_LAYERS = {
    'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'},
}

ELASTICSEARCH_DSL_SIGNAL_PROCESSOR = 'django_elasticsearch_dsl.signals.BaseSignalProcessor'

MOCK_EXTERNAL_SERVICES = True
