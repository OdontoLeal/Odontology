# Reporte de Ejecución de Casos de Prueba de Integración (QA)

Este documento contiene el detalle estructurado de 7 casos de prueba de integración ejecutados el `02/11/2026` (Ciclo 5, commit `15e651b`, rama `dev`, v3.1), normalizado en formato clave-valor para su lectura, trazabilidad y análisis automatizado por modelos de Inteligencia Artificial.

## Resumen de Casos de Prueba

| ID | Requisito ERS | Punto de Integración | Tipo | Estado | Evidencias | Defectos Asociados | Fecha | Ejecutor |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **I5-002** | RF-HCL-009 | I5 | Error esperado | Fallido | E-124 | D-25 (Alta, propuesta) | 02/11/2026 | Silvia Juliana Rodríguez |
| **I6-001** | RF-DOC-001 a RF-DOC-003 | I6 | Camino feliz | Fallido | E-126, E-127, E-128 | D-27, D-23, D-24 | 02/11/2026 | Silvia Juliana Rodríguez |
| **I2-009** | RQNF-SEG-003; RQNF-SEG-009 | I2 | Error esperado | Fallido | E-107 | D-18 (Baja), DEF-14, D-15 (rel.) | 02/11/2026 | Silvia Juliana Rodríguez |
| **I3-007** | RQNF-SEG-005; RF-HCL-001 | I3 | Camino feliz | Fallido | E-92 | D-16, DEF-23 (ant.) | 02/11/2026 | Silvia Juliana Rodríguez |
| **I4-010** | RQNF-SEG-005; RF-AGE-003 | I4 | Error esperado | Fallido | E-108, E-116 | D-22 (Alta, propuesta), D-16 (rel.) | 02/11/2026 | Silvia Juliana Rodríguez |
| **I4-011** | RQNF-USA-002; RF-AGE-003; RF-AGE-005 | I4 | Camino feliz | Fallido | E-117, E-118, E-119 | D-21 (Baja) | 02/11/2026 | Silvia Juliana Rodríguez |
| **I5-006** | RQNF-SEG-003; Regla de Negocio 5 | I5 | Error esperado | Fallido | E-131 a E-135 | D-26, D-28, D-18 | 02/11/2026 | Silvia Juliana Rodríguez |

---

## Detalle de Casos de Prueba

### I5-002: Registro de evolución clínica cruzando el paciente con la cita de otro paciente

* **ID:** I5-002
* **Requisito ERS:** RF-HCL-009
* **Punto de integración:** I5
* **Módulos (origen → destino):** Módulo de evolución clínica → API de evolución y pacientes → tablas de evolución, cita e historia clínica
* **Tipo:** Error esperado
* **Estado:** Fallido
* **Evidencia:** E-124
* **Fecha:** 02/11/2026
* **Ejecutor:** Silvia Juliana Rodríguez
* **Precondiciones:**
  Base de datos de prueba con el esquema y los datos semilla cargados. Backend en el puerto `4000` conectado a la BD. Sesión iniciada como administrador (cookie o token, según use la API). Dos pacientes, cada uno con su cita.
* **Datos de entrada:**
  Evolución en la historia del paciente A con el `id` de la cita del paciente B.
* **Pasos:**
  1. Enviar el `POST` con la cita de otro paciente.
  2. Consultar la BD.
* **Resultado esperado:**
  El sistema la rechaza con un error controlado y no se guarda la evolución.
* **Resultado obtenido:**
  `02/11/2026`. Con la cita `5` (del paciente `5`) «En consulta», se envió `POST /api/v1/clinical-records/evolutions` con `idPaciente: 6`, `idCita: 5` y `marcarTodoNoAplica`, con la sesión del profesional responsable → Devuelve `201` «Entrada clínica registrada exitosamente.»: `idEvolucion: 6`, `idHistoria: 6` (la historia del paciente 6), `idCita: 5`. El sistema guardó la evolución en la historia de un paciente ligada a una cita de otro paciente. (Esperado: rechazo con error controlado y sin guardar). Un primer intento (paciente 5 con la cita 6) respondió `400` por la validación de antecedentes, no por el cruce; no sirvió como prueba.
* **Observaciones:**
  * Si la acepta, es un defecto de integridad entre paciente, historia y cita (candidato a severidad Alta).
  * **29/10/2026:** Pasa a «Bloqueado» por decisión del equipo: escribe en la BD compartida (el `.env` da acceso con credenciales reales). Lo ejecuta el programador responsable del software, o se ejecuta en una BD local cuando entregue el esquema (`pg_dump -s`).
  * **Defecto D-25 (Alta, propuesta):** En el código, `createEntry` (`clinical-records.controller.ts`) lee el estado y el profesional de la cita, pero no compara el paciente de la cita con el `idPaciente` recibido. La evolución `6` (historia `6`, cita `5`) queda en la BD para que el programador la corrija o la borre (`O-33`).
* **Motivo del bloqueo (histórico / desbloqueo):**
  Autorización del programador (`02/11/2026`, por WhatsApp): puede escribir en la BD compartida porque no tiene datos reales; datos con prefijo `QA-`; correos de prueba a los alias de la tester y a la coordinadora.
* **Historial de ejecuciones:**
  * `Ejecución 1 · Ciclo 5 · 02/11/2026 · 15e651b (dev, v3.1; git log -1 del 02/11/2026) · Fallido` (`201`: evolución del paciente 6 ligada a la cita 5, que es del paciente 5, `D-25`).

---

### I6-001: Creación de documento clínico y verificación de almacenamiento en `evolucion.plan_manejo` sin generar archivo PDF en servidor

* **ID:** I6-001
* **Requisito ERS:** RF-DOC-001 a RF-DOC-003
* **Punto de integración:** I6
* **Módulos (origen → destino):** Módulo de documentos clínicos → API de documentos → tabla `evolucion` (campo `tipoRegistro`)
* **Tipo:** Camino feliz
* **Estado:** Fallido
* **Evidencia:** E-126, E-127, E-128
* **Fecha:** 02/11/2026
* **Ejecutor:** Silvia Juliana Rodríguez
* **Precondiciones:**
  Base de datos de prueba con el esquema y los datos semilla cargados. Backend en el puerto `4000` conectado a la BD. Sesión iniciada como administrador (cookie o token, según use la API). Paciente con historia clínica.
* **Datos de entrada:**
  Documento clínico válido (por ejemplo, una orden de medicamentos).
* **Pasos:**
  1. Crear el documento con el `POST` de documentos.
  2. Consultar la fila nueva en la tabla `evolucion` y su atributo `plan_manejo`.
* **Resultado esperado:**
  Se guarda una fila en `evolucion`, ligada a la historia del paciente, con el documento (tipo y datos) dentro de `plan_manejo`. No se guarda ningún archivo PDF (ERS v1.2).
* **Resultado obtenido:**
  `02/11/2026`. Con la cita `6` «En consulta» y la sesión del profesional responsable (`ROL-ODO`), se envió `POST /api/v1/clinical-documents` con `ORDEN_MEDICAMENTOS`, firma manuscrita y un medicamento → Devuelve `201` «Documento (ORDEN_MEDICAMENTOS) generado exitosamente.» (`idDocumento: 5`, que es el `id` de la fila de evolución). `GET /api/v1/clinical-records/patient/6` muestra la orden y el medicamento: el documento queda guardado en la evolución, dentro de la historia del paciente (se cumple esa parte). Sin embargo, la respuesta trae `archivoPdfUrl: "/storage/clinical-documents/6/cita-6-orden-medicamentos-…-flattened.pdf"` y el archivo existe en la carpeta `storage` del repositorio del backend (`1847 bytes`; `E-127`): sí se guarda un archivo PDF, mientras que el caso y la ERS v1.2 (`RF-DOC-001` a `RF-DOC-004`: «sin almacenar el archivo PDF en el servidor») esperan que no (`D-27`, `E-126`). Además, ese PDF se descarga sin sesión (`D-23`).
* **Observaciones:**
  * Confirmar la ruta exacta en `api.routes.ts`. Ajustar los nombres de tablas y columnas al diagrama de la BD.
  * **29/10/2026:** Repetir cuando el equipo decida si cambia el código o el diagrama (`D-04`). Bloqueado porque escribe en la BD compartida: lo ejecuta el programador responsable del software.
  * **01/11/2026:** El programador confirmó que el documento clínico queda guardado en la tabla `evolucion`, en el atributo `plan_manejo`, y que el PDF no se guarda (ERS v1.2). Caso redactado de nuevo con esa información.
  * **02/11/2026:** Sigue bloqueado inicialmente porque el código exige una cita del paciente en estado «En consulta» (o atendida el mismo día) y la sesión del odontólogo responsable de esa cita (`ROL-ODO` o `ROL-ESP`); con administrador responde `403`. Depende de la tanda de citas (`I4`).
  * La cláusula «no se guarda ningún archivo PDF» está en la ERS v1.2 (`RF-DOC-001` a `RF-DOC-004`) y el programador la confirmó el `01/11/2026`. El sistema guarda el PDF en disco (`D-27`). La descarga del PDF sin sesión es `D-23`, y el orden documento–apertura es `D-24`. *(Corrección de la v1.25, que decía que la ERS no lo dice: se había citado el texto de la v1.1)*. Antes de abrir la consulta, el documento creó la fila de evolución con el motivo «Plan de Manejo y Conducta», lo que bloqueó la apertura real y dejó finalizar la cita (`D-24`).
* **Motivo del bloqueo (histórico / desbloqueo):**
  Autorización del programador (`02/11/2026`, por WhatsApp): puede escribir en la BD compartida porque no tiene datos reales; datos con prefijo `QA-`; correos de prueba a los alias de la tester y a la coordinadora.
* **Historial de ejecuciones:**
  * `Ejecución 1 · Ciclo 5 · 02/11/2026 · 15e651b (dev, v3.1; git log -1 del 02/11/2026) · Fallido` (el documento se guarda en la evolución, pero también se guarda un archivo PDF en disco, `D-27`; descarga sin sesión, `D-23`; relacionado con `D-24`).

---

### I2-009: Bloqueo de acceso a historia clínica y documentos para rol Coordinadora (`ROL-COA`) y registro en auditoría

* **ID:** I2-009
* **Requisito ERS:** RQNF-SEG-003; RQNF-SEG-009
* **Punto de integración:** I2
* **Módulos (origen → destino):** `POST /api/v1/auth/login` (usuario con `ROL-COA`) → `GET /api/v1/clinical-records/patient/:id` y `GET /api/v1/clinical-documents/patient/:id`
* **Tipo:** Error esperado
* **Estado:** Fallido
* **Evidencia:** E-107
* **Fecha:** 02/11/2026
* **Ejecutor:** Silvia Juliana Rodríguez
* **Precondiciones:**
  Ambiente desplegado de pruebas, antes de cargar datos reales (URL y commit por registrar en Observaciones), o BD local de pruebas creada con `scripts/schema.sql`. No ejecutar escrituras en la BD compartida. Mecanismo de sesión implementado (ver `D-05`). Usuario `QA-` activo solo con `ROL-COA`. Paciente `QA-` con historia clínica. Tabla del registro de auditoría identificada en el esquema.
* **Datos de entrada:**
  Credenciales del usuario `QA-COA`; `id` del paciente `QA-`.
* **Pasos:**
  1. Iniciar sesión con `QA-COA` y guardar el token o la cookie.
  2. Con esa sesión, pedir `GET /clinical-records/patient/<id>`.
  3. Pedir `GET /clinical-documents/patient/<id>`.
  4. Consultar en la BD el registro de auditoría de ese usuario.
* **Resultado esperado:**
  Las dos peticiones se bloquean (`403`) sin devolver datos, con el mensaje «No tiene permiso para realizar esta acción», y cada intento queda en el registro de auditoría como acceso bloqueado, con usuario, fecha y hora (`RQNF-SEG-003` y `RQNF-SEG-009`).
* **Resultado obtenido:**
  `02/11/2026`, pasos 1 a 3: un usuario QA con solo `ROL-COA` (`id: 10`) inició sesión (`200`, con token).
  * `GET /api/v1/clinical-records/patient/3` → `403` «No tiene permiso para consultar la historia clínica.»
  * `GET /api/v1/clinical-documents/patient/3` → `403` «No tiene permiso para consultar documentos clínicos.»
  Ninguna de las dos devolvió datos del paciente. El paso 4 (registro de auditoría de los intentos bloqueados) no se ejecutó: lo consulta el programador en la BD.
* **Observaciones:**
  * Si al ejecutar sigue abierto `D-05` (no hay sesión), el caso queda Bloqueado con ese motivo. Antecedente: `DEF-14` del Excel de sistema (ronda 1) reporta que no hay tabla ni código de auditoría.
  * **01/11/2026 (v1.18):** Pasa a «Bloqueado» por decisión de la tester: necesita crear en la BD compartida un usuario `QA-` solo con `ROL-COA` y un paciente `QA-` con historia clínica, y consultar el registro de auditoría en la BD. `D-05` ya está corregido (hay sesión con token), así que ese motivo ya no aplica. Antes de ejecutarlo, confirmar que existe la tabla del registro de auditoría (`DEF-14`).
  * **01/11/2026 (21:57):** Hallazgo relacionado, `D-15`: con el token de un usuario `ROL-ODO`, `PATCH /users/999999/status` llega a la lógica de administración (`400` «no existe», no `403`). Solo `POST /users` devolvió `403` (`E-86`, `E-87`).
  * **02/11/2026 (Ciclo 5, dev `15e651b` v3.1):** El bloqueo funciona (`403` sin datos), pero el mensaje no es el que pide el resultado esperado ni la ERS («No tiene permiso para realizar esta acción»). Por eso el caso queda Fallido por `D-18` (Baja). Falta el paso 4 (auditoría), a cargo del programador; `DEF-14` del Excel de sistema ya reportaba que no hay registro de auditoría. El primer `QA COA` (`id: 5`) no sirvió porque no se conocía su contraseña temporal; se creó otro (`id: 10`, con un alias del correo de la tester).
* **Motivo del bloqueo (histórico / desbloqueo):**
  Autorización del programador (`02/11/2026`, por WhatsApp): puede escribir en la BD compartida porque no tiene datos reales; datos con prefijo `QA-`.
* **Historial de ejecuciones:**
  * `Ejecución 1 · Ciclo 5 · 02/11/2026 · 15e651b (dev, v3.1; git log -1 del 02/11/2026) · Fallido` (`403` sin datos; mensaje distinto al de la ERS, `D-18`; falta el paso 4 de auditoría).

---

### I3-007: Persistencia de la autorización de tratamiento de datos (adulto y menor) en base de datos tras reinicio del servidor

* **ID:** I3-007
* **Requisito ERS:** RQNF-SEG-005; RF-HCL-001
* **Punto de integración:** I3
* **Módulos (origen → destino):** Módulo de pacientes (frontend) → `POST /api/v1/patients` → BD (paciente y autorización)
* **Tipo:** Camino feliz
* **Estado:** Fallido
* **Evidencia:** E-92
* **Fecha:** 02/11/2026
* **Ejecutor:** Silvia Juliana Rodríguez
* **Precondiciones:**
  Ambiente desplegado de pruebas, antes de cargar datos reales (URL y commit por registrar en Observaciones), o BD local de pruebas creada con `scripts/schema.sql`. No ejecutar escrituras en la BD compartida. Versión vigente del aviso de privacidad cargada.
* **Datos de entrada:**
  Paciente adulto `QA-` con la casilla de autorización marcada. Paciente menor `QA-` con acudiente y casilla marcada.
* **Pasos:**
  1. Crear el adulto desde la pantalla marcando la casilla.
  2. Crear el menor con su acudiente marcando la casilla.
  3. Consultar en la BD la autorización de cada uno.
  4. Reiniciar el backend y volver a consultar los dos pacientes con `GET /api/v1/patients/:id`.
* **Resultado esperado:**
  Para cada paciente queda guardada la autorización con fecha, hora, medio, versión del aviso y usuario; en el menor, la del acudiente. Los datos siguen después del reinicio (`RQNF-SEG-005`).
* **Resultado obtenido:**
  `02/11/2026`, pasos 1 a 3 con paciente adulto QA: `POST /api/v1/patients` con `autorizacionDatos: {autorizado: true, medio, versionAvisoPrivacidad}` → `201`. `GET /api/v1/patients/<id>` devuelve la autorización con fecha, hora, medio y versión del aviso, pero `idUsuarioRegistro` llega en `null`: no se guarda qué usuario la registró, aunque el registro lo hizo un administrador con sesión. Resultado esperado incumplido (falta el usuario). Se registra `D-16`.
* **Observaciones:**
  * El paso 4 comprueba que la autorización se guarda en la BD y no en memoria. Antecedente: `DEF-23` del Excel de sistema (ronda 1).
  * **01/11/2026:** Pasa a «Bloqueado» por decisión del equipo: escribe en la BD compartida. Lo ejecuta el programador responsable del software, o se ejecuta en el ambiente desplegado de pruebas o en una BD local cuando se entregue.
  * **02/11/2026 (Ciclo 5, dev `15e651b` v3.1):** Falla en el dato «usuario» de la autorización (`D-16`). Queda pendiente el paso 4 (reiniciar el backend y volver a consultar) y la prueba del paciente menor con acudiente.
* **Motivo del bloqueo (histórico / desbloqueo):**
  Autorización del programador (`02/11/2026`, por WhatsApp): puede escribir en la BD compartida porque no tiene datos reales; datos con prefijo `QA-`.
* **Historial de ejecuciones:**
  * `Ejecución 1 · Ciclo 5 · 02/11/2026 · 15e651b (dev, v3.1; git log -1 del 02/11/2026) · Fallido` (`D-16`: la autorización no guarda el usuario que la registró; falta el paso 4).

---

### I4-010: Validación y persistencia de la autorización de tratamiento de datos (Ley 1581) en solicitudes públicas de citas

* **ID:** I4-010
* **Requisito ERS:** RQNF-SEG-005; RF-AGE-003
* **Punto de integración:** I4
* **Módulos (origen → destino):** `PublicBookingPage` → `POST /api/v1/appointments/public-requests` → BD
* **Tipo:** Error esperado
* **Estado:** Fallido
* **Evidencia:** E-108, E-116
* **Fecha:** 02/11/2026
* **Ejecutor:** Silvia Juliana Rodríguez
* **Precondiciones:**
  Ambiente desplegado de pruebas, antes de cargar datos reales (URL y commit por registrar en Observaciones), o BD local de pruebas creada con `scripts/schema.sql`. No ejecutar escrituras en la BD compartida. Un bloque disponible a 5 o más días.
* **Datos de entrada:**
  * **(a)** Solicitud pública con la casilla de autorización sin marcar.
  * **(b)** La misma solicitud con la casilla marcada.
* **Pasos:**
  1. Desde la página pública, intentar enviar (a).
  2. Enviar (a) directamente a la API con la autorización en `false`.
  3. Enviar (b).
  4. Consultar en la BD las solicitudes y autorizaciones.
* **Resultado esperado:**
  * **(a)** No se registra, ni por pantalla ni por API, y se indica la falta.
  * **(b)** Se registra con los datos que exige `RQNF-SEG-005`: fecha, hora, medio, versión del aviso y usuario.
* **Resultado obtenido:**
  `02/11/2026`.
  * **(a)** Solicitud pública con `autorizacionDatos` en `false` → `400` «Debe aceptar la autorización de tratamiento de datos personales (Ley 1581 de 2012) para solicitar la cita.» (`E-108`).
  * **(b)** Solicitud con `autorizacionDatos` en `true` → `201` (solicitud `3`); una vez aprobada, creó el paciente `5`. Al consultar `GET /api/v1/patients/5` → `200` con `autorizacionDatos: null`: no hay fecha, hora, medio, versión del aviso ni usuario. Además, `datosIncompletos` sale en `false`. La autorización con la que se envió la solicitud no se guardó (según el código, el `INSERT` de `solicitud_cita` no la incluye). Falla la parte (b).
* **Observaciones:**
  * Antecedente: `DEF-07` del Excel de sistema (ronda 1).
  * **01/11/2026:** Pasa a «Bloqueado» por decisión del equipo: escribe en la BD compartida.
  * **02/11/2026 (ejecución parcial, Ciclo 5, dev `15e651b`):** Parte (a) responde `400` correctamente y las solicitudes siguieron en `0`. En el código, el `INSERT` de `solicitud_cita` (`appointment.repository.ts`) no guarda la autorización ni la versión del aviso.
  * **Defecto D-22 (Alta, propuesta):** Relacionado con `D-16` y con la observación `O-38` (`datosIncompletos`).
* **Motivo del bloqueo (histórico / desbloqueo):**
  Autorización del programador (`02/11/2026`, por WhatsApp): puede escribir en la BD compartida porque no tiene datos reales; datos con prefijo `QA-`; correos de prueba a los alias de la tester y a la coordinadora.
* **Historial de ejecuciones:**
  * `Ejecución 1 · Ciclo 5 · 02/11/2026 · 15e651b (dev, v3.1; git log -1 del 02/11/2026) · Fallido` (`a`: `400` correcto; `b`: el paciente creado desde la solicitud queda sin autorización de datos, `D-22`).

---

### I4-011: Formato de fecha (`DD/MM/AAAA`) y hora de 12 horas en correos de notificación de citas

* **ID:** I4-011
* **Requisito ERS:** RQNF-USA-002; RF-AGE-003; RF-AGE-005
* **Punto de integración:** I4
* **Módulos (origen → destino):** API de citas → servicio de correo (buzón de pruebas)
* **Tipo:** Camino feliz
* **Estado:** Fallido
* **Evidencia:** E-117, E-118, E-119
* **Fecha:** 02/11/2026
* **Ejecutor:** Silvia Juliana Rodríguez
* **Precondiciones:**
  Ambiente desplegado de pruebas, antes de cargar datos reales (URL y commit por registrar en Observaciones), o BD local de pruebas creada con `scripts/schema.sql`. No ejecutar escrituras en la BD compartida. Buzón de correo de pruebas configurado.
* **Datos de entrada:**
  Solicitud pública de un paciente `QA-` para un bloque de las `2:00 p. m.`, luego confirmada por la coordinadora.
* **Pasos:**
  1. Registrar la solicitud.
  2. Confirmarla.
  3. Abrir los correos recibidos: recepción de la solicitud, aviso al personal y confirmación.
* **Resultado esperado:**
  Todos los correos están en español (Colombia), con fechas en formato `DD/MM/AAAA` y horas en formato de 12 horas (p. ej. `02:00 p. m.`), tanto en el asunto como en el cuerpo (`RQNF-USA-002`).
* **Resultado obtenido:**
  `02/11/2026`. Se registró la solicitud `6` para el bloque de las 2:00 p. m. del `12/11/2026` (`201`) y se confirmó (`200`, cita `6`). Correos revisados (todos en español): solicitud recibida (bloques de 10:00, 10:30 y 11:00), confirmación al paciente (10:00 - 10:30), aviso al profesional (10:00 - 10:30) y alerta a coordinación de la solicitud `6` (reenviada por el programador). En todos, la fecha sale como `2026-11-12` (`AAAA-MM-DD`) y la hora en formato de 24 horas (`10:00`, `10:00 - 10:30`, `14:00`), también en el asunto. Esperado: `12/11/2026` y `02:00 p. m.`. No se abrieron los correos de recepción, confirmación y aviso al doctor de las 2:00 p. m., solo la alerta a coordinación de esa solicitud; los demás se revisaron con los bloques de las 10:00 a 11:00, que tienen el mismo formato.
* **Observaciones:**
  * Antecedente: la hoja Evidencias del Excel de sistema (ronda 1) registra asuntos con el formato «`2026-11-04 a las 09:00`».
  * **01/11/2026:** Pasa a «Bloqueado» por decisión del equipo: escribe en la BD compartida.
  * **Defecto D-21 (Baja):** Los asuntos de las evidencias del Excel de sistema (ronda 1) ya mostraban el mismo formato; revisar si ya está reportado allí para unificar.
* **Motivo del bloqueo (histórico / desbloqueo):**
  Autorización del programador (`02/11/2026`, por WhatsApp): puede escribir en la BD compartida porque no tiene datos reales; datos con prefijo `QA-`; correos de prueba a los alias de la tester y a la coordinadora.
* **Historial de ejecuciones:**
  * `Ejecución 1 · Ciclo 5 · 02/11/2026 · 15e651b (dev, v3.1; git log -1 del 02/11/2026) · Fallido` (correos en español, pero con fecha `AAAA-MM-DD` y hora de 24 horas, `D-21`).

---

### I5-006: Control de acceso del rol Auxiliar (`ROL-AUX`) a la historia clínica según el estado de la cita («En consulta» vs otros estados)

* **ID:** I5-006
* **Requisito ERS:** RQNF-SEG-003; Regla de Negocio 5
* **Punto de integración:** I5
* **Módulos (origen → destino):** Sesión con `ROL-AUX` → API de historia clínica según el estado de la cita
* **Tipo:** Error esperado
* **Estado:** Fallido
* **Evidencia:** E-131, E-132, E-133, E-134, E-135
* **Fecha:** 02/11/2026
* **Ejecutor:** Silvia Juliana Rodríguez
* **Precondiciones:**
  Ambiente desplegado de pruebas, antes de cargar datos reales (URL y commit por registrar en Observaciones), o BD local de pruebas creada con `scripts/schema.sql`. No ejecutar escrituras en la BD compartida. Mecanismo de sesión (`D-05`). Auxiliar `QA-` activa. Paciente A con una cita «En consulta». Paciente B con historia clínica y sin cita «En consulta».
* **Datos de entrada:**
  Credenciales de la auxiliar `QA-`; `ids` de los pacientes A y B.
* **Pasos:**
  1. Con la cita de A «En consulta», la auxiliar abre la historia de esa consulta y registra una evolución.
  2. Pide la historia clínica de B.
  3. Pide el historial clínico anterior de A.
  4. El profesional finaliza la cita de A y la auxiliar repite el paso 1.
* **Resultado esperado:**
  * **Paso 1:** Permitido, con `'Diligenciado por' = auxiliar`.
  * **Pasos 2, 3 y 4:** Bloqueados con «No tiene permiso para realizar esta acción», sin datos y registrados en auditoría (`RQNF-SEG-003`: matriz que incluye `ROL-AUX` con y sin cita «En consulta»; Regla de Negocio 5).
* **Resultado obtenido:**
  `02/11/2026`, con la API. Cita `9` del paciente `7` (A) «En consulta», con la apertura hecha por el profesional (evolución `9`); el paciente `5` (B) sin cita «En consulta»; sesión de la auxiliar QA (usuario `8`, `ROL-AUX`).
  * **Paso 1:** `GET /api/v1/clinical-records/patient/7` por la auxiliar → `403` «No tiene permiso para consultar la historia clínica.» (la ERS v1.2 dice que la auxiliar ve la historia de esa consulta: `D-26`). `POST /api/v1/clinical-records/evolutions` de tipo `EVOLUCION` por la auxiliar → `201`, con ella como quien diligencia («QA Recuperacion» en la respuesta). Sin embargo, la evolución usó la misma fila de la apertura (`idEvolucion: 9`) y reemplazó el motivo «QA consulta con auxiliar» por «Consulta Odontológica» y los antecedentes por valores por defecto: con la sesión del profesional, el `GET` de la historia ya no muestra el motivo de la apertura (`D-28`).
  * **Paso 2:** `GET` de la historia de B por la auxiliar → `403`, sin datos (mensaje distinto del de la ERS, `D-18`).
  * **Paso 3:** Las historias anteriores se piden con el mismo `GET`: `403`.
  * **Extra:** `POST /api/v1/clinical-documents` por la auxiliar → `403` «No tiene permiso para realizar esta acción» (correcto).
  * **Paso 4:** Con la cita finalizada (`Atendida`, `200`), `POST` de evolución por la auxiliar → `409` «Solo se puede crear o abrir la historia clínica cuando la cita está “En consulta”.» y `GET` de la historia de A → `403`. No se comprobó el registro en auditoría.
* **Observaciones:**
  * Antecedente: `DEF-02` del Excel de sistema (ronda 1).
  * **01/11/2026:** Pasa a «Bloqueado» por decisión del equipo: escribe en la BD compartida. Requiere sesión (`D-05`).
  * **02/11/2026 (Ciclo 5, dev `15e651b` v3.1):** Falla el paso 1 (la auxiliar no puede ver la historia de la consulta en curso, `D-26`) y la evolución de la auxiliar sobrescribe la apertura (`D-28`). Los pasos 2 a 4 bloquean el acceso, pero con mensajes distintos de «No tiene permiso para realizar esta acción» (`D-18`: `403` con «…para consultar la historia clínica» y `409` por el estado de la cita). La ERS v1.2 dice que la auxiliar «no abre historias anteriores ni de otros pacientes»: ese bloqueo es correcto. Un primer intento sin cita preparada no valió (`idCita` vacío) y no escribió nada. Ejecutado con la contraseña del usuario `8` restablecida por recuperación.
* **Motivo del bloqueo (histórico / desbloqueo):**
  Autorización del programador (`02/11/2026`, por WhatsApp): puede escribir en la BD compartida porque no tiene datos reales; datos con prefijo `QA-`; correos de prueba a los alias de la tester y a la coordinadora.
* **Historial de ejecuciones:**
  * `Ejecución 1 · Ciclo 5 · 02/11/2026 · 15e651b (dev, v3.1; git log -1 del 02/11/2026) · Fallido` (la auxiliar no ve la historia de la consulta, `D-26`; su evolución sobrescribe la apertura, `D-28`; mensajes de rechazo distintos de la ERS, `D-18`; auditoría sin comprobar).