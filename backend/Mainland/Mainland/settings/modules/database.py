import os

from redis.asyncio import StrictRedis
from redis import StrictRedis as Sync_StrictRedis

PROXYSQL_HOST = os.getenv("PROXYSQL_HOST", "proxysql")

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': os.getenv('DEFAULT_DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': PROXYSQL_HOST,
        'PORT': '6033',
        'OPTIONS': {
            'charset': 'utf8mb4'
        }
    }
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
REDIS_HOST = os.getenv("REDIS_HOST", "redis-proxy")

CACHE_REDIS_PORT = int(os.getenv("CACHE_REDIS_PORT", 6379))
SESSION_REDIS_PORT = int(os.getenv("SESSION_REDIS_PORT", 6380))

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{CACHE_REDIS_PORT}/0",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
    },
    "session_cache": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{SESSION_REDIS_PORT}/0",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
    },
}

SESSION_CACHE_ALIAS = "session_cache"
SESSION_ENGINE = "django.contrib.sessions.backends.cached_db"

# Raw redis clients for WebSocket presence tracking, used by
# common/utils/ws_consumer.py and common/mixins/v1/ws_consumer.py. Kept real
# and working here — the equivalent in lambumiz-plus's own settings is
# referenced by its common/ code but never actually defined anywhere.
REDIS = StrictRedis(host=REDIS_HOST, port=CACHE_REDIS_PORT, password=REDIS_PASSWORD, decode_responses=True)
SYNC_REDIS = Sync_StrictRedis(host=REDIS_HOST, port=CACHE_REDIS_PORT, password=REDIS_PASSWORD, decode_responses=True)

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{CACHE_REDIS_PORT}/0"],
        },
    },
}
