# 📖 Especificación de la API REST — OdontoLeal (v1)

Base URL: `/api/v1`  
Protocolo: HTTP/1.1  
Formato de Intercambio: JSON (`application/json`)  
Autenticación: Bearer Token JWT en cabecera `Authorization: Bearer <token>`

---

## 📑 Tabla de Contenidos

1. [Estructura Estándar de Respuestas y Errores](#1-estructura-estándar-de-respuestas-y-errores)
2. [Módulo A: Usuarios, Roles y Autenticación](#2-módulo-a-usuarios-roles-y-autenticación)
3. [Módulo B: Agendamiento de Citas y Agenda Semanal](#3-módulo-b-agendamiento-de-citas-y-agenda-semanal)
4. [Módulo C: Pacientes, Ficha Médica e Historia Clínica](#4-módulo-c-pacientes-ficha-médica-e-historia-clínica)
5. [Módulo D: Consentimientos Informados y Firma Móvil](#5-módulo-d-consentimientos-informados-y-firma-móvil)
6. [Módulo E: Documentos Clínicos Oficiales](#6-módulo-e-documentos-clínicos-oficiales)

---

## 1. Estructura Estándar de Respuestas y Errores

### Respuesta Exitosa
```json
{
  "status": "OK",
  "data": { ... },
  "message": "Operación realizada con éxito"
}
```

### Respuesta de Error
```json
{
  "status": "ERROR",
  "message": "Descripción legible de la regla de negocio o validación infringida",
  "errors": [ ... ]
}
```

### Códigos de Estado HTTP
- `200 OK`: Consulta o actualización ejecutada correctamente.
- `201 Created`: Recurso creado exitosamente.
- `400 Bad Request`: Parámetros inválidos o violación de reglas de negocio.
- `401 Unauthorized`: Token ausente, expirado o credenciales incorrectas.
- `403 Forbidden`: El rol del usuario no cuenta con los permisos requeridos (RBAC).
- `404 Not Found`: El recurso solicitado no existe.
- `409 Conflict`: Conflicto de unicidad (documento, correo o bloque ya ocupado).
- `500 Internal Server Error`: Excepción no controlada en el servidor.

---

## 2. Módulo A: Usuarios, Roles y Autenticación

### 2.1 Autenticación y Recuperación

#### `POST /auth/login`
Inicia sesión con credenciales de usuario. Bloquea temporalmente por 15 minutos tras 5 intentos fallidos consecutivos.

- **Request Body:**
```json
{
  "documento": "1098765432",
  "password": "Password123!"
}
```
- **Response (200 OK):**
```json
{
  "status": "OK",
  "data": {
    "token": "eyJhbGciOi...",
    "usuario": {
      "idUsuario": 1,
      "nombreCompleto": "Dr. Eduar Leal Álvarez",
      "documento": "1098765432",
      "correo": "eduar.leal@odontoleal.com",
      "roles": ["ROL-ADM", "ROL-ODO"]
    }
  }
}
```

#### `POST /auth/recovery/request`
Genera un token de un solo uso con vigencia de 30 minutos y envía un enlace por correo electrónico.

- **Request Body:**
```json
{
  "correo": "doctor@odontoleal.com"
}
```

#### `POST /auth/recovery/reset`
Restablece la contraseña utilizando el token temporal.

- **Request Body:**
```json
{
  "token": "a1b2c3d4...",
  "nuevaPassword": "NuevaPassword456!"
}
```

#### `POST /auth/logout` *(Requiere Token)*
Invalida la sesión activa y limpia los borradores en memoria.

---

### 2.2 Administración de Usuarios

#### `GET /users` *(Requiere Token)*
Busca y lista usuarios del sistema con filtrado insensible a mayúsculas y acentos.
- **Query Params:** `query` (opcional), `estado` (opcional).

#### `POST /users` *(Requiere Token - ROL-ADM)*
Crea un nuevo usuario profesional o administrativo. Asigna contraseña temporal y notifica por email.
- **Request Body:**
```json
{
  "documento": "1234567890",
  "nombreCompleto": "Dra. Marcela Gómez",
  "correo": "marcela.gomez@odontoleal.com",
  "telefono": "+57 310 123 4567",
  "roles": [2],
  "firmaBase64": "data:image/png;base64,..."
}
```

#### `PUT /users/:id` *(Requiere Token - ROL-ADM)*
Actualiza información de perfil, roles asignados y firma digital.

#### `PATCH /users/:id/status` *(Requiere Token - ROL-ADM)*
Activa o inactiva el acceso de un usuario. Impide inactivar al único administrador activo del sistema.

---

### 2.3 Roles y Permisos (RBAC)

#### `GET /roles` *(Requiere Token)*
Obtiene la lista de roles del sistema y su matriz de permisos funcionales.

#### `POST /roles` *(Requiere Token - ROL-ADM)*
Crea un rol configurable. Valida mediante Zod que no se asignen permisos clínicos protegidos.
- **Request Body:**
```json
{
  "nombreRol": "Auditor Externo",
  "descripcion": "Rol con permisos de solo lectura sobre consentimientos y agenda",
  "permisos": ["RF-AGE-008", "RF-CON-003"]
}
```

#### `PUT /roles/:id` y `DELETE /roles/:id` *(Requiere Token - ROL-ADM)*
Modifica o elimina roles creados. Protege contra eliminación de los roles iniciales y roles asignados a usuarios activos.

---

## 3. Módulo B: Agendamiento de Citas y Agenda Semanal

### 3.1 Portal Público de Pacientes

#### `GET /appointments/available-slots`
Consulta bloques de horario libres (30 minutos) para una fecha específica.
- **Query Params:** `fecha=YYYY-MM-DD`

#### `POST /appointments/public-requests`
Registra solicitud pública de cita con reserva exclusiva preventiva del bloque.
- **Validaciones:** Ventana de 5 a 60 días calendario y consentimiento de Habeas Data Ley 1581.
- **Request Body:**
```json
{
  "nombreSolicitante": "Lucía Morales",
  "documentoSolicitante": "52876543",
  "correoSolicitante": "lucia.morales@gmail.com",
  "telefonoSolicitante": "+57 315 987 6543",
  "fechaNacimiento": "1994-06-15",
  "sexo": "F",
  "bloqueSolicitado": "2026-11-15 09:30:00",
  "descripcion": "Valoración inicial para diseño de sonrisa",
  "autorizacionDatos": true
}
```

---

### 3.2 Gestión Interna de Agenda

#### `GET /appointments/agenda` *(Requiere Token)*
Retorna la agenda semanal con citas, bloques asociados, paciente, profesional responsable y trazabilidad.
- **Query Params:** `fecha=YYYY-MM-DD`, `idProfesional` (opcional), `idPaciente` (opcional).

#### `POST /appointments` *(Requiere Token)*
Agenda una cita interna directamente en estado **Confirmada** con registro del usuario gestor.
- **Request Body:**
```json
{
  "titulo": "Limpieza y Profilaxis",
  "descripcion": "Limpieza ultrasónica dental",
  "idPaciente": 12,
  "idUsuarioProfesional": 3,
  "idUsuarioGestor": 1,
  "bloques": [
    "2026-11-10 14:00:00",
    "2026-11-10 14:30:00"
  ]
}
```

#### `POST /appointments/requests/:id/review` *(Requiere Token - ROL-COA / ROL-ADM)*
Aprueba o rechaza una solicitud web. Al aprobar, da de alta automática al paciente si es nuevo y confirma la cita.
- **Request Body:**
```json
{
  "aprobar": true,
  "motivo": "Solicitud aprobada y asignada al consultorio 01",
  "idUsuarioGestor": 1,
  "idProfesional": 2,
  "selectedBlocks": ["2026-11-15 09:30:00"]
}
```

#### `PATCH /appointments/:id/state` *(Requiere Token)*
Aplica transiciones de estado a la cita médica:
- `En consulta`: Solo permitida por el profesional asignado; verifica que no tenga otra cita activa en consulta.
- `Atendida` / `Completada`: Requiere que la evolución clínica cuente con motivo de consulta y procedimiento.
- `Cancelada`: Libera los bloques de horario en la agenda.
- `No asistió`: Conserva los bloques ocupados conforme a la norma RF-AGE-013.

---

## 4. Módulo C: Pacientes, Ficha Médica e Historia Clínica

### 4.1 Pacientes y Habeas Data

#### `GET /patients` *(Requiere Token)*
Búsqueda de pacientes por nombre o documento exacto.

#### `POST /patients` *(Requiere Token)*
Registra un nuevo paciente y crea automáticamente su ficha de historia clínica.

#### `GET /patients/:id` *(Requiere Token)*
Obtiene el perfil del paciente con segregación de datos clínicos según el rol del usuario conectado.

#### `GET /patients/holder/:documento` *(Requiere Token - ROL-COA / ROL-ADM)*
Exporta reporte oficial de datos del titular conforme al principio de Habeas Data (Ley 1581 de 2012).

---

### 4.2 Historia Clínica y Odontograma FDI

#### `GET /clinical-records/patient/:idPaciente` *(Requiere Token)*
Obtiene el historial cronológico descendente de evoluciones del paciente.

#### `GET /clinical-records/odontogram/latest/:idPaciente` *(Requiere Token)*
Obtiene el último odontograma validado del paciente o genera uno en blanco para primera vez.

#### `POST /clinical-records` *(Requiere Token - ROL-ODO / ROL-ESP)*
Registra una evolución clínica. Solo se permite cuando la cita asociada está en estado **En consulta**.
- **Contratos JSONB:** Valida `antecedentesClinicos`, `habitosHigiene`, `examenEstomatognatico`, `odontograma` y `planManejo`.

---

## 5. Módulo D: Consentimientos Informados y Firma Móvil

### 5.1 Plantillas de Consentimientos

#### `GET /consents/templates` *(Requiere Token)*
Lista las plantillas de consentimientos activas y versionadas.

#### `POST /consents/templates` *(Requiere Token - ROL-ADM)*
Crea una plantilla con soporte para interpolación dinámica de variables (`{{nombre_paciente}}`, etc.).

---

### 5.2 Firma Digital y Firma en Tablet / QR

#### `POST /consents/sign` *(Requiere Token)*
Registra un consentimiento firmado directamente en el consultorio.
- Valida documento y nombre del acudiente si `firmaPorAcudiente` es verdadero.

#### `POST /consents/tablet-token` *(Requiere Token)*
Genera un token temporal para firma en dispositivo móvil o tableta.

#### `GET /consents/tablet-session/:token`
Ruta pública para cargar el formulario de firma en la tablet sin requerir inicio de sesión del paciente.

#### `POST /consents/tablet-sign/:token`
Envía los trazos de firma desde la tablet para consolidar el documento.

#### `GET /consents/:id/pdf` *(Requiere Token)*
Genera en memoria y descarga el PDF oficial (%PDF-1.7) con texto consolidado y firmas incrustadas.

---

## 6. Módulo E: Documentos Clínicos Oficiales

#### `POST /clinical-documents` *(Requiere Token - ROL-ODO / ROL-ESP)*
Genera un documento clínico oficial con firma digital incrustada del profesional responsable:
- **`RECETA`:** Orden médica con listado de principios activos, concentración, vía y duración.
- **`INCAPACIDAD`:** Certificado de reposo médico (entre 1 y 30 días calendario) con validación de fechas.
- **`REMISION`:** Remisión a especialidades del catálogo oficial.

#### `GET /clinical-documents/patient/:idPaciente` *(Requiere Token)*
Lista los documentos clínicos emitidos para el paciente con segregación de acceso por rol.
