import os

PROXYSQL_HOST = os.getenv("PROXYSQL_HOST", "proxysql")

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'spine_segmentation_db',
        'USER': 'spine_segmentation_user',
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': PROXYSQL_HOST,
        'PORT': '6033',
        'CONN_MAX_AGE': int(os.getenv('DATABASE_CONN_MAX_AGE', 60)),
        'OPTIONS': {
            'charset': 'utf8mb4',
            'connect_timeout': 5,
            'autocommit': True,
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
        }
    }
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
REDIS_HOST     = os.getenv("REDIS_HOST", "redis-proxy")

CACHE_REDIS_PORT     = 6379
SESSION_REDIS_PORT   = 6380
CHANNELS_REDIS_PORT  = 6382
CACHE_REDIS_INDEX    = int(os.getenv("CACHE_REDIS_INDEX",    0))
SESSION_REDIS_INDEX  = int(os.getenv("SESSION_REDIS_INDEX",  0))
CHANNELS_REDIS_INDEX = int(os.getenv("CHANNELS_REDIS_INDEX", 0))

# health_check_interval: redis-proxy's HAProxy backend silently closes any
# connection idle for over `timeout tunnel` (1h, proxy-layer/redis-proxy/
# configs/haproxy.template.cfg) -- without this, a pooled connection that
# outlives that window looks fine to django-redis until the next request
# reuses it and gets `ConnectionError: ... Connection reset by peer`. This
# makes redis-py ping a pooled connection before reuse if it's been idle
# longer than the interval, transparently replacing dead ones instead.
REDIS_HEALTH_CHECK_INTERVAL = 30

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{CACHE_REDIS_PORT}/{CACHE_REDIS_INDEX}",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "CONNECTION_POOL_KWARGS": {
                "retry_on_timeout": True,
                "max_connections": 20,
                "health_check_interval": REDIS_HEALTH_CHECK_INTERVAL,
            },
        },
    },
    "session_cache": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{SESSION_REDIS_PORT}/{SESSION_REDIS_INDEX}",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "CONNECTION_POOL_KWARGS": {
                "retry_on_timeout": True,
                "max_connections": 20,
                "health_check_interval": REDIS_HEALTH_CHECK_INTERVAL,
            },
        },
    },
}

SESSION_CACHE_ALIAS = "session_cache"
SESSION_ENGINE = "django.contrib.sessions.backends.cached_db"

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [{
                "address": f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{CHANNELS_REDIS_PORT}/{CHANNELS_REDIS_INDEX}",
                "health_check_interval": REDIS_HEALTH_CHECK_INTERVAL,
            }],
        },
    },
}
