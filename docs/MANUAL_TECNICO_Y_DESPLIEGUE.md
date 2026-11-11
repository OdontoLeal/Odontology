# MANUAL TÉCNICO Y DE DESPLIEGUE: Sistema de Gestión Clínica y Odontológica OdontoLeal
*Versión del Documento: 1.0.0*  
*Área: Ingeniería de Sistemas y Computación*

---

## 1. INTRODUCCIÓN Y ALCANCE TÉCNICO

### 1.1 Objetivo del manual
Establecer la referencia técnica oficial de arquitectura, diseño de datos, contratos de interfaz, estándares de ingeniería, compilación, despliegue en la nube y operación en producción del **Sistema de Gestión Clínica y Odontológica OdontoLeal** (`odontology`).

Este documento está dirigido a:
- **Desarrolladores de Software:** responsables de mantener, extender y depurar los módulos de dominio, contratos de esquema, interfaz React y pruebas automatizadas.
- **Ingenieros DevOps / SRE:** encargados de administrar el pipeline de Integración Continua (GitHub Actions), la plataforma PaaS en Heroku, el aprovisionamiento del complemento **Heroku Postgres**, la configuración de variables de entorno y la gestión de respaldos y registros.
- **Mantenedores y Auditores Técnicos:** responsables de verificar el cumplimiento de controles de acceso basados en roles (RBAC), integridad referencial, inmutabilidad de auditoría y normatividad colombiana de protección de datos personales (Ley 1581 de 2012) e historia clínica (Ley 23 de 1981 y Resolución 1995 de 1999).

### 1.2 Descripción técnica de la solución
**OdontoLeal** es una aplicación web empresarial de arquitectura **monolito modular full-stack** implementada íntegramente en **TypeScript**, orientada a la gestión clínica y administrativa del Consultorio Odontológico Dr. Eduar Leal Álvarez (Tunja, Boyacá).

Desde el punto de vista operativo, un único proceso servidor en **Node.js (`24.13.0`)** con **Express (`5.3.0`)** cumple tres funciones integradas:
1. **Exposición de la API REST (`/api/v1`):** procesa la lógica de negocio, autenticación JWT (`HS256`), control de acceso RBAC dinámico, validación de contratos `jsonb` mediante **Zod (`4.6.7`)** y persistencia transaccional en **PostgreSQL** (`pg`).
2. **Distribución del Frontend SPA:** sirve los activos estáticos compilados con **Vite (`8.3.4`)**, **React (`19.3.1`)** y **Tailwind CSS (`4.3.3`)** desde `dist/public`, con enrutamiento fallback para navegación SPA.
3. **Ejecución de procesos en segundo plano y generación documental en memoria:** ejecuta el planificador interno `CronService` (intervalo de 60 segundos) para cierres automáticos nocturnos, recordatorios de citas 24 horas antes y resúmenes diarios a las 07:00 a. m., además de ensamblar documentos PDF-1.7 en memoria mediante `pdf-lib` y despachar correos transaccionales vía `nodemailer`.

El sistema encapsula su dominio funcional en seis módulos independientes bajo `src/modules/`:

| Módulo | Código | Responsabilidad Técnica |
| :--- | :--- | :--- |
| **Usuarios y Autenticación** | `users-auth` | Gestión de usuarios, RBAC configurable, hash `scrypt`, JWT `HS256`, revocación de sesiones, bloqueo por fuerza bruta, recuperación por token de un solo uso y borradores de sesión. |
| **Agendamiento y Agenda** | `appointments` | Gestión de bloques horarios de 30 minutos (`06:00`–`20:00`), portal público de solicitudes (ventana 5–60 días), revisión de solicitudes, máquina de 7 estados de cita y notificaciones automáticas. |
| **Pacientes y Habeas Data** | `patients` | Registro demográfico, búsqueda normalizada sin tildes/mayúsculas, perfil con segregación clínica por rol y exportación JSON/PDF de datos del titular (Ley 1581 de 2012). |
| **Historia Clínica y Odontograma** | `clinical-records` | Historia clínica única por paciente, evoluciones por consulta con 5 campos `jsonb` validados por Zod, odontograma FDI interactivo (32 piezas permanentes / 20 temporales) y notas aclaratorias inmutables. |
| **Consentimientos Informados** | `consents` | Administración de plantillas versionadas (`PROCEDIMIENTO`, `AUTORIZACION_DATOS`, `MENORES`), interpolación dinámica, firma digital manuscrita (`Base64`), soporte de acudiente y emisión PDF-1.7 en memoria. |
| **Documentos Clínicos** | `clinical-documents` | Generación en memoria (sin almacenamiento en disco) de órdenes farmacológicas (`ORDEN_MEDICAMENTOS`), incapacidades médicas (`INCAPACIDAD`, 1–30 días) y remisiones (`REMISION`) con firma incrustada y fusionada. |

### 1.3 Supuestos y restricciones técnicas
- **Huso horario oficial unificado (`America/Bogota`, UTC-5):** toda lógica de bloques horarios, citas, vencimientos de tokens, recordatorios de 24 horas y cierres automáticos a las 23:59 opera en hora legal de Colombia. La clase `Database` ejecuta `SET TIME ZONE 'America/Bogota'` en cada nueva conexión del pool y registra parsers personalizados en `pg` para los OID `1114` (`TIMESTAMP WITHOUT TIME ZONE`) y `1082` (`DATE`) a fin de evitar conversiones implícitas a UTC por parte del driver.
- **Inmutabilidad legal y auditoría forense en base de datos:** mediante triggers PL/pgSQL definidos en `database/migrations/001_ers_1_3.sql`, las tablas `historia_clinica`, `evolucion`, `nota_evolucion` y `consentimiento_firmado` rechazan toda operación `DELETE`, mientras que `registro_auditoria` rechaza `UPDATE`, `DELETE` y `TRUNCATE`.
- **Sistema de archivos efímero (sin persistencia local en disco):** acorde con la arquitectura de Heroku Dynos, el servidor no almacena archivos PDF, imágenes ni sesiones en el sistema de archivos. Las firmas se persisten como `text` / `Base64` en PostgreSQL (límite máximo de 2 MB para firmas de profesionales; límite global de body JSON de `5mb` en Express) y todos los PDFs se construyen y transmiten en memoria (`Uint8Array` / `Base64`).
- **Alineación con la especificación ERS v1.3:** no existe firma remota por enlace o código QR (`RF-CON-006`) ni consulta histórica de documentos clínicos emitidos (`RF-DOC-005`). Asimismo, existe una excepción operativa temporal documentada en `MODIFICACION_TEMPORAL_ATENCION_MISMO_DIA.md` que permite iniciar atención (`Confirmada` → `En consulta`) en citas de cualquier fecha mientras se encuentre vigente el periodo de pruebas/atención extemporánea.
- **Topología de proceso único para tareas programadas:** `CronService.start()` se inicializa dentro del proceso web (`src/app/server.ts`). Si la aplicación escala horizontalmente a múltiples dynos web en Heroku, debe extraerse `CronService` a un *Worker Dyno* dedicado o *Heroku Scheduler* para evitar contención innecesaria de consultas cada minuto (aunque `send24HourReminders` y `sendDailyDigest` mantienen control idempotente en PostgreSQL).
- **Dependencia estricta de versión de runtime:** `package.json` fija `"engines": { "node": "=24.13.0", "npm": ">=10.0.0" }`, por lo que Heroku y los entornos locales deben utilizar Node.js `24.13.0`.

---

## 2. ARQUITECTURA DEL SISTEMA

### 2.1 Patrón de arquitectura seleccionado y justificación técnica
El sistema adopta una combinación de dos patrones arquitectónicos complementarios:

1. **En nivel macro (Despliegue): Monolito Modular (`Modular Monolith`).**
   - **Implementación:** un único artefacto ejecutable (`dist/app/server.js`) sirve tanto la API REST (`/api/v1`) como los activos estáticos del cliente SPA (`dist/public`).
   - **Justificación técnica:** elimina la latencia de red entre capas HTTP separadas, simplifica la política CORS al compartir el mismo origen en producción, reduce la superficie operativa en Heroku (un único Dyno web más un add-on PostgreSQL) y mantiene un despliegue atómico sincronizado entre frontend y backend.

2. **En nivel interno (Diseño de software): Arquitectura Limpia (*Clean Architecture*) + Diseño Guiado por el Dominio (*DDD*) + Puertos y Adaptadores (*Hexagonal*).**
   - **Implementación:** cada módulo en `src/modules/<modulo>/` separa estrictamente cuatro subcapas (`domain/`, `application/`, `infrastructure/`, `ui/`) gobernadas por la regla de dependencia hacia el centro:
     - `domain/`: entidades ricas (`UserEntity`, `RoleEntity`, `AppointmentEntity`, `Patient`, `ClinicalRecordEntity`, `PrescriptionEntity`, etc.), objetos de valor (`OneTimeTokenVO`, `AuthorshipMetadata`), errores de dominio e interfaces de repositorio (`*.repository.interface.ts` / `*.port.ts`). No depende de Express ni de PostgreSQL.
     - `application/`: casos de uso (`*.use-case.ts`), políticas de acceso (`ClinicalAccessPolicy`) y servicios de aplicación (`ConsentService`, `ClinicalDocumentPdfGeneratorService`, `EmbedProfessionalSignatureService`).
     - `infrastructure/`: controladores HTTP (`*.controller.ts`), repositorios PostgreSQL (`*.repository.ts`), modelos de fila (`*.model.ts`) y adaptadores hacia el kernel compartido (`src/shared/`).
     - `ui/`: vistas React, componentes de presentación, hooks personalizados y barrares de exportación por módulo.
   - **Justificación técnica:** permite sustituir los repositorios PostgreSQL por implementaciones en memoria (`InMemory*`) en las pruebas automatizadas (114 casos de prueba ejecutables sin instancia de base de datos), garantiza la aplicación práctica de los principios **SOLID** (SRP, OCP mediante catálogos y roles configurables, LSP en repositorios, ISP en puertos dedicados, DIP en casos de uso) y aísla las reglas clínico-legales de los cambios de framework o transporte.

### 2.2 Diagrama de Arquitectura General

<!-- ESPACIO RESERVADO PARA DIAGRAMA: Arquitectura General del Sistema -->

**Descripción técnica del diagrama:** El diagrama debe representar la topología integral del sistema en tiempo de ejecución, mostrando cómo los clientes web (navegadores de escritorio para personal clínico/administrativo y dispositivos táctiles/móviles para pacientes o firma en consultorio) se comunican sobre HTTPS con el Router de Heroku, el cual realiza la terminación TLS y reenvía el tráfico al Dyno Web de Node.js/Express. Dentro del Dyno deben distinguirse los middlewares transversales, el enrutador `/api/v1`, el servidor de archivos estáticos SPA (`dist/public`), los seis módulos de dominio, el generador PDF en memoria (`pdf-lib`) y el planificador `CronService`, así como las conexiones externas salientes hacia el Add-on **Heroku Postgres** (vía `pg.Pool` con SSL) y el servidor **SMTP** externo (Gmail, Brevo/Resend o Ethereal).

```mermaid
flowchart TB
    subgraph Clientes["Capa de Presentacion (Clientes Web)"]
        BrowserStaff["Navegador Clinico y Administrativo\n(React 19 SPA / Tailwind CSS 4)"]
        BrowserPublic["Portal Publico de Pacientes\n(Agendamiento y Aviso de Privacidad)"]
    end

    subgraph HerokuRouter["Capa de Borde y Enrutamiento (Heroku)"]
        Router["Heroku Router\n(Terminacion SSL/TLS + X-Forwarded-Proto)"]
    end

    subgraph WebDyno["Dyno Web Heroku (node dist/app/server.js - Puerto $PORT)"]
        Express["Servidor Express 5.3.0\n(trust proxy, CORS, JSON 5MB)"]
        SPAStatic["Servidor Estatico SPA\n(dist/public + Fallback GET)"]
        Middlewares["Seguridad y Auditoria\n(authMiddleware JWT HS256 + requirePermission RBAC)"]
        ApiRouter["Enrutador REST /api/v1\n(y alias /api/users-auth)"]

        subgraph DomainModules["Modulos de Dominio (Clean Architecture / DDD)"]
            ModA["users-auth\n(Usuarios, RBAC, Sesion)"]
            ModB["appointments\n(Agenda y Solicitudes)"]
            ModC1["patients\n(Ficha y Habeas Data)"]
            ModC2["clinical-records\n(Historia y Odontograma)"]
            ModD["consents\n(Plantillas y Firmas)"]
            ModE["clinical-documents\n(Ordenes, Incapacidades, Remisiones)"]
        end

        ZodSSOT["Contratos Zod SSOT\n(src/schemas/*.schema.ts)"]
        PdfEngine["Motor PDF en Memoria\n(pdf-lib PDF-1.7)"]
        Cron["CronService\n(Intervalo 60s en memoria)"]
    end

    subgraph DataAndExternal["Persistencia y Servicios Externos"]
        PG[("Add-on Heroku Postgres\n(PostgreSQL 15+ / JSONB / Triggers\nZona horaria America/Bogota)")]
        SMTP["Servidor SMTP Externo\n(Gmail / SMTP Generico / Ethereal)"]
    end

    BrowserStaff -->|"HTTPS / JSON + Bearer JWT + Cookie HttpOnly"| Router
    BrowserPublic -->|"HTTPS / JSON"| Router
    Router -->|"HTTP + X-Forwarded-*"| Express

    Express --> SPAStatic
    Express --> ApiRouter
    ApiRouter --> Middlewares
    Middlewares --> DomainModules

    DomainModules --> ZodSSOT
    ModD --> PdfEngine
    ModE --> PdfEngine
    ModC1 --> PdfEngine
    Cron --> ModB
    Cron -->|"nodemailer"| SMTP
    DomainModules -->|"nodemailer"| SMTP
    DomainModules -->|"pg.Pool max 15 conexiones (SSL)"| PG
    Cron -->|"Transacciones Sistema"| PG
```

### 2.3 Diagrama de Componentes (UML)

<!-- ESPACIO RESERVADO PARA DIAGRAMA: Diagrama de Componentes (UML) -->

**Descripción técnica del diagrama:** El diagrama debe ilustrar la segregación estricta de responsabilidades entre las cuatro capas lógicas del software: la capa de **Interfaz de Usuario (UI)** en React (`App.tsx`, vistas por módulo, hooks con interceptor `fetch` y componentes compartidos), la capa de **API y Seguridad** (`api.routes.ts`, middlewares de autenticación/RBAC y manejador centralizado de errores HTTP), la capa de **Aplicación y Dominio** (casos de uso, políticas clínicas, entidades, puertos e integradores de esquemas Zod), y la capa de **Infraestructura y Persistencia** (repositorios SQL, singleton `Database`, `AuditLogService`, `MailerService` y `CronService`).

```mermaid
flowchart LR
    subgraph CapaUI["Capa UI (React 19 + Vite 8)"]
        MainFetch["main.tsx\n(Interceptor Authorization Bearer)"]
        AppShell["App.tsx + InternalDashboardLayout"]
        Views["Vistas y Hooks por Modulo\n(src/modules/*/ui)"]
        SharedUI["Componentes Shared UI\n(Modal, Table, Pagination, Toast)"]
        MainFetch --> AppShell --> Views
        Views --> SharedUI
    end

    subgraph CapaAPI["Capa API HTTP y Seguridad (Express 5)"]
        Routes["api.routes.ts\n(/api/v1/*)"]
        AuthMW["authMiddleware + requirePermission\n(access-control.ts / token.service.ts)"]
        ErrHandler["http-error.handler.ts\n(handleHttpError / handleRequestError)"]
        Controllers["Controladores REST\n(src/modules/*/infrastructure/*.controller.ts)"]
        Routes --> AuthMW --> Controllers
        Controllers --> ErrHandler
    end

    subgraph CapaAppDom["Capa de Aplicacion y Dominio"]
        UseCases["Casos de Uso y Servicios\n(src/modules/*/application)"]
        Policies["Politicas y Validadores\n(ClinicalAccessPolicy, StateValidator)"]
        Entities["Entidades y Value Objects\n(src/modules/*/domain)"]
        Ports["Interfaces de Puertos/Repositorios\n(*.repository.interface.ts / *.port.ts)"]
        Schemas["Contratos Zod SSOT\n(src/schemas/*.schema.ts)"]
        UseCases --> Policies
        UseCases --> Entities
        UseCases --> Ports
        UseCases --> Schemas
    end

    subgraph CapaInfra["Capa de Infraestructura y Kernel Compartido"]
        Repos["Repositorios PostgreSQL\n(*.repository.ts)"]
        DBSingleton["Database Pool Singleton\n(database.ts / migrate.ts)"]
        AuditSvc["AuditLogService\n(audit-log.service.ts)"]
        MailerSvc["MailerService\n(mailer.service.ts)"]
        PdfSvc["Generadores PDF\n(pdf-lib)"]
        CronSvc["CronService\n(cron.service.ts)"]
        Repos -.->|"Implementa"| Ports
        Repos --> DBSingleton
        Repos --> AuditSvc
        AuditSvc --> DBSingleton
        UseCases --> PdfSvc
        Controllers --> MailerSvc
        CronSvc --> DBSingleton
        CronSvc --> MailerSvc
    end

    Views -->|"HTTP JSON /api/v1"| Routes
    Controllers --> UseCases
    Controllers --> Repos
```

### 2.4 Flujo de datos y comunicación entre módulos

#### Flujo de una petición autenticada estándar (Request-Response Lifecycle)
1. **Cliente (`src/main.tsx`):** el interceptor global sobrescribe `window.fetch`, recupera el JWT desde `window.sessionStorage` (`odontoleal_jwt_token` o `odontoleal_active_session_v1`), habilita `credentials: 'include'` (para enviar la cookie `session_token`) e inyecta la cabecera `Authorization: Bearer <token>`.
2. **Capa Express (`src/app/server.ts`):** evalúa la política CORS dinámica contra orígenes locales, `*.herokuapp.com`, el host actual y `FRONTEND_URL`, parsea cuerpos JSON hasta `5mb` y despacha la petición a `/api/v1`.
3. **Autenticación y RBAC (`authMiddleware` + `requirePermission`):**
   - `extractToken(req)` extrae el token desde la cabecera `Authorization: Bearer` o la cookie `session_token`.
   - `JwtTokenService.verifyToken(token)` valida firma `HS256` mediante `crypto.timingSafeEqual` y vigencia (`exp`).
   - `isTokenRevoked(token)` calcula el hash SHA-256 del token y verifica en `public.sesion_revocada` que la sesión no haya sido cerrada.
   - `loadActiveSessionUser(idUsuario)` consulta en PostgreSQL el estado vigente del usuario (`estado = true AND es_sistema = false`) junto con la unión de sus roles activos (`usuario_rol`) y códigos de permisos (`rol.permisos`). De este modo, cualquier cambio de rol o inactivación surte efecto inmediato en la siguiente petición sin esperar la expiración del JWT.
   - `requirePermission(...permisos)` comprueba si el usuario posee al menos uno de los códigos funcionales requeridos; en caso contrario invoca `recordBlockedAccess()` (insertando en `registro_auditoria` con acción `ACCESO_BLOQUEADO`) y retorna HTTP `403` con el mensaje único `"No tiene permiso para realizar esta acción"`.
4. **Controlador, Aplicación y Persistencia:** el controlador resuelve la identidad del actor exclusivamente desde `getSessionUser(req)` (ignorando campos manipulables del cuerpo), invoca los casos de uso o repositorios, valida estructuras `jsonb` contra los esquemas Zod (`src/schemas/`), ejecuta operaciones SQL parametrizadas dentro de `db.withTransaction(...)` e inserta el registro de auditoría en la misma transacción.
5. **Manejo de errores (`handleRequestError` / `handleHttpError`):** traduce errores `403` (registrando auditoría de acceso bloqueado), mapea códigos PostgreSQL `23505` (unicidad) y `22001` (longitud excedida) a respuestas `400` legibles, y oculta fallos internos de red o SQL bajo un mensaje genérico `500`.

#### Comunicación entre módulos desacoplados
- **Puertos compartidos y APIs de módulo:** los archivos `index.ts` en `appointments`, `clinical-records`, `patients`, `users-auth` y `clinical-documents` exponen sus interfaces públicas (por ejemplo `IClinicalRecordCheckerPort`, `IAppointmentStatePort`, `IAuditLoggerPort`).
- **Auditoría transversal (`src/shared/infrastructure/audit/`):** `AuditLogService` expone el puerto `IAuditLog` (`src/shared/domain/audit.port.ts`) y `UsersAuditAdapter` adapta dicho puerto al contrato específico `IAuditLoggerPort` de `users-auth`.
- **Sincronización clínica entre Agenda e Historia Clínica:** al intentar finalizar una consulta (`En consulta` → `Atendida`), `AppointmentRepository` consulta la existencia de apertura (`evolucion.motivo_consulta`) asociada a `id_cita`; de manera inversa, `ClinicalRecordsController` y `ClinicalDocumentsController` consultan el contexto de la cita (`idProfesional`, `estado`, `idPaciente`) para aplicar `ClinicalAccessPolicy` y `EmbedProfessionalSignatureService`.
- **Procesos automáticos (`CronService`):** cada 60 segundos ejecuta secuencialmente 5 tareas bajo el usuario técnico `Sistema` (`es_sistema = true`): `cancelUnmanagedRequests`, `markUnstartedAsNoShow`, `closeOpenConsultations`, `send24HourReminders` y `sendDailyDigest`.

---

## 3. FICHA TÉCNICA Y STACK TECNOLÓGICO

### 3.1 Tabla detallada de tecnologías

| Categoría | Tecnología / Paquete | Versión Exacta (`package.json`) | Rol en el Sistema | Licencia |
| :--- | :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | `=24.13.0` (`engines.node`) | Entorno de ejecución JavaScript del servidor y scripts CLI | MIT |
| **Gestor de Paquetes** | npm | `>=10.0.0` (`engines.npm`) | Gestión de dependencias (`package-lock.json`) y scripts | Artistic-2.0 |
| **Lenguaje** | TypeScript | `^5.8.2` | Tipado estático estricto en Backend, Frontend y Esquemas | Apache-2.0 |
| **Backend HTTP** | Express | `^5.3.0` | Framework REST API, middlewares y servidor de archivos SPA | MIT |
| **Middleware CORS** | `cors` | `^2.8.6` | Control de orígenes permitidos y credenciales cross-origin | MIT |
| **Configuración** | `dotenv` | `^18.0.8` | Carga de variables de entorno desde `.env` en desarrollo/CLI | BSD-2-Clause |
| **Frontend UI** | React / React DOM | `^19.3.1` | Construcción de vistas SPA reactivas y componentes modulares | MIT |
| **Bundler / Dev Server** | Vite + `@vitejs/plugin-react` | `^8.3.4` / `^6.1.2` | Compilación de producción (`dist/public`) y proxy de desarrollo | MIT |
| **Estilos CSS** | Tailwind CSS + `@tailwindcss/vite` | `^4.3.3` | Framework CSS utility-first con tokens de diseño en `src/index.css` | MIT |
| **Base de Datos** | PostgreSQL | `15` o superior (Heroku Postgres) | Motor RDBMS transaccional, almacenamiento `jsonb`, índices y triggers | PostgreSQL |
| **Driver BD** | `pg` (`node-postgres`) | `^8.23.1` | Pool de conexiones TCP/TLS (`max: 15`) y ejecución parametrizada | MIT |
| **Validación / SSOT** | `zod` | `^4.6.7` | Validación de contratos `jsonb` clínicos y permisos RBAC | MIT |
| **Generación PDF** | `pdf-lib` | `^1.17.1` | Construcción binaria PDF-1.7 en memoria con firmas incrustadas | MIT |
| **Correo Electrónico** | `nodemailer` | `^10.1.7` | Cliente SMTP para Gmail, proveedores SMTP y sandbox Ethereal | MIT-0 |
| **Ejecución TS / Tests** | `tsx` | `^4.23.15` | Transpilación al vuelo (`tsx watch`), migraciones y runner `tsx --test` | MIT |
| **Linter** | ESLint + `typescript-eslint` + `@eslint/js` | `^10.14.0` / `^8.72.1` / `^10.0.1` | Análisis estático Flat Config (`eslint.config.mjs`) | MIT |
| **Formateador** | Prettier + `eslint-config-prettier` | `^3.9.10` / `^10.1.8` | Estandarización de formato de código fuente (`.prettierrc`) | MIT |
| **CI / CD** | GitHub Actions | `actions/checkout@v4`, `setup-node@v4` | Validación automática de tipos, lint, build y 114 pruebas | MIT |
| **Cloud PaaS** | Heroku (Node.js Buildpack) | Stack `heroku-24` (PaaS) | Alojamiento web (`Procfile`), TLS router y add-on Heroku Postgres | Comercial |

> **Nota técnica de criptografía y pruebas:** El sistema utiliza exclusivamente los módulos nativos de Node.js `node:crypto` (`scryptSync`, `randomBytes`, `createHmac`, `createHash`, `timingSafeEqual`) para hashing de contraseñas y firma/verificación JWT, y el runner nativo `node:test` invocado mediante `tsx --test`, evitando dependencias externas de hashing nativo (`bcrypt`) que requieren compilación C++ en despliegues multiplataforma.

### 3.2 Gestores de paquetes y dependencias críticas del proyecto
El proyecto utiliza **npm** con bloqueo determinista mediante `package-lock.json` y configuración `"type": "commonjs"` en `package.json`. Todos los scripts operativos del ciclo de vida están centralizados en un único `package.json` en la raíz:

| Script (`npm run <script>`) | Comando Subyacente | Función Operativa |
| :--- | :--- | :--- |
| `dev` | `tsx watch src/app/server.ts` | Inicia el servidor Express en modo observación con recarga automática ante cambios en `src/`. |
| `build` | `tsc && vite build` | Compila el backend TypeScript hacia `dist/` y empaqueta el frontend React/Vite hacia `dist/public/`. |
| `heroku-postbuild` | `npm run build` | Hook ejecutado automáticamente por el buildpack de Heroku tras instalar dependencias de producción/compilación. |
| `start` | `node dist/app/server.js` | Arranca el servidor compilado de producción (usado en `Procfile`). |
| `test` | `tsx --test src/**/__tests__/*.test.ts` | Ejecuta las **14 suites y 114 pruebas** automatizadas unitarias e integradas. |
| `db:migrate` / `db:init` | `tsx src/shared/infrastructure/database/migrate.ts` | Aplica migraciones SQL pendientes de `database/migrations/`. |
| `lint` | `eslint src` | Verifica reglas estáticas en todo `src/**/*.{ts,tsx}`. |
| `lint:fix` | `eslint src --fix` | Corrige automáticamente advertencias y errores corregibles de ESLint. |
| `format` | `prettier --write "src/**/*.{ts,tsx,css,json,md}"` | Aplica el formato oficial a todo el código fuente. |
| `format:check` | `prettier --check "src/**/*.{ts,tsx,css,json,md}"` | Comprueba cumplimiento de formato sin modificar archivos. |

### 3.3 Requisitos mínimos y recomendados del sistema

| Componente | Entorno de Desarrollo Local (Mínimo) | Entorno de Desarrollo Local (Recomendado) | Entorno de Producción (Heroku PaaS) |
| :--- | :--- | :--- | :--- |
| **Sistema Operativo** | Windows 10 (64-bit), macOS 13+ o Ubuntu 22.04+ | Windows 11, macOS 14+ o Ubuntu 24.04 LTS | Linux Contenerizado Heroku Stack (`heroku-24`) |
| **Procesador (CPU)** | 2 núcleos x86_64 o ARM64 (2.0 GHz) | 4+ núcleos x86_64 o ARM64 | 1x vCPU compartida (Dyno `Basic`) o dedicada (`Standard-1X`/`2X`) |
| **Memoria RAM** | 4 GB (compilación `tsc` + `vite` + Postgres local) | 8 GB o superior | 512 MB mínimo (`Basic` / `Eco`); 1 GB recomendado (`Standard-2X` para concurrencia de PDFs y pool) |
| **Almacenamiento** | 1.5 GB libres (código, `node_modules`, `dist/`, Postgres) | 5 GB SSD libres | Sistema efímero Dyno (~1 GB); Add-on Heroku Postgres `Essential-0` (1 GB) o `Standard-0` (64 GB) |
| **Base de Datos** | PostgreSQL 15.x local | PostgreSQL 16.x local | Add-on **Heroku Postgres** (TLS obligatorio) |
| **Red y Puertos** | Acceso local a puertos `4000` (API), `5173` (Vite), `5432` (PG) | Igual + salida TCP `587`/`465` para pruebas SMTP | Puerto dinámico `$PORT` inyectado por Heroku; salida TLS hacia Postgres y SMTP |

---

## 4. GUÍA DE INSTALACIÓN Y CONFIGURACIÓN LOCAL (STEP-BY-STEP)

### 4.1 Requisitos previos
Antes de iniciar la configuración local, verificar que las siguientes herramientas estén instaladas y disponibles en el `PATH` del sistema:

```bash
# 1. Verificar Node.js (el proyecto exige exactamente v24.13.0 en engines; compatible en rango >=20.x/24.x)
node -v

# 2. Verificar npm (requiere >= 10.0.0)
npm -v

# 3. Verificar cliente y servidor PostgreSQL (versión 15 o superior)
psql --version

# 4. Verificar Git
git --version
```

Si se gestionan múltiples versiones de Node.js localmente (por ejemplo con `nvm` o `nvm-windows`), instalar y activar la versión exacta declarada en `package.json`:

```bash
nvm install 24.13.0
nvm use 24.13.0
```

### 4.2 Clonación y estructura del repositorio
Clonar el repositorio oficial de GitHub y posicionarse en la rama de desarrollo o principal según el flujo requerido:

```bash
git clone https://github.com/OdontoLeal/Odontology.git
cd Odontology

# Opcional: cambiar a la rama de integración 'dev' si se trabajará en nuevas características
git checkout dev
```

El repositorio contiene en su raíz los manifiestos de compilación (`package.json`, `tsconfig.json`, `vite.config.ts`), despliegue (`Procfile`), calidad (`eslint.config.mjs`, `.prettierrc`), migraciones (`database/migrations/`), documentación (`docs/`) y código fuente unificado (`src/`).

### 4.3 Configuración de variables de entorno
El repositorio no incluye actualmente un archivo `.env.example` versionado en la raíz; por ello, las variables oficiales han sido consolidadas directamente a partir de `src/app/config/env.config.ts`, `src/shared/infrastructure/database/migrate.ts`, `src/shared/infrastructure/security/token.service.ts` y `src/shared/infrastructure/mail/mailer.service.ts`.

Crear el archivo `.env` en la raíz del proyecto (`Odontology/.env`):

```bash
# Linux / macOS
touch .env

# Windows PowerShell
New-Item -Path .env -ItemType File -Force
```

Completar `.env` utilizando la siguiente plantilla con marcadores de posición:

```env
# ==============================================================================
# SERVIDOR Y ENTORNO
# ==============================================================================
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# ==============================================================================
# SEGURIDAD Y AUTENTICACIÓN (Obligatorio en producción)
# ==============================================================================
JWT_SECRET=<TU_SECRETO_JWT_DE_ALTA_ENTROPIA_MIN_32_CHARS>

# ==============================================================================
# BASE DE DATOS POSTGRESQL
# Usar DATABASE_URL o bien las variables individuales DB_*
# ==============================================================================
DATABASE_URL=postgres://<TU_USUARIO_DB>:<TU_PASSWORD_DB>@localhost:5432/odontoleal
DB_HOST=localhost
DB_PORT=5432
DB_NAME=odontoleal
DB_USER=<TU_USUARIO_DB>
DB_PASSWORD=<TU_PASSWORD_DB>
DB_SSL=false

# ==============================================================================
# CORREO ELECTRÓNICO (Prioridad 1: Gmail App Password | Prioridad 2: SMTP | 3: Ethereal)
# ==============================================================================
# Opción A: Gmail directo
# GMAIL_USER=<TU_CUENTA_GMAIL>
# GMAIL_APP_PASSWORD=<TU_APP_PASSWORD_DE_16_CARACTERES>

# Opción B: SMTP estándar (Brevo, Resend, Outlook, Mailtrap, etc.)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<TU_USUARIO_SMTP>
SMTP_PASS=<TU_PASSWORD_SMTP>
EMAIL_FROM="Consultorio OdontoLeal" <notificaciones@odontoleal.com>
```

#### Diccionario exhaustivo de variables de entorno

| Clave | Obligatoria | Valor por Defecto en Código | Descripción Técnica y Uso en Código |
| :--- | :--- | :--- | :--- |
| `PORT` | No | `4000` | Puerto TCP en el que escucha Express (`env.config.ts`) y al cual apunta el proxy de Vite (`vite.config.ts`). En Heroku lo inyecta la plataforma automáticamente. |
| `NODE_ENV` | No | `'development'` | Define el modo de ejecución (`development`, `production`, `test`). En `production`, exige `JWT_SECRET`, activa `Secure` en la cookie `session_token` y activa detección de BD remota en `migrate.ts`. |
| `FRONTEND_URL` | No | `'http://localhost:5173'` | URL pública permitida explícitamente en la lista blanca CORS (`server.ts`) y URL base usada para construir el enlace de recuperación de contraseña (`?token=...`). |
| `JWT_SECRET` | Sí (Prod) | `'odontoleal-jwt-signing-secret-solo-desarrollo'` (solo dev) | Llave secreta HMAC-SHA256 para firmar y verificar JWT (`JwtTokenService`). En `NODE_ENV=production` lanza una excepción fatal si está ausente. |
| `DATABASE_URL` | Condicional | `undefined` | URI completa de conexión PostgreSQL (`postgres://user:pass@host:port/db`). Si está definida, tiene prioridad sobre `DB_HOST`/`DB_NAME`/`DB_*` en `Database` y `migrate.ts`. |
| `DB_HOST` | Condicional | `'localhost'` (en `migrate.ts`) | Host del servidor PostgreSQL cuando no se provee `DATABASE_URL`. |
| `DB_PORT` | No | `5432` | Puerto TCP de PostgreSQL. |
| `DB_NAME` | Condicional | `'odontoleal'` (en `migrate.ts`) | Nombre de la base de datos lógica en PostgreSQL. |
| `DB_USER` | Condicional | `'postgres'` (en `migrate.ts`) | Usuario de conexión a PostgreSQL. |
| `DB_PASSWORD` | Condicional | `'postgres'` (en `migrate.ts`) | Contraseña del usuario PostgreSQL. |
| `DB_SSL` | No | `true` (en `env.config.ts`: `!== 'false'`) | Controla TLS hacia PostgreSQL. **Importante:** en local sin TLS debe establecerse explícitamente `DB_SSL=false` para `Database`; en `migrate.ts`, se activa SSL si `DB_SSL === 'true'` o si el host es remoto (`amazonaws.com`, `herokuapp.com`, `rds.`). |
| `GMAIL_USER` | No | `undefined` | Cuenta Gmail para envío directo con Nodemailer (`service: 'gmail'`). Tiene prioridad 1 sobre `SMTP_HOST`. |
| `GMAIL_PASS` / `GMAIL_APP_PASSWORD` | No | `undefined` | Contraseña de aplicación de Google (el servicio elimina espacios automáticamente). `GMAIL_PASS` tiene precedencia sobre `GMAIL_APP_PASSWORD`. |
| `SMTP_HOST` | No | `undefined` | Host del servidor SMTP genérico (Prioridad 2 si no hay credenciales Gmail). Si no hay credenciales Gmail ni SMTP, `MailerService` crea una cuenta temporal gratuita en `smtp.ethereal.email`. |
| `SMTP_PORT` | No | `587` | Puerto del servidor SMTP (`587` STARTTLS, `465` SSL implícito). |
| `SMTP_SECURE` | No | `false` (`true` si `port === 465`) | Activa TLS directo al conectar con el servidor SMTP. |
| `SMTP_USER` | No | `undefined` | Usuario de autenticación SMTP. |
| `SMTP_PASS` | No | `undefined` | Contraseña o API Key de autenticación SMTP. |
| `EMAIL_FROM` / `SMTP_FROM` | No | `'"Consultorio OdontoLeal" <notificaciones@odontoleal.com>'` | Remitente mostrado en los correos transaccionales (`EMAIL_FROM` tiene prioridad sobre `SMTP_FROM` en `MailerService`). |

### 4.4 Instalación de dependencias
Dado que el backend y el frontend residen en un mismo proyecto TypeScript con un único `package.json`, todas las dependencias de servidor, cliente y herramientas de compilación se instalan mediante un solo comando:

```bash
# Instalación limpia respetando exactamente las versiones de package-lock.json (recomendado)
npm ci

# Alternativa para entornos de desarrollo donde se agreguen paquetes
npm install
```

### 4.5 Preparación de la base de datos
1. **Crear la base de datos local en PostgreSQL:**

```bash
# Conectarse al motor PostgreSQL local como superusuario
psql -U postgres -h localhost -c "CREATE DATABASE odontoleal WITH ENCODING 'UTF8';"
```

2. **Verificar el estado de las migraciones pendientes:**

```bash
npm run db:migrate -- --status
```

3. **Ejecutar el migrador versionado:**
El script `src/shared/infrastructure/database/migrate.ts` crea la tabla de control `public.schema_migrations` y aplica en orden alfabético (`000_baseline.sql`, `001_ers_1_3.sql`) cada archivo SQL dentro de una transacción con zona horaria `America/Bogota`:

```bash
# En base de datos local
npm run db:migrate

# Equivalente alias disponible en package.json
npm run db:init
```

4. **Carga opcional de datos de prueba (Seeding):**
El repositorio incluye `src/shared/infrastructure/database/seeds/seed-agenda.ts` para poblar roles, usuarios de prueba, pacientes de ejemplo y bloques/citas de demostración.
> **Advertencia:** `seed-agenda.ts` instancia un `Pool` con `ssl: { rejectUnauthorized: false }` y `connectionString: process.env.DATABASE_URL`. Si la base de datos local de PostgreSQL no tiene SSL habilitado, utilizar una conexión compatible con TLS o ajustar temporalmente la opción `ssl` al ejecutarlo en local.

```bash
# Ejecutar semilla de datos de demostración (requiere BD con soporte SSL o ajuste local)
npx tsx src/shared/infrastructure/database/seeds/seed-agenda.ts
```

5. **Creación de un usuario administrador inicial (si no se ejecuta el seed):**
Si se parte de una base de datos limpia únicamente con migraciones, insertar un rol inicial `ROL-ADM` y un usuario administrador activo (generando el hash `scrypt$` con Node.js):

```bash
# Generar hash scrypt compatible con HybridPasswordHasherService
node -e "const c=require('crypto'); const s=c.randomBytes(16).toString('hex'); const k=c.scryptSync('<TU_PASSWORD_INICIAL>', s, 64).toString('hex'); console.log('scrypt$' + s + '$' + k);"
```

### 4.6 Puesta en marcha en modo desarrollo
En desarrollo local, el backend y el servidor de desarrollo frontend (Vite con HMR) se ejecutan en procesos paralelos para habilitar recarga en caliente en ambas capas:

```bash
# Terminal 1: Iniciar Backend API + CronService (puerto definido en PORT, por defecto 4000)
npm run dev

# Terminal 2: Iniciar Frontend React + Tailwind CSS con Vite (puerto 5173 con proxy /api/v1 -> localhost:4000)
npx vite
```

**Puertos predeterminados en desarrollo:**
- **Frontend SPA (Vite Dev Server):** `http://localhost:5173` (intercepta y redirige `/api/v1/*` hacia `http://localhost:${PORT || 4000}`).
- **Backend API (Express):** `http://localhost:4000/api/v1` (o el puerto asignado en `.env` mediante `PORT`).
- **Healthcheck local:** `http://localhost:4000/api/v1/health`.

Si se desea probar localmente el comportamiento exacto de producción (monolito compilado sirviendo `dist/public` desde Express):

```bash
npm run build
npm start
# Disponible íntegramente en http://localhost:4000 (o el valor de PORT)
```

---

## 5. MODELO DE DATOS Y PERSISTENCIA

### 5.1 Diagrama Entidad-Relación (DER)

<!-- ESPACIO RESERVADO PARA DIAGRAMA: Diagrama Entidad-Relación (DER) -->

**Descripción técnica del diagrama:** El diagrama debe representar las 20 tablas operativas del esquema `public` (más la tabla de control `schema_migrations`), reflejando la cardinalidad exacta entre usuarios y roles (`usuario_rol`), la gestión de seguridad (`intento_login`, `token_recuperacion`, `sesion_revocada`, `borrador_sesion`), la agenda única por bloques de 30 minutos (`bloques_horario`, `solicitud_cita`, `historial_solicitud`, `cita`, `bloques_citas`, `historial_cita`), la ficha de paciente y su historia clínica única (`paciente`, `historia_clinica`, `evolucion`, `nota_evolucion`), el módulo de consentimientos versionados (`plantilla_consentimiento`, `consentimiento_firmado`) y el registro append-only de auditoría (`registro_auditoria`).

```mermaid
erDiagram
    rol ||--o{ usuario_rol : "asignado en"
    usuario ||--o{ usuario_rol : "posee"
    usuario ||--o{ sesion_revocada : "revoca"
    usuario ||--o{ borrador_sesion : "guarda"
    usuario ||--o{ registro_auditoria : "origina"
    usuario ||--o{ plantilla_consentimiento : "modifica"
    usuario ||--o{ historial_solicitud : "gestiona"
    usuario ||--o{ historial_cita : "gestiona"
    usuario ||--o{ cita : "atiende"
    usuario ||--o{ consentimiento_firmado : "diligencia"
    usuario ||--o{ evolucion : "abre"
    usuario ||--o{ nota_evolucion : "registra"

    paciente ||--|| historia_clinica : "tiene una"
    paciente ||--o{ cita : "programa"
    paciente ||--o{ consentimiento_firmado : "suscribe"

    bloques_horario ||--o{ solicitud_cita : "reservado por"
    bloques_horario ||--o{ bloques_citas : "ocupa"
    cita ||--o{ bloques_citas : "compuesta por"
    cita ||--o{ historial_cita : "traza cambios"
    cita ||--o| evolucion : "documenta"

    solicitud_cita ||--o{ historial_solicitud : "traza revision"
    plantilla_consentimiento ||--o{ solicitud_cita : "autoriza datos"
    plantilla_consentimiento ||--o{ consentimiento_firmado : "instancia"

    historia_clinica ||--o{ evolucion : "contiene"
    evolucion ||--o{ nota_evolucion : "anexa"

    rol {
        smallserial id_rol PK
        varchar codigo_rol UK
        varchar nombre_rol UK
        jsonb permisos
        boolean es_inicial
    }

    usuario {
        integer id_usuario PK
        varchar documento_identidad UK
        varchar correo UK
        varchar nombre_completo
        varchar contrasena_hash
        boolean es_contrasena_temporal
        boolean es_sistema
        boolean estado
    }

    paciente {
        integer id_paciente PK
        varchar documento_identidad UK
        varchar nombre_completo
        date fecha_nacimiento
        varchar sexo
        varchar correo
        varchar telefono
    }

    bloques_horario {
        timestamp inicio PK
        timestamp final
        boolean estado
        boolean ocupacion
    }

    solicitud_cita {
        integer id_solicitud PK
        varchar documento_solicitante
        timestamp bloque_solicitado FK
        integer id_plantilla_autorizacion FK
        boolean estado
    }

    cita {
        integer id_cita PK
        integer id_paciente FK
        integer id_usuario FK
        varchar titulo
        varchar estado
        varchar recordatorio_estado
    }

    historia_clinica {
        integer id_historia PK
        integer id_paciente FK "UNIQUE"
        timestamp fecha_creacion
    }

    evolucion {
        integer id_evolucion PK
        integer id_historia FK
        integer id_cita FK "UNIQUE"
        integer id_usuario_diligencio FK
        jsonb antecedentes_clinicos
        jsonb habitos_higiene
        jsonb examen_estomatognatico
        jsonb odontograma
        jsonb plan_manejo
    }

    nota_evolucion {
        integer id_nota PK
        integer id_evolucion FK
        integer id_usuario_diligencio FK
        varchar tipo
        text texto
    }

    plantilla_consentimiento {
        integer id_consentimiento PK
        varchar nombre UK
        smallint version
        varchar tipo
        boolean estado
        integer id_usuario_modificador FK
    }

    consentimiento_firmado {
        integer id_consentimiento_firmado PK
        integer id_consentimiento FK
        integer id_paciente FK
        integer id_usuario_diligencio FK
        smallint version_plantilla
        boolean firma_por_acudiente
    }

    registro_auditoria {
        bigint id_auditoria PK
        timestamptz fecha
        integer id_usuario FK
        varchar actor
        varchar accion
        varchar entidad
        varchar id_registro
    }
```

### 5.2 Diccionario de Datos
El esquema reside en `public` y se compone de 20 tablas de dominio más la tabla de control de migraciones `schema_migrations`.

#### Tabla 1: `public.rol`
Almacena la matriz de roles iniciales protegidos y roles dinámicos configurables.

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `id_rol` | `smallserial` | NO | PK | Identificador autoincremental del rol. |
| `nombre_rol` | `varchar(40)` | NO | UNIQUE | Nombre legible del rol (ej. `Administrador`, `Odontólogo General`). |
| `permisos` | `jsonb` | NO | Default `'[]'::jsonb` | Arreglo JSON con códigos de requisitos funcionales habilitados (`RF-*`). |
| `es_inicial` | `boolean` | NO | Default `false` | Indica si es uno de los 6 roles iniciales protegidos contra edición/eliminación (`ROL-PAC`, `ROL-ODO`, `ROL-ESP`, `ROL-COA`, `ROL-AUX`, `ROL-ADM`). |
| `codigo_rol` | `varchar(20)` | SÍ | UNIQUE | Código corto estandarizado del rol (ej. `ROL-ADM`, `ROL-ODO`). |
| `descripcion` | `varchar(250)` | SÍ | — | Descripción funcional del alcance del rol. |

#### Tabla 2: `public.usuario`
Almacena las cuentas del personal clínico, administrativo y el usuario técnico interno `Sistema`.

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `id_usuario` | `integer` | NO | PK (`IDENTITY`) | Identificador único del usuario. |
| `nombre_completo` | `varchar(150)` | NO | — | Nombre completo del profesional o funcionario. |
| `documento_identidad` | `varchar(20)` | NO | UNIQUE | Número de documento de identidad (solo dígitos). |
| `correo` | `varchar(150)` | NO | UNIQUE | Correo electrónico normalizado en minúsculas (credencial de acceso). |
| `telefono` | `varchar(20)` | SÍ | — | Número de contacto telefónico (10 dígitos en usuarios estándar). |
| `contrasena_hash` | `varchar(255)` | NO | — | Hash criptográfico en formato `scrypt$<salt>$<hash>`. Para `Sistema` almacena `'!sin-acceso'`. |
| `estado` | `boolean` | NO | Default `true` | Estado operativo de la cuenta (`true` = Activo, `false` = Inactivo). |
| `firma_base64` | `text` | SÍ | — | Imagen PNG/JPEG de la firma del profesional codificada en Base64 (máx. 2 MB). |
| `es_contrasena_temporal` | `boolean` | NO | Default `false` | Fuerza cambio de contraseña obligatorio en el próximo inicio de sesión (`001_ers_1_3.sql`). |
| `es_sistema` | `boolean` | NO | Default `false` | Identifica al usuario técnico `Sistema` (bloqueado para inicio de sesión humano). |

#### Tabla 3: `public.usuario_rol`
Tabla asociativa N:M entre usuarios y roles.

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `id_usuario` | `integer` | NO | PK, FK → `usuario` (`ON UPDATE CASCADE ON DELETE CASCADE`) | Referencia al usuario. |
| `id_rol` | `smallint` | NO | PK, FK → `rol` (`ON UPDATE CASCADE ON DELETE RESTRICT`) | Referencia al rol asignado. |
| `estado` | `boolean` | NO | Default `true` | Indica si la asignación del rol está vigente para el usuario. |

#### Tabla 4: `public.intento_login`
Control persistente de bloqueo temporal por fuerza bruta (`RF-USR-005`).

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `correo` | `varchar(150)` | NO | PK | Correo normalizado sobre el que se contabilizan intentos fallidos. |
| `intentos_fallidos` | `smallint` | NO | Default `0` | Contador consecutivo de fallos (bloquea al alcanzar `5`). |
| `bloqueado_hasta` | `timestamptz` | SÍ | — | Marca temporal hasta la cual permanece bloqueado (15 minutos tras el 5.º fallo). |

#### Tabla 5: `public.token_recuperacion`
Tokens temporales de un solo uso para restablecimiento de contraseña (`RF-USR-009`).

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `token` | `varchar(255)` | NO | PK | Token aleatorio hexadecimal de 64 caracteres (`32` bytes). |
| `id_usuario` | `integer` | NO | — | Identificador del usuario solicitante. |
| `correo` | `varchar(150)` | NO | — | Correo electrónico asociado a la solicitud. |
| `creado_en` | `timestamp` | NO | — | Fecha y hora de emisión. |
| `expira_en` | `timestamp` | NO | — | Fecha y hora de expiración (`creado_en + 30 minutos`). |
| `usado` | `boolean` | NO | Default `false` | Indica si el token ya fue consumido. |
| `invalidado` | `boolean` | NO | Default `false` | Indica si fue invalidado por una solicitud posterior. |

#### Tabla 6: `public.sesion_revocada`
Lista de revocación de tokens JWT cerrados antes de su expiración (`RF-USR-008`).

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `token_hash` | `char(64)` | NO | PK | Digest SHA-256 hexadecimal del JWT revocado (nunca se almacena el JWT en claro). |
| `id_usuario` | `integer` | SÍ | FK → `usuario` (`ON DELETE CASCADE`) | Usuario propietario de la sesión cerrada. |
| `revocada_en` | `timestamptz` | NO | Default `now()` | Instante de revocación. |
| `expira_en` | `timestamptz` | NO | — | Instante de expiración original del JWT (usado para purga automática). |

#### Tabla 7: `public.borrador_sesion`
Almacenamiento persistente de formularios sin guardar cuando expira la sesión por inactividad (`RF-USR-008`).

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `id_usuario` | `integer` | NO | PK, FK → `usuario` (`ON DELETE CASCADE`) | Usuario propietario del borrador. |
| `formulario_id` | `varchar(120)` | NO | PK | Identificador lógico del formulario (ej. `USER_FORM`). |
| `datos` | `jsonb` | NO | Default `'{}'::jsonb` | Estado serializado de los campos del formulario. |
| `fecha_guardado` | `timestamptz` | NO | Default `now()` | Fecha y hora del último guardado automático. |

#### Tabla 8: `public.paciente`
Registro maestro de datos demográficos de identificación y contacto del paciente (`RF-HCL-001`).

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `id_paciente` | `integer` | NO | PK (`IDENTITY`) | Identificador único del paciente. |
| `nombre_completo` | `varchar(150)` | NO | — | Nombre completo del paciente. |
| `documento_identidad` | `varchar(20)` | NO | UNIQUE | Documento de identidad único. |
| `correo` | `varchar(150)` | SÍ | — | Correo electrónico de contacto y notificaciones. |
| `telefono` | `varchar(20)` | SÍ | — | Teléfono móvil o fijo de contacto. |
| `fecha_nacimiento` | `date` | NO | — | Fecha de nacimiento (`YYYY-MM-DD`); determina mayoría de edad (< 18 años). |
| `sexo` | `varchar(10)` | SÍ | — | Valores esperados: `Femenino`, `Masculino`, `Indeterminado`. Si es `NULL` al crearse desde solicitud web, activa la marca derivada `datosIncompletos`. |

#### Tabla 9: `public.bloques_horario`
Grilla única de bloques de 30 minutos de la agenda del consultorio (`RF-AGE-001`).

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `inicio` | `timestamp` | NO | PK | Fecha/hora de inicio del bloque (`YYYY-MM-DD HH:MM:SS`, hora Colombia). |
| `final` | `timestamp` | NO | `CHECK (final > inicio)` | Fecha/hora de fin del bloque (`inicio + 30 min`). |
| `estado` | `boolean` | NO | Default `true` | `true` si el bloque está habilitado para agendamiento; `false` si fue inhabilitado. |
| `ocupacion` | `boolean` | NO | Default `false` | `true` si está reservado por una solicitud pendiente o una cita activa (`Confirmada`, `En consulta`, `Atendida`, `Inasistencia`). |

#### Tabla 10: `public.solicitud_cita`
Solicitudes de cita registradas desde el portal público (`RF-AGE-003`). Índice único parcial `uq_solicitud_pendiente_por_documento` garantiza una sola solicitud pendiente (`WHERE estado`) por documento.

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `id_solicitud` | `integer` | NO | PK (`IDENTITY`) | Identificador único de la solicitud web. |
| `nombre_solicitante` | `varchar(150)` | NO | — | Nombre del solicitante. |
| `documento_solicitante` | `varchar(20)` | NO | Índice único parcial (`WHERE estado`) | Documento del solicitante. |
| `correo_solicitante` | `varchar(150)` | NO | — | Correo electrónico para confirmaciones o rechazos. |
| `bloque_solicitado` | `timestamp` | NO | FK → `bloques_horario` (`ON DELETE RESTRICT`) | Bloque de 30 minutos reservado preventivamente. |
| `descripcion` | `varchar(500)` | SÍ | — | Motivo o síntomas descritos por el solicitante. |
| `estado` | `boolean` | NO | Default `true` | `true` = Pendiente de revisión; `false` = Gestionada (aprobada, rechazada o expirada). |
| `telefono_solicitante` | `varchar(20)` | SÍ | — | Teléfono de 10 dígitos del solicitante. |
| `fecha_nacimiento` | `date` | SÍ | — | Fecha de nacimiento del solicitante. |
| `sexo` | `varchar(10)` | SÍ | — | Sexo biológico (opcional en el portal público). |
| `fecha_solicitud` | `timestamp` | SÍ | Default `CURRENT_TIMESTAMP` | Fecha y hora de radicación. |
| `id_plantilla_autorizacion` | `integer` | SÍ | FK → `plantilla_consentimiento` | Plantilla de autorización de datos personales aceptada (`RQNF-SEG-005`). |
| `version_plantilla_autorizacion` | `smallint` | SÍ | — | Versión exacta de la plantilla aceptada al radicar la solicitud. |
| `fecha_aceptacion_autorizacion` | `timestamp` | SÍ | — | Marca temporal de aceptación de Habeas Data. |

#### Tabla 11: `public.historial_solicitud`
Trazabilidad de decisiones sobre solicitudes públicas (`RF-AGE-005`, `RF-AGE-010`).

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `id_cambio_solicitud` | `integer` | NO | PK (`IDENTITY`) | Identificador del evento en el historial. |
| `id_solicitud` | `integer` | NO | FK → `solicitud_cita` (`ON DELETE CASCADE`) | Solicitud afectada. |
| `id_usuario_gestor` | `integer` | NO | FK → `usuario` (`ON DELETE RESTRICT`) | Usuario coordinador/administrador o usuario técnico `Sistema`. |
| `fecha_historial` | `timestamp` | NO | Default `CURRENT_TIMESTAMP` | Fecha y hora del evento. |
| `reporte` | `varchar(1000)` | SÍ | — | Descripción de la acción ejecutada. |
| `motivo` | `varchar(500)` | SÍ | — | Motivo de rechazo o cancelación automática. |

#### Tabla 12: `public.cita`
Registro central de citas odontológicas. Sujeto a restricciones `chk_cita_estado` (7 estados ERS v1.3) y `chk_cita_recordatorio_estado`.

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `id_cita` | `integer` | NO | PK (`IDENTITY`) | Identificador único de la cita. |
| `titulo` | `varchar(50)` | NO | — | Servicio o motivo breve de la cita. |
| `descripcion` | `varchar(500)` | SÍ | — | Notas u observaciones de agendamiento. |
| `id_paciente` | `integer` | NO | FK → `paciente` (`ON DELETE RESTRICT`) | Paciente titular de la atención. |
| `id_usuario` | `integer` | NO | FK → `usuario` (`ON DELETE RESTRICT`) | Profesional responsable (`ROL-ODO` o `ROL-ESP`). |
| `estado` | `varchar(20)` | NO | `CHECK` (`Solicitada`, `Confirmada`, `Rechazada`, `En consulta`, `Atendida`, `Cancelada`, `Inasistencia`) | Estado vigente en el flujo de atención. |
| `recordatorio_estado` | `varchar(12)` | NO | Default `'Pendiente'`, `CHECK` (`Pendiente`, `Enviado`, `No enviado`, `Anulado`) | Estado de envío del recordatorio automático 24h (`RF-AGE-011`). |
| `recordatorio_causa` | `varchar(250)` | SÍ | — | Causa registrada cuando el recordatorio resulta `'No enviado'`. |
| `recordatorio_fecha` | `timestamptz` | SÍ | — | Timestamp de procesamiento del recordatorio. |

#### Tabla 13: `public.bloques_citas`
Relación N:M que asigna uno o varios bloques consecutivos de 30 minutos a una cita.

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `id_bloque` | `timestamp` | NO | PK, FK → `bloques_horario` (`ON DELETE RESTRICT`) | Timestamp de inicio del bloque reservado. |
| `id_cita` | `integer` | NO | PK, FK → `cita` (`ON DELETE CASCADE`) | Cita propietaria del bloque. |

#### Tabla 14: `public.historial_cita`
Bitácora de creación, edición y transiciones de estado de cada cita.

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `id_cambio_cita` | `integer` | NO | PK (`IDENTITY`) | Identificador del registro histórico. |
| `id_cita` | `integer` | NO | FK → `cita` (`ON DELETE CASCADE`) | Cita asociada. |
| `id_usuario_gestor` | `integer` | NO | FK → `usuario` (`ON DELETE RESTRICT`) | Usuario autenticado o `Sistema` que ejecutó la acción. |
| `fecha_historial` | `timestamp` | NO | Default `CURRENT_TIMESTAMP` | Fecha y hora de la transición. |
| `reporte` | `varchar(1000)` | SÍ | — | Resumen del cambio realizado. |
| `motivo` | `varchar(500)` | SÍ | — | Justificación (obligatoria al cancelar). |

#### Tabla 15: `public.plantilla_consentimiento`
Catálogo versionado de textos de consentimiento informado y avisos legales (`RF-CON-004`, `RF-CON-007`, `RF-CON-008`). Índice único parcial `uq_plantilla_tipo_especial_activa` garantiza como máximo una plantilla activa de tipo `AUTORIZACION_DATOS` y una de `MENORES`.

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `id_consentimiento` | `integer` | NO | PK (`IDENTITY`) | Identificador único de la plantilla. |
| `nombre` | `varchar(150)` | NO | UNIQUE | Título único de la plantilla. |
| `version` | `smallint` | NO | Default `1` | Número incremental de versión (aumenta en +1 al editar). |
| `estado` | `boolean` | NO | Default `true` | `true` = Activa, `false` = Inactiva (no eliminable). |
| `texto_plantilla` | `text` | NO | Default `''` | Texto fuente con marcadores `{{nombre_paciente}}`, `{{documento_paciente}}`, `{{datos_acudiente}}`, etc. |
| `id_usuario_modificador` | `integer` | SÍ | FK → `usuario` (`ON DELETE RESTRICT`) | Último usuario administrador que creó o actualizó la plantilla. |
| `fecha_modificacion` | `timestamp` | NO | Default `CURRENT_TIMESTAMP` | Fecha de la última modificación o publicación. |
| `tipo` | `varchar(20)` | NO | Default `'PROCEDIMIENTO'`, `CHECK` (`PROCEDIMIENTO`, `AUTORIZACION_DATOS`, `MENORES`) | Clasificación funcional y legal de la plantilla. |

#### Tabla 16: `public.consentimiento_firmado`
Consentimientos suscritos por pacientes o acudientes. Protegida contra eliminación mediante trigger `trg_consentimiento_no_eliminable`. Índice único `uq_consentimiento_paciente_version` impide firmar dos veces la misma versión de una plantilla por un mismo paciente.

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `id_consentimiento_firmado` | `integer` | NO | PK (`IDENTITY`) | Identificador único del consentimiento suscrito. |
| `id_consentimiento` | `integer` | NO | FK → `plantilla_consentimiento` (`ON DELETE RESTRICT`) | Plantilla origen. |
| `id_paciente` | `integer` | NO | FK → `paciente` (`ON DELETE RESTRICT`) | Paciente titular. |
| `fecha` | `timestamp` | NO | Default `CURRENT_TIMESTAMP` | Fecha y hora de suscripción. |
| `version_plantilla` | `smallint` | NO | Default `1` | Snapshot de la versión vigente al momento de firmar. |
| `texto_firmado` | `text` | NO | Default `''` | Snapshot inmutable del texto ya interpolado. |
| `firma_base64` | `text` | NO | Default `''` | Trazos de firma digitalizada en Base64. |
| `firma_por_acudiente` | `boolean` | NO | Default `false` | Indica si firmó un representante legal/acudiente (obligatorio para menores). |
| `nombre_documento_acudiente` | `varchar(200)` | SÍ | `CHECK` (`chk_acudiente_consentimiento`) | Nombre y documento del acudiente (obligatorio no vacío si `firma_por_acudiente = true`). |
| `id_usuario_diligencio` | `integer` | SÍ | FK → `usuario` (`ON DELETE RESTRICT`) | Profesional o auxiliar autenticado que gestionó la toma de firma. |

#### Tabla 17: `public.historia_clinica`
Contenedor único por paciente. Protegida contra eliminación (`trg_historia_no_eliminable`).

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `id_historia` | `integer` | NO | PK (`IDENTITY`) | Identificador de la historia clínica. |
| `id_paciente` | `integer` | NO | UNIQUE, FK → `paciente` (`ON DELETE RESTRICT`) | Relación estricta 1:1 con `paciente`. |
| `fecha_creacion` | `timestamp` | NO | Default `CURRENT_TIMESTAMP` | Fecha de apertura inicial de la carpeta clínica. |

#### Tabla 18: `public.evolucion`
Registro clínico por consulta (`id_cita` único). Protegida por `trg_evolucion_no_eliminable` (sin borrado) y `trg_evolucion_paciente_coherente` (garantiza que la cita pertenezca al mismo paciente que la historia clínica). Índice `idx_evolucion_historia_fecha` optimiza lectura cronológica descendente.

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `id_evolucion` | `integer` | NO | PK (`IDENTITY`) | Identificador único de la evolución. |
| `id_historia` | `integer` | NO | FK → `historia_clinica` (`ON DELETE RESTRICT`) | Historia clínica a la que pertenece. |
| `fecha` | `timestamp` | NO | Default `CURRENT_TIMESTAMP` | Fecha y hora de registro. |
| `id_cita` | `integer` | NO | UNIQUE (`uq_evolucion_cita`), FK → `cita` (`ON DELETE RESTRICT`) | Cita clínica asociada (relación 1:1 por atención). |
| `motivo_consulta` | `varchar(250)` | NO | — | Motivo de consulta obligatorio para apertura y cierre (`RF-AGE-009`). |
| `enfermedad_actual` | `varchar(1000)` | SÍ | Default `'N/A'` | Descripción clínica de la enfermedad actual. |
| `antecedentes_clinicos` | `jsonb` | SÍ | Default `'{}'::jsonb` | Objeto validado por `AntecedentesClinicosSchema` (7 categorías). |
| `habitos_higiene` | `jsonb` | SÍ | Default `'{}'::jsonb` | Objeto validado por `HabitosHigieneSchema` (6 hábitos). |
| `examen_estomatognatico` | `jsonb` | SÍ | Default `'{}'::jsonb` | Objeto validado por `ExamenEstomatognaticoSchema` (8 estructuras anatómicas). |
| `examen_fisico_observaciones` | `text` | SÍ | — | Observaciones complementarias del examen físico. |
| `odontograma` | `jsonb` | SÍ | Default `'{}'::jsonb` | Mapa dental FDI validado por `OdontogramaSchema` (cuadrantes 1–4 y temporales 5–8). |
| `procedimiento_realizado` | `text` | SÍ | — | Descripción clínica del procedimiento efectuado. |
| `diagnostico_generado` | `text` | SÍ | — | Diagnóstico clínico establecido. |
| `acciones_a_realizar` | `text` | SÍ | — | Conducta y pasos clínicos siguientes. |
| `hallazgos_observaciones` | `text` | SÍ | — | Hallazgos clínicos relevantes de la sesión. |
| `plan_manejo` | `jsonb` | SÍ | Default `'{}'::jsonb` | Objeto validado por `PlanManejoSchema` (prescripción, incapacidad, remisión). |
| `id_usuario_diligencio` | `integer` | SÍ | FK → `usuario` (`ON DELETE RESTRICT`) | Profesional responsable autor de la apertura clínica. |

#### Tabla 19: `public.nota_evolucion`
Notas de apoyo de la auxiliar (`ROL-AUX` durante `En consulta`) y notas aclaratorias posteriores al cierre del profesional responsable (`RF-HCL-006`, `RF-HCL-009`). Protegida por `trg_nota_no_eliminable`. Índice `idx_nota_evolucion_evolucion (id_evolucion, fecha)`.

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `id_nota` | `integer` | NO | PK (`IDENTITY`) | Identificador único de la nota. |
| `id_evolucion` | `integer` | NO | FK → `evolucion` (`ON DELETE RESTRICT`) | Evolución clínica asociada. |
| `tipo` | `varchar(20)` | NO | Default `'EVOLUCION'`, `CHECK` (`EVOLUCION`, `NOTA_ACLARATORIA`) | Naturaleza de la nota. |
| `procedimiento_realizado` | `text` | SÍ | — | Procedimiento reportado en la nota. |
| `texto` | `text` | NO | `CHECK (btrim(texto) <> '')` | Contenido clínico de la nota (no puede ser vacío). |
| `id_usuario_diligencio` | `integer` | NO | FK → `usuario` (`ON DELETE RESTRICT`) | Autor real de la nota (profesional o auxiliar). |
| `fecha` | `timestamp` | NO | Default `CURRENT_TIMESTAMP` | Fecha y hora de inserción. |

#### Tabla 20: `public.registro_auditoria`
Bitácora de auditoría inalterable (`RQNF-SEG-009`). Triggers `trg_auditoria_inalterable` y `trg_auditoria_no_truncate` bloquean cualquier intento de `UPDATE`, `DELETE` o `TRUNCATE`. Índices: `idx_auditoria_entidad_registro` y `idx_auditoria_fecha`.

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `id_auditoria` | `bigint` | NO | PK (`IDENTITY`) | Identificador secuencial de auditoría. |
| `fecha` | `timestamptz` | NO | Default `now()` | Marca temporal exacta con zona horaria. |
| `id_usuario` | `integer` | SÍ | FK → `usuario` (`ON DELETE RESTRICT`) | Identificador del usuario ejecutor (`NULL` si el actor fue anónimo). |
| `actor` | `varchar(150)` | NO | — | Correo del usuario, `'Sistema'` o `'Anónimo'`. |
| `accion` | `varchar(120)` | NO | — | Evento auditado (`CREAR`, `MODIFICAR`, `CAMBIAR_ESTADO`, `ACCESO_BLOQUEADO`, `CONSULTA_TITULAR`, `AVISO_DIARIO_SOLICITUDES`, `FALLO_CORREO`, etc.). |
| `entidad` | `varchar(60)` | NO | — | Entidad o módulo afectado (`paciente`, `cita`, `solicitud_cita`, `evolucion`, `rbac`, `titular`, `correo`, etc.). |
| `id_registro` | `varchar(60)` | SÍ | — | Identificador del recurso afectado o ruta/fecha clave. |
| `valor_anterior` | `jsonb` | SÍ | — | Snapshot previo a la mutación. |
| `valor_nuevo` | `jsonb` | SÍ | — | Snapshot posterior a la mutación. |
| `detalle` | `jsonb` | SÍ | — | Metadatos adicionales (IP/método/permiso requerido/error). |

#### Tabla 21: `public.schema_migrations`
Tabla de control creada automáticamente por `src/shared/infrastructure/database/migrate.ts`.

| Campo | Tipo de Dato | Nulo | Llave / Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- | :--- |
| `nombre` | `varchar(200)` | NO | PK | Nombre exacto del archivo `.sql` aplicado (ej. `000_baseline.sql`). |
| `aplicada_en` | `timestamptz` | NO | Default `now()` | Timestamp de aplicación exitosa. |

#### Resumen de Contratos `jsonb` Validados (Single Source of Truth en `src/schemas/`)
Las columnas `jsonb` nunca se insertan con estructuras arbitrarias. Todo acceso pasa por validadores Zod y constructores semilla (`src/schemas/index.ts`):
- `rol.permisos` → `RolPermisosSchema` / `ConfigurableRolPermisosSchema` (bloquea permisos clínicos protegidos `RF-HCL-005`..`009`, `RF-CON-001`..`003`, `RF-DOC-001`..`004` y excluye permisos automáticos/universales).
- `evolucion.antecedentes_clinicos` → `AntecedentesClinicosSchema` (7 llaves; si `presenta: true`, `observaciones` no puede estar vacío ni ser `"N/A"`).
- `evolucion.habitos_higiene` → `HabitosHigieneSchema` (6 llaves; si `aplica: true`, exige `frecuencia_cantidad` y `observaciones`).
- `evolucion.examen_estomatognatico` → `ExamenEstomatognaticoSchema` (8 estructuras anatómicas; si `presenta_anormalidades: true`, exige descripción).
- `evolucion.odontograma` → `OdontogramaSchema` (cuadrantes 1–4 para adultos y 5–8 temporales para menores de 18 años; diferenciación `palatina` en maxilar superior vs. `lingual` en inferior; máximo 1 hallazgo booleano activo por cara dental).
- `evolucion.plan_manejo` → `PlanManejoSchema` (prescripción farmacológica, incapacidad 1–30 días y remisión por especialidad sin nombres de especialistas).

### 5.3 Estrategia de migraciones y versionado del esquema de base de datos
El versionado del esquema utiliza un motor propio ligero, determinista y transaccional implementado en `src/shared/infrastructure/database/migrate.ts`, tomando como fuente única de verdad los archivos SQL ubicados en `database/migrations/`:

1. **Convención de nombrado:** todo archivo de migración debe cumplir el patrón `^\d{3}_.+\.sql$` (prefijo numérico secuencial de tres dígitos):
   - `000_baseline.sql`: esquema idempotente base anterior a ERS v1.3 (15 tablas).
   - `001_ers_1_3.sql`: evolución a ERS v1.3 (columnas de contraseña temporal y usuario `Sistema`, triggers de inmutabilidad en auditoría y registros clínicos, tablas `registro_auditoria`, `sesion_revocada`, `intento_login`, `borrador_sesion`, `nota_evolucion`, restricción `chk_cita_estado`, plantillas legales iniciales y migración del catálogo de permisos).
2. **Garantías transaccionales:** cada migración pendiente se ejecuta en orden dentro de un bloque `BEGIN ... COMMIT` con `SET LOCAL TIME ZONE 'America/Bogota'`, insertándose su registro en `public.schema_migrations` al finalizar con éxito. Si alguna sentencia falla, se ejecuta `ROLLBACK` automático impidiendo estados intermedios corruptos.
3. **Protección contra ejecución accidental en producción:** si `DATABASE_URL` contiene `amazonaws.com`, `herokuapp.com`, `rds.` o `NODE_ENV === 'production'`, el script aborta con código de salida `1` a menos que se especifique explícitamente la bandera `-- --force`:

```bash
# Consultar migraciones pendientes sin modificar la BD (dry-run)
npm run db:migrate -- --status

# Aplicar migraciones en entorno local
npm run db:migrate

# Aplicar migraciones en Heroku Postgres / entorno remoto
npm run db:migrate -- --force
```

---

## 6. ESPECIFICACIÓN DE APIS Y SERVICIOS WEB

### 6.1 Convenciones de API
- **Prefijo base:** `/api/v1` (adicionalmente existe el alias heredado `/api/users-auth/*`, que redirige internamente hacia `/api/v1/auth/*` en `src/app/server.ts`).
- **Protocolo y codificación:** HTTP/1.1 sobre TLS en producción, formato `application/json; charset=utf-8`, límite máximo de payload de entrada `5mb` (`express.json({ limit: '5mb' })`).
- **Estructura de respuestas observada en controladores:**
  - Éxito en consultas y mutaciones: objeto JSON con clave `"data"` y opcionalmente `"message"` (ej. `{ "message": "...", "data": { ... } }`). En `/auth/login` retorna `{ requiereCambioContrasena, message, usuario, permisos, token }`. En `/health` retorna `{ status: "OK", database: { horaServidorColombia } }`.
  - Respuestas de error (`http-error.handler.ts`): `{ "message": "<descripción legible>", "field"?: "<campo>" }`.
- **Códigos de estado HTTP implementados:**
  - `200 OK`: operación o consulta completada con éxito.
  - `201 Created`: recurso creado (rol, usuario, bloque, solicitud pública, cita, paciente, evolución/nota aclaratoria, consentimiento firmado, plantilla).
  - `400 Bad Request`: error de validación de formato, campos obligatorios ausentes, longitud máxima (`22001`), clave única duplicada (`23505`) o violación de regla de negocio.
  - `401 Unauthorized`: token ausente, formato Bearer inválido, token expirado/manipulado, sesión revocada o usuario inactivo.
  - `403 Forbidden`: usuario autenticado sin permiso funcional `RF-*` o sin contexto clínico autorizado (se audita en `registro_auditoria` y responde `"No tiene permiso para realizar esta acción"`).
  - `404 Not Found`: recurso inexistente (`cita`, `solicitud`, `paciente`, `evolucion`, `aviso de privacidad`).
  - `409 Conflict`: conflicto de estado o concurrencia (cita en estado final, transición inválida, bloque ya ocupado, solicitud duplicada, restricción temporal).
  - `500 Internal Server Error`: fallo de infraestructura o base de datos sanitizado (sin exposición de SQL, nombres de tabla ni hostnames).

### 6.2 Esquema de autenticación y autorización
1. **Emisión dual de credenciales (`POST /api/v1/auth/login`):**
   - Si el usuario tiene `es_contrasena_temporal = true` y no envía `nuevaContrasena` y `confirmacionNuevaContrasena`, el servidor retorna `200 OK` con `requiereCambioContrasena: true` sin emitir token.
   - Una vez autenticado, `JwtTokenService.generateToken()` genera un JWT firmado con **HMAC-SHA256 (`HS256`)** y vigencia de **8 horas** (`SESSION_HOURS = 8`).
   - El servidor entrega el token tanto en la propiedad JSON `token` como en una cookie `session_token` configurada con `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 28800000` (8h) y `secure: true` cuando `NODE_ENV === 'production'`.
2. **Validación en peticiones protegidas (`authMiddleware`):**
   - Lee el token desde la cabecera HTTP `Authorization: Bearer <token>` o, en su defecto, desde la cookie `session_token`.
   - Verifica firma con `crypto.timingSafeEqual` y vigencia (`exp`), consulta `public.sesion_revocada` (mediante SHA-256) y carga roles y permisos vigentes directamente desde PostgreSQL (`loadActiveSessionUser`).
3. **Cierre de sesión e inactividad (`RF-USR-008`):**
   - El cliente React (`useAuth.ts`) monitorea eventos de actividad durante **29 minutos** (alerta modal de advertencia) y ejecuta el cierre automático al **minuto 30** enviando `motivo: "INACTIVITY_TIMEOUT"` y persistiendo el borrador en `public.borrador_sesion`.
   - `POST /api/v1/auth/logout` revoca el hash SHA-256 del token en `public.sesion_revocada` y limpia la cookie `session_token`.

### 6.3 Catálogo de Endpoints principales

#### Salud y Endpoints Públicos (Sin autenticación)

| Método | Ruta (`/api/v1/...`) | Descripción | Parámetros / Payload Ejemplo | Respuesta Exitosa y Errores |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Verifica conectividad con PostgreSQL y hora oficial Colombia. | N/A | `200`: `{"status":"OK","database":{"horaServidorColombia":"..."}}` · `500`: BD caída. |
| `POST` | `/auth/login` | Inicia sesión o completa cambio de contraseña temporal. Bloquea 15 min al 5.º fallo. | Body: `{"correo":"doc@odontoleal.com","contrasena":"<PASSWORD>"}` | `200`: `{"requiereCambioContrasena":false,"message":"Autenticación exitosa.","usuario":{...},"permisos":[...],"token":"eyJ..."}` · `400`, `401`. |
| `POST` | `/auth/recovery/request` | Emite token de un solo uso (30 min) y envía correo de recuperación si el usuario está activo. | Body: `{"correo":"doc@odontoleal.com"}` | `200`: `{"message":"Si el correo está registrado, recibirá un enlace para restablecer su contraseña"}` · `400`. |
| `POST` | `/auth/recovery/reset` | Restablece contraseña validando el token de un solo uso. | Body: `{"token":"<HEX_64>","nuevaContrasena":"<NEW_PASS>","confirmacionContrasena":"<NEW_PASS>"}` | `200`: `{"message":"Contraseña actualizada correctamente..."}` · `400`. |
| `GET` | `/appointments/available-slots` | Lista bloques de 30 min habilitados y libres para una fecha. | Query: `?fecha=2026-11-20` | `200`: `{"data":[{"inicio":"2026-11-20 08:00:00","final":"2026-11-20 08:30:00","estado":true,"ocupacion":false}]}` · `400`, `500`. |
| `POST` | `/appointments/public-requests` | Registra solicitud externa (ventana 5–60 días, reserva preventiva de bloque y Habeas Data). | Body: `{"nombreSolicitante":"Lucía Morales","documentoSolicitante":"52876543","correoSolicitante":"lucia@correo.com","telefonoSolicitante":"3159876543","fechaNacimiento":"1994-06-15","sexo":"Femenino","bloqueSolicitado":"2026-11-25 09:30:00","descripcion":"Valoración","autorizacionDatos":true}` | `201`: `{"message":"Solicitud registrada y sujeta a aprobación del consultorio.","data":{...}}` · `400`, `409`. |
| `GET` | `/public/privacy-notice` | Retorna el aviso de privacidad vigente (`AUTORIZACION_DATOS`). | N/A | `200`: `{"data":{"idPlantilla":1,"nombre":"...","version":1,"fechaPublicacion":"...","texto":"..."}}` · `404`. |

#### Módulo A: Usuarios, Roles y Sesión (`/api/v1/...`, requiere `Authorization: Bearer <token>` o cookie `session_token`)

| Método | Ruta | Permiso RBAC | Request Payload / Query | Response Éxito / Errores |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/logout` | Sesión activa | Body: `{"motivo":"MANUAL","tieneCambiosSinGuardar":false,"confirmadoPorUsuario":true}` | `200`: `{"sesionCerrada":true,"requiereConfirmacion":false,"borradorGuardado":false,"message":"..."}` · `400`, `401`. |
| `GET` | `/auth/drafts` | Sesión activa | N/A | `200`: `{"data":[{"idUsuario":1,"formularioId":"USER_FORM","datosBorrador":{...},"fechaGuardado":"..."}]}` · `401`, `500`. |
| `DELETE` | `/auth/drafts/:formularioId` | Sesión activa | Path: `:formularioId` | `200`: `{"message":"Borrador descartado."}` · `401`, `500`. |
| `GET` | `/roles` | `RF-USR-007/010/011/001/002/004` | N/A | `200`: `{"data":[{"id_rol":1,"codigo_rol":"ROL-ADM","nombre_rol":"Administrador","permisos":[...],"es_inicial":true,"usuariosAsignadosCount":2}]}` · `401`, `403`. |
| `POST` | `/roles` | `RF-USR-007` | Body: `{"codigo":"ROL-AUD","nombreRol":"Auditor","descripcion":"Solo lectura","permisos":["RF-AGE-008"]}` | `201`: rol creado · `400`, `403` (si incluye permisos clínicos protegidos). |
| `PUT` | `/roles/:id` | `RF-USR-010` | Path `:id`, Body: `{"nombreRol":"Auditor Interno","descripcion":"...","permisos":["RF-AGE-008"]}` | `200`: rol actualizado · `400`, `403`, `404`. |
| `DELETE` | `/roles/:id` | `RF-USR-011` | Path `:id` | `200`: `{"message":"...","eliminado":true}` · `400` (rol inicial o con usuarios), `403`. |
| `GET` | `/users` | `RF-USR-004/001/002/003` | Query: `?query=leal&idRol=2&estado=true` | `200`: `{"data":[...],"message":"..."}` · `401`, `403`. |
| `POST` | `/users` | `RF-USR-001` | Body: `{"nombreCompleto":"Dra. Ana Ruiz","documentoIdentidad":"1098765400","correo":"ana@odontoleal.com","telefono":"3101234567","contrasenaTemporal":"Temp2026!","rolesIds":[2],"firma":null}` | `201`: usuario creado (hash `scrypt` + `es_contrasena_temporal=true`) · `400`, `403`. |
| `PUT` | `/users/:id` | `RF-USR-002` | Path `:id`, Body parcial con datos, `rolesIds`, `nuevaContrasenaTemporal`, `firma` | `200`: usuario actualizado · `400`, `403`. |
| `PATCH` | `/users/:id/status` | `RF-USR-003` | Path `:id`, Body: `{"estado":false}` | `200`: usuario activado/inactivado (impide inactivar al último `ROL-ADM`) · `400`, `403`. |

#### Módulo B: Agendamiento y Agenda (`/api/v1/appointments/...`)

| Método | Ruta | Permiso RBAC | Request Payload / Query | Response Éxito / Errores |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/appointments/professionals` | `RF-AGE-001/002/005/006/008` | N/A | `200`: `{"data":[{"idUsuario":1,"nombreCompleto":"...","roles":[...]}]}` · `401`, `403`. |
| `POST` | `/appointments/slots` | `RF-AGE-001` | Body: `{"inicio":"2026-11-20 08:00:00","final":"2026-11-20 08:30:00","estado":true}` | `201`: `{"message":"Bloque de horario actualizado.","data":{...}}` · `400`, `409`. |
| `POST` | `/appointments/generate-day-slots` | `RF-AGE-001` | Body o Query: `{"fecha":"2026-11-20"}` (genera 06:00–20:00 en bloques de 30 min) | `201`: `{"message":"Se habilitaron ...","data":{"totalGenerados":28,"yaExistian":false,"totalExistentes":28,"fecha":"2026-11-20"}}` · `400`. |
| `PATCH` | `/appointments/slots/toggle` | `RF-AGE-001` | Body: `{"inicio":"2026-11-20 12:00:00"}` | `200`: `{"message":"Bloque ... habilitado/deshabilitado exitosamente.","data":{...}}` · `400`, `409`. |
| `GET` | `/appointments/slots` | `RF-AGE-001/002/005/006/008` | Query: `?desde=2026-11-20&hasta=2026-11-27` | `200`: `{"data":[...]}` · `403`, `500`. |
| `GET` | `/appointments/monthly-summary` | `RF-AGE-008` | Query: `?year=2026&month=11&idProfesional=1` | `200`: resumen mensual por día filtrado según rol (`ROL-ODO`/`ROL-ESP` ven solo sus citas). |
| `GET` | `/appointments/requests` | `RF-AGE-005/008` | N/A | `200`: `{"data":[...]}` (solicitudes pendientes). |
| `GET` | `/appointments/requests/:id` | `RF-AGE-005/008` | Path: `:id` | `200`: `{"data":{...}}` · `404`. |
| `POST` | `/appointments/requests/:id/review` | `RF-AGE-005` | Body: `{"aprobar":true,"motivo":"","idProfesional":2,"selectedBlocks":["2026-11-25 09:30:00"]}` | `200`: confirma cita (y crea paciente si es nuevo) o rechaza con motivo obligatorio + email · `400`, `403`, `409`. |
| `POST` | `/appointments` | `RF-AGE-002` | Body: `{"titulo":"Profilaxis","descripcion":"Limpieza","idPaciente":12,"idUsuarioProfesional":2,"bloques":["2026-11-20 14:00:00"]}` | `201`: `{"message":"Cita confirmada exitosamente.","data":{...}}` · `400`, `409`. |
| `PUT` | `/appointments/:id` | `RF-AGE-006` | Path `:id`, Body: `{"idDoctor":2,"titulo":"...","descripcion":"...","selectedBlocks":[...],"motivo":"Cambio solicitado"}` | `200`: `{"message":"Cita actualizada exitosamente.","data":{...}}` (notifica si cambian bloques o doctor). |
| `PATCH` | `/appointments/:id/state` | `RF-AGE-007/009/012` | Path `:id`, Body: `{"nuevoEstado":"En consulta"|"Atendida"|"Cancelada"|"Inasistencia","motivo":"...","liberarBloques":true}` | `200`: `{"message":"Cita actualizada a estado ...","data":{...}}` · `400`, `403`, `409`. |
| `GET` | `/appointments/agenda` | `RF-AGE-008` | Query: `?fecha=2026-11-20&idProfesional=2&idPaciente=12` | `200`: `{"data":[...]}` (profesionales ven solo su agenda; COA/AUX/ADM ven global). |

#### Módulo C: Pacientes, Habeas Data, Historia Clínica y Odontograma (`/api/v1/...`)

| Método | Ruta | Permiso RBAC | Request Payload / Query | Response Éxito / Errores |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/patients` | `RF-HCL-003` o `RF-AGE-002` | Query: `?q=sofia` o `?search=1020456789` | `200`: `{"data":[...],"message":"..."}` · `403`. |
| `POST` | `/patients` | `RF-HCL-001` | Body: `{"nombreCompleto":"Sofía Carvajal","documentoIdentidad":"1020456789","correo":"sofia@correo.com","telefono":"3124567890","fechaNacimiento":"1996-05-14","sexo":"Femenino"}` | `201`: `{"message":"Paciente creado con historial clínico vacío.","data":{...,"historiaClinicaBase":{...}}}` · `400`. |
| `PUT` | `/patients/:id` | `RF-HCL-002` | Path `:id`, Body con campos demográficos a actualizar | `200`: `{"message":"Datos del paciente actualizados.","data":{...}}` · `400`, `404`. |
| `GET` | `/patients/:id` | `RF-HCL-004` | Path `:id` | `200`: `{"data":{...,"opcionesClinicasVisibles":{"historiaClinica":bool,"consentimientosInformados":bool}}}` · `404`. |
| `GET` | `/patients/holder-data/:documento` (y `/patients/holder-data`) | `RF-HCL-010` (`ROL-COA`/`ROL-ADM`) | Path `:documento` o Query `?documento=1020456789&formato=PDF` | `200`: `{"data":{"tituloDocumento":"Datos personales del titular","fechaGeneracion":"...","datosTitular":{...},"pdfBufferBase64":"..."}}` (auditado `CONSULTA_TITULAR`) · `403`, `404`. |
| `GET` | `/clinical-records/odontogram/latest/:idPaciente` | `RF-HCL-007` | Path `:idPaciente`, Query `?esMenor=true` | `200`: `{"data":{"cuadrantes":{...}}}` · `403`. |
| `GET` | `/clinical-records/appointment/:idCita` | `RF-HCL-005/007/009` | Path `:idCita` | `200`: `{"data":{"cita":{...},"registro":{...}|null,"mensaje":"..."}}` · `403`, `404`. |
| `POST` | `/clinical-records/evolutions` | `RF-HCL-005/007/009` | Body: `{"idPaciente":1,"idCita":11,"tipoRegistro":"APERTURA_CONSULTA"|"EVOLUCION"|"NOTA_ACLARATORIA","motivoConsulta":"...","antecedentesClinicos":{...},"habitosHigiene":{...},"examenEstomatognatico":{...},"odontograma":{...},"planManejo":{...},"marcarTodoNoAplica":false,"notaEvolucion":"...","notaAclaratoria":"..."}` | `201`: `{"message":"Registro clínico guardado."|"Nota aclaratoria registrada.","data":{...}}` · `400`, `403`, `404`, `409`. |
| `PUT` | `/clinical-records/evolutions/:idEvolucion` | `RF-HCL-006/007/009` | Path `:idEvolucion`, Body con `idCita` y bloques actualizados mientras la cita está `En consulta` | `200`: `{"message":"Historia clínica actualizada.","data":{...}}` · `400`, `403`, `409`. |
| `GET` | `/clinical-records/patient/:idPaciente` | `RF-HCL-008` (`ROL-ODO`/`ROL-ESP`) | Path `:idPaciente` | `200`: historial cronológico completo incluyendo inasistencias del paciente · `403`. |

#### Módulo D y Módulo E: Consentimientos Informados y Documentos Clínicos (`/api/v1/...`)

| Método | Ruta | Permiso RBAC | Request Payload / Query | Response Éxito / Errores |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/consents/templates` | `RF-CON-001/004/007/008` | Query: `?activas=true` | `200`: `{"data":[...]}` · `403`. |
| `POST` | `/consents/templates` | `RF-CON-004` | Body: `{"nombre":"Endodoncia","textoPlantilla":"Yo, {{nombre_paciente}}...","tipo":"PROCEDIMIENTO"}` | `201`: `{"message":"Plantilla creada en versión 1.","data":{...}}` · `400`, `409`. |
| `PUT` | `/consents/templates/:id` | `RF-CON-007` | Path `:id`, Body: `{"nombre":"...","textoPlantilla":"..."}` | `200`: `{"message":"Nueva versión de plantilla generada.","data":{...}}` · `400`, `404`. |
| `PATCH` | `/consents/templates/:id/status` | `RF-CON-008` | Path `:id`, Body: `{"estado":false}` | `200`: `{"message":"Estado de plantilla actualizado.","data":{...}}` · `400`, `404`. |
| `POST` | `/consents/sign` | `RF-CON-002` | Body: `{"idConsentimiento":1,"idPaciente":4,"textoFirmado":"...","firmaBase64":"data:image/png;base64,...","aceptado":true,"firmaPorAcudiente":false,"nombreDocumentoAcudiente":null}` | `201`: `{"message":"Consentimiento firmado guardado exitosamente.","data":{...}}` · `400`, `409`. |
| `GET` | `/consents/patient/:idPaciente` | `RF-CON-001/003` | Path `:idPaciente` | `200`: listado completo para `ROL-ODO`/`ROL-ESP` o `ROL-AUX` con cita `En consulta`; solo estado para otros · `403`. |
| `GET` | `/consents/:id/pdf` | `RF-CON-003` | Path `:id` (`idConsentimientoFirmado`) | `200`: `{"data":{"idConsentimientoFirmado":1,"pdfBase64":"JVBERi0xLjc..."}}` · `403`, `404`. |
| `POST` | `/clinical-documents` | `RF-DOC-001/002/003` | Body: `{"idPaciente":1,"idCita":11,"tipoDocumento":"ORDEN_MEDICAMENTOS"|"INCAPACIDAD"|"REMISION","modoFirma":"CON_FIRMA_REGISTRADA"|"EN_BLANCO","detalles":{...}}` | `200`: `{"message":"Documento (...) generado. El servidor no conserva el archivo.","warning":"...","data":{...,"pdfBytes":{...}}}` · `400`, `403`. |

> **Ejemplo de `detalles` por `tipoDocumento` en `POST /api/v1/clinical-documents`:**
> - `ORDEN_MEDICAMENTOS`: `{"medicamentos":[{"medicamento_principio_activo":"Amoxicilina","dosis_concentracion":"500 mg","frecuencia_via":"Cada 8 horas vía oral","duracion_tratamiento":"7 días","indicaciones_adicionales":"Después de alimentos"}],"indicacionesAdicionales":"Hidratación"}`
> - `INCAPACIDAD`: `{"diasIncapacidad":3,"motivoIncapacidad":"Postoperatorio exodoncia quirúrgica"}` (entero `1` a `30`)
> - `REMISION`: `{"especialidadDestino":"Endodoncia","otraEspecialidad":null,"motivoRemision":"Evaluación conductos molar 46"}` (catálogo: `Endodoncia`, `Cirugía oral`, `Ortopedia maxilar`, `Periodoncia`, `Otra`)

### 6.4 Integraciones de terceros
1. **Servicio de Correo Transaccional (`MailerService` + `nodemailer` `^10.1.7`):**
   - Resolución automática en cascada al primer envío:
     1. **Gmail App Password:** si `GMAIL_USER` y `GMAIL_PASS`/`GMAIL_APP_PASSWORD` existen, crea un transportador `service: 'gmail'`.
     2. **SMTP Estándar (Brevo, Resend, Outlook, etc.):** si `SMTP_HOST`, `SMTP_USER` y `SMTP_PASS` existen, conecta al host y puerto configurados (`587` STARTTLS o `465` TLS).
     3. **Sandbox Automático Ethereal Email:** en ausencia de credenciales reales (desarrollo o pruebas), genera una cuenta efímera en `smtp.ethereal.email` mediante `nodemailer.createTestAccount()` (con fallback secundario a `jsonTransport: true` si no hay acceso a Internet).
   - **Catálogo de correos emitidos:** recuperación de contraseña (`sendPasswordRecoveryEmail`), recepción de solicitud pública (`sendPublicRequestReceivedEmail`), alerta a coordinación/auxiliar/administrador (`sendCoordinatorNewRequestAlertEmail`), confirmación de cita a paciente y profesional (`sendAppointmentConfirmationEmail`, `sendDoctorAppointmentNotificationEmail`), reprogramación (`sendAppointmentRescheduledEmail`, `sendDoctorAppointmentRescheduledEmail`), cancelación (`sendAppointmentCancellationEmail`), rechazo de solicitud (`sendRequestRejectedEmail`), recordatorio 24h (`sendAppointmentReminderEmail`) y resumen diario de las 07:00 a. m. (`sendDailyDigest`).
   - **Tolerancia a fallos (`RQNF-FIA-004`):** un fallo SMTP nunca revierte la operación de agenda; `reportFailure()` intenta registrar el evento `FALLO_CORREO` en `registro_auditoria`.
2. **Motor de Documentos PDF en Memoria (`pdf-lib` `^1.17.1`):** genera binarios `%PDF-1.7` en formato Carta (`612 × 792 pt`) usando fuentes estándar (`Helvetica`, `HelveticaBold`, `HelveticaOblique`) sin requerir binarios nativos del sistema operativo (como Puppeteer/Chromium o wkhtmltopdf), garantizando ejecución idéntica en Windows y en Heroku Linux.
3. **Tipografía Web (`Google Fonts`):** `index.html` carga la familia tipográfica `Plus Jakarta Sans` desde `fonts.googleapis.com` con respaldo local `system-ui`.

---

## 7. ESTRUCTURA DEL CÓDIGO FUENTE Y CONVENCIONES

### 7.1 Árbol de directorios anotado

```text
Odontology/
├── .github/
│   ├── copilot-instructions.md             # Reglas de contexto para uso obligatorio de Zod SSOT en jsonb
│   └── workflows/
│       └── ci.yml                          # Pipeline CI GitHub Actions (Node 24.x, tsc, lint, build, test)
├── database/
│   └── migrations/
│       ├── 000_baseline.sql                # Esquema base idempotente (15 tablas)
│       └── 001_ers_1_3.sql                 # Evolución ERS v1.3: auditoría, sesiones, notas, triggers
├── docs/
│   ├── AI_CONTEXT_JSON_SCHEMAS.md          # Especificación oficial de contratos JSONB
│   ├── API.md                              # Referencia inicial de API (ver sección 6 actualizada a ERS v1.3)
│   └── MANUAL_TECNICO_Y_DESPLIEGUE.md      # Este documento oficial
├── src/
│   ├── App.tsx                             # Orquestador SPA React, enrutamiento lógico y gating RBAC en UI
│   ├── main.tsx                            # Punto de entrada React + interceptor global fetch Authorization Bearer
│   ├── index.css                           # Configuración Tailwind CSS v4 (@theme) y tokens visuales
│   ├── app/
│   │   ├── config/
│   │   │   ├── env.config.ts               # Lectura tipada y centralizada de process.env
│   │   │   └── services-catalog.config.ts  # Catálogo configurable de servicios odontológicos
│   │   ├── layouts/
│   │   │   └── InternalDashboardLayout.tsx # Shell de navegación lateral/superior y control de inactividad
│   │   ├── routes/
│   │   │   └── api.routes.ts               # Registro maestro de rutas /api/v1 con authMiddleware y RBAC
│   │   └── server.ts                       # Bootstrap Express 5, trust proxy, CORS, static SPA y CronService
│   ├── modules/
│   │   ├── appointments/                   # Módulo B: domain/, application/, infrastructure/, ui/, __tests__/
│   │   ├── clinical-documents/             # Módulo E: domain/, application/, infrastructure/, ui/, __tests__/
│   │   ├── clinical-records/               # Módulo C2: domain/, application/, infrastructure/, ui/, __tests__/
│   │   ├── consents/                       # Módulo D: domain/, application/, infrastructure/, ui/, __tests__/
│   │   ├── patients/                       # Módulo C1: domain/, application/, infrastructure/, ui/, __tests__/
│   │   └── users-auth/                     # Módulo A: domain/, application/, infrastructure/, ui/, __tests__/
│   ├── schemas/                            # Capa 2 y Capa 3 SSOT Zod + Builders de valores iniciales JSONB
│   │   ├── assets/                         # Esquemas JSON portables oficiales (odontograma.json, etc.)
│   │   ├── __tests__/schemas.test.ts       # Pruebas unitarias de contratos Zod
│   │   ├── antecedentes-clinicos.schema.ts
│   │   ├── examen-estomatognatico.schema.ts
│   │   ├── habitos-higiene.schema.ts
│   │   ├── index.ts
│   │   ├── odontograma.schema.ts
│   │   ├── plan-manejo.schema.ts
│   │   └── rol-permisos.schema.ts
│   └── shared/                             # Kernel transversal
│       ├── domain/                         # audit.port.ts, authorship-metadata.vo.ts, colombia-time/format
│       ├── infrastructure/
│       │   ├── audit/                      # audit-log.service.ts, users-audit.adapter.ts
│       │   ├── database/                   # database.ts, migrate.ts, seeds/seed-agenda.ts
│       │   ├── http/                       # http-error.handler.ts
│       │   ├── mail/                       # mailer.service.ts
│       │   ├── security/                   # auth.middleware.ts, access-control.ts, token.service.ts
│       │   └── services/                   # cron.service.ts
│       └── ui/                             # Design system reutilizable (components/, hooks/, format.ts)
├── eslint.config.mjs                       # ESLint 10 Flat Config + typescript-eslint + prettier
├── index.html                              # Shell HTML5 raíz para Vite (es-CO, Plus Jakarta Sans)
├── package.json                            # Dependencias, engines (Node 24.13.0) y scripts
├── Procfile                                # Comando de arranque Heroku: web: node dist/app/server.js
├── tsconfig.json                           # Compilador TS estricto (ES2022, CommonJS, outDir ./dist)
└── vite.config.ts                          # Bundler Vite 8 hacia dist/public y proxy /api/v1 en dev
```

### 7.2 Estándares de codificación y linters
- **Compilación estricta (`tsconfig.json`):** `"strict": true`, `"target": "ES2022"`, `"module": "CommonJS"`, `"esModuleInterop": true`, `"forceConsistentCasingInFileNames": true`. La verificación de tipos sin emisión (`npx tsc --noEmit`) es un paso bloqueante en CI.
- **Análisis estático (`eslint.config.mjs`):** configuración Flat Config basada en `eslint.configs.recommended`, `tseslint.configs.recommended` y `eslint-config-prettier`. Ignora `dist/**`, `node_modules/**`, `vite.config.ts` y `src/schemas/assets/**`. Permite variables o argumentos no utilizados únicamente si llevan prefijo `_` (`^_`).
- **Formato uniforme (`.prettierrc`):**
  - Punto y coma obligatorio (`"semi": true`).
  - Comillas simples (`"singleQuote": true`), coma final ES5 (`"trailingComma": "es5"`), ancho de línea `100`, indentación de `2` espacios y saltos de línea `LF` (`"endOfLine": "lf"`).
- **Convenciones de nombrado:**
  - *Archivos TypeScript de servidor/dominio:* `kebab-case` con sufijo de responsabilidad (`*.entity.ts`, `*.use-case.ts`, `*.repository.interface.ts`, `*.repository.ts`, `*.controller.ts`, `*.model.ts`, `*.schema.ts`, `*.service.ts`, `*.test.ts`).
  - *Componentes y vistas React:* `PascalCase.tsx` (`ActiveConsultationPage.tsx`, `OdontogramCanvas.tsx`); hooks en `camelCase.ts` (`useAuth.ts`, `usePatients.ts`).
  - *Base de datos y contratos JSONB:* `snake_case` (`id_usuario`, `fecha_nacimiento`, `antecedentes_clinicos`); DTOs de API y TypeScript en `camelCase`.
- **Flujo de ramas y commits recomendado:**
  - Ramas principales observadas: `main` (producción / liberación estable) y `dev` (integración continua), con ramas de trabajo numeradas por incidencia/historia (ej. `58-middleware-for-jwt-and-rbac`).
  - Formato de commits semánticos (*Conventional Commits*): `<tipo>(<módulo>): <descripción imperativa>` (ej. `feat(clinical-records): validar firma de notas aclaratorias`, `fix(appointments): corregir cálculo de bloques en UTC-5`, `docs(manual): agregar especificación técnica y despliegue`).

### 7.3 Manejo centralizado de excepciones y logging
- **Aislamiento de fallos HTTP (`src/shared/infrastructure/http/http-error.handler.ts`):**
  - `handleRequestError(req, res, error, defaultStatus)` intercepta errores de autorización (`statusCode === 403` o `'FORBIDDEN'`), invoca `recordBlockedAccess(req, { causa })` para persistir el intento bloqueado en `registro_auditoria` y responde `403` con el mensaje único `"No tiene permiso para realizar esta acción"`. Si falla la propia escritura de auditoría, aborta con `500` para no ocultar accesos no auditados.
  - `handleHttpError(res, error, defaultStatus)` inspecciona errores de PostgreSQL (`error.code` de 5 caracteres, `error.routine` o patrones `ENOTFOUND`, `ECONNREFUSED`, `relation .* does not exist`):
    - Código `23505` → `400` con mensaje de negocio sobre duplicidad de documento o valor único.
    - Código `22001` → `400` sobre exceso de longitud de campo.
    - Cualquier otro error de BD o red → `500` genérico (`"Error interno en el servidor. Por favor intente más tarde."`), evitando exposición de esquemas, restricciones o cadenas de conexión.
- **Auditoría transaccional y stdout/stderr:**
  - Toda mutación crítica comparte la misma conexión `PoolClient` con `auditLog.record(..., client)`. Si la inserción en `registro_auditoria` falla, se hace `ROLLBACK` completo de la operación clínica o administrativa.
  - Los eventos operativos (`🚀 Servidor OdontoLeal...`, `⏰ Tareas programadas iniciadas.`, envío de correos y errores capturados) se emiten por `console.log` / `console.error` hacia `stdout`/`stderr` para recolección automática por **Heroku Logplex**. Conforme a la mitigación **D-17 (CWE-532)**, nunca se imprimen tokens de recuperación de contraseña ni contraseñas en la salida estándar.

---

## 8. GUÍA DE DESPLIEGUE EN PRODUCCIÓN

### 8.1 Diagrama de Despliegue

<!-- ESPACIO RESERVADO PARA DIAGRAMA: Diagrama de Despliegue (UML / Infraestructura) -->

**Descripción técnica del diagrama:** El diagrama debe describir la infraestructura real de despliegue continuo y ejecución en producción: el repositorio en **GitHub** (`OdontoLeal/Odontology`), el pipeline de **GitHub Actions** (`.github/workflows/ci.yml`) ejecutando compilación, linter y las 114 pruebas automatizadas sobre `ubuntu-latest` con Node `24.x`, la plataforma **Heroku** ejecutando `npm run heroku-postbuild` y levantando el Dyno Web mediante `Procfile` (`web: node dist/app/server.js`), el complemento gestionado **Heroku Postgres** enlazado por `DATABASE_URL` bajo TLS, y los servicios SMTP externos.

```mermaid
flowchart LR
    subgraph DevAndGit["Control de Versiones y CI (GitHub)"]
        Repo["Repositorio GitHub\n(OdontoLeal/Odontology\nRamas: dev / main)"]
        GHActions["GitHub Actions Runner\n(ubuntu-latest / Node 24.x)\n1. npm ci\n2. tsc --noEmit\n3. npm run lint\n4. npm run build\n5. npm test (114 pruebas)"]
        Repo -->|"push / pull_request\n[main, master, dev]"| GHActions
    end

    subgraph HerokuCloud["Plataforma PaaS Heroku"]
        Buildpack["Heroku Node.js Buildpack\n(node =24.13.0 / heroku-postbuild)"]
        RouterTLS["Heroku Router\n(HTTPS 443 / TLS Termination)"]
        subgraph WebDyno["Heroku Web Dyno (Procfile: web: node dist/app/server.js)"]
            NodeProc["Proceso Node.js\n(dist/app/server.js\nExpress + SPA dist/public + CronService)"]
        end
        PGAddon[("Add-on Heroku Postgres\n(PostgreSQL Gestionado\nConfig Var: DATABASE_URL\nSSL: rejectUnauthorized=false)")]
        Logplex["Heroku Logplex\n(Agregador stdout / stderr)"]

        Buildpack --> NodeProc
        RouterTLS -->|"HTTP / puerto $PORT"| NodeProc
        NodeProc -->|"pg.Pool TLS"| PGAddon
        NodeProc --> Logplex
    end

    subgraph ExternalServices["Servicios Externos"]
        SMTPRelay["Proveedor SMTP\n(Gmail / Brevo / Resend)"]
        Clients["Usuarios y Pacientes\n(HTTPS *.herokuapp.com)"]
    end

    GHActions -->|"CI Verde -> Auto-Deploy GitHub/Heroku\n(rama main)"| Buildpack
    Clients -->|"HTTPS 443"| RouterTLS
    NodeProc -->|"SMTP TLS 587/465"| SMTPRelay
```

### 8.2 Proceso de compilación/build para producción
El comando de compilación definido en `package.json` es `npm run build`, el cual ejecuta secuencialmente dos compiladores:

1. **Compilación Backend (`tsc`):** lee `tsconfig.json`, verifica tipos estrictos de `src/**/*` y emite JavaScript `CommonJS` (ES2022) en `./dist/`, generando el punto de entrada `dist/app/server.js`.
2. **Empaquetado Frontend (`vite build`):** lee `vite.config.ts`, compila React 19 + TypeScript + Tailwind CSS v4 (mediante `@tailwindcss/vite`), realiza tree-shaking y minificación de CSS/JS, y genera los archivos estáticos en `./dist/public/`.

Comandos reproducibles de verificación y compilación local:

```bash
# 1. Verificación estricta de tipos sin generar archivos
npx tsc --noEmit

# 2. Verificación de calidad y estilo
npm run lint

# 3. Compilación completa Backend + Frontend
npm run build

# 4. Ejecución de suite automatizada (114 pruebas en 14 suites)
npm test

# 5. Verificación de existencia de artefactos de salida
ls -la dist/app/server.js dist/public/index.html
```

En Heroku, el buildpack oficial de Node.js detecta `package.json`, instala el runtime exacto `"node": "=24.13.0"` y ejecuta automáticamente el script `"heroku-postbuild": "npm run build"`. Al arrancar el dyno, `src/app/server.ts` comprueba `fs.existsSync(path.resolve(process.cwd(), 'dist/public'))`, registra `express.static(clientDistPath)` y sirve `dist/public/index.html` para cualquier ruta `GET` que no comience por `/api`.

### 8.3 Despliegue en la nube (Heroku + GitHub Actions) y referencia contenerizada

#### A. Flujo actual en producción: GitHub Actions CI + Heroku + Add-on Postgres

**1. Pipeline de Integración Continua (`.github/workflows/ci.yml`):**
Se activa automáticamente en cada `push` o `pull_request` hacia las ramas `main`, `master` y `dev`:

```yaml
name: CI / CD Pipeline
on:
  push:
    branches: [main, master, dev]
  pull_request:
    branches: [main, master, dev]
```

Cada ejecución aprovisiona `ubuntu-latest`, configura Node `24.x` con caché `npm` y ejecuta: `npm ci` → `npx tsc --noEmit` → `npm run lint` → `npm run build` → `npm test`. Si cualquiera de estas 5 puertas falla, el Pull Request queda marcado como fallido y Heroku (con la opción *Wait for CI to pass before deploy* habilitada en la integración GitHub–Heroku) bloquea el despliegue automático.

**2. Aprovisionamiento inicial de la aplicación y Add-on PostgreSQL en Heroku CLI:**

```bash
# 1. Autenticarse en Heroku CLI
heroku login

# 2. Crear la aplicación (si es un entorno nuevo) y asociar remoto Git
heroku create <NOMBRE_APP_HEROKU>

# 3. Aprovisionar el add-on Heroku Postgres (genera automáticamente DATABASE_URL)
heroku addons:create heroku-postgresql:essential-0 -a <NOMBRE_APP_HEROKU>

# 4. Verificar el estado y versión del add-on Postgres
heroku pg:info -a <NOMBRE_APP_HEROKU>
```

**3. Configuración de Config Vars de producción en Heroku:**
> **Nota:** `PORT` y `DATABASE_URL` son administrados automáticamente por Heroku y el add-on Postgres; nunca sobrescribirlos manualmente.

```bash
heroku config:set -a <NOMBRE_APP_HEROKU> \
  NODE_ENV=production \
  JWT_SECRET="<TU_SECRETO_JWT_PRODUCCION_64_HEX>" \
  FRONTEND_URL="https://<NOMBRE_APP_HEROKU>.herokuapp.com" \
  DB_SSL=true \
  SMTP_HOST="<TU_HOST_SMTP>" \
  SMTP_PORT=587 \
  SMTP_SECURE=false \
  SMTP_USER="<TU_USUARIO_SMTP>" \
  SMTP_PASS="<TU_CLAVE_SMTP>" \
  EMAIL_FROM="\"Consultorio OdontoLeal\" <notificaciones@odontoleal.com>"
```

*(Si se utiliza Gmail con contraseña de aplicación en lugar de un servidor SMTP dedicado, reemplazar las variables `SMTP_*` por `GMAIL_USER` y `GMAIL_APP_PASSWORD`).*

**4. Despliegue de código y ejecución de migraciones:**
Si el despliegue automático desde GitHub está conectado en el Dashboard de Heroku (*Deploy → GitHub → Enable Automatic Deploys* en `main` con *Wait for CI to pass*), cada merge a `main` tras superar `ci.yml` desencadena el build. Para despliegue manual vía CLI:

```bash
# Desplegar la rama main hacia Heroku
git push heroku main

# Verificar estado de migraciones contra Heroku Postgres
heroku run -a <NOMBRE_APP_HEROKU> "npm run db:migrate -- --status"

# Aplicar migraciones pendientes en producción (requiere --force por seguridad)
heroku run -a <NOMBRE_APP_HEROKU> "npm run db:migrate -- --force"

# Verificar dyno activo (Procfile: web: node dist/app/server.js)
heroku ps -a <NOMBRE_APP_HEROKU>
```

#### B. Referencia de despliegue contenerizado (Docker / Docker Compose)
Para escenarios de migración a servidores propios, *staging* aislado o infraestructura Kubernetes, el proyecto puede contenerizarse de forma portable mediante una compilación *multi-stage* respetando Node `24.13.0`:

**`Dockerfile` de referencia:**

```dockerfile
# Etapa 1: Compilación TypeScript + Vite
FROM node:24.13.0-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
RUN npm run build

# Etapa 2: Imagen liviana de ejecución en producción
FROM node:24.13.0-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY database ./database

EXPOSE 4000
CMD ["node", "dist/app/server.js"]
```

**`docker-compose.yml` de referencia:**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: odontoleal_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: odontoleal
      POSTGRES_USER: <TU_USUARIO_DB>
      POSTGRES_PASSWORD: <TU_PASSWORD_DB>
      TZ: America/Bogota
    ports:
      - "5432:5432"
    volumes:
      - pgdata_odontoleal:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U <TU_USUARIO_DB> -d odontoleal"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: odontoleal_app
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      PORT: 4000
      NODE_ENV: production
      DATABASE_URL: postgres://<TU_USUARIO_DB>:<TU_PASSWORD_DB>@postgres:5432/odontoleal
      DB_SSL: "false"
      JWT_SECRET: <TU_SECRETO_JWT_PRODUCCION>
      FRONTEND_URL: https://<TU_DOMINIO_O_HOST>
      SMTP_HOST: <TU_HOST_SMTP>
      SMTP_PORT: 587
      SMTP_USER: <TU_USUARIO_SMTP>
      SMTP_PASS: <TU_CLAVE_SMTP>
    ports:
      - "4000:4000"

volumes:
  pgdata_odontoleal:
```

### 8.4 Configuración de proxy inverso (Nginx) y certificados SSL

#### En el entorno productivo actual (Heroku)
- **Terminación SSL/TLS gestionada:** El **Heroku Router** recibe todas las solicitudes HTTPS externas en el puerto `443` con certificado TLS administrado automáticamente para `*.herokuapp.com` (y mediante *Automated Certificate Management — ACM* con Let's Encrypt si se configura un dominio personalizado como `portal.odontoleal.com`), reenviando el tráfico en plano interno al dyno por HTTP en `$PORT`.
- **Confianza de encabezados proxy (`src/app/server.ts`):** La línea `app.set('trust proxy', 1)` habilita a Express a leer `X-Forwarded-Proto`, `X-Forwarded-Host` y `X-Forwarded-For`, garantizando que Express reconozca la conexión como HTTPS y emita correctamente las cookies `session_token` con el atributo `Secure`.

#### Referencia Nginx + Certbot (para despliegue VPS / Docker sin Heroku)
En caso de operar sobre un servidor Linux dedicado detrás de Nginx:

```nginx
server {
    listen 80;
    server_name <TU_DOMINIO>;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name <TU_DOMINIO>;

    ssl_certificate     /etc/letsencrypt/live/<TU_DOMINIO>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<TU_DOMINIO>/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Alineado con express.json({ limit: '5mb' }) para firmas Base64
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

Emisión y renovación automática del certificado SSL con Certbot:

```bash
sudo certbot --nginx -d <TU_DOMINIO> --non-interactive --agree-tos -m <TU_CORREO_ADMIN>
sudo certbot renew --dry-run
```

---

## 9. MANTENIMIENTO, SEGURIDAD Y TROUBLESHOOTING

### 9.1 Monitoreo y ubicación de logs de error y acceso
Debido a que Heroku utiliza un sistema de archivos efímero, la aplicación no escribe archivos `.log` locales en disco; toda la telemetría fluye hacia dos destinos:

1. **Flujo en tiempo real (Heroku Logplex - `stdout` / `stderr`):**
   Registra el arranque del servidor, inicialización de `CronService`, trazas de envío/fallo SMTP y excepciones no esperadas del router HTTP de Heroku (`H10`, `H12`, `R14`).

```bash
# Monitorear logs en tiempo real de la aplicación y router
heroku logs --tail -a <NOMBRE_APP_HEROKU>

# Filtrar únicamente logs generados por el proceso Node.js (web.1)
heroku logs --tail --source app --dyno web -a <NOMBRE_APP_HEROKU>

# Filtrar únicamente errores de enrutamiento HTTP (status 4xx/5xx en router)
heroku logs --tail --source heroku --dyno router -a <NOMBRE_APP_HEROKU>
```

2. **Verificación de salud (Healthcheck):**

```bash
curl -i https://<NOMBRE_APP_HEROKU>.herokuapp.com/api/v1/health
```

3. **Auditoría forense y de seguridad persistente (`public.registro_auditoria`):**
   Almacena intentos de acceso denegados (`ACCESO_BLOQUEADO`), fallos de correo (`FALLO_CORREO`), ejecuciones del aviso diario (`AVISO_DIARIO_SOLICITUDES`), consultas de titulares (`CONSULTA_TITULAR`) y todas las mutaciones de datos clínicos/administrativos.

```bash
# Consultar los últimos 20 eventos de acceso bloqueado o fallos de correo en Heroku Postgres
heroku pg:psql -a <NOMBRE_APP_HEROKU> -c "
  SELECT id_auditoria, fecha AT TIME ZONE 'America/Bogota' AS fecha_col, actor, accion, entidad, id_registro, detalle
  FROM public.registro_auditoria
  WHERE accion IN ('ACCESO_BLOQUEADO', 'FALLO_CORREO', 'AVISO_DIARIO_SOLICITUDES')
  ORDER BY fecha DESC
  LIMIT 20;
"
```

### 9.2 Rutina de copias de seguridad (backup) y restauración de base de datos

#### A. Copias de seguridad gestionadas en Heroku Postgres (`PGBackups`)

```bash
# Programar respaldo diario automático a las 02:00 a. m. hora Colombia
heroku pg:backups:schedule DATABASE_URL --at '02:00 America/Bogota' -a <NOMBRE_APP_HEROKU>

# Ejecutar un respaldo manual bajo demanda (antes de aplicar migraciones mayores)
heroku pg:backups:capture -a <NOMBRE_APP_HEROKU>

# Listar respaldos disponibles
heroku pg:backups -a <NOMBRE_APP_HEROKU>

# Descargar el último respaldo al equipo local (formato binario custom dump)
heroku pg:backups:download -a <NOMBRE_APP_HEROKU> -o backup_odontoleal_$(date +%Y%m%d).dump

# Restaurar un respaldo específico hacia Heroku Postgres (operación destructiva)
heroku pg:backups:restore <ID_BACKUP_O_URL_S3> DATABASE_URL -a <NOMBRE_APP_HEROKU> --confirm <NOMBRE_APP_HEROKU>
```

#### B. Copias de seguridad manuales y locales con `pg_dump` / `pg_restore`

```bash
# Exportar respaldo comprimido completo (esquema + datos + triggers + schema_migrations)
pg_dump -Fc --no-owner --no-acl -d "<TU_DATABASE_URL>" -f "odontoleal_$(date +%Y%m%d_%H%M).dump"

# Exportar únicamente respaldo en SQL plano legible
pg_dump --no-owner --no-acl --clean --if-exists -d "<TU_DATABASE_URL>" -f "odontoleal_backup.sql"

# Restaurar en una base de datos destino limpia
createdb -h localhost -U <TU_USUARIO_DB> odontoleal_restore
pg_restore --no-owner --no-acl -d "postgres://<TU_USUARIO_DB>:<TU_PASSWORD_DB>@localhost:5432/odontoleal_restore" odontoleal_20261110.dump
```

> **Precaución operativa al restaurar:** Debido a los triggers `trg_auditoria_inalterable`, `trg_historia_no_eliminable`, `trg_evolucion_no_eliminable`, `trg_nota_no_eliminable` y `trg_consentimiento_no_eliminable`, toda restauración debe realizarse preferiblemente sobre una **base de datos vacía recién creada** (o reiniciando el add-on mediante `heroku pg:reset`), evitando utilizar `--clean` sobre tablas ya pobladas donde el trigger bloquearía sentencias `DELETE`.

### 9.3 Matriz de resolución de problemas comunes

| Síntoma / Error Observado | Causa Raíz Técnica | Solución Técnica Verificada |
| :--- | :--- | :--- |
| Error al arrancar en Heroku: `JWT_SECRET no está configurado.` | `NODE_ENV` es `'production'`, pero falta la variable `JWT_SECRET` (`JwtTokenService` bloquea el secreto de desarrollo en producción). | Ejecutar `heroku config:set JWT_SECRET="<SECRETO_SEGURO>" -a <APP>` y reiniciar los dynos. |
| `npm run db:migrate` aborta con: `Se detectó una BD remota/producción.` | Salvaguarda de `migrate.ts` al detectar `herokuapp.com`, `amazonaws.com`, `rds.` o `NODE_ENV=production`. | Ejecutar explícitamente `npm run db:migrate -- --force` (o vía `heroku run`). |
| Error de conexión PostgreSQL local: `The server does not support SSL connections` | En `env.config.ts`, `DB_SSL` es `true` por defecto si no se declara exactamente `'false'`. | Agregar `DB_SSL=false` al archivo `.env` local. |
| Citas o bloques horarios aparecen corridos +5 horas respecto a Colombia | Pérdida de zona horaria al serializar `timestamp without time zone` o sesión sin `America/Bogota`. | Verificar que las conexiones usen el singleton `Database` (`database.ts` configura OID `1114`/`1082` y `SET TIME ZONE 'America/Bogota'`) y que el proceso de migración haya usado `migrate.ts`. |
| Correos de recuperación o citas no llegan al buzón real y en logs aparece `Ethereal` | Faltan credenciales válidas en `GMAIL_USER`+`GMAIL_APP_PASSWORD` o en `SMTP_HOST`+`SMTP_USER`+`SMTP_PASS`. | Configurar credenciales SMTP o Gmail App Password válidas en las variables de entorno / Heroku Config Vars y verificar eventos `FALLO_CORREO` en `registro_auditoria`. |
| Error `403 Forbidden` al consultar historia clínica completa con usuario Administrador | Cumplimiento de `ClinicalAccessPolicy` (Regla de Negocio 4): `ROL-ADM` y `ROL-COA` por sí solos no acceden a historia clínica ni consentimientos; solo `ROL-ODO` y `ROL-ESP` (y `ROL-AUX` únicamente durante `En consulta`). | Verificar que el profesional tenga asignado `ROL-ODO` o `ROL-ESP` y sea el médico responsable de la cita. |
| Error `409` al finalizar cita (`En consulta` → `Atendida`) | La consulta no tiene registrada apertura de historia clínica (`evolucion.motivo_consulta`). | Guardar primero el registro clínico / motivo de consulta en `POST /api/v1/clinical-records/evolutions` antes de cambiar la cita a `Atendida`. |
| No se permite iniciar atención (`En consulta`) si se revierte el cambio temporal | Validación de fecha del mismo día (`RF-AGE-009`) documentada como deshabilitada temporalmente en `MODIFICACION_TEMPORAL_ATENCION_MISMO_DIA.md`. | Revisar `appointment.entity.ts` y `appointment-state.validator.ts` según las instrucciones de activación/reversión del documento mencionado. |
| Error `400` bloqueando creación de documentos clínicos (`ORDEN_MEDICAMENTOS`, `INCAPACIDAD`, `REMISION`) | El paciente fue creado aprobando una solicitud web pública sin campo `sexo` (estado derivado `datosIncompletos = true`). | Actualizar el campo `sexo` del paciente mediante `PUT /api/v1/patients/:id` (`RF-HCL-002`). |
| Error CORS al consumir `/api/v1` desde un dominio personalizado externo | El origen de la petición no coincide con `*.herokuapp.com`, `localhost`, host actual ni `FRONTEND_URL`. | Configurar `FRONTEND_URL=https://<TU_DOMINIO_FRONTEND>` en las Config Vars de Heroku. |
| Fallo en `heroku-postbuild` o CI por sintaxis o versión de Node | Entorno corriendo una versión de Node distinta a la especificada en `package.json` (`24.13.0`). | Alinear el entorno local o runner a Node `24.13.0` y ejecutar `npm ci && npx tsc --noEmit && npm run lint && npm run build`. |

### 9.4 Consideraciones de seguridad implementadas
- **Control de acceso basado en roles (RBAC) dinámico y no escalable:**
  - Todo endpoint protegido pasa por `authMiddleware` y `requirePermission(...)`, consultando los roles y permisos vigentes en PostgreSQL en cada petición (`loadActiveSessionUser`).
  - El esquema `ConfigurableRolPermisosSchema` (`src/schemas/rol-permisos.schema.ts`) y `RoleEntity` bloquean la asignación de permisos clínicos protegidos (`RF-HCL-005`..`009`, `RF-CON-001`..`003`, `RF-DOC-001`..`004`) a roles personalizados y protegen los 6 roles iniciales (`ROL-PAC`, `ROL-ODO`, `ROL-ESP`, `ROL-COA`, `ROL-AUX`, `ROL-ADM`) contra alteración o borrado.
  - Se impide inactivar al último administrador activo y el usuario técnico `Sistema` (`es_sistema = true`) tiene prohibida la autenticación interactiva.
- **Almacenamiento seguro de contraseñas (`HybridPasswordHasherService`):**
  - Las contraseñas nuevas, temporales y restablecidas se derivan con `crypto.scryptSync` (longitud de clave 64 bytes) y un salt criptográfico aleatorio de 16 bytes (`crypto.randomBytes(16)`), verificadas en tiempo constante mediante `crypto.timingSafeEqual` para mitigar ataques de temporización.
- **Gestión segura de sesiones y mitigación de fuerza bruta:**
  - Tokens JWT `HS256` validados con `timingSafeEqual`, transportados por cabecera `Bearer` y cookie `HttpOnly` + `SameSite=Lax` + `Secure` (en producción), revocables en servidor por hash SHA-256 (`public.sesion_revocada`) al cerrar sesión.
  - Bloqueo temporal de 15 minutos en `public.intento_login` tras 5 intentos fallidos consecutivos (tanto para correos existentes como inexistentes, evitando enumeración de usuarios).
  - Cierre automático de sesión por inactividad tras 30 minutos (aviso al minuto 29) con respaldo de borradores por usuario en `public.borrador_sesion`.
  - Tokens de recuperación de contraseña de un solo uso con expiración estricta de 30 minutos e invalidación de tokens previos, nunca registrados en logs (mitigación CWE-532).
- **Prevención de Inyección SQL, XSS y fuga de errores:**
  - Todas las consultas en `pg` utilizan parámetros posicionales (`$1, $2, ...`), evitando concatenación de cadenas SQL.
  - Los payloads clínicos estructurados son saneados y validados por `Zod` antes de persistirse en `jsonb`.
  - `http-error.handler.ts` intercepta excepciones de PostgreSQL y de red para evitar fugas de detalles internos hacia el cliente.
  - React escapa por defecto las interpolaciones en el DOM previniendo XSS reflejado o almacenado.
- **Política CORS restrictiva y protección proxy:**
  - Lista blanca verificada dinámicamente por petición en `src/app/server.ts`, restringida a métodos `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS` y cabeceras `Content-Type`, `Authorization`, `X-Requested-With`, con límite de carga útil `5mb` y `trust proxy = 1`.
- **Protección de datos personales (Ley 1581 de 2012) e inmutabilidad médico-legal:**
  - Aviso de privacidad público sin sesión (`GET /api/v1/public/privacy-notice`) y aceptación versionada obligatoria en solicitudes públicas.
  - Exportación auditada (`CONSULTA_TITULAR`) de datos personales del titular restringida exclusivamente a `ROL-COA` y `ROL-ADM`.
  - Triggers PL/pgSQL que impiden el borrado de historias clínicas, evoluciones, notas aclaratorias y consentimientos firmados, y bloquean toda modificación o borrado en `public.registro_auditoria`.
