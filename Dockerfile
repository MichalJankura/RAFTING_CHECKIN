FROM node:20-bullseye-slim

# Install PostgreSQL
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql postgresql-client gpg \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /var/lib/postgresql/*

WORKDIR /app

# Dependencies (separate layer — cached until package.json changes)
COPY package*.json ./
RUN npm ci

# Source code
COPY . .

# Build Vite frontend
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3001

ENV NODE_ENV=production \
    PORT=3001 \
    DB_HOST=localhost \
    DB_PORT=5432 \
    DB_NAME=rafting_dunajec \
    DB_USER=rafting_app
# DB_PASSWORD and all other secrets are NOT set here.
# They are injected at runtime via Docker secrets (/run/secrets/).

# Database data directory survives container restarts via the named volume
VOLUME ["/var/lib/postgresql/data"]

ENTRYPOINT ["/app/docker-entrypoint.sh"]
