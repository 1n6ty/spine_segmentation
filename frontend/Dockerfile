# ========================================================
# Stage 1: Build
# ========================================================
FROM node:24-alpine AS build

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

# ========================================================
# Stage 2: Artifact
# ========================================================
FROM alpine:3.21 AS artifact
COPY --from=build /build/dist /dist
CMD ["true"]
