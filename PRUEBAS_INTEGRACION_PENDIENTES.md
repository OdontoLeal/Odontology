# Suite de Pruebas de Integración: Verificación y Corrección (I2 - I9)

## 1. Contexto Global y Reglas de Seguridad (CRÍTICO)
- **Estado general:** Todos los casos listados abajo se encuentran en estado `Bloqueado` (29/10/2026) porque realizan operaciones de escritura (`POST`, `PATCH`, `DELETE`, `DDL`) y el archivo `.env` actual apunta a la **Base de Datos Compartida**.
- **Regla de Oro para el Agente:** **NUNCA** ejecutes pruebas de escritura ni alteración de tablas (`RENAME TABLE`) contra la base de datos compartida/remota. 
  1. Antes de cualquier prueba dinámica, verifica a qué host apunta `DATABASE_URL` o las variables de conexión en `.env`.
  2. Si no hay una BD local de pruebas disponible, realiza **Verificación por Análisis Estático de Código** (revisando rutas, controladores, casos de uso y repositorios) y genera los parches de código o scripts de pruebas automatizadas (Jest/Supertest con mocks o contenedor local) sin mutar la BD compartida.
- **Entorno esperado para ejecución dinámica:** Backend en puerto `4000`, BD PostgreSQL local con esquema (`pg_dump -s`) y datos semilla cargados, sesión de Administrador activa (cookie/JWT).

## 2. Mapa de Defectos y Observaciones Relacionadas
El agente debe tener en cuenta estos hallazgos previos al auditar el código:
- **O-01:** `DELETE /api/v1/roles/:id` responde `400` con mensaje vacío cuando el rol está asignado.
- **D-04:** Discrepancia entre diagrama y código en documentos clínicos. No existe la columna `tipoRegistro` en la tabla `evolucion`; el código actual (`clinical-document.repository.ts`) guarda los documentos dentro de la columna `evolucion.plan_manejo` (`JSONB`) en la lista `"documentos"`.
- **D-05:** Endpoints de la API sin middleware de autenticación activo, lo que permitiría bloquear cuentas de usuarios reales en pruebas de fuerza bruta.
- **O-07 / v1.11:** En el diagrama, `solicitud_cita.estado` es `BOOLEAN`, pero el flujo maneja 3 estados. En el código actual (`appointment.repository.ts`, línea 199), la solicitud pública crea una cita preliminar en estado `"Solicitada"`, la aprobación la pasa a `"Confirmada"` y el rechazo a `"Rechazada"`.
- **O-08:** La BD no tiene restricción única (`UNIQUE`) que impida dos citas en el mismo bloque; la única defensa es el bloqueo pesimista `FOR UPDATE` en `createPublicRequest`.
- **D-09:** Por revisión estática (`I4-008`), el código actual no rechaza la doble aprobación de una misma solicitud (incumple `RF-AGE-005`).
- **O-09:** En consentimientos, `nombre` y `plantilla_url` son únicos, `consentimiento_firmado` no guarda la versión de la plantilla, y la PK `(id_consentimiento, id_paciente)` solo permite una firma por paciente y plantilla.
- **O-10:** El diagrama de BD no muestra una tabla independiente de tokens para recuperación de contraseña; verificar en el código dónde se persiste el token y su expiración.

---

## 3. Casos de Prueba por Módulo de Integración

### Módulo I2: Usuarios, Roles y Autenticación

#### [ ] I2-006 | Borrado de rol asignado a un usuario
- **Requisito:** `RF-USR-011`
- **Flujo / Componente:** `DELETE /api/v1/roles/:id` -> tabla `usuario-rol`
- **Tipo de prueba:** Error esperado
- **Precondiciones:** BD de prueba con esquema y semilla. Admin autenticado. Existe un rol asignado a al menos un usuario.
- **Datos de entrada:** `DELETE` del ID del rol asignado.
- **Pasos:**
  1. Enviar `DELETE /api/v1/roles/<id_rol_asignado>`.
  2. Revisar código HTTP y cuerpo de la respuesta.
  3. Consultar en la BD la tabla de roles y las filas de `usuario-rol`.
- **Resultado esperado:** El sistema rechaza el borrado con un mensaje claro (corrigiendo `O-01` donde respondía 400 con mensaje vacío), o lo gestiona según regla de negocio sin dejar relaciones huérfanas ni usuarios sin rol.
- **Notas para el Agente:** Verificar el controlador/caso de uso de borrado de roles y asegurar que el error `400/409` devuelva un mensaje descriptivo en JSON.

#### [ ] I2-008 | Control de bloqueo por intentos fallidos de login
- **Requisito:** `RF-USR-005`
- **Flujo / Componente:** `POST /api/v1/auth/login` -> `authenticate-user.use-case.ts`
- **Tipo de prueba:** Error esperado
- **Precondiciones:** Usuario de prueba `qa.i2001@correo.com` activo (quedó inactivo tras `I2-007`; requiere reactivación en BD local). **Probar solo con ese usuario**.
- **Datos de entrada:** Contraseña incorrecta repetida hasta alcanzar el límite de intentos (confirmar límite exacto en `authenticate-user.use-case.ts` o ERS).
- **Pasos:**
  1. Enviar login con contraseña incorrecta repetidamente hasta alcanzar el límite.
  2. Revisar el mensaje de cada intento.
  3. Intentar login con la contraseña correcta mientras dura el bloqueo (15 min).
  4. Esperar 15 minutos (o simular avance de tiempo/expiración en BD local) y repetir con contraseña correcta.
- **Resultado esperado:** Al alcanzar el límite, responde `"Demasiados intentos fallidos. Intente de nuevo en 15 minutos"` incluso con la contraseña correcta. Pasados los 15 minutos, el login vuelve a funcionar.

---

### Módulo I3: Pacientes e Historia Clínica (Transaccionalidad)

#### [ ] I3-002 | Rollback en creación de paciente + historia clínica (Contrato Roto)
- **Requisito:** `RF-HCL-001`
- **Flujo / Componente:** `POST` de pacientes -> transacción `paciente` + `historia_clinica`
- **Tipo de prueba:** Rollback de transacción
- **Precondiciones:** **Exclusivamente en BD de prueba local**. Admin autenticado.
- **Datos de entrada:** Paciente nuevo con documento `1000000002`, con la tabla de historia clínica renombrada temporalmente para forzar fallo.
- **Pasos:**
  1. En la BD local, renombrar temporalmente la tabla de historia clínica.
  2. Enviar el `POST` de creación de paciente.
  3. Consultar en la BD si quedó insertado el registro en la tabla `paciente`.
  4. Restaurar inmediatamente el nombre original de la tabla de historia clínica.
- **Resultado esperado:** La petición falla con un error controlado (`500/400` manejado) y se ejecuta `ROLLBACK` completo: no queda ningún paciente creado sin historia clínica.
- **Notas para el Agente:** Verificar en el repositorio de pacientes que la inserción de paciente e historia clínica compartan el mismo `QueryRunner` / cliente de transacción (`BEGIN ... COMMIT / ROLLBACK`).

---

### Módulo I4: Solicitudes y Agendamiento de Citas

#### [ ] I4-001 | Creación de solicitud de cita en bloque libre
- **Requisito:** `RF-AGE-003`
- **Flujo / Componente:** Módulo de citas (frontend) -> API de solicitudes y citas -> tablas de `solicitud`, `bloque_horario`, `cita` e `historial`
- **Tipo de prueba:** Camino feliz
- **Precondiciones:** Existen un paciente, un profesional y un bloque de horario libre.
- **Datos de entrada:** Solicitud de cita para el bloque libre.
- **Pasos:**
  1. Crear la solicitud con el `POST` de solicitudes (confirmar ruta exacta en `api.routes.ts`).
  2. Consultar en la BD la solicitud, la cita preliminar, el bloque y su historial.
- **Resultado esperado (Original vs Código v1.11):**
  - *Caso original:* La solicitud queda en estado pendiente, el historial registra su creación y el bloque sigue libre.
  - *Comportamiento actual en código (`v1.11`, `appointment.repository.ts` l. 199):* `createPublicRequest` bloquea el bloque con `FOR UPDATE`, lo marca ocupado y crea una cita preliminar en estado `"Solicitada"`.
- **Notas para el Agente:** Verificar y alinear la discrepancia `O-07` (`solicitud_cita.estado` booleano en diagrama vs estados `"Solicitada"`, `"Confirmada"`, `"Rechazada"` en código).

#### [ ] I4-002 | Aprobación de solicitud de cita pendiente
- **Requisito:** `RF-AGE-005`
- **Flujo / Componente:** API de solicitudes y citas -> tablas de `solicitud`, `bloque_horario`, `cita` e `historial`
- **Tipo de prueba:** Camino feliz
- **Precondiciones:** Solicitud pendiente creada en `I4-001`.
- **Datos de entrada:** Aprobación de la solicitud mediante ruta de revisión.
- **Pasos:**
  1. Aprobar la solicitud con el endpoint de revisión (confirmar ruta en `api.routes.ts`).
  2. Consultar en la BD la solicitud, la cita, el bloque y el historial.
- **Resultado esperado:** La cita ligada a la solicitud y al bloque pasa a estado `"Confirmada"` (según `v1.11`), el bloque permanece ocupado, la solicitud queda aprobada y el historial registra la transición.

#### [ ] I4-003 | Concurrencia: Dos solicitudes públicas simultáneas para el mismo bloque
- **Requisito:** `RF-AGE-003`
- **Flujo / Componente:** API de solicitudes públicas -> bloqueo `FOR UPDATE` en BD
- **Tipo de prueba:** Error esperado (Concurrencia)
- **Precondiciones:** Existe un bloque de horario libre.
- **Datos de entrada:** Dos peticiones `POST` de solicitudes públicas idénticas/simultáneas apuntando al mismo bloque libre.
- **Pasos:**
  1. Preparar dos peticiones concurrentes (`Promise.all` o dos terminales simultáneas) con el `POST` de solicitud pública para el mismo bloque.
  2. Ejecutarlas al mismo tiempo.
  3. Consultar las solicitudes, citas y el bloque en la BD.
- **Resultado esperado:** Una solicitud se crea (`2xx`) y la otra se rechaza con un error controlado (`"ya se encuentra ocupado"`). El bloque queda ocupado una sola vez gracias a `SELECT ... FOR UPDATE`.
- **Notas para el Agente:** Como la BD no tiene constraint `UNIQUE` que impida dos citas en el mismo bloque (`O-08`), revisar que el orden de bloqueo transaccional en `createPublicRequest` sea hermético ante condiciones de carrera.

#### [ ] I4-004 | Doble aprobación de una misma solicitud
- **Requisito:** `RF-AGE-005`
- **Flujo / Componente:** API de revisión de solicitudes -> tablas de `solicitud`, `cita` e `historial`
- **Tipo de prueba:** Error esperado
- **Precondiciones:** Solicitud ya aprobada previamente (`I4-002`).
- **Datos de entrada:** Petición de aprobación sobre la misma solicitud ya aprobada.
- **Pasos:**
  1. Enviar nuevamente la petición de aprobación.
  2. Contar las citas asociadas a la solicitud y los registros de historial en la BD.
- **Resultado esperado:** Respuesta `4xx` controlada indicando que la solicitud ya cambió de estado (según ERS `RF-AGE-005`). No se duplica la cita ni se altera el historial.
- **Notas para el Agente:** **Defecto detectado (`D-09`):** Por revisión estática (`I4-008`), el código actual NO rechaza la doble aprobación. Corregir la validación de estado previo antes de procesar la transición.

#### [ ] I4-005 | Rechazo de solicitud de cita con motivo
- **Requisito:** `RF-AGE-005`
- **Flujo / Componente:** API de revisión de solicitudes -> tablas de `solicitud`, `bloque_horario`, `cita` e `historial`
- **Tipo de prueba:** Camino feliz
- **Precondiciones:** Nueva solicitud pendiente.
- **Datos de entrada:** Rechazo de la solicitud indicando un motivo válido.
- **Pasos:**
  1. Rechazar la solicitud mediante la ruta de revisión.
  2. Consultar en la BD la solicitud, la cita preliminar, el bloque y el historial.
- **Resultado esperado:** La solicitud/cita pasa a `"Rechazada"` con su motivo registrado en el historial, y **el bloque de horario vuelve a quedar libre** (verificar que si `createPublicRequest` ocupó el bloque al solicitarla, el rechazo lo libere correctamente).

#### [ ] I4-006 | Rollback al aprobar solicitud si falla el registro de historial (Contrato Roto)
- **Requisito:** `RF-AGE-005`
- **Flujo / Componente:** Transacción de aprobación de cita -> tabla de `historial`
- **Tipo de prueba:** Rollback de transacción
- **Precondiciones:** **Solo en BD de prueba local**. Solicitud pendiente.
- **Datos de entrada:** Aprobación de solicitud con la tabla de historial renombrada temporalmente.
- **Pasos:**
  1. En la BD local, renombrar temporalmente la tabla de historial.
  2. Enviar petición para aprobar la solicitud.
  3. Consultar el estado de la solicitud, la cita y el bloque en la BD.
  4. Restaurar el nombre de la tabla de historial.
- **Resultado esperado:** La petición falla con error controlado y hace `ROLLBACK` conjunto: la solicitud/cita no queda confirmada ni en un estado inconsistente.

#### [ ] I4-007 | Solicitud de cita en fecha pasada o bloque ocupado
- **Requisito:** `RF-AGE-003`
- **Flujo / Componente:** Validación de entrada en creación de solicitudes
- **Tipo de prueba:** Valor límite
- **Precondiciones:** BD de prueba, Admin autenticado.
- **Datos de entrada:** 1) Solicitud para una fecha pasada; 2) Solicitud para un bloque ya ocupado.
- **Pasos:**
  1. Enviar `POST` de solicitud con fecha pasada.
  2. Enviar `POST` de solicitud apuntando a un bloque ocupado.
  3. Revisar respuestas HTTP y verificar que no existan registros nuevos en la BD.
- **Resultado esperado:** Ambas peticiones son rechazadas con código `400/409` y mensaje de validación claro; no se crea ningún registro.

---

### Módulo I5: Evolución Clínica

#### [ ] I5-001 | Creación de evolución clínica ligada a cita aprobada
- **Requisito:** `RF-HCL-009`
- **Flujo / Componente:** Módulo de evolución clínica -> API de evolución y pacientes -> tablas `evolucion`, `cita` e `historia_clinica`
- **Tipo de prueba:** Camino feliz
- **Precondiciones:** Paciente con historia clínica activa y una cita aprobada/confirmada.
- **Datos de entrada:** Datos de evolución nueva vinculada al ID de esa cita.
- **Pasos:**
  1. Crear la evolución mediante el `POST` de evolución (confirmar ruta en `api.routes.ts`).
  2. Consultar en la BD la fila insertada en `evolucion`.
- **Resultado esperado:** La fila de evolución se guarda correctamente ligada tanto a la cita como a la historia clínica del mismo paciente.

#### [ ] I5-002 | Integridad cruzada: Evolución en historia del Paciente A con cita del Paciente B
- **Requisito:** `RF-HCL-009`
- **Flujo / Componente:** API de evolución -> validación de pertenencia cita-paciente-historia
- **Tipo de prueba:** Error esperado
- **Precondiciones:** Dos pacientes (A y B), cada uno con su propia historia clínica y su propia cita.
- **Datos de entrada:** `POST` de evolución para la historia clínica del Paciente A enviando el `id_cita` perteneciente al Paciente B.
- **Pasos:**
  1. Enviar el `POST` cruzando la historia del Paciente A con la cita del Paciente B.
  2. Consultar la tabla `evolucion` en la BD.
- **Resultado esperado:** El sistema rechaza la petición con error controlado (`400/403/409`) y no guarda la evolución.
- **Notas para el Agente:** **Crítico (Severidad Alta si falla):** Verificar en el caso de uso/repositorio que se valide explícitamente que `cita.id_paciente === historia_clinica.id_paciente` antes de insertar la evolución.

#### [ ] I5-003 | Creación de evolución con ID de cita inexistente
- **Requisito:** `RF-HCL-009`
- **Flujo / Componente:** API de evolución -> manejo de clave foránea / existencia de cita
- **Tipo de prueba:** Error esperado
- **Precondiciones:** Admin autenticado.
- **Datos de entrada:** `POST` de evolución enviando `id_cita = 99999` (inexistente).
- **Pasos:**
  1. Enviar el `POST` con el ID de cita inexistente.
  2. Consultar la BD.
- **Resultado esperado:** Respuesta `400` o `404` controlada (nunca `500 Internal Server Error` por violación de FK no capturada). No se guarda ninguna evolución.

---

### Módulo I6: Documentos Clínicos

> **Nota Arquitectónica del Módulo I6 (`D-04` / `v1.11`):** En el commit `f41b003`, `GET /clinical-records/patient/34` devuelve `200` y `GET /clinical-documents/patient/34` devuelve `404` controlado. Sin embargo, en el código actual (`clinical-document.repository.ts`) **no existe la columna `tipoRegistro`** en la tabla `evolucion`; los documentos clínicos se almacenan dentro de la columna `evolucion.plan_manejo` (`JSONB`), bajo el arreglo `"documentos"`. El agente debe verificar esta implementación y alinear las validaciones o el esquema según corresponda.

#### [ ] I6-001 | Creación de documento clínico con tipo válido
- **Requisito:** `RF-DOC-001` a `RF-DOC-003`
- **Flujo / Componente:** `POST /api/v1/clinical-documents` -> `clinical-document.repository.ts` -> tabla `evolucion`
- **Tipo de prueba:** Camino feliz
- **Precondiciones:** Paciente con historia clínica activa.
- **Datos de entrada:** Documento clínico con un `tipoRegistro` válido.
- **Pasos:**
  1. Crear el documento mediante `POST /api/v1/clinical-documents`.
  2. Consultar la tabla `evolucion` (y la estructura `plan_manejo->'documentos'`).
- **Resultado esperado:** Se registra el documento clínico con su tipo válido asociado a la historia/evolución del paciente.

#### [ ] I6-002 | Consulta de documentos clínicos en la historia del paciente y orden cronológico
- **Requisito:** `RF-DOC-005`; `RF-HCL-008`
- **Flujo / Componente:** `GET /api/v1/clinical-records/patient/:id` y `GET /api/v1/clinical-documents/patient/:id`
- **Tipo de prueba:** Camino feliz
- **Precondiciones:** Paciente con documento creado en `I6-001`.
- **Datos de entrada:** `GET` de la historia clínica / documentos del paciente.
- **Pasos:**
  1. Consultar los endpoints de historia clínica y documentos del paciente.
  2. Verificar la presencia del documento creado, su tipo y el orden de los registros.
- **Resultado esperado:** El documento aparece con su tipo correctamente mapeado y los registros se listan en orden cronológico.

#### [ ] I6-003 | Creación de documento clínico con tipo inválido
- **Requisito:** `RF-DOC-001` a `RF-DOC-003`
- **Flujo / Componente:** `POST /api/v1/clinical-documents` -> validación de dominio
- **Tipo de prueba:** Error esperado
- **Precondiciones:** Admin autenticado.
- **Datos de entrada:** Documento con un `tipoRegistro` inexistente (ej. `"XYZ"`).
- **Pasos:**
  1. Enviar `POST /api/v1/clinical-documents` con tipo `"XYZ"`.
  2. Consultar la tabla `evolucion`.
- **Resultado esperado:** Respuesta `400 Bad Request` controlada y no se guarda ningún registro ni entrada en el `JSONB`.

#### [ ] I6-004 | Creación de documento clínico para paciente sin historia clínica
- **Requisito:** `RF-DOC-001` a `RF-DOC-003`; `RF-HCL-005`
- **Flujo / Componente:** `POST /api/v1/clinical-documents` -> dependencia con `I3` (historia clínica)
- **Tipo de prueba:** Error esperado
- **Precondiciones:** Paciente insertado directamente en la BD de prueba **sin** fila en `historia_clinica`.
- **Datos de entrada:** Documento clínico para dicho paciente.
- **Pasos:**
  1. Enviar `POST` del documento clínico para el paciente sin historia.
  2. Revisar la respuesta HTTP y la tabla `evolucion`.
- **Resultado esperado:** Respuesta `400/404` controlada indicando la falta de historia clínica; no se guarda ninguna fila.

---

### Módulo I7: Consentimientos Informados

#### [ ] I7-001 | Creación de plantilla de consentimiento nueva
- **Requisito:** `RF-CON-004`
- **Flujo / Componente:** Módulo de consentimientos -> API de plantillas -> tabla de plantillas
- **Tipo de prueba:** Camino feliz
- **Precondiciones:** Admin autenticado.
- **Datos de entrada:** Plantilla nueva con título y texto/contenido.
- **Pasos:**
  1. Crear la plantilla mediante el `POST` de plantillas (confirmar ruta en `api.routes.ts`).
  2. Consultar la tabla correspondiente en la BD.
- **Resultado esperado:** La plantilla se guarda como versión `1` y en estado `activa`.

#### [ ] I7-002 | Versionado de plantilla al modificar texto con consentimiento ya firmado
- **Requisito:** `RF-CON-007`
- **Flujo / Componente:** Actualización de plantillas -> relación con `consentimiento_firmado`
- **Tipo de prueba:** Camino feliz
- **Precondiciones:** Plantilla en versión 1 que ya tiene un consentimiento firmado asociado.
- **Datos de entrada:** Modificación del texto de la plantilla.
- **Pasos:**
  1. Enviar petición de actualización de la plantilla.
  2. Consultar las versiones de la plantilla en la BD.
  3. Consultar el consentimiento previamente firmado.
- **Resultado esperado:** Se genera la versión `2` de la plantilla y el consentimiento firmado anteriormente conserva intacta la referencia a la versión `1`.
- **Notas para el Agente:** **Revisar observación `O-09`:** En la BD actual, `nombre` y `plantilla_url` tienen restricción `UNIQUE` y `consentimiento_firmado` no guarda columna de versión. Verificar cómo está implementado el versionado en el repositorio y corregir el modelo/lógica si impide crear nuevas versiones o sobrescribe el histórico legal.

#### [ ] I7-003 | Firma de consentimiento de paciente ligada a una cita
- **Requisito:** `RF-CON-002`
- **Flujo / Componente:** `POST` de consentimientos firmados -> tablas `consentimiento_firmado`, `paciente`, `cita`
- **Tipo de prueba:** Camino feliz
- **Precondiciones:** Existen paciente, cita y plantilla activa.
- **Datos de entrada:** Firma digital/aceptación del paciente sobre la plantilla activa asociada a la cita.
- **Pasos:**
  1. Enviar la firma mediante el `POST` de consentimientos.
  2. Consultar la BD.
- **Resultado esperado:** Se persiste el consentimiento vinculado al paciente, la cita, la versión de la plantilla y la fecha de firma.
- **Notas para el Agente:** **Revisar observación `O-09`:** La clave primaria compuesta `(id_consentimiento, id_paciente)` en BD solo permite **una** firma por paciente y plantilla (impidiendo firmar la misma plantilla en una segunda cita futura). Verificar este comportamiento en el esquema.

#### [ ] I7-004 | Firma con plantilla inexistente o inactiva
- **Requisito:** `RF-CON-002`; `RF-CON-008`
- **Flujo / Componente:** Validación en `POST` de consentimientos firmados
- **Tipo de prueba:** Error esperado
- **Precondiciones:** Admin autenticado.
- **Datos de entrada:** Petición de firma enviando un ID de plantilla inexistente o una plantilla en estado inactivo.
- **Pasos:**
  1. Enviar el `POST` de firma con plantilla inexistente y luego con plantilla inactiva.
  2. Consultar la BD.
- **Resultado esperado:** Respuesta `4xx` controlada en ambos casos y no se guarda ningún registro en `consentimiento_firmado`.

#### [ ] I7-005 | Consulta de consentimientos firmados por paciente (Aislamiento de datos)
- **Requisito:** `RF-CON-003`
- **Flujo / Componente:** `GET /api/v1/consents/patient/:id` (y hook `useConsents.ts`)
- **Tipo de prueba:** Camino feliz
- **Precondiciones:** Dos pacientes (A y B), ambos con consentimientos firmados en la BD de prueba.
- **Datos de entrada:** `GET /api/v1/consents/patient/<id_paciente_A>`.
- **Pasos:**
  1. Consultar los consentimientos del Paciente A.
  2. Comparar los registros devueltos con la BD.
- **Resultado esperado:** Devuelve `200 OK` únicamente con los consentimientos pertenecientes al Paciente A, incluyendo los metadatos/versión de su plantilla, sin filtrar datos del Paciente B.

---

### Módulo I8: Recuperación y Restablecimiento de Contraseña

> **Nota Arquitectónica del Módulo I8 (`O-10`):** El diagrama entidad-relación no muestra una tabla independiente de tokens. El agente debe inspeccionar los casos de uso de `auth/recovery` para identificar dónde se almacena el token y su fecha de expiración (columnas en tabla `usuario`, tabla oculta o caché en memoria/JWT).

#### [ ] I8-001 | Solicitud de recuperación de contraseña y envío de correo
- **Requisito:** `RF-USR-009`
- **Flujo / Componente:** `PasswordRecoveryPage` -> `POST /api/v1/auth/recovery/request` -> persistencia de token -> servicio SMTP
- **Tipo de prueba:** Camino feliz
- **Precondiciones:** Usuario de prueba activo. Servicio SMTP o buzón de pruebas (Mailtrap / Ethereal / mock) configurado en `.env`.
- **Datos de entrada:** Correo electrónico del usuario de prueba.
- **Pasos:**
  1. Enviar `POST /api/v1/auth/recovery/request` con el correo.
  2. Consultar en la BD el token generado y su timestamp de expiración.
  3. Verificar la salida en el buzón de pruebas o log del servicio de correo.
- **Resultado esperado:** Respuesta `200 OK`, token persistido con vigencia de 30 minutos y correo enviado con el enlace de restablecimiento.

#### [ ] I8-002 | Restablecimiento exitoso de contraseña con token vigente
- **Requisito:** `RF-USR-009`
- **Flujo / Componente:** `POST /api/v1/auth/recovery/reset` -> validación de token -> actualización de hash de contraseña
- **Tipo de prueba:** Camino feliz
- **Precondiciones:** Token vigente generado en `I8-001`.
- **Datos de entrada:** Token válido y nueva contraseña que cumple la política.
- **Pasos:**
  1. Enviar `POST /api/v1/auth/recovery/reset` con el token y la contraseña nueva.
  2. Intentar iniciar sesión (`POST /api/v1/auth/login`) con la contraseña nueva.
  3. Intentar iniciar sesión con la contraseña anterior.
- **Resultado esperado:** Respuesta `200 OK` en el reset. El login funciona con la contraseña nueva, rechaza la anterior, y el token queda invalidado/consumido.

#### [ ] I8-003 | Intento de reutilizar un token de recuperación ya consumido
- **Requisito:** `RF-USR-009`
- **Flujo / Componente:** `POST /api/v1/auth/recovery/reset` -> control de token de un solo uso
- **Tipo de prueba:** Error esperado
- **Precondiciones:** Token ya utilizado exitosamente en `I8-002`.
- **Datos de entrada:** El mismo token ya usado y una tercera contraseña.
- **Pasos:**
  1. Enviar nuevamente `POST /api/v1/auth/recovery/reset` con el token usado.
  2. Revisar la respuesta HTTP y verificar que el hash de contraseña en BD no haya cambiado.
- **Resultado esperado:** Respuesta `400` o `410` con mensaje claro; la contraseña no se modifica.

#### [ ] I8-004 | Intento de restablecimiento con token expirado (y contrato con Frontend)
- **Requisito:** `RF-USR-009`
- **Flujo / Componente:** `POST /api/v1/auth/recovery/reset` -> validación de expiración -> UI `PasswordRecoveryPage`
- **Tipo de prueba:** Valor límite
- **Precondiciones:** Token recién generado con `recovery/request`.
- **Datos de entrada:** Token cuya fecha de expiración se modifica en BD local a un timestamp pasado (y prueba adicional con 1 minuto de vigencia restante).
- **Pasos:**
  1. En BD local, adelantar/expirar la fecha de vencimiento del token.
  2. Enviar `POST /api/v1/auth/recovery/reset`.
  3. Revisar el código HTTP y el texto exacto del mensaje de error.
- **Resultado esperado:** Respuesta `400` o `410` sin cambiar la contraseña. **Detalle crítico de integración con Frontend:** `PasswordRecoveryPage` anuncia 30 minutos de vigencia y solo renderiza el botón `"Solicitar un nuevo enlace"` si el mensaje de error del backend contiene la palabra `"venció"`. Verificar que el backend incluya `"venció"` en el mensaje de token expirado (y que acepte el token cuando aún le queda 1 minuto de vigencia).

#### [ ] I8-006 | Validación de política de longitud y complejidad de contraseña en reset
- **Requisito:** `RF-USR-009`
- **Flujo / Componente:** `POST /api/v1/auth/recovery/reset` -> validador de contraseña
- **Tipo de prueba:** Valor límite
- **Precondiciones:** Token vigente.
- **Datos de entrada:** 1) Contraseña de 7 caracteres (debajo del mínimo); 2) Contraseña de 8 caracteres con al menos una letra y un número (en el límite mínimo).
- **Pasos:**
  1. Enviar `POST /api/v1/auth/recovery/reset` con la contraseña de 7 caracteres.
  2. Verificar que se rechace con `400` y que **el token NO se haya consumido**.
  3. Enviar `POST /api/v1/auth/recovery/reset` con el mismo token y la contraseña válida de 8 caracteres (con letra y número).
- **Resultado esperado:** La contraseña de 7 caracteres o sin letra/número se rechaza con `400` conservando el token intacto; la de 8 caracteres con letra y número se acepta (`200`).
- **Notas para el Agente:** Comprobar que el backend aplique exactamente la misma regla que exige el frontend (`PasswordRecoveryPage`: mínimo 8 caracteres, al menos 1 letra y 1 número).

---

### Módulo I9: Inactivación de Profesionales (Odontólogos)

#### [ ] I9-001 | Rechazo de inactivación de odontólogo con citas activas
- **Requisito:** `RF-USR-003`
- **Flujo / Componente:** `PATCH /api/v1/users/:id/status` -> tablas `usuario` y `cita`
- **Tipo de prueba:** Error esperado
- **Precondiciones:** Usuario con rol de odontólogo activo que tiene al menos una cita activa (`Solicitada`, `Confirmada` o `En consulta`, según ERS `RF-USR-003` v1.8).
- **Datos de entrada:** Petición `PATCH` cambiando el estado del profesional a `inactivo`.
- **Pasos:**
  1. Enviar `PATCH /api/v1/users/:id/status` con estado inactivo.
  2. Revisar el código y mensaje de respuesta.
  3. Consultar el estado del usuario en la BD.
- **Resultado esperado:** El sistema rechaza la inactivación (`400/409`) con un mensaje claro indicando que el profesional tiene citas activas, y el usuario permanece activo en la BD.

#### [ ] I9-002 | Inactivación exitosa de odontólogo sin citas
- **Requisito:** `RF-USR-003`
- **Flujo / Componente:** `PATCH /api/v1/users/:id/status` -> tablas `usuario` y `cita`
- **Tipo de prueba:** Camino feliz
- **Precondiciones:** Usuario con rol de odontólogo activo que no tiene ninguna cita registrada.
- **Datos de entrada:** Petición `PATCH` cambiando el estado a `inactivo`.
- **Pasos:**
  1. Enviar `PATCH /api/v1/users/:id/status` con estado inactivo.
  2. Consultar el estado del usuario en la BD.
- **Resultado esperado:** Respuesta `200 OK` y el profesional queda inactivo en la BD.

#### [ ] I9-003 | Inactivación exitosa de odontólogo cuya única cita está Cancelada o Atendida
- **Requisito:** `RF-USR-003`
- **Flujo / Componente:** `PATCH /api/v1/users/:id/status` -> filtro de estados de cita
- **Tipo de prueba:** Valor límite
- **Precondiciones:** Usuario con rol de odontólogo activo cuyas únicas citas están en estado `Cancelada` o `Atendida` (no activas).
- **Datos de entrada:** Petición `PATCH` cambiando el estado a `inactivo`.
- **Pasos:**
  1. Enviar `PATCH /api/v1/users/:id/status` con estado inactivo.
  2. Consultar el estado del usuario en la BD.
- **Resultado esperado:** Respuesta `200 OK` y el usuario queda inactivo, comprobando que la consulta SQL/ORM solo bloquea por los estados `Solicitada`, `Confirmada` y `En consulta`.