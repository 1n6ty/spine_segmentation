# --- Stage 1: Base (Environment setup) ---
FROM python:3.13-alpine AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

ARG USER_ID
ARG GROUP_ID

WORKDIR /home/Mainland

RUN apk add --no-cache bash curl libmagic librdkafka mariadb-connector-c \
    && addgroup -g ${GROUP_ID} -S Mainland && adduser -S -u ${USER_ID} Mainland -G Mainland

# --- Stage 2: Builder (Install dependencies) ---
FROM base AS builder

RUN apk add --no-cache gcc musl-dev python3-dev librdkafka-dev mariadb-dev
COPY req.txt .
RUN python -m venv .venv \
    && .venv/bin/pip install --upgrade pip \
    && .venv/bin/pip install --no-cache-dir -r req.txt

# --- Stage 3: Development ---
FROM builder AS development
COPY . .
RUN mkdir -p static templates media /var/log/django && chown -R Mainland:Mainland /home/Mainland /var/log/django

USER Mainland

# --- Stage 4: Production (The Slim Image) ---
FROM base AS production

COPY --from=builder --chown=Mainland:Mainland /home/Mainland/.venv /home/Mainland/.venv
COPY --chown=Mainland:Mainland . .

RUN mkdir -p static templates media /var/log/django && chown -R Mainland:Mainland static templates media /var/log/django

USER Mainland