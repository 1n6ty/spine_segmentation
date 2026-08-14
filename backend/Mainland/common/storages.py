from storages.backends.s3boto3 import S3Boto3Storage

class PublicMediaStorage(S3Boto3Storage):
    bucket_name = 'media-public'
    querystring_auth = False  # Clean, permanent URLs
    secure_urls = True

class PrivateMediaStorage(S3Boto3Storage):
    bucket_name = 'media-private'
    querystring_auth = False  # Clean, permanent URLs
    secure_urls = True