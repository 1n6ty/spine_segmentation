# --- Stage 1: Base (Runtime Environment) ---
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/home/Mainland/.venv/bin:$PATH"

ARG USER_ID
ARG GROUP_ID

WORKDIR /home/Mainland

# Install runtime-only system dependencies
# libgl1 and libglib2.0-0 are mandatory for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    curl \
    libmagic1 \
    librdkafka1 \
    libmariadb3 \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g ${GROUP_ID} Mainland \
    && useradd -m -u ${USER_ID} -g Mainland Mainland

# --- Stage 2: Builder (Compile/Install) ---
FROM base AS builder

# Install build-time dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    python3-dev \
    librdkafka-dev \
    libmariadb-dev \
    && rm -rf /var/lib/apt/lists/*

COPY req.txt .

# Create venv and install dependencies
RUN python -m venv /home/Mainland/.venv \
    && .venv/bin/pip install --upgrade pip \
    && .venv/bin/pip install --no-cache-dir -r req.txt

# --- Stage 3: Development ---
FROM builder AS development
COPY . .
RUN mkdir -p static templates media /var/log/django && \
    chown -R Mainland:Mainland /home/Mainland /var/log/django

USER Mainland

# --- Stage 4: Production ---
FROM base AS production

# Copy the pre-installed virtualenv from the builder
COPY --from=builder --chown=Mainland:Mainland /home/Mainland/.venv /home/Mainland/.venv
COPY --chown=Mainland:Mainland . .

RUN mkdir -p static templates media /var/log/django && \
    chown -R Mainland:Mainland static templates media /var/log/django

USER Mainland