from pathlib import Path
import os, uuid, socket
from .modules.auth import *
from .modules.database import *
from .modules.storage import *
from .modules.security import *
from .modules.logging import *
from .modules.celery import *
from .modules.search import *

hostname = socket.gethostname()
local_ip_address = socket.gethostbyname(hostname)

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Secret key should be provided via environment variable in production
SECRET_KEY = os.getenv('SECRET_KEY', uuid.uuid4().hex)

# Default DEBUG is False for safety; overridden in dev.py
DEBUG = False

APPEND_SLASH = True

SILENCED_SYSTEM_CHECKS = ["models.W036"]

# Application definition
INSTALLED_APPS = [
    'django_celery_beat',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'drf_spectacular_websocket',
    'drf_spectacular',
    'drf_spectacular_sidecar',
    'channels',
    'rest_framework',
    'corsheaders',
    'django_filters',
    'django_elasticsearch_dsl',
    'parler',
    'django_cleanup.apps.CleanupConfig',
    'phonenumber_field',

    'Core',
    'Dicom',
    'Company',
    'Profile',
    'FileManager',
]

LANGUAGES = (
    ('en-us', 'English'),
    ('ru', 'Русский'),
)

PARLER_DEFAULT_LANGUAGE_CODE = 'en-us'
PARLER_LANGUAGES = {
    None: (
        {'code': 'en-us'},
        {'code': 'ru'},
    ),
    'default': {
        'fallbacks': ['en-us', 'ru'],
        'hide_untranslated': False,
    },
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'Spine-Segmentation API',
    'DESCRIPTION': 'API/Websocket endpoints of Spine-Segmentation.',
    'VERSION': '1.0.0',
    'COMPONENT_SPLIT_REQUEST': True,
    'SERVE_INCLUDE_SCHEMA': False,
    'OAS_VERSION': '3.1.0',

    'DEFAULT_GENERATOR_CLASS': 'drf_spectacular_websocket.schemas.WsSchemaGenerator',
    
    'SWAGGER_UI_DIST': 'SIDECAR',
    'SWAGGER_UI_SETTINGS': {
        'deepLinking': True,
        'persistAuthorization': True,
        'displayOperationId': False,
        "supportedSubmitMethods": ["get", "post", "put", "patch", "delete", "options"],
        "tryItOutEnabled": True,
        'connectSocket': True,
    },
    'SERVE_PERMISSIONS': ['rest_framework.permissions.IsAdminUser'],
    'POSTPROCESSING_HOOKS': [
        'drf_spectacular.hooks.postprocess_schema_enums',
        'common.schemas.openapi_hooks.postprocess_schema_nullable',
    ],
}


MIDDLEWARE = [
    'metrics_python.django.middleware.QueryCountMiddleware',
    'metrics_python.django.middleware.MetricsMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]


from metrics_python.django.cache import patch_caching
from metrics_python.django.signals import patch_signals
from metrics_python.generics.info import expose_application_info

patch_caching()
patch_signals()
expose_application_info(version=os.getenv("SPINE_SEGMENTATION_IMAGE_TAG", "unknown"))

ROOT_URLCONF = 'Mainland.urls'

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
                'django.template.context_processors.i18n',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

ASGI_APPLICATION = "Mainland.asgi.application"

REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.CursorPagination",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework.authentication.BasicAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "PAGE_SIZE": 10,
}
