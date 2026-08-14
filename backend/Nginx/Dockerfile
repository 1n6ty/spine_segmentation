# ========================================================
# Stage 1: Compile Frontend Assets
# ========================================================
FROM node:24-alpine AS frontend-builder

WORKDIR /build/frontend

COPY ./frontend/package.json ./frontend/package-lock.json ./
RUN npm ci

COPY ./frontend .

RUN npm run build

# ========================================================
# Stage 2: Collect Django Static Files
# ========================================================
# collectstatic loads the full Django app registry (including Dicom's
# task-import chain, which pulls in sahi/scipy/opencv at module level) but
# never touches an actual model -- AutoDetectionModel/YOLO are only imported
# lazily inside Dicom.tasks.segmentation._get_model(). req.static.txt is
# exactly what this stage needs; req.nn.txt (torch/torchvision/ultralytics/
# onnxruntime) is never installed here.
# Debian slim, not Alpine: matches backend/Mainland/Dockerfile's base for the
# same reason -- opencv-python-headless (still needed here, see req.static.txt)
# needs runtime libs (libxcb etc.) this stage installs explicitly, and getting
# musl/Alpine equivalents right isn't worth the risk when this path is already
# proven on Debian.
FROM python:3.13-slim AS backend-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libmariadb-dev pkg-config \
        libglib2.0-0 libsm6 libxext6 libxrender1 libgl1 libxcb1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY backend/Mainland/req.static.txt .
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/

RUN uv venv .venv && uv pip install --python .venv --no-cache -r req.static.txt

COPY ./backend/Mainland ./backend/Mainland
RUN .venv/bin/python3 ./backend/Mainland/manage.py collectstatic --noinput

# ========================================================
# Stage 3: Production Target
# ========================================================
FROM nginx:1.29.5-alpine AS production

RUN rm /etc/nginx/conf.d/default.conf

COPY ./backend/Nginx/templates/ /etc/nginx/templates/

# svelte.config.js sets kit.appDir='static' so the built app references its own
# hashed assets as /static/immutable/... -- copying dist/static/'s *contents*
# (not dist/ itself) here means the alias below only has to strip one /static/
# prefix; copying dist/ wholesale would nest it as /static/static/immutable/...
# and 404 every asset.
COPY --from=frontend-builder --chown=nginx:nginx /build/frontend/dist/static/ /usr/share/nginx/static/
COPY --from=backend-builder  --chown=nginx:nginx /build/backend/Mainland/static/ /usr/share/nginx/static/

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
