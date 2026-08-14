# ========================================================
# Stage 1: Runtime base — only packages the running container needs
# ========================================================
# Debian slim, not Alpine: PyTorch (needed transitively via sahi/ultralytics
# for the segmentation model) publishes no musllinux wheels at all, so it
# cannot be installed on Alpine's musl libc under any version pin.
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

ARG USER_ID=1000
ARG GROUP_ID=1000

WORKDIR /home/Mainland

# libglib2.0-0/libsm6/libxext6/libxrender1/libgl1/libxcb1: opencv-python-headless
# still links against these at the ELF level despite being the "headless"
# variant -- Debian slim's minimal base doesn't ship them, so cv2 fails to
# import (ImportError: libxcb.so.1) without them, and Dicom/tasks/segmentation.py's
# module-level `import cv2` chain gets pulled in by Django's own URL/system
# checks on every management command, not just at actual runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
        bash curl default-mysql-client libmariadb3 \
        libglib2.0-0 libsm6 libxext6 libxrender1 libgl1 libxcb1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g ${GROUP_ID} Mainland \
    && useradd -M -s /usr/sbin/nologin -u ${USER_ID} -g Mainland Mainland \
    # WORKDIR (above) creates /home/Mainland as root, before this user exists --
    # COPY --chown in later stages only chowns what it copies IN, not this
    # pre-existing directory itself, so without this the Mainland user can't
    # create new files directly in the workdir root (e.g. coverage's .coverage
    # SQLite file), only inside the specific chowned subdirectories.
    && chown Mainland:Mainland /home/Mainland

# ========================================================
# Stage 2: Frontend Builder (Compile UI Panel)
# ========================================================
FROM node:24-alpine AS frontend-builder

WORKDIR /build/frontend

COPY ./frontend/package.json ./frontend/package-lock.json ./
RUN npm ci

COPY ./frontend .

RUN npm run build

# ========================================================
# Stage 3: Builder (Install Python Dependencies)
# Build tools are installed here and never reach the runtime stages.
# ========================================================
FROM base AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/

# libmariadb-dev ships mariadb_config, which mysqlclient's setup.py
# auto-detects -- no manual MYSQLCLIENT_CFLAGS/LDFLAGS needed (and hardcoding
# them would be wrong here anyway: Debian installs to a multiarch lib path,
# not Alpine's flat /usr/lib).
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libmariadb-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

# req.nn.txt's --index-url points torch/torchvision at the CPU-only wheel
# index (see req.nn.txt's header comment), but uv's default index-strategy
# (first-index) doesn't reliably prefer it -- unsafe-best-match is required
# for that pin to actually win over PyPI's default CUDA-enabled build.
ENV UV_INDEX_STRATEGY=unsafe-best-match

COPY backend/Mainland/req.static.txt backend/Mainland/req.nn.txt .
RUN uv venv .venv && uv pip install --python .venv --no-cache -r req.static.txt -r req.nn.txt

# ========================================================
# Stage 4: Production Target
# FROM base: compiler toolchain from builder never reaches this image.
# ========================================================
FROM base AS production

COPY --from=builder /home/Mainland/.venv .venv

COPY --chown=Mainland:Mainland ./backend/Mainland .

RUN mkdir -p static templates/frontend /var/log/django \
    && chown -R Mainland:Mainland static templates /var/log/django

# Mainland/pages.py's index() calls render(req, 'frontend/index.html'), which
# resolves against TEMPLATES[0]['DIRS'] (templates/) -- the directory here
# must match that literal.
COPY --from=frontend-builder --chown=Mainland:Mainland /build/frontend/dist/*.html /home/Mainland/templates/frontend/

USER Mainland

# ========================================================
# Stage 5: Development Target
# req.dev.txt is installed before source copy so that source
# changes don't bust the dev-deps cache layer.
# ========================================================
FROM builder AS development

COPY backend/Mainland/req.dev.txt .
RUN uv pip install --python .venv --no-cache -r req.dev.txt

COPY --chown=Mainland:Mainland ./backend/Mainland .

RUN mkdir -p static templates/frontend /var/log/django \
    && chown -R Mainland:Mainland static templates /var/log/django

# Mainland/pages.py's index() calls render(req, 'frontend/index.html'), which
# resolves against TEMPLATES[0]['DIRS'] (templates/) -- the directory here
# must match that literal.
COPY --from=frontend-builder --chown=Mainland:Mainland /build/frontend/dist/*.html /home/Mainland/templates/frontend/

USER Mainland
