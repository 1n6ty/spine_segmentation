# ========================================================
# Stage 1: Base (Environment setup)
# ========================================================
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

ARG USER_ID
ARG GROUP_ID

WORKDIR /home/Mainland

# Supercronic runs CRONJOBS without needing an OS cron daemon/crontab binary
# (neither is installed in this image) — see compile-cron.py and the
# mainland-cron service in compose.yaml.
ARG SUPERCRONIC_VERSION=v0.2.33

# torch/torchvision/ultralytics (req.txt) ship no musllinux wheels, so this
# stage can't be Alpine — glibc is required. libgl1/libglib2.0-0/libsm6/
# libxext6/libxrender1 are runtime libs opencv-python-headless dynamically
# links against despite being "headless" (confirmed via the actual
# ImportError: libGL.so.1: cannot open shared object file).
RUN apt-get update && apt-get install -y --no-install-recommends \
        bash curl libmagic1 default-libmysqlclient-dev libmariadb-dev pkg-config \
        build-essential default-mysql-client redis-tools \
        libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL -o /usr/local/bin/supercronic \
        "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-amd64" \
    && chmod +x /usr/local/bin/supercronic \
    && groupadd -g ${GROUP_ID} Mainland && useradd -u ${USER_ID} -g Mainland -M -s /usr/sbin/nologin Mainland

# ========================================================
# Stage 2: Frontend Builder (Compile UI SpineSeg)
# ========================================================
FROM node:26-alpine AS frontend-builder

WORKDIR /build

COPY ./SpineSeg/package.json ./SpineSeg/package.json
RUN cd SpineSeg && npm install

COPY ./SpineSeg ./SpineSeg

RUN cd SpineSeg && npm run build

# ========================================================
# Stage 3: Builder (Install Python Dependencies)
# ========================================================
FROM base AS builder

COPY backend/Mainland/req.txt .
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV MYSQLCLIENT_CFLAGS="-I/usr/include/mariadb" \
    MYSQLCLIENT_LDFLAGS="-L/usr/lib/x86_64-linux-gnu -lmariadb"

RUN uv venv .venv && uv pip install --python .venv --no-cache -r req.txt

# ========================================================
# Stage 4: Production Target
# ========================================================
FROM builder AS production

COPY --chown=Mainland:Mainland ./backend/Mainland .

RUN mkdir -p static templates /var/log/django && chown -R Mainland:Mainland static templates /var/log/django

# Mainland/pages.py's index() calls render(req, 'index.html'), which resolves
# against TEMPLATES[0]['DIRS'] (templates/ directly) — not a subdirectory.
COPY --from=frontend-builder --chown=Mainland:Mainland /build/SpineSeg/dist/*.html /home/Mainland/templates/

USER Mainland

# ========================================================
# Stage 5: Development Target
# ========================================================
FROM builder AS development

COPY --chown=Mainland:Mainland ./backend/Mainland .
RUN uv pip install --python .venv --no-cache -r req.dev.txt

RUN mkdir -p static templates /var/log/django && chown -R Mainland:Mainland static templates /var/log/django

# Mainland/pages.py's index() calls render(req, 'index.html'), which resolves
# against TEMPLATES[0]['DIRS'] (templates/ directly) — not a subdirectory.
COPY --from=frontend-builder --chown=Mainland:Mainland /build/SpineSeg/dist/*.html /home/Mainland/templates/

USER Mainland