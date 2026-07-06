# 03 · JWT + Refresh Tokens (autenticación stateless con rotación de tokens y blacklist)

Implementación de autenticación basada en **JWT con refresh tokens y blacklist de access tokens**: combina la eficiencia stateless de JWT con la capacidad de invalidar sesiones de forma inmediata, resolviendo las limitaciones de los métodos anteriores.

El servidor emite dos tokens: un **access token** de corta duración para autenticar requests, y un **refresh token** de larga duración para obtener nuevos access tokens sin necesidad de volver a hacer login. Cada tecnología almacena lo que mejor sabe gestionar:

- **PostgreSQL** — refresh tokens (persistente, auditable, larga duración)
- **Redis** — blacklist de access tokens (efímero, TTL corto, acceso en microsegundos)

Este proyecto forma parte de [`auth-methods-lab`](../README.md), un laboratorio para aprender todos los métodos de autenticación implementando cada uno por separado.

---

## 🧠 ¿Cómo funciona este método?

1. El usuario se registra con email y contraseña. La contraseña se guarda hasheada con bcrypt (con prehash SHA-256).
2. En el login, el servidor valida las credenciales y emite **dos tokens**:
   - **Access token** (JWT firmado, duración corta: 15 minutos) — para autenticar cada request.
   - **Refresh token** (opaco, duración larga: 7 días) — para obtener nuevos access tokens. Se guarda hasheado en PostgreSQL y en una cookie `HttpOnly`.
3. El cliente usa el **access token** en el header `Authorization: Bearer` para requests protegidas.
4. Cuando el **access token expira**, el cliente llama a `POST /auth/refresh` — el servidor verifica el refresh token en PostgreSQL, lo invalida, y emite un par de tokens nuevo (**rotación**).
5. En el logout, el refresh token se elimina de PostgreSQL y el access token se añade a la **blacklist en Redis** con TTL igual a su tiempo de expiración restante — invalidación instantánea garantizada.

---

## 🔄 Flujo de rotación de tokens

```
Login
 └─► access token (15min) + refresh token (7d) → cliente

Request normal
 └─► Authorization: Bearer <access_token>
      ├─► requireAuth comprueba blacklist Redis (sin DB) ✅
      └─► requireAuth verifica firma JWT (sin DB) ✅

Access token expirado
 └─► POST /auth/refresh (cookie refresh_token)
      ├─► verifica refresh token en PostgreSQL ✅
      ├─► elimina el refresh token viejo (rotación) ♻️
      └─► emite nuevo access token + nuevo refresh token

Logout
 └─► POST /auth/logout
      ├─► elimina refresh token de PostgreSQL
      └─► añade access token a blacklist Redis (TTL = tiempo restante)
           └─► invalidación inmediata ✅
```

La **rotación** significa que cada vez que se usa un refresh token se invalida el anterior. Si se detecta que un refresh token ya usado vuelve a presentarse, es señal de robo — se pueden invalidar todas las sesiones del usuario.

---

## ⚙️ Por qué cada tecnología en su sitio

| Dato | Tecnología | Razón |
|---|---|---|
| Refresh tokens | PostgreSQL | Persistente, auditable, queries complejas, FK con usuario |
| Blacklist access tokens | Redis | Efímero (TTL = expiración del token), acceso en microsegundos, nunca necesitas leerlos en batch |

Si Redis cae, el peor escenario es que algunos access tokens invalidados sean temporalmente válidos (máximo 15 min). Si PostgreSQL cae, todos los refresh tokens están a salvo y la sesión se recupera al reiniciar.

---

## 🗄️ Modelo de datos

### PostgreSQL — `users`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | Generado con `uuid_generate_v4()` |
| `email` | VARCHAR(255) UNIQUE NOT NULL | |
| `password_hash` | VARCHAR(255) NOT NULL | bcrypt con prehash SHA-256 |
| `created_at` | TIMESTAMP DEFAULT now() | |
| `updated_at` | TIMESTAMP DEFAULT now() | Auto-actualizado por trigger |

### PostgreSQL — `refresh_tokens`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users.id ON DELETE CASCADE | |
| `token_hash` | VARCHAR(255) NOT NULL UNIQUE | SHA-256 del refresh token (nunca en claro) |
| `expires_at` | TIMESTAMP NOT NULL | |
| `user_agent` | VARCHAR(255) | Auditoría / sesiones por dispositivo |
| `ip_address` | VARCHAR(45) | Auditoría |
| `created_at` | TIMESTAMP DEFAULT now() | |

### Redis — `blacklist:<jti>`

Los access tokens invalidados se guardan con clave `blacklist:<jti>` y TTL igual al tiempo restante hasta su expiración:

```bash
SET blacklist:550e8400-e29b-41d4-a716 "1" EX 847
# Expira automáticamente cuando el token habría expirado de todas formas
```

Para que esto funcione, cada access token lleva un campo `jti` (JWT ID) único en el payload:

```json
// JWT payload (decodificado)
{
  "sub": "161c0b73-9898-408a-89a2-94069eeed8f7",
  "email": "user@example.com",
  "jti": "550e8400-e29b-41d4-a716-446655440000",
  "iat": 1751234567,
  "exp": 1751235467
}
```

---

## 🔌 Endpoints

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| `POST` | `/auth/register` | Crea un usuario nuevo | No |
| `POST` | `/auth/login` | Verifica credenciales y emite token par | No |
| `POST` | `/auth/refresh` | Rota el refresh token y emite nuevo access token | Cookie |
| `POST` | `/auth/logout` | Invalida refresh token y añade access token a blacklist | Bearer + Cookie |
| `GET` | `/users/me` | Devuelve el usuario autenticado | Bearer |
| `GET` | `/health` | Health check de Postgres y Redis | No |

### `POST /auth/register`

```json
// Request
{
  "email": "user@example.com",
  "password": "Password123!"
}

// Response 201
{
  "message": "User registered successfully",
  "user": {
    "id": "161c0b73-9898-408a-89a2-94069eeed8f7",
    "email": "user@example.com"
  }
}
```

### `POST /auth/login`

```json
// Request
{
  "email": "user@example.com",
  "password": "Password123!"
}

// Response 200
// Set-Cookie: refreshToken=<token>; HttpOnly; Secure; SameSite=Strict
{
  "message": "Login successful",
  "user": {
    "id": "161c0b73-9898-408a-89a2-94069eeed8f7",
    "email": "user@example.com"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### `POST /auth/refresh`

```json
// Cookie: refreshToken=<token> (enviada automáticamente)
// No requiere body ni Authorization header

// Response 200
// Set-Cookie: refreshToken=<nuevo_token>; HttpOnly; Secure; SameSite=Strict
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### `POST /auth/logout`

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Cookie: refreshToken=<token>
```

```json
// Response 200
// Elimina refresh token de PostgreSQL
// Añade access token a blacklist Redis
// Limpia la cookie
{
  "message": "Logout successful"
}
```

### `GET /users/me`

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

```json
// Response 200
{
  "user": {
    "id": "161c0b73-9898-408a-89a2-94069eeed8f7",
    "email": "user@example.com"
  }
}
```

---

## 🛠️ Stack

- **Node.js + Express**
- **PostgreSQL** — usuarios y refresh tokens (persistente)
- **Redis** — blacklist de access tokens (efímero)
- **`jsonwebtoken`** — generación y verificación de access tokens JWT
- **`bcrypt`** — hash de contraseñas
- **`crypto` (Node nativo)** — prehash SHA-256, generación y hash de refresh tokens, `jti` único por token
- **`cookie-parser`** — lectura de cookies (refresh token)
- **`postgres.js`** — cliente PostgreSQL
- **`redis`** — cliente Redis oficial
- **`zod`** — validación de inputs
- **`cors`** — configuración de CORS

---

## 📂 Estructura del proyecto

```
03-jwt-refresh-tokens/
├── src/
│   ├── database/
│   │   ├── database.manager.js       # Singleton Postgres
│   │   └── redis.manager.js          # Singleton Redis
│   ├── auth/
│   │   ├── auth.controller.js
│   │   ├── auth.middleware.js        # requireAuth (verifica JWT + blacklist Redis)
│   │   ├── auth.repository.js        # Queries usuarios
│   │   ├── auth.routes.js
│   │   ├── auth.schema.js            # Validación Zod
│   │   └── auth.service.js
│   ├── token/
│   │   ├── token.repository.js       # CRUD refresh tokens (PostgreSQL) + blacklist (Redis)
│   │   └── token.service.js          # Generación, rotación, invalidación y blacklist
│   ├── health/
│   │   ├── health.controller.js
│   │   ├── health.repository.js
│   │   ├── health.routes.js
│   │   └── health.service.js
│   └── index.js
├── .env.example
├── .gitignore
├── .npmrc
├── package.json
└── README.md
```

---

## 🚀 Cómo ejecutar

### 1. Levanta PostgreSQL y Redis

```bash
# PostgreSQL
# Iniciación externa en el servidor

# Redis
redis-server
```

### 2. Instala dependencias

```bash
cd 03-jwt-refresh-tokens
pnpm install
```

### 3. Configura las variables de entorno

```bash
cp .env.example .env
```

```env
HOST=localhost
PORT=3002

DB_HOST=localhost
DB_PORT=5432
DB_NAME=jwt_refresh_auth
DB_USER=postgres
DB_PASSWORD=
DB_POOL_MAX=10
DB_IDLE_TIMEOUT=30
DB_CONNECT_TIMEOUT=10

REDIS_HOST=localhost
REDIS_PORT=6379

ACCESS_TOKEN_SECRET=change-me-in-production
ACCESS_TOKEN_EXPIRES_IN=15m

REFRESH_TOKEN_SECRET=change-me-in-production-too
REFRESH_TOKEN_EXPIRES_IN=7d

NODE_ENV=development
```

### 4. Levanta el servidor

```bash
pnpm run dev
```

Disponible en `http://localhost:3002`.

---

## 🔍 Probar el flujo completo con REST Client

```http
### Login
# @name login
POST http://localhost:3002/auth/login
Content-Type: application/json

{
    "email": "user1@example.com",
    "password": "Password1!"
}

### Me (con access token)
GET http://localhost:3002/users/me
Authorization: Bearer {{login.response.body.accessToken}}

### Refresh (cookie enviada automáticamente)
# @name refresh
POST http://localhost:3002/auth/refresh

### Me (con nuevo access token)
GET http://localhost:3002/users/me
Authorization: Bearer {{refresh.response.body.accessToken}}

### Logout
POST http://localhost:3002/auth/logout
Authorization: Bearer {{login.response.body.accessToken}}

### Me tras logout (debe devolver 401 — token en blacklist)
GET http://localhost:3002/users/me
Authorization: Bearer {{login.response.body.accessToken}}
```

---

## 🔍 Inspeccionar blacklist en Redis

```bash
redis-cli

# Ver todos los tokens en blacklist
KEYS blacklist:*

# Ver si un token concreto está en blacklist
GET blacklist:<jti>

# Ver segundos restantes hasta que se limpie automáticamente
TTL blacklist:<jti>
```

---

## 🔒 Consideraciones de seguridad

- Las contraseñas se hashean con **bcrypt** precedido de un **prehash SHA-256** para evitar la truncación silenciosa a 72 bytes.
- El refresh token se genera con `crypto.randomBytes(64)` y se guarda **hasheado con SHA-256** en PostgreSQL — si la DB es comprometida, los tokens no son utilizables directamente.
- El access token incluye un **`jti` único** (`crypto.randomUUID()`) que permite añadirlo a la blacklist de forma individual.
- El access token viaja en el header `Authorization: Bearer`, nunca en la URL.
- El refresh token viaja en una cookie `HttpOnly; Secure; SameSite=Strict` — no accesible desde JS, resistente a CSRF.
- La **rotación** detecta reutilización: si un refresh token ya invalidado se vuelve a presentar, es señal de robo y se invalidan todas las sesiones del usuario.
- La blacklist en Redis expira automáticamente cuando el access token habría expirado de todas formas — sin cron jobs de limpieza.
- Los refresh tokens expirados se deben limpiar periódicamente de PostgreSQL (`DELETE WHERE expires_at < NOW()`).
- Los inputs se validan con Zod antes de cualquier operación de negocio.

---

## 🏗️ Casos de uso reales

**SPAs y apps móviles con sesiones largas**
El usuario no quiere hacer login cada 15 minutos. El access token de corta duración protege contra robo, y el refresh token mantiene la sesión activa de forma transparente durante días o semanas.

**APIs con requisitos de seguridad elevados**
Bancos, fintechs, plataformas SaaS — necesitan poder invalidar sesiones de forma inmediata (fraude detectado, cambio de contraseña, baja del usuario) sin renunciar a la escalabilidad de JWT. La blacklist de Redis garantiza invalidación instantánea del access token.

**Múltiples dispositivos con control granular**
Al guardar cada refresh token en PostgreSQL con `userAgent` e `ipAddress`, puedes ofrecer al usuario una vista de "sesiones activas por dispositivo" y permitirle cerrarlas individualmente, como hace Google o GitHub.

**Microservicios con gateway de autenticación**
El gateway verifica el access token stateless en cada request (firma JWT + blacklist Redis, sin tocar PostgreSQL). Solo cuando el access token expira y el cliente hace refresh, hay una consulta a PostgreSQL — reduciendo drásticamente la carga.

---

## ⚖️ Comparativa con los métodos anteriores

| | Session Auth (`01`) | JWT (`02`) | JWT + Refresh (`03`) |
|---|---|---|---|
| Estado en servidor | ✅ Redis | ❌ | ✅ PostgreSQL + Redis |
| Invalidación inmediata | ✅ | ❌ | ✅ (blacklist Redis) |
| Consulta a DB por request | ✅ Redis | ❌ | ❌ solo blacklist Redis |
| Escalabilidad horizontal | Requiere Redis | ✅ | ✅ |
| Múltiples dispositivos | ✅ | ❌ | ✅ |
| Sesiones largas sin re-login | ❌ | ❌ | ✅ |
| Complejidad de implementación | Baja | Baja | Media-alta |
| Ideal para | Monolitos | APIs simples | SPAs, móvil, SaaS |

---

## ✅ Cuándo usar este método (y cuándo no)

**Úsalo cuando:**
- Necesitas sesiones largas sin re-login frecuente (apps móviles, SPAs).
- Quieres invalidación inmediata de sesiones manteniendo la escalabilidad de JWT.
- Tienes múltiples dispositivos y quieres control granular por sesión.
- Construyes una API con requisitos de seguridad elevados (fintech, SaaS, salud).

**Evítalo cuando:**
- La simplicidad es prioritaria y los tokens de corta duración son aceptables (`02-jwt-auth`).
- Tu aplicación es un monolito simple donde session-based auth (`01-session-auth`) es suficiente.
- No tienes Redis disponible en tu infraestructura.

---

## 📄 Licencia
© 2026 Israel Luque. Todos los derechos reservados.
