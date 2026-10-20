# Monorepo: el build context es la RAÍZ del repo (ver docker-compose.yml).
# Multi-stage: deps (npm ci) -> build (shared + api) -> runtime.

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY packages/shared packages/shared
RUN npm run build --workspace packages/shared
COPY apps/api apps/api
# openssl ANTES de `prisma generate`: si falta, el cliente se genera para
# "debian-openssl-1.1.x" y en la imagen final (que sí tiene openssl 3.0.x)
# Prisma no encuentra el Query Engine y el seed revienta. Instalarlo acá
# hace que el cliente se genere para "debian-openssl-3.0.x", igual que en
# runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
# El cliente de Prisma generado no viaja en el repo: hay que generarlo
# antes de compilar la API (el código importa tipos de @prisma/client).
RUN npm run prisma:generate --workspace apps/api
RUN npm run build --workspace apps/api

# Imagen final: node_modules COMPLETOS (incluye prisma CLI y ts-node, que
# son devDependencies y se necesitan para migrate deploy y el seed).
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
# tsconfig.json es imprescindible para `ts-node prisma/seed.ts`: sin él,
# ts-node usa defaults con module node16 y el seed revienta con
# ERR_UNKNOWN_FILE_EXTENSION.
COPY --from=build /app/apps/api/tsconfig.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
# OpenSSL: Prisma detecta la versión de libssl para elegir su engine
# criptográfico; bookworm-slim no la trae y avisa "failed to detect the
# libssl/openssl version". Instalarlo en la imagen final elimina el aviso.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/apps/api
EXPOSE 3001
# Arranque: migrar -> seed idempotente -> API. Todo dentro de la imagen,
# sin scripts .sh (evita problemas de CRLF en Windows).
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/main"]
