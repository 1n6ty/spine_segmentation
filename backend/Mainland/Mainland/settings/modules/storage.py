import json, os
from pathlib import Path

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

DATA_UPLOAD_MAX_MEMORY_SIZE = API_MANIFEST["limits"]["data_upload_max_memory_size"]

LANGUAGE_CODE = API_MANIFEST["localization"]["default_language_code"]
USE_I18N = True
DATETIME_FORMAT = API_MANIFEST["localization"]["datetime_format"]
L10N = False
USE_TZ = True
TIME_ZONE = "UTC"

# MinIO (S3-compatible) object storage — see common/storages.py for the two
# storage classes, and docs/backend-architecture.md for how media-public vs.
# media-private are actually served (nginx proxy_pass / X-Accel-Redirect,
# never direct or presigned MinIO URLs).
AWS_ACCESS_KEY_ID = os.getenv("MINIO_USER")
AWS_SECRET_ACCESS_KEY = os.getenv("MINIO_PASSWORD")
AWS_S3_ENDPOINT_URL = f'http://{os.getenv("MINIO_PROXY_HOST", "minio-proxy")}:9000'

STORAGES = {
    # Default engine used for standard fields (public)
    "default": {
        "BACKEND": "common.storages.PublicMediaStorage",
    },
    # Secondary engine specifically for confidential files (private, e.g. DICOM)
    "private": {
        "BACKEND": "common.storages.PrivateMediaStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}
