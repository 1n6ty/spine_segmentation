# ==========================================
# Stage 1: Compile Frontend Assets (Prod Only)
# ==========================================
FROM node:26-alpine AS frontend-builder

WORKDIR /build

COPY ./SpineSeg/package.json ./SpineSeg/package.json
RUN cd SpineSeg && npm install

COPY ./SpineSeg ./SpineSeg

RUN cd SpineSeg && npm run build

# ==========================================
# Stage 2: Collect Django Static Files (Prod Only)
# ==========================================
FROM python:3.13-slim AS backend-builder

# torch/torchvision/ultralytics (req.txt) ship no musllinux wheels, so this
# stage can't be Alpine — glibc is required, matching backend/Mainland/Dockerfile.
RUN apt-get update && apt-get install -y --no-install-recommends \
        default-libmysqlclient-dev libmariadb-dev pkg-config build-essential \
        libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 \
    && rm -rf /var/lib/apt/lists/*

ENV MYSQLCLIENT_CFLAGS="-I/usr/include/mariadb" \
    MYSQLCLIENT_LDFLAGS="-L/usr/lib/x86_64-linux-gnu -lmariadb"

WORKDIR /build

COPY backend/Mainland/req.txt .
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

RUN uv venv .venv && uv pip install --python .venv --no-cache -r req.txt

COPY ./backend/Mainland ./backend/Mainland
RUN .venv/bin/python3 ./backend/Mainland/manage.py collectstatic --noinput

# ==========================================
# Stage 3: Production Target
# ==========================================
FROM nginx:1.29.5-alpine AS production

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx templates (Path relative to project root context)
COPY ./backend/Nginx/templates/ /etc/nginx/templates/

# svelte.config.js's appDir: 'static' names a subfolder *inside* dist/, not a
# rename of dist/ itself — copying dist/ wholesale double-nests assets under
# /usr/share/nginx/static/static/..., 404ing against nginx's /static/ alias.
COPY --from=frontend-builder /build/SpineSeg/dist/static/ /usr/share/nginx/static/

# Inject collected Django static files (Admin styles, framework assets)
COPY --from=backend-builder /build/backend/Mainland/static/ /usr/share/nginx/static/

# Ensure proper ownership for Alpine Nginx user
RUN chown -R nginx:nginx /usr/share/nginx/static

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
