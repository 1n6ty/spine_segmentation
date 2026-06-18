import os

from storages.backends.s3boto3 import S3Boto3Storage

class PublicMediaStorage(S3Boto3Storage):
    """
    Backs Django's default storage. Served at /media/public/... via nginx's
    proxy_pass to minio-proxy (see backend/Nginx/nginx.conf) — never directly
    or via a presigned MinIO URL. custom_domain makes .url() agree with that
    route, in case anything (e.g. the Django admin) ever calls it.
    """
    bucket_name = 'media-public'
    querystring_auth = False
    custom_domain = None

class PrivateMediaStorage(S3Boto3Storage):
    """
    Backs DicomImage.dicom_file (PHI). Never served via .url() — the
    authenticated file view in Dicom/v1/views/file.py reads .name directly
    and serves it through nginx's internal-only X-Accel-Redirect location.
    """
    bucket_name = 'media-private'
