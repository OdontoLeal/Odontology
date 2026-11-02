# 🦷 OdontoLeal — Sistema de Gestión Clínica y Odontológica Integral

Plataforma empresarial full-stack para la gestión clínica, agendamiento de citas, historia clínica digital con odontograma interactivo FDI, emisión de documentos clínicos oficiales, consentimientos informados con firma digital/móvil y control de acceso basado en roles (RBAC).

Desarrollado bajo principios de **Clean Code**, **SOLID** y arquitectura modular por dominios (**Domain-Driven Design / Clean Architecture**).

---

## 🏛️ Arquitectura del Sistema

El proyecto implementa una arquitectura modular desacoplada en tres capas principales:

```
src/
├── app/                        # Configuración global, servidor Express y Vite
│   ├── config/                 # Variables de entorno y catálogos estáticos
│   └── routes/                 # Enrutador centralizado de la API REST (/api/v1)
├── modules/                    # Módulos desacoplados de dominio (DDD)
│   ├── users-auth/             # Módulo A: Gestión de Usuarios, Roles y Autenticación
│   ├── appointments/           # Módulo B: Agendamiento, Agenda Semanal y Solicitudes
│   ├── patients/               # Módulo C (P1): Ficha de Paciente y Habeas Data
│   ├── clinical-records/       # Módulo C (P2): Historia Clínica, Odontograma FDI y Evolución
│   ├── consents/               # Módulo D: Plantillas y Consentimientos Informados Firmados
│   └── clinical-documents/     # Módulo E: Órdenes Farmacológicas, Incapacidades y Remisiones
├── schemas/                    # Contratos de Datos Zod (Single Source of Truth)
│   └── assets/                 # Esquemas JSON oficiales portables
└── shared/                     # Kernel compartido (Database, Seguridad, UI Components)
```

### Principios SOLID Aplicados
- **Single Responsibility (SRP):** Cada caso de uso, repositorio y componente visual resuelve una única responsabilidad. Las vistas complejas como `AppointmentDetailPage` y `EvolutionTemplateEditor` se descomponen en componentes de presentación y pestañas dedicadas.
- **Open/Closed (OCP):** El sistema permite incorporar nuevos roles configurables, plantillas de consentimiento y hallazgos dentales sin modificar el código fuente del núcleo.
- **Liskov Substitution (LSP):** Los repositorios en memoria (`InMemory*`) implementan fielmente los contratos de interfaz de los repositorios Postgres para garantizar pruebas unitarias idénticas a producción.
- **Interface Segregation (ISP):** Interfaces pequeñas y especializadas por puertos (`IClinicalRecordCheckerPort`, `IAppointmentStatePort`, etc.).
- **Dependency Inversion (DIP):** Los casos de uso dependen de interfaces y abstracciones, no de implementaciones concretas de infraestructura.

---

## 🔐 Matriz de Roles y Permisos (RBAC)

El sistema cuenta con roles iniciales protegidos y roles dinámicos configurables:

| Código | Rol | Alcance y Capacidades Clave |
| :--- | :--- | :--- |
| **ROL-ADM** | Administrador | Control total de usuarios, roles, permisos, catálogos del sistema y auditoría. |
| **ROL-COA** | Coordinadora de Agendamiento | Gestión de agenda general, revisión de solicitudes públicas, asignación de doctores y Habeas Data. |
| **ROL-ODO** | Odontólogo General | Atención clínica, evolución, diligenciamiento de historia clínica, odontograma y emisión de documentos. |
| **ROL-ESP** | Especialista | Valoración especializada, diligenciamiento clínico y emisión de órdenes. |
| **ROL-AUX** | Auxiliar Odontológica | Apoyo en consultorio durante cita "En consulta", pre-diligenciamiento de odontograma y consulta de agenda. |
| **ROL-REC** | Recepcionista | Búsqueda básica de pacientes, recepción en sala de espera y consulta de disponibilidad de citas. |

> [!NOTE]
> Los roles configurables creados por el administrador no pueden recibir permisos clínicos protegidos (`RF-HCL-005` a `RF-HCL-009`) ni permisos automáticos/universales, garantizando la integridad legal de los actos médicos.

---

## 📋 Requisitos Previos

- **Node.js:** Versión 24.x (compatible `>=20.x`)
- **NPM:** Versión `>=10.0.0`
- **PostgreSQL:** Versión 15 o superior
- **Navegador Web:** Chrome, Firefox, Edge o Safari moderno

---

## 🚀 Instalación y Puesta en Marcha

### 1. Clonar el Repositorio
```bash
git clone https://github.com/AdtC818/Odontology.git
cd Odontology
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configuración de Variables de Entorno
Crear un archivo `.env` en la raíz del proyecto basado en las variables requeridas:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgres://usuario:password@localhost:5432/odontology_db
JWT_SECRET=super_secret_jwt_key_odontoleal_2026
SESSION_TIMEOUT_MINUTES=30

# Configuración de Correo Electrónico (Nodemailer / SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notificaciones@odontoleal.com
SMTP_PASS=tu_password_de_aplicacion
SMTP_FROM="OdontoLeal Clínica" <notificaciones@odontoleal.com>
```

### 3.1. Inicialización de la Base de Datos (PostgreSQL - DEF-27)

El esquema relacional completo del sistema (15 tablas, restricciones de integridad referencial, índices y auditoría médica) se encuentra versionado en el repositorio:
* **Script DDL canónico:** [`database/schema.sql`](database/schema.sql)
* **Dump de referencia:** [`database/DDL_ult_version.txt`](database/DDL_ult_version.txt)

Para inicializar la base de datos en un entorno local o de desarrollo aislado (Docker, PostgreSQL local):
```bash
# Ejecutar script de inicialización DDL (protegido por defecto contra bases de producción)
npm run db:init

# En caso de requerir ejecución explícita forzada:
npm run db:init -- --force
```
*Alternativamente, puede importar directamente el archivo `database/schema.sql` en su cliente PostgreSQL preferido (DBeaver, pgAdmin o `psql -d odontoleal -f database/schema.sql`).*

### 4. Ejecución en Modo Desarrollo
Inicia el servidor backend con recarga automática y el cliente frontend Vite:
```bash
npm run dev
```

### 5. Compilación para Producción
```bash
npm run build
npm start
```

---

## 🧪 Pruebas Automatizadas y Portabilidad

La suite cuenta con **82 pruebas unitarias e integradas** que cubren el 100% de los requerimientos funcionales del ERS v1.2:

```bash
npm test
```

### Portabilidad Garantizada
Todos los esquemas de datos oficiales (`odontograma.json`, `antecendentes_clinicos.json`, `habitos_higiene.json`, `examen_estomatognatico.json`, `plan_manejo.json`) se encuentran empaquetados dentro del repositorio en `src/schemas/assets/`, permitiendo que la suite se ejecute de manera portable en cualquier entorno (Windows, Linux, macOS o contenedores Docker).

---

## 🔍 Linter y Formato de Código

El proyecto incluye configuración moderna de **ESLint 9+ (Flat Config)** y **Prettier**:

```bash
# Analizar código con ESLint
npm run lint

# Corregir advertencias automáticamente
npm run lint:fix

# Formatear archivos con Prettier
npm run format

# Verificar consistencia de formato
npm run format:check
```

---

## 🔄 Integración Continua (CI / CD)

El repositorio incluye un pipeline automatizado en **GitHub Actions** (`.github/workflows/ci.yml`) que valida en cada `push` o `pull request` a las ramas principales:
1. Instalación limpia de dependencias (`npm ci`).
2. Comprobación estricta de tipos de TypeScript (`npx tsc --noEmit`).
3. Validación de linter y calidad de código (`npm run lint`).
4. Compilación del proyecto (`npm run build`).
5. Ejecución completa de las 82 pruebas automatizadas (`npm test`).

---

## 📚 Documentación de la API

Para consultar la referencia completa de todos los endpoints REST, parámetros, códigos de estado HTTP y contratos de solicitud/respuesta, consulta la guía detallada en [docs/API.md](docs/API.md).
