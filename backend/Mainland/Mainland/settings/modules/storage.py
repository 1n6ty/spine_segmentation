import json, os
from pathlib import Path

# Base directory relative to this file
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent

STATIC_ROOT = BASE_DIR / 'static'
MEDIA_ROOT = BASE_DIR / 'media'

# Load API manifest for dynamic storage and localization settings
manifest_path = STATIC_ROOT / 'api.manifest.json'
if manifest_path.exists():
    with open(manifest_path, 'r') as f:
        API_MANIFEST = json.load(f)
else:
    raise FileNotFoundError("api.manifest.json doesn't exist")

STATIC_URL = API_MANIFEST["storage"]["static_url"]
MEDIA_URL = API_MANIFEST["storage"]["media_url"]

FILEBROWSER_DIRECTORY = ''
DATA_UPLOAD_MAX_MEMORY_SIZE = API_MANIFEST["limits"]["data_upload_max_memory_size"]

LANGUAGE_CODE = API_MANIFEST["localization"]["default_language_code"]
TIME_ZONE = API_MANIFEST["localization"]["time_zone"]
USE_I18N = True
DATETIME_FORMAT = API_MANIFEST["localization"]["datetime_format"]
L10N = False
USE_TZ = True

AWS_ACCESS_KEY_ID = "spine_segmentation_user"
AWS_SECRET_ACCESS_KEY = os.getenv("MINIO_PASSWORD")
AWS_S3_ENDPOINT_URL = f'http://{os.getenv("MINIO_PROXY_HOST")}:9000'
AWS_QUERYSTRING_AUTH = False

AWS_S3_CUSTOM_DOMAIN = None

STORAGES = {
    # Default engine used for standard fields (Public)
    "default": {
        "BACKEND": "common.storages.PublicMediaStorage",
    },
    # Secondary engine specifically for confidential files (Private)
    "private": {
        "BACKEND": "common.storages.PrivateMediaStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}