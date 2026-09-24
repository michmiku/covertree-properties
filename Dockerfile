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

# One-shot migrations (compose `migrate` service). Needs the Prisma CLI, a dev dependency.
FROM deps AS migrate
WORKDIR /app/apps/api
USER node
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]

# Production dependencies only; `dist` already contains the compiled Prisma client.
FROM deps AS api-build
RUN pnpm --filter api build \
  && pnpm --filter api deploy --prod --ignore-scripts /out

FROM node:22-slim AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=api-build /out/package.json ./
COPY --from=api-build /out/node_modules ./node_modules
COPY --from=api-build /app/apps/api/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]

FROM deps AS web-build
# Inlined at build time; the browser calls the API directly.
ARG VITE_GRAPHQL_URL=http://localhost:4000/graphql
ENV VITE_GRAPHQL_URL=$VITE_GRAPHQL_URL
RUN pnpm --filter web build

FROM nginx:1.29-alpine AS web
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
