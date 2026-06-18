from pathlib import Path
import os, uuid

from .modules.auth import *
from .modules.database import *
from .modules.storage import *
from .modules.security import *
from .modules.logging import *
from .modules.celery import *
from .modules.cron import *

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Secret key should be provided via environment variable in production
SECRET_KEY = os.getenv("SECRET_KEY", uuid.uuid4().hex)

# Default DEBUG is False for safety; overridden in dev.py
DEBUG = False

APPEND_SLASH = True

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
