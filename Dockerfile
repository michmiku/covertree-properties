# syntax=docker/dockerfile:1
# One Dockerfile for the monorepo; docker-compose.yml builds the `api` and `web` targets.

FROM node:22-slim AS base
# openssl: Prisma's schema engine (`migrate deploy`) links against it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@12.6.0
WORKDIR /app

# Dependencies are fetched from the lockfile alone, so this layer survives source edits.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY . .
# postinstall runs `prisma generate` (the Prisma client is not committed).
RUN pnpm install --offline --frozen-lockfile

FROM deps AS api
RUN pnpm --filter api build
WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 4000
# Dev dependencies stay installed: the Prisma CLI applies migrations on start.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/server.js"]

FROM deps AS web-build
# Inlined at build time; the browser calls the API directly.
ARG VITE_GRAPHQL_URL=http://localhost:4000/graphql
ENV VITE_GRAPHQL_URL=$VITE_GRAPHQL_URL
RUN pnpm --filter web build

FROM nginx:1.29-alpine AS web
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
