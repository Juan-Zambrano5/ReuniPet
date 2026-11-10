# ReuniPet

Plataforma web para reportar, buscar y reencontrar mascotas perdidas y
encontradas: los propietarios publican reportes con fotos, la comunidad los
consulta con filtros y el sistema detecta posibles coincidencias y genera
alertas.

**Rama con el trabajo más reciente:** `sprint4` (Sprints 1 a 4). Cloná con
`git clone --branch sprint4 <url>` (o `git checkout sprint4`).

**Estado (Sprint 4):**

- Registro e inicio de sesión con **JWT** (8 h) y límite de intentos; ya no
  hay sesión simulada.
- Roles `USUARIO` y `ADMIN`, con panel de **administración** (`/admin`):
  ocultar y restaurar reportes (**moderación**) y **suspender** o reactivar
  usuarios.
- **Edición** de reportes por su dueño (recalcula coincidencias), cierre y
  reapertura, y "Mis reportes".
- **Mapa** real (Leaflet + OpenStreetMap) para marcar la ubicación al
  reportar o editar, y para verla en el detalle (punto exacto para el dueño,
  zona aproximada de ~1 km para los demás).

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
- **Docker Desktop tiene que estar abierto** (el motor corriendo) antes de
  usar `docker compose`; si no, falla con `dockerDesktopLinuxEngine` (ver
  "Problemas frecuentes").

### Pasos

1. Creá el archivo de entorno y completá las variables obligatorias.
   `.env` está en `.gitignore`: **nunca se sube** al repositorio.

   ```bash
   cp .env.example .env
   # Windows: copy .env.example .env
   ```

   Obligatorias (el `.env.example` las trae vacías):

   | Variable | Para qué |
   |---|---|
   | `JWT_SECRET` | Firma los tokens de sesión. **Mínimo 32 caracteres**; sin él `docker compose` no arranca. |
   | `DEMO_PASSWORD` | Contraseña del usuario demo (`demo@reunipet.app`), mínimo 8 caracteres. |
   | `ADMIN_EMAIL` | Correo del primer administrador, creado por el seed. |
   | `ADMIN_PASSWORD` | Contraseña de ese administrador, mínimo 8 caracteres. |

   El seed asigna las contraseñas **solo la primera vez** (cuando crea la
   cuenta o si el demo todavía no tiene una): cambiarlas después en `.env` no
   las modifica.

   Generar un `JWT_SECRET` (48 bytes aleatorios en Base64):

   ```powershell
   # Windows (PowerShell)
   $b = New-Object byte[] 48
   [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
   [Convert]::ToBase64String($b)
   ```

   ```bash
   # Linux / macOS
   openssl rand -base64 48
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
  `/app/apps/api/uploads` dentro del contenedor de la API, y se sirven en
  `http://localhost:3001/files/...`. Sobreviven a `docker compose restart` y
  a `docker compose down` (sin `-v`).
- **`NEXT_PUBLIC_API_URL`:** se incrusta en el build del frontend como
  `http://localhost:3001` (la URL que usa el navegador), no la URL interna
  `http://api:3001`.
- **Sesión:** `POST /auth/login` devuelve un token JWT (8 h) firmado con
  `JWT_SECRET`; el frontend lo envía en `Authorization: Bearer <token>`. Las
  rutas privadas responden 401 sin un token válido, y las cuentas
  suspendidas reciben `CUENTA_SUSPENDIDA`.

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

`DATABASE_URL` ya viene compatible con la opción B.1 y la B.2 (si tu
PostgreSQL usa otro usuario o contraseña, cambialo ahí). Completá además
`JWT_SECRET` (obligatorio, mínimo 32 caracteres; se genera como en la
Opción A), `DEMO_PASSWORD`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.

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
- `prisma:seed` crea el **usuario demo** (`demo@reunipet.app`, contraseña
  `DEMO_PASSWORD`) y el **administrador** (`ADMIN_EMAIL` /
  `ADMIN_PASSWORD`). Es idempotente.

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
| Detalle de un reporte, sus fotos y (si es tuyo) el panel de estado: marcar como recuperada / reabrir | `/reportes/<id>` |
| Registro de usuario ("Crear cuenta" en la barra) | `/registro` |
| Iniciar sesión | `/login` |
| Editar un reporte propio | `/reportes/<id>/editar` |
| Mis reportes: todos tus reportes, su estado y posibles coincidencias | `/mis-reportes` |
| Administración (solo `ADMIN`): reportes y usuarios | `/admin` |
| Mapa para marcar o ver la ubicación de un reporte | En `/reportar/...`, en la edición y en `/reportes/<id>` |

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
npm run test --workspace apps/api    # 148 tests (todo mockeado)
```

### API — e2e (necesita una base de datos de prueba)

Los e2e usan `DATABASE_URL` de `apps/api/.env` y **borran** reportes,
fotografías y coincidencias al finalizar (`deleteMany` en los
`*.e2e-spec.ts`). No los corras contra una base con datos que quieras
conservar: usá una base separada (por ejemplo `reunipet_test`).

**Fotos de las pruebas:** las e2e fijan `UPLOADS_DIR` en
`apps/api/uploads-test` (en `test/setup-env.ts`), así que nunca escriben en
`apps/api/uploads`, la carpeta de las fotos de desarrollo. Al terminar
borran solo los archivos que subieron. `UPLOADS_DIR` también sirve para
cambiar la carpeta de fotos de la API (por defecto, `apps/api/uploads`).

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

# 2. En un clon limpio apps/api/.env no existe: copialo del ejemplo
#    (Windows: copy apps\api\.env.example apps\api\.env)
cp apps/api/.env.example apps/api/.env
#    y apuntá DATABASE_URL a la base de prueba (5433 si usaste Docker;
#    5432 si es tu PostgreSQL local). JWT_SECRET puede quedar vacío: las e2e
#    usan uno propio solo para pruebas.
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/reunipet_test?schema=public"

# 3. Aplicar migraciones y seed (el seed crea el usuario demo,
#    que varios e2e requieren)
npm run prisma:deploy --workspace apps/api
npm run prisma:seed   --workspace apps/api

# 4. Correr los e2e
npm run test:e2e --workspace apps/api   # 141 tests
```

Al terminar, si usaste la opción con Docker, borrá el contenedor y su
volumen:

```bash
docker rm -fv reunipet-test-pg
```

### Web — unit (sin base de datos)

```bash
npm run test --workspace apps/web    # 177 tests
```

### Todos los workspaces

```bash
npm test    # api (unit) + web + shared (no tiene tests)
npm run lint
npm run typecheck    # tsc --noEmit en shared + api + web (INCLUYE los archivos de test)
```

> **Importante:** corré `npm run typecheck` después de tocar código o tests.
> `next build` y `nest build` no revisan los archivos de prueba, así que un
> error de tipos en un `.test.tsx` o `.spec.ts` solo lo detecta este chequeo.

Total: **466 tests** en el Sprint 4 (api unit 148 + e2e 141 + web 177).

## Comandos útiles (raíz)

| Comando | Qué hace |
|---|---|
| `docker compose up --build` | Levanta todo con Docker (Opción A) |
| `npm run setup` | Instala dependencias y prepara shared + Prisma (Opción B) |
| `npm run dev:api` | API en watch (NestJS), puerto 3001 |
| `npm run dev:web` | Frontend en dev (Next.js), puerto 3000 |
| `npm run build` | Compila shared → api → web |
| `npm test` | Tests de todos los workspaces |
| `npm run typecheck` | Chequeo de tipos (`tsc --noEmit`) incluyendo tests |
| `npm run lint` | Lint de todos los workspaces |
| `npm run format` | Formatea con Prettier |

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `Cannot find module '@reunipet/shared'` o error resolviendo tipos de shared | Falta compilar el paquete: `npm run build --workspace packages/shared` |
| `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine` | Docker Desktop no está abierto (o el motor no terminó de arrancar). Abrilo, esperá a que indique que está corriendo y repetí el comando |
| `docker compose up` falla con `Define JWT_SECRET en .env` | Falta `JWT_SECRET` en el `.env` de la raíz (mínimo 32 caracteres; ver Opción A, paso 1) |
| No se puede iniciar sesión con el demo o el administrador | Faltaban `DEMO_PASSWORD` o `ADMIN_EMAIL`/`ADMIN_PASSWORD` al correr el seed. Definilos y volvé a correr el seed (en Docker, `docker compose restart api`) |
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
│   │   └── src/      # módulos: auth, admin, reportes, alertas, matching, storage...
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
