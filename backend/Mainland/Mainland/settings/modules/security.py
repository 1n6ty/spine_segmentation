import os, socket

hostname = socket.gethostname()
local_ip_address = socket.gethostbyname(hostname)

# Host settings

ALLOWED_HOSTS = list(filter(None, [
    "127.0.0.1",
    "localhost",
    "spine-segmentation-mainland",
    os.getenv("DOMAIN"),
    os.getenv("HOST_IP"),
    local_ip_address
]))

# CSRF settings

CSRF_TRUSTED_ORIGINS = list(filter(None, [
    f"https://{os.getenv('DOMAIN')}" if os.getenv("DOMAIN") else None,
    f"http://{os.getenv('DOMAIN')}" if os.getenv("DOMAIN") else None,
]))
CSRF_ADD = os.getenv("CSRF_TRUSTED_ORIGINS", None)
if CSRF_ADD:
    CSRF_TRUSTED_ORIGINS += list(filter(None, CSRF_ADD.split(',')))

# CORS settings — corsheaders' CorsMiddleware is already in MIDDLEWARE, but
# CORS_ALLOWED_ORIGINS was never actually defined anywhere; picked up here
# since the env var already exists (currently unused) in deployment configs.
CORS_ADD = os.getenv("CORS_ALLOWED_ORIGINS", None)
CORS_ALLOWED_ORIGINS = list(filter(None, CORS_ADD.split(','))) if CORS_ADD else []

# Session/cookie settings

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

SESSION_COOKIE_HTTPONLY = True

SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

SESSION_EXPIRE_AT_BROWSER_CLOSE = True

# Traefik terminates TLS, then forwards plain HTTP through nginx to Mainland —
# without this, Django has no way to know the original request was HTTPS
# (request.is_secure(), CSRF's Referer check, and HSTS all depend on it).
# nginx.conf already sends X-Forwarded-Proto; this was simply never read
# before introducing the Traefik hop.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True
