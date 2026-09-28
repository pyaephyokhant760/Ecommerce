# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Ecommerce API (Express + TypeScript + Prisma + MongoDB)
#
# The app is executed with ts-node (via nodemon), so this is a single-stage
# image that keeps dev dependencies. `docker-compose.yml` bind-mounts `src/`
# and `prisma/` for hot reload.
# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS base

# Prisma's query engine (and bcrypt) need OpenSSL at runtime/build time.
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=development \
    npm_config_update_notifier=false

WORKDIR /app

# ---------------------------------------------------------------------------
# Dependencies (compiled in their own layer so changes to src/ don't bust it)
# ---------------------------------------------------------------------------
FROM base AS deps

# bcrypt is a native addon: keep a toolchain around in case no prebuilt
# binary is available for this platform.
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM base AS runtime

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate the Prisma Client for the MongoDB schema (node_modules/.prisma).
RUN npx prisma generate

RUN chmod +x docker/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["docker/entrypoint.sh"]
CMD ["npm", "start"]
