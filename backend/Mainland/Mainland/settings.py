from pathlib import Path
import socket, os, uuid, json

# Build paths inside the project like this: BASE_DIR / 'subdir'.

BASE_DIR = Path(__file__).resolve().parent.parent

# Local machine

hostname = socket.gethostname()
local_ip_address = socket.gethostbyname(hostname)

# Secret-key

SECRET_KEY = os.getenv("SECRET_KEY", str(uuid.uuid4()))

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = False

# CSRF settings

CSRF_TRUSTED_ORIGINS = [
    f"https://{os.getenv("DOMAIN")}",
    f"http://{os.getenv("DOMAIN")}"
]
CSRF_ADD = os.getenv("CSRF_TRUSTED_ORIGINS", None)
if not (CSRF_ADD is None) and len(CSRF_ADD) > 0:
    CSRF_TRUSTED_ORIGINS += list(filter(None, CSRF_ADD.split(',')))

# Host settings

ALLOWED_HOSTS = [
    "127.0.0.1",
    "localhost",
    "spine-segmentation-mainland",
    os.getenv("DOMAIN"),
    os.getenv("HOST_IP"),
    local_ip_address
]

REDIS_HOST = os.getenv("REDIS_HOST")
MYSQL_HOST = os.getenv("MYSQL_HOST")

# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django_crontab',
    'django_cleanup.apps.CleanupConfig',
    'rest_framework',
    'drf_spectacular',
    'channels',
    'corsheaders',
    'Core',
    'Dicom',
    'DSL'
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'Mainland.urls'
APPEND_SLASH = True

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            BASE_DIR / 'templates'
        ],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

ASGI_APPLICATION = "Mainland.asgi.application"

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [(REDIS_HOST, 6379)],
        },
    },
}

# Database settings

from redis.asyncio import StrictRedis
REDIS = StrictRedis(host=REDIS_HOST, port=6379, decode_responses=True, db=int(os.getenv("REDIS_DB_INDEX")))

from redis import StrictRedis as Sync_StrictRedis
SYNC_REDIS = Sync_StrictRedis(host=REDIS_HOST, port=6379, decode_responses=True, db=int(os.getenv("REDIS_DB_INDEX")))

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql', 
        'NAME': os.getenv('MYSQL_DB_NAME'),
        'USER': os.getenv('MYSQL_DB_USER'),
        'PASSWORD': os.getenv('MYSQL_DB_PASSWORD'),
        'HOST': MYSQL_HOST,
        'PORT': '3306',
        'OPTIONS': {
            'charset': 'utf8mb4'
        }
    }
}

# Password validation

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Static files (CSS, JavaScript, Images)

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'static'

# Manifest

with open(STATIC_ROOT / 'api.manifest.json', 'r') as f:
    API_MANIFEST = json.load(f)

# Internationalization

LANGUAGE_CODE = API_MANIFEST["localization"]["default_language_code"]

TIME_ZONE = API_MANIFEST["localization"]["time_zone"]
USE_I18N = True
DATETIME_FORMAT = API_MANIFEST["localization"]["datetime_format"]
L10N = False
USE_TZ = True
TIME_ZONE = "UTC"

# Media files
MEDIA_URL = API_MANIFEST["storage"]["media_url"]
MEDIA_ROOT = BASE_DIR / 'media'

# DRF settings

SPECTACULAR_SETTINGS = {
    'TITLE': 'Spine Segmentation API',
    'DESCRIPTION': 'API endpoints of Spine Segmentation Project.',
    'VERSION': '1.0.0',
    'COMPONENT_SPLIT_REQUEST': True, 
    "SWAGGER_UI_SETTINGS": {
        "supportedSubmitMethods": ["get", "post", "put", "patch", "delete", "options"],
        "tryItOutEnabled": True,
    },
}

REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.CursorPagination",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "PAGE_SIZE": 10,
}

# logging

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {name} | {message}',
            'style': '{'
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose"
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
}

# Session settings

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

SESSION_COOKIE_HTTPONLY = True

SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

SESSION_EXPIRE_AT_BROWSER_CLOSE = True

# Crontab settings

CRONTAB_PYTHON_EXECUTABLE = '/home/Mainland/.venv/bin/python3'
CRONJOBS = [
    
]

# Celery-workers settings

CELERY_BROKER_URL = f"redis://{REDIS_HOST}:6379/{os.getenv('CELERY_REDIS_INDEX')}"
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'