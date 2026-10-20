# ReuniPet

Plataforma web para reportar, buscar y reencontrar mascotas perdidas y
encontradas: los propietarios publican reportes con fotos, la comunidad los
consulta con filtros y el sistema detecta posibles coincidencias y genera
alertas.

**Rama por defecto:** `main` — tiene el trabajo completo (Sprint 1 y Sprint 2)
y es idéntica a `sprint2`; un clon normal ya trae todo.

Hay dos formas de correr el proyecto:

- **Opción A (Docker):** un solo `docker compose up --build` levanta base de
  datos, API y frontend. Es la más rápida para empezar.
- **Opción B (manual):** Node + PostgreSQL instalados en la PC, útil para
  desarrollar sin Docker.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + TailwindCSS + shadcn/ui |
| Backend | NestJS + TypeScript |
| Base de datos | PostgreSQL + Prisma ORM |
| Monorepo | npm workspaces: `apps/web`, `apps/api`, `packages/shared` |
| Testing | Jest + Testing Library (web), Jest + Supertest (api) |

---

## Opción A — Docker (recomendada)

### Requisitos

- **Docker Desktop** (Windows/macOS) o Docker Engine + Compose (Linux), con
  al menos ~4 GB de RAM asignados a Docker.

### Pasos

1. Creá el archivo de entorno (no está versionado):

   ```bash
   cp .env.example .env
   # Windows: copy .env.example .env
   ```

2. Levantá todo (base de datos, API y frontend):

   ```bash
   docker compose up --build
   ```

   Para correrlo en segundo plano (los logs quedan accesibles con
   `docker compose logs -f`):

   ```bash
   docker compose up -d --build
   ```

   - La primera vez tarda unos minutos (baja imágenes y compila).
   - `db` tiene healthcheck; la API espera a que Postgres esté sano, aplica
     las migraciones (`prisma migrate deploy`), corre el seed (idempotente)
     y recién entonces arranca en el puerto 3001.

3. Abrí <http://localhost:3000>.

### URLs y puertos

| Servicio | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |

### Cómo funciona por dentro

- **Base de datos:** PostgreSQL 16 en el servicio `db` con volumen persistente
  (`db-data`). El puerto 5432 **no** se publica al host (evita choques con un
  PostgreSQL local).
- **Fotos:** se guardan en el volumen `uploads-data`, montado en
  `app/apps/api/uploads` dentro del contenedor de la API, y se sirven en
  `http://localhost:3001/files/...`.
- **`NEXT_PUBLIC_API_URL`:** se incrusta en el build del frontend como
  `http://localhost:3001` (la URL que usa el navegador), no la URL interna
  `http://api:3001`.
- **Sesión simulada:** todavía no hay login (llega en Sprints 3/4). La API
  resuelve el usuario actual con el header `X-User-Id`; si no viene, usa el
  usuario demo creado por el seed.

### Reiniciar con base limpia

```bash
docker compose down -v   # -v borra los volúmenes (datos y fotos)
docker compose up --build
```

Para solo detener (conservando datos):

```bash
docker compose down
```

---

## Opción B — Manual (sin Docker)

### Requisitos

- **Git**
- **Node.js >= 20** y npm (lo exige `engines` en el `package.json` raíz)
- **PostgreSQL >= 14** (instalado localmente o en Docker)

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/Juan-Zambrano5/ReuniPet.git
cd ReuniPet
npm run setup
```

`npm run setup` hace `npm install` (instala los tres workspaces desde la raíz),
compila `packages/shared` y genera el cliente de Prisma. **Hay que correrlo
desde la raíz del repo**, no dentro de `apps/api` ni de `apps/web`.

### 2. Base de datos

Elegí una de las dos opciones.

**Opción B.1 — PostgreSQL instalado localmente**

Creá una base de datos vacía (desde `psql`, pgAdmin o tu herramienta
preferida):

```sql
CREATE DATABASE reunipet;
```

**Opción B.2 — PostgreSQL en Docker**

```bash
docker run --name reunipet-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=reunipet \
  -p 5432:5432 \
  -d postgres:16
```

### 3. Variables de entorno

`.env` **no está versionado** (está en `.gitignore`): cada quien lo crea en su
PC y nunca se commitea.

```bash
# Windows
copy apps\api\.env.example apps\api\.env
# Linux / macOS
cp apps/api/.env.example apps/api/.env
```

Contenido (ya trae los valores por defecto compatibles con la opción B.1 y la
B.2):

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/reunipet?schema=public"
PORT=3001
```

Si tu PostgreSQL usa otro usuario o contraseña, cambialo en
`DATABASE_URL`.

Para el frontend podés crear `apps/web/.env.local` (hay un
`apps/web/.env.example` como punto de partida); si no existe, se usa
`http://localhost:3001` por defecto.

### 4. Prisma: migrar y sembrar

```bash
npm run prisma:migrate   --workspace apps/api
npm run prisma:seed      --workspace apps/api
```

- `prisma:migrate` aplica las migraciones versionadas en
  `apps/api/prisma/migrations`.
- `prisma:seed` crea el **usuario demo** (`demo@reunipet.app`). Es
  obligatorio: sin él, la API responde `404 "Usuario demo no encontrado"`
  en cualquier endpoint que necesite usuario en sesión (ver
  `apps/api/src/usuarios/current-user.provider.ts`).

### 5. Correr el proyecto

Necesitás **dos terminales** (o dos pestañas en VS Code), siempre desde la
raíz del repo:

```bash
# Terminal 1 — API NestJS (http://localhost:3001)
npm run dev:api

# Terminal 2 — Frontend Next.js (http://localhost:3000)
npm run dev:web
```

Abrí <http://localhost:3000> y probá crear un reporte.

---

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Crear reporte de mascota **perdida** | `/reportar/perdida` (datos + fotos en 2 pasos) |
| Crear reporte de mascota **encontrada** | `/reportar/encontrada` |
| Alertas de coincidencia (Tus coincidencias) | `/alertas` |
| **"Recientes en tu zona"** y los **filtros** (especie, raza, color, cerca de mí) | `/alertas`, bloque "Recientes en tu zona" |
| Comparador de una coincidencia | `/comparador/<id>`; desde "Comparador Inteligente" del navbar abre la más reciente |
| Detalle de un reporte y su foto | `/reportes/<id>` |
| Mapa | `/mapa` (placeholder: "Disponible próximamente") |

---

## Cómo correr los tests

### En un clon limpio

Desde la raíz del repo, en este orden:

```bash
# 1. Instalar dependencias (fiel al package-lock.json)
npm ci

# 2. Compilar packages/shared (su main/types apuntan a dist/, que NO está versionado)
npm run build --workspace packages/shared

# 3. Generar el cliente de Prisma
npm run prisma:generate --workspace apps/api
```

> **Nota:** la instalación puede imprimir varios `npm warn deprecated`
> (glob, eslint 8, whatwg-encoding…). Son avisos de dependencias viejas de
> paquetes transitivos: son normales, no son errores y no frenan nada.

> **Nota:** si las suites fallan al arrancar con
> `Cannot find module '@reunipet/shared'`, falta el paso 2: corré
> `npm run build --workspace packages/shared`. (También está en
> "Problemas frecuentes".)

### API — unit (sin base de datos)

```bash
npm run test --workspace apps/api    # 59 tests (todo mockeado)
```

### API — e2e (necesita una base de datos de prueba)

Los e2e usan `DATABASE_URL` de `apps/api/.env` y **borran** reportes,
fotografías y coincidencias al finalizar (`deleteMany` en los
`*.e2e-spec.ts`). No los corras contra una base con datos que quieras
conservar: usá una base separada (por ejemplo `reunipet_test`).

```bash
# 1. Crear la base de prueba. Opción con Docker (no requiere PostgreSQL
#    instalado; usa el puerto 5433 para no chocar con un PostgreSQL local
#    ni con el puerto del servicio db de docker-compose.yml):
docker run --name reunipet-test-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=reunipet_test \
  -p 5433:5432 \
  -d postgres:16-alpine

# Opción con PostgreSQL local (psql, pgAdmin o tu herramienta preferida):
#   CREATE DATABASE reunipet_test;

# 2. Que apps/api/.env apunte a esa base (5433 si usaste Docker;
#    5432 si es tu PostgreSQL local)
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/reunipet_test?schema=public"

# 3. Aplicar migraciones y seed (el seed crea el usuario demo,
#    que varios e2e requieren)
npm run prisma:deploy --workspace apps/api
npm run prisma:seed   --workspace apps/api

# 4. Correr los e2e
npm run test:e2e --workspace apps/api   # 57 tests
```

Al terminar, si usaste la opción con Docker, borrá el contenedor y su
volumen:

```bash
docker rm -fv reunipet-test-pg
```

### Web — unit (sin base de datos)

```bash
npm run test --workspace apps/web    # 49 tests
```

### Todos los workspaces

```bash
npm test    # api (unit) + web + shared (no tiene tests)
npm run lint
```

Total: **165 tests** (api unit 59 + e2e 57 + web 49).

## Comandos útiles (raíz)

| Comando | Qué hace |
|---|---|
| `docker compose up --build` | Levanta todo con Docker (Opción A) |
| `npm run setup` | Instala dependencias y prepara shared + Prisma (Opción B) |
| `npm run dev:api` | API en watch (NestJS), puerto 3001 |
| `npm run dev:web` | Frontend en dev (Next.js), puerto 3000 |
| `npm run build` | Compila shared → api → web |
| `npm test` | Tests de todos los workspaces |
| `npm run lint` | Lint de todos los workspaces |
| `npm run format` | Formatea con Prettier |

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `Cannot find module '@reunipet/shared'` o error resolviendo tipos de shared | Falta compilar el paquete: `npm run build --workspace packages/shared` |
| API responde `404 Usuario demo no encontrado` | Falta el seed: `npm run prisma:seed --workspace apps/api` |
| `Environment variable not found: DATABASE_URL` o error de conexión | Revisá `apps/api/.env` (opción B) o el `.env` de la raíz (opción A) y que la DB exista y esté en el puerto correcto |
| Prisma Client no inicializado / schema no encontrado | `npm run prisma:generate --workspace apps/api` |
| El frontend no responde o no llega a la API | Que la API esté levantada en el puerto 3001; si usás otro puerto, creá `.env.local` en `apps/web` con `NEXT_PUBLIC_API_URL=http://localhost:<puerto>` |
| Puerto 3000 o 3001 ocupado | Cerrá el proceso previo (opción B) o cambiá `PORT` en el `.env` de la raíz (opción A) |
| `docker compose up` falla en `api` con error de conexión a `db` | Esperá a que el healthcheck de `db` esté sano; revisá el `.env` de la raíz |

## Estructura del monorepo

```
ReuniPet/
├── apps/
│   ├── api/          # Backend NestJS + Prisma (puerto 3001)
│   │   ├── prisma/   # schema, migraciones y seed
│   │   └── src/      # módulos: reportes, alertas, matching, storage...
│   └── web/          # Frontend Next.js App Router (puerto 3000)
├── packages/
│   └── shared/       # Tipos y DTOs compartidos api <-> web
├── docker-compose.yml  # servicios: db, api, web
├── package.json      # workspaces + scripts de raíz
└── README.md
```

## Documentación interna

El detalle por historia de usuario y el modelo de datos viven en los
documentos internos del proyecto (`AGENTS.md`, `SPRINT2_PLAN.md`,
`DOCUMENTO_TECNICO.txt`), que no están versionados en este repo.
