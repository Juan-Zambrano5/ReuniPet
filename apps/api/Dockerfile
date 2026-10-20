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

WORKDIR /app/apps/api
EXPOSE 3001
# Arranque: migrar -> seed idempotente -> API. Todo dentro de la imagen,
# sin scripts .sh (evita problemas de CRLF en Windows).
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/main"]
