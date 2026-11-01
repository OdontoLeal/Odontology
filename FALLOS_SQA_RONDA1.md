# Reporte de Casos Fallidos SQA - Ronda 1 (Verificación y Corrección)

## 1. Metadatos de la Ejecución
- **Fecha de ejecución:** 27/10/2026 (18:53 - 18:56)
- **Responsable SQA:** Angel Torres
- **Ronda:** 1
- **Total de casos fallidos:** 47 (`API (servidor)`: 41 | `Pantalla (navegador)`: 6)
- **Instrucción para el Agente:** Todos los casos listados abajo están en estado `Falla`. Muchos casos son síntomas de un mismo defecto estructural (`DEF-01` a `DEF-26`). Tu objetivo es diagnosticar las causas raíz en el código fuente, diseñar un plan de corrección agrupado por defectos y verificar que cada uno de los 47 escenarios pase a estado `Aprobado`.

---

## 2. Catálogo de Causas Raíz (Defectos `DEF-01` a `DEF-26`)

| ID Defecto | Descripción Técnica de la Causa Raíz | Casos Afectados |
| :--- | :--- | :--- |
| **DEF-01** | **Sin sesión real ni protección de rutas en API:** El backend no valida tokens/sesiones al invocar endpoints protegidos, no invalida sesión en logout y si se omite la cabecera de rol entrega datos sensibles con HTTP 200. | `CPS-USR-001-04`, `CPS-USR-006-03`, `CPS-USR-008-04`, `CPS-HCL-008-02`, `CPS-CON-003-01`, `CPS-DOC-005-02` |
| **DEF-02** | **Fallo de autorización y pertenencia en acciones clínicas:** Permite que un odontólogo inicie la cita asignada a otro profesional, y bloquea con `403` a la Auxiliar al registrar hallazgos en el odontograma (y deja `Diligenciado por` como `undefined`). | `CPS-AGE-009-03`, `CPS-HCL-007-01` |
| **DEF-03** | **Agenda única global en vez de agenda por profesional:** Los bloques de horario no filtran ni persisten por `idProfesional`, compartiendo una única agenda para todo el consultorio. | `CPS-AGE-001-01`, `CPS-AGE-002-03` |
| **DEF-04** | **Falta de validación de motivos obligatorios:** Permite rechazar solicitudes sin motivo (autocompleta `"Solicitud rechazada"`), cancelar citas sin motivo y finalizar consultas sin haber registrado motivo de consulta en la historia clínica. | `CPS-AGE-005-02`, `CPS-AGE-007-02`, `CPS-AGE-009-02` |
| **DEF-05** | **Máquina de estados de cita rota y desalineada:** Acepta cualquier string arbitrario como estado (`"Estado inventado"`), tiene discrepancia de nombres (`"Completada"`/`"No asistió"` vs `"Atendida"`/`"Inasistencia"`) y permite marcar inasistencia en citas futuras. | `CPS-AGE-009-04`, `CPS-AGE-013-01` |
| **DEF-06** | **Sin validación de ventana temporal en solicitud pública:** Permite solicitar citas para el día siguiente, ignorando la regla de negocio de permitir solo entre 5 y 60 días de anticipación. | `CPS-AGE-003-02` |
| **DEF-07** | **Incumplimiento Ley 1581 (Autorización de datos):** El formulario público no tiene checkbox de autorización (`ui_03`), el endpoint de solicitud pública no lo exige, y `POST /patients` asume `true` cuando el campo `autorizacionDatos` no se envía en el body. | `CPS-AGE-003-03`, `CPS-AGE-003-05`, `CPS-HCL-001-03` |
| **DEF-08** | **Datos quemados (hardcoded) al crear solicitudes/pacientes:** Si no se envían `fechaNacimiento` ni `sexo` en la solicitud pública, el servidor inventa `1997-04-12` y `Femenino`. Al confirmar solicitud de paciente nuevo, deja `datosIncompletos: false` en lugar de `true` y concatena gestores en historial (`1,67`). | `CPS-AGE-003-04`, `CPS-AGE-005-01` |
| **DEF-09** | **Enrutamiento de correo ignorando estado de Coordinadora:** Cuando la coordinadora está inactiva, el aviso de nueva solicitud no se redirige a la auxiliar activa. | `CPS-AGE-004-02` |
| **DEF-10** | **Inexistencia de tareas programadas (Cron Jobs):** No existen jobs en `src/` para: 1) resumen diario 7:00 a. m. de solicitudes sin gestionar, 2) cancelar solicitudes no gestionadas cuya fecha ya pasó, 3) pasar citas `Confirmada` a `Inasistencia` a las 23:59, y 4) enviar recordatorios 24h antes. | `CPS-AGE-004-03`, `CPS-AGE-010-01`, `CPS-AGE-010-02`, `CPS-AGE-011-01` |
| **DEF-11** | **Cancelación de cita sin notificación por correo:** Cambiar el estado de una cita a `Cancelada` libera el bloque pero no envía correos al paciente ni al profesional. | `CPS-AGE-007-01` |
| **DEF-12** | **Agendamiento en bloques pasados:** Permite crear y confirmar citas en bloques del día actual cuya hora de inicio ya transcurrió. | `CPS-AGE-002-04` |
| **DEF-13** | **Validación de estado de cita confiada al Frontend:** Al crear registro clínico (`RF-HCL-005`), el servidor lee el estado de la cita desde el body enviado por el cliente (por defecto `"En consulta"`) en vez de verificar en la BD si la cita realmente está `"En consulta"`. | `CPS-HCL-005-03` |
| **DEF-14** | **Auditoría incompleta al editar historia clínica:** Al actualizar la historia dentro del plazo legal, no se registra ni expone el valor anterior junto al valor nuevo. | `CPS-HCL-006-01` |
| **DEF-15** | **Controladores sin ruta publicada o colisión de rutas en Express:** `getLatestOdontogram` y `exportHolderData` existen en los controladores pero no están registrados (o colisionan con `:id`) en `api.routes.ts`, devolviendo `404 Cannot GET`. | `CPS-HCL-007-03`, `CPS-HCL-010-01` |
| **DEF-16** | **Falta campo "Agendado por" en citas de la ficha del paciente:** El endpoint de detalle de paciente devuelve las citas asociadas pero omite quién las agendó. | `CPS-HCL-004-01` |
| **DEF-17** | **Exposición de información clínica a Coordinadora en UI:** En el módulo de Pacientes, el rol Coordinadora ve el botón `"Ver historia clínica"` y puede abrir el expediente médico completo. | `CPS-HCL-004-02` |
| **DEF-18** | **Falta de validación en plantillas de consentimiento:** Permite crear múltiples plantillas con el mismo nombre y permite editar plantillas dejando el texto/archivo vacío (incrementando la versión). | `CPS-CON-004-02`, `CPS-CON-007-02` |
| **DEF-19** | **Consentimientos firmados duplicados:** Permite guardar una segunda firma de la misma plantilla de consentimiento para la misma paciente. | `CPS-CON-001-01` |
| **DEF-20** | **Firma de menor de edad sin acudiente:** El servidor permite registrar la firma de un menor de edad sin exigir ni validar los datos del acudiente. | `CPS-CON-005-01` |
| **DEF-21** | **Arquitectura de firma en Tablet rota (`/tablet-sign`):** No genera un token/enlace de un solo uso con expiración de 15 min; usa una ruta fija (`/tablet-sign/:id`) que lee el estado en memoria del navegador actual, por lo que al abrirse en una tablet independiente no carga al paciente ni guarda la firma. | `CPS-CON-002-02`, `CPS-CON-006-01` |
| **DEF-22** | **Sin motor real de generación de PDF en documentos clínicos:** Guarda rutas como `/storage/clinical-documents/...pdf` que devuelven `text/html` al abrirse; no genera un binario PDF real con datos del paciente, logo, marca de agua y firma. | `CPS-DOC-001-01` |
| **DEF-23** | **Estado volátil en memoria RAM (se pierde al reiniciar servidor):** Atributos críticos (`esContrasenaTemporal`, permisos de roles nuevos, `acudiente`, `autorizacion` y `datosIncompletos` de pacientes) se guardan en estructuras en memoria del proceso Node.js en vez de persistirse/leerse de PostgreSQL. | `CPS-USR-005-04`, `CPS-USR-007-04`, `CPS-HCL-001-06` |
| **DEF-24** | **Bucle infinito en temporizador de inactividad (UI):** En el minuto 29 aparece el aviso de cierre de sesión, pero la propia apertura del modal dispara el detector de actividad de la pantalla, cerrando el aviso al instante y reiniciando el contador de 29 minutos indefinidamente. | `CPS-USR-008-02` |
| **DEF-25** | **Fecha inicial quemada en hook de agenda:** `useRealtimeAgenda.ts` inicializa la fecha fija en `'2026-10-24'` (Sábado) en lugar de obtener la fecha actual (`new Date()`). | `CPS-AGE-008-04` |
| **DEF-26** | **Falta selector de servicio en portal público de citas:** La vista pública no permite elegir el servicio odontológico (ej. Ortodoncia) para filtrar profesionales/bloques y envía siempre `idProfesional: 1` (Dr. Eduar Leal) quemado. | `CPS-AGE-012-02` |

---

## 3. Detalle de Casos de Prueba por Módulo

### Módulo 1: Usuarios y Roles (`CPS-USR`)

#### [ ] CPS-USR-001-04 | Solo el administrador puede crear usuarios (control de acceso)
- **Requisito:** `RF-USR-001` - Crear usuario (Prioridad: Alta)
- **Defecto asociado:** `DEF-01` | **Tipo:** API (servidor)
- **Precondiciones:** Petición hecha sin sesión de administrador (se indica que la hace `ROL-COA`).
- **Datos de prueba:** Usuario `"Intruso"` con rol Administrador (`documentoIdentidad: "1012345699"`, `correo: "intruso@pruebas.co"`, `telefono: "3001234599"`).
- **Pasos:** 1. Enviar la creación de usuario sin ser administrador.
- **Resultado esperado:** El sistema rechaza la operación (`401/403` sin permiso) y no crea el usuario.
- **Resultado obtenido (Falla):** El sistema creó el usuario `"Intruso"` con rol Administrador (`id 105`) sin verificar quién lo pide.
- **Evidencia:** `HTTP 201 {"message":"Usuario creado en estado Activo.","data":{"idUsuario":105,"nombreCompleto":"Intruso","documentoIdentidad":"1012345699","correo":"intruso@pruebas.co","telefono":"3001234599","estado":true,"roles":[{"idRol":1,"nombreRol":"Administrador del Sistema"...`

#### [ ] CPS-USR-005-04 | La marca de contraseña temporal se conserva después de reiniciar el servidor
- **Requisito:** `RF-USR-005` - Autenticar usuario (Prioridad: Alta)
- **Defecto asociado:** `DEF-23` | **Tipo:** API (servidor)
- **Precondiciones:** Usuario creado con contraseña temporal que todavía no ha entrado.
- **Datos de prueba:** Usuario `"Rita Temporal"` (`correo: "rita@pruebas.co"`).
- **Pasos:** 1. Crear el usuario. 2. Reiniciar el servidor. 3. Rita entra con la contraseña temporal.
- **Resultado esperado:** El sistema le exige cambiar la contraseña temporal (`requiereCambioContrasena: true` / `esContrasenaTemporal: true`).
- **Resultado obtenido (Falla):** Después de reiniciar: `HTTP 200`; `requiereCambioContrasena: false`, `esContrasenaTemporal: false`.
- **Evidencia:** `HTTP 200 {"requiereCambioContrasena":false,"message":"Autenticación exitosa.","usuario":{"idUsuario":108,"nombreCompleto":"Rita Temporal","documentoIdentidad":"1012345604","correo":"rita@pruebas.co","telefono":"3001234504","estado":true,"esContrasenaTemporal":false...`

#### [ ] CPS-USR-006-03 | Sin sesión no se pueden ver datos de la agenda ni de usuarios
- **Requisito:** `RF-USR-006` - Acceder solicitud cita (Prioridad: Alta)
- **Defecto asociado:** `DEF-01` | **Tipo:** API (servidor)
- **Precondiciones:** Navegador o programa sin iniciar sesión.
- **Datos de prueba:** N/A
- **Pasos:** 1. Pedir directamente la agenda y la lista de usuarios al servidor.
- **Resultado esperado:** No se muestra ningún dato (`401 Unauthorized`).
- **Resultado obtenido (Falla):** Agenda: `HTTP 200` (4 citas). Usuarios: `HTTP 200` (9 usuarios con correo y teléfono).
- **Evidencia:** `HTTP 200 {"data":[{"idUsuario":67,"nombreCompleto":"Andrea Guerrero","documentoIdentidad":"1050000045","correo":"andrea@gmail.com","telefono":"3114534113","estado":true,"roles":[{"idRol":4,"nombreRol":"Coordinadora de Agendamiento"...`

#### [ ] CPS-USR-007-04 | Los permisos de un rol nuevo se conservan después de reiniciar el servidor
- **Requisito:** `RF-USR-007` - Crear rol (Prioridad: Alta)
- **Defecto asociado:** `DEF-23` | **Tipo:** API (servidor)
- **Precondiciones:** Rol `Recepción` creado con permiso `RF-HCL-003` (`CPS-USR-010-01`).
- **Datos de prueba:** Usuario Pedro Díaz (`pedro.diaz@pruebas.co`, `idUsuario: 107`).
- **Pasos:** 1. Reiniciar el servidor (como pasa en cada despliegue). 2. Pedro inicia sesión.
- **Resultado esperado:** Pedro conserva los permisos asignados a su rol (`RF-HCL-003`).
- **Resultado obtenido (Falla):** Después de reiniciar: `HTTP 200 "Autenticación exitosa."`; los permisos se resetearon a `RF-AGE-008`.
- **Evidencia:** `HTTP 200 {"requiereCambioContrasena":false,"message":"Autenticación exitosa.","usuario":{"idUsuario":107,"nombreCompleto":"Pedro Díaz","documentoIdentidad":"1012345603","correo":"pedro.diaz@pruebas.co","telefono":"3001234503","estado":true,"esContrasenaTemporal":false...`

#### [ ] CPS-USR-008-02 | Aviso en el minuto 29 y cierre a los 30 minutos sin actividad
- **Requisito:** `RF-USR-008` - Cerrar sesión (Prioridad: Alta)
- **Defecto asociado:** `DEF-24` | **Tipo:** Pantalla (navegador)
- **Precondiciones:** Dr. Eduar Leal con sesión activa. Reloj del navegador controlado por la prueba.
- **Datos de prueba:** 29 y 30 minutos sin actividad.
- **Pasos:** 1. Entrar. 2. Adelantar el reloj 29 minutos. 3. Adelantar 1 minuto más.
- **Resultado esperado:** En el minuto 29 aparece el aviso de expiración próxima y en el minuto 30 la sesión se cierra automáticamente.
- **Resultado obtenido (Falla):** Aviso en el minuto 29: no se ve. Sesión cerrada en el minuto 30: no. **Causa encontrada:** el aviso se abre en el minuto 29 y la pantalla lo cierra sola al instante y vuelve a contar 29 minutos, por lo que la sesión nunca se cierra (bucle en temporizadores: programa 29 min -> borra -> programa 29 min).
- **Evidencia:** `evidencias/ui_11_aviso_minuto_29.png` ; `evidencias/ui_11b_minuto_30.png`

#### [ ] CPS-USR-008-04 | Después de cerrar sesión no se pueden usar los datos con la sesión anterior
- **Requisito:** `RF-USR-008` - Cerrar sesión (Prioridad: Alta)
- **Defecto asociado:** `DEF-01` | **Tipo:** API (servidor)
- **Precondiciones:** Andrea inicia y cierra sesión.
- **Datos de prueba:** N/A
- **Pasos:** 1. Iniciar sesión. 2. Cerrar sesión. 3. Pedir la agenda al servidor.
- **Resultado esperado:** El servidor rechaza la petición (`401`) porque la sesión ya fue cerrada/invalidada.
- **Resultado obtenido (Falla):** Cerrar sesión: `HTTP 200`. Agenda pedida después: `HTTP 200`, devuelve 4 citas con nombres y teléfonos. El servidor no maneja sesiones ni invalida tokens.
- **Evidencia:** `HTTP 200 {"data":[{"idCita":137,"titulo":"Brackets","descripcion":"Solicitud externa de cita por Camila Orto","estado":"Solicitada","idPaciente":13,"nombrePaciente":"Camila Orto"...`

---

### Módulo 2: Agenda y Citas (`CPS-AGE`)

#### [ ] CPS-AGE-001-01 | Habilitar bloques de 8:00 a 11:00 de un lunes futuro solo para el Dr. Eduar Leal
- **Requisito:** `RF-AGE-001` - Gestionar bloques horario (Prioridad: Alta)
- **Defecto asociado:** `DEF-03` | **Tipo:** API (servidor)
- **Precondiciones:** Lunes `09/11/2026` sin bloques.
- **Datos de prueba:** Profesional: Dr. Eduar Leal (`id 1`); horario `08:00` a `11:00`.
- **Pasos:** 1. Abrir la agenda del Dr. Leal. 2. Crear bloques del `09/11` de `8:00` a `11:00`. 3. Ver la agenda del Dr. Leal y la de otro profesional (Dra. Natalia Díaz).
- **Resultado esperado:** La agenda del Dr. Leal muestra 6 bloques disponibles y la de la Dra. Natalia Díaz no cambia.
- **Resultado obtenido (Falla):** Se crearon 6 bloques (`HTTP 201`), pero los bloques no tienen profesional asignado: el sistema guarda una sola agenda global para todo el consultorio, por lo que el mismo bloque aparece para todos los profesionales.
- **Evidencia:** `HTTP 200 {"data":[{"inicio":"2026-11-09 08:00:00","final":"2026-11-09 08:30:00","estado":true,"ocupacion":false}...`

#### [ ] CPS-AGE-002-03 | Dos profesionales distintos pueden tener cita a la misma hora
- **Requisito:** `RF-AGE-002` - Agendar citas (Prioridad: Alta)
- **Defecto asociado:** `DEF-03` | **Tipo:** API (servidor)
- **Precondiciones:** El Dr. Mateo ya tiene cita agendada a las `09:00` del `04/11`.
- **Datos de prueba:** Dra. Valeria Silva, paciente Luis Pérez, `09:00` del `04/11`.
- **Pasos:** 1. Agendar a Luis con la Dra. Silva a las `9:00` del mismo día (`04/11`).
- **Resultado esperado:** La cita se crea (`201`), porque cada profesional tiene su propia agenda independiente (`RF-AGE-001`).
- **Resultado obtenido (Falla):** `HTTP 400 {"message":"El bloque 2026-11-04 09:00:00 no está disponible."}`

#### [ ] CPS-AGE-002-04 | No agendar en un bloque que ya pasó
- **Requisito:** `RF-AGE-002` - Agendar citas (Prioridad: Alta)
- **Defecto asociado:** `DEF-12` | **Tipo:** API (servidor)
- **Precondiciones:** Hoy `27/10/2026` después de las 6:00 p. m.; existe bloque de las `16:30` de hoy.
- **Datos de prueba:** Bloque `2026-10-27 16:30` (ya pasó).
- **Pasos:** 1. Agendar una cita en un bloque de hoy cuya hora ya pasó.
- **Resultado esperado:** El sistema rechaza la creación (`400`).
- **Resultado obtenido (Falla):** El sistema creó y confirmó la cita `134` en un bloque pasado.
- **Evidencia:** `HTTP 201 {"message":"Cita confirmada exitosamente.","data":{"id_cita":134,"titulo":"Control de hoy","id_paciente":7,"id_usuario":101,"estado":"Confirmada"...`

#### [ ] CPS-AGE-003-02 | No permitir solicitar una cita para mañana (menos de 5 días)
- **Requisito:** `RF-AGE-003` - Solicitar cita (Prioridad: Alta)
- **Defecto asociado:** `DEF-06` | **Tipo:** API (servidor)
- **Precondiciones:** Hoy `27/10/2026`; existen bloques del `28/10/2026`.
- **Datos de prueba:** Bloque `28/10/2026 10:00`, solicitante `"Mario Fuera"`.
- **Pasos:** 1. En la sección pública, solicitar cita para el `28/10`.
- **Resultado esperado:** El sistema rechaza la solicitud (solo se permite entre 5 y 60 días de anticipación).
- **Resultado obtenido (Falla):** La solicitud para el día siguiente se registró exitosamente (`id_solicitud: 3`).
- **Evidencia:** `HTTP 201 {"message":"Solicitud registrada y sujeta a aprobación del consultorio.","data":{"solicitud":{"id_solicitud":3,"nombre_solicitante":"Mario Fuera"...`

#### [ ] CPS-AGE-003-03 | No registrar la solicitud si no se marca la autorización de datos (API)
- **Requisito:** `RF-AGE-003` - Solicitar cita (Prioridad: Alta)
- **Defecto asociado:** `DEF-07` | **Tipo:** API (servidor)
- **Precondiciones:** Bloque `04/11 15:00` disponible.
- **Datos de prueba:** Autorización de tratamiento de datos sin marcar (`false` / omitida).
- **Pasos:** 1. Llenar la solicitud. 2. No marcar la autorización. 3. Enviar petición.
- **Resultado esperado:** La solicitud se rechaza (`400`) y no se registra.
- **Resultado obtenido (Falla):** La solicitud se registró (`HTTP 201`, `id_solicitud: 4`) aunque la autorización estaba sin marcar.
- **Evidencia:** `HTTP 201 {"message":"Solicitud registrada y sujeta a aprobación del consultorio.","data":{"solicitud":{"id_solicitud":4,"nombre_solicitante":"Sin Autorizacion"...`

#### [ ] CPS-AGE-003-04 | No inventar datos que el solicitante no escribió
- **Requisito:** `RF-AGE-003` - Solicitar cita (Prioridad: Alta)
- **Defecto asociado:** `DEF-08` | **Tipo:** API (servidor)
- **Precondiciones:** Bloque `04/11 16:00` disponible.
- **Datos de prueba:** Solicitud sin `fechaNacimiento` ni `sexo`.
- **Pasos:** 1. Enviar una solicitud sin fecha de nacimiento ni sexo. 2. Revisar la solicitud/paciente registrado.
- **Resultado esperado:** Los campos no enviados quedan vacíos (`null`) o se rechaza pidiendo llenarlos; jamás se guardan valores inventados.
- **Resultado obtenido (Falla):** Fecha de nacimiento guardada: `1997-04-12`; sexo guardado: `Femenino`. Ninguno de los dos se envió en la petición.
- **Evidencia:** `HTTP 201 {"message":"Solicitud registrada y sujeta a aprobación del consultorio.","data":{"solicitud":{"id_solicitud":5,"nombre_solicitante":"Datos Parciales"...`

#### [ ] CPS-AGE-003-05 | La solicitud pública pide marcar la autorización de datos (UI)
- **Requisito:** `RF-AGE-003` - Solicitar cita (Prioridad: Alta)
- **Defecto asociado:** `DEF-07` | **Tipo:** Pantalla (navegador)
- **Precondiciones:** Navegador sin sesión en la página pública.
- **Datos de prueba:** Solicitante `"Paula Pantalla"`, bloque `05/11 2:00 p. m.`
- **Pasos:** 1. Llenar los datos. 2. Elegir el bloque. 3. Pulsar `"Confirmar Solicitud de Cita"`.
- **Resultado esperado:** Aparece la casilla de autorización de tratamiento de datos personales (Ley 1581) desmarcada por defecto y no permite enviar el formulario sin marcarla.
- **Resultado obtenido (Falla):** Casillas de autorización en el formulario: `0`; en la ventana de confirmación: `0`. La solicitud se envía sin aceptar autorización.
- **Evidencia:** `evidencias/ui_03_confirmar_sin_autorizacion.png`

#### [ ] CPS-AGE-004-02 | Si la coordinadora está inactiva, el aviso le llega a la auxiliar
- **Requisito:** `RF-AGE-004` - Notificar solicitud cita (Prioridad: Media)
- **Defecto asociado:** `DEF-09` | **Tipo:** API (servidor)
- **Precondiciones:** Andrea (coordinadora) inactiva; Milena (auxiliar) activa.
- **Datos de prueba:** Solicitud de `"Jorge Ruiz"` para el `05/11 10:00`.
- **Pasos:** 1. Inactivar a Andrea. 2. Registrar una solicitud pública. 3. Revisar buzones de correo.
- **Resultado esperado:** El correo de notificación interna llega al buzón de la auxiliar activa (Milena).
- **Resultado obtenido (Falla):** Solo se envió a `jorge.ruiz@pruebas.co` y `eduard.leal@gmail.com`; nunca llegó a la auxiliar.
- **Evidencia:** `jorge.ruiz@pruebas.co: Solicitud de Cita Recibida... | eduard.leal@gmail.com: Nueva Solicitud de Cita Recibida en Portal Web - Jorge Ruiz (#6)`

#### [ ] CPS-AGE-004-03 | Aviso diario de las 7:00 a. m. con solicitudes sin gestionar
- **Requisito:** `RF-AGE-004` - Notificar solicitud cita (Prioridad: Media)
- **Defecto asociado:** `DEF-10` | **Tipo:** API (servidor)
- **Precondiciones:** Solicitud sin gestionar para dentro de 5 o más días.
- **Datos de prueba:** N/A
- **Pasos:** 1. Revisar si el servidor tiene una tarea programada (cron) que envíe el aviso diario a las 7:00 a. m.
- **Resultado esperado:** A las 7:00 a. m. se ejecuta el job y envía el correo con el listado de solicitudes pendientes.
- **Resultado obtenido (Falla):** El servidor no tiene ninguna tarea programada en `src/`; el aviso diario nunca se envía.
- **Evidencia:** `Búsqueda de tareas programadas en src/ (sin resultados).`

#### [ ] CPS-AGE-005-01 | Confirmar una solicitud de un documento no registrado
- **Requisito:** `RF-AGE-005` - Gestionar solicitud (Prioridad: Alta)
- **Defecto asociado:** `DEF-08` | **Tipo:** API (servidor)
- **Precondiciones:** Solicitud pendiente de `"Carolina Rojas"` (documento no registrado previamente como paciente).
- **Datos de prueba:** Gestor que aprueba: Andrea (`id 67`).
- **Pasos:** 1. La coordinadora abre la solicitud. 2. Pulsa Confirmar.
- **Resultado esperado:** La cita queda `Confirmada`, con `"Agendado por"` = Andrea (`67`), y se crea automáticamente el registro del paciente con la bandera `datosIncompletos: true`.
- **Resultado obtenido (Falla):** Cita `Confirmada`, pero gestores en historial quedó como `"1,67"` y el paciente fue creado con `datosIncompletos: false`.
- **Evidencia:** `HTTP 200 {"message":"Cita creada y confirmada exitosamente...","data":{"id_cita":128,"titulo":"Dolor de muela","id_paciente":8,"id_usuario":101,"estado":"Confirmada"...`

#### [ ] CPS-AGE-005-02 | No rechazar una solicitud sin motivo
- **Requisito:** `RF-AGE-005` - Gestionar solicitud (Prioridad: Alta)
- **Defecto asociado:** `DEF-04` | **Tipo:** API (servidor)
- **Precondiciones:** Solicitud de `"Jorge Ruiz"` pendiente (`id 6`).
- **Datos de prueba:** Rechazar con motivo vacío (`""` / `null`).
- **Pasos:** 1. Abrir la solicitud. 2. Pulsar Rechazar sin escribir motivo.
- **Resultado esperado:** El sistema rechaza la operación (`400`) exigiendo el motivo, y el estado de la solicitud no cambia.
- **Resultado obtenido (Falla):** `HTTP 200 "Solicitud rechazada correctamente."`: el sistema autocompletó el motivo `"Solicitud rechazada"` por su cuenta y cambió el estado a `Rechazada`.
- **Evidencia:** `HTTP 200 {"message":"Solicitud rechazada correctamente.","data":{"estado":"Rechazada","solicitudId":6,"correo":"jorge.ruiz@pruebas.co"}}`

#### [ ] CPS-AGE-007-01 | Cancelar una cita Confirmada con motivo
- **Requisito:** `RF-AGE-007` - Cancelar cita (Prioridad: Alta)
- **Defecto asociado:** `DEF-11` | **Tipo:** API (servidor)
- **Precondiciones:** Cita Confirmada de Luis Pérez con la Dra. Silva (`05/11 11:00`, `id_cita: 133`).
- **Datos de prueba:** Motivo: `"Viaje del paciente"`.
- **Pasos:** 1. Abrir la cita. 2. Cancelar. 3. Escribir el motivo. 4. Confirmar.
- **Resultado esperado:** La cita pasa a `Cancelada`, sus bloques quedan disponibles y **tanto el paciente como el profesional reciben correo de notificación**.
- **Resultado obtenido (Falla):** Estado: `Cancelada`; bloque liberado: `sí`; correos al paciente: `0`; correos a la profesional: `0` (el cambio de estado no envía ningún correo).
- **Evidencia:** `HTTP 200 {"message":"Cita actualizada a estado Cancelada.","data":{"id_cita":133,"titulo":"Control ortodoncia","id_paciente":7,"id_usuario":102,"estado":"Cancelada"}}`

#### [ ] CPS-AGE-007-02 | No cancelar una cita sin motivo
- **Requisito:** `RF-AGE-007` - Cancelar cita (Prioridad: Alta)
- **Defecto asociado:** `DEF-04` | **Tipo:** API (servidor)
- **Precondiciones:** Cita de Ana Pérez en estado `Confirmada` (`id_cita: 127`).
- **Datos de prueba:** Motivo vacío.
- **Pasos:** 1. Enviar cancelación de cita sin escribir motivo.
- **Resultado esperado:** La cita no se cancela (`400 Bad Request`).
- **Resultado obtenido (Falla):** `HTTP 200 "Cita actualizada a estado Cancelada."` sin haber enviado motivo.
- **Evidencia:** `HTTP 200 {"message":"Cita actualizada a estado Cancelada.","data":{"id_cita":127,"titulo":"Valoración general","id_paciente":6,"id_usuario":101,"estado":"Cancelada"}}`

#### [ ] CPS-AGE-008-04 | La agenda abre en el día de hoy
- **Requisito:** `RF-AGE-008` - Consultar agenda (Prioridad: Alta)
- **Defecto asociado:** `DEF-25` | **Tipo:** Pantalla (navegador)
- **Precondiciones:** Hoy es martes `27/10/2026`.
- **Datos de prueba:** N/A
- **Pasos:** 1. Entrar como coordinadora. 2. Mirar el día inicial que muestra la agenda.
- **Resultado esperado:** La agenda abre posicionada en el día actual (`27/10/2026`).
- **Resultado obtenido (Falla):** La agenda abre en `"Sábado 24 Octubre 2026"`. La fecha inicial está quemada en el código (`useRealtimeAgenda.ts`: `'2026-10-24'`).
- **Evidencia:** `evidencias/ui_14_agenda_dia_inicial.png`

#### [ ] CPS-AGE-009-02 | No finalizar una atención sin motivo de consulta
- **Requisito:** `RF-AGE-009` - Iniciar / finalizar atención (Prioridad: Alta)
- **Defecto asociado:** `DEF-04` | **Tipo:** API (servidor)
- **Precondiciones:** Cita de hoy de Luis Pérez (`id_cita: 134`) iniciada (`En consulta`) sin registro de historia clínica / motivo de consulta.
- **Datos de prueba:** Cambio de estado a finalizar atención.
- **Pasos:** 1. El profesional inicia la atención. 2. Sin registrar el motivo de consulta en la historia, pulsa Finalizar.
- **Resultado esperado:** El sistema rechaza la finalización (`400`), la cita permanece `En consulta` y muestra el aviso correspondiente.
- **Resultado obtenido (Falla):** Finalizar sin motivo devuelve `HTTP 200 "Cita actualizada a estado Completada."`.
- **Evidencia:** `HTTP 200 {"message":"Cita actualizada a estado Completada.","data":{"id_cita":134,"titulo":"Control de hoy","id_paciente":7,"id_usuario":101,"estado":"Completada"}}`

#### [ ] CPS-AGE-009-03 | Solo el profesional responsable inicia la atención
- **Requisito:** `RF-AGE-009` - Iniciar / finalizar atención (Prioridad: Alta)
- **Defecto asociado:** `DEF-02` | **Tipo:** API (servidor)
- **Precondiciones:** Cita Confirmada de Ana Pérez asignada a la Dra. Natalia Díaz (`id_usuario: 106`, `10/11 10:00`, `id_cita: 135`).
- **Datos de prueba:** El Dr. Mateo (`id 101`) intenta iniciar la atención.
- **Pasos:** 1. Otro profesional distinto al asignado pulsa Iniciar atención.
- **Resultado esperado:** El sistema rechaza la operación (`403 Forbidden`).
- **Resultado obtenido (Falla):** El Dr. Mateo pudo iniciar la cita de la Dra. Natalia Díaz (`HTTP 200`); el servidor no verifica que el usuario autenticado coincida con el profesional asignado a la cita.
- **Evidencia:** `HTTP 200 {"message":"Cita actualizada a estado En consulta.","data":{"id_cita":135,"titulo":"Control general","id_paciente":6,"id_usuario":106,"estado":"En consulta"}}`

#### [ ] CPS-AGE-009-04 | No aceptar un estado de cita que no existe
- **Requisito:** `RF-AGE-009` - Iniciar / finalizar atención (Prioridad: Alta)
- **Defecto asociado:** `DEF-05` | **Tipo:** API (servidor)
- **Precondiciones:** Cita Confirmada de Ana Pérez (`id_cita: 135`, `10/11 10:00`).
- **Datos de prueba:** Estados `"Inasistencia"` y `"Estado inventado"`.
- **Pasos:** 1. Enviar cambio de estado con un valor no válido o desalineado.
- **Resultado esperado:** El sistema rechaza cualquier estado fuera del enum oficial y unifica la nomenclatura entre Agenda, Historia Clínica y ERS (`Atendida`/`Completada` e `Inasistencia`/`No asistió`).
- **Resultado obtenido (Falla):** Tanto `"Inasistencia"` como `"Estado inventado"` devuelven `HTTP 200` y se guardan en la cita. Además, `"Inasistencia"` se salta la validación de hora porque el código solo comprueba el string `"No asistió"`.
- **Evidencia:** `HTTP 200 {"message":"Cita actualizada a estado Estado inventado.","data":{"id_cita":135,"estado":"Estado inventado"}}`

#### [ ] CPS-AGE-010-01 | Cancelar automáticamente una cita Solicitada que no se gestionó a tiempo
- **Requisito:** `RF-AGE-010` - Gestionar cita automática (Prioridad: Alta)
- **Defecto asociado:** `DEF-10` | **Tipo:** API (servidor)
- **Precondiciones:** Datos semilla: cita `14` (Lucía Restrepo) en estado `Solicitada` para el `24/10/2026` (fecha ya pasada respecto a hoy `27/10/2026`).
- **Datos de prueba:** Fecha actual `27/10/2026`.
- **Pasos:** 1. Consultar el estado de la cita `14` tres días después de su fecha.
- **Resultado esperado:** La cita pasó automáticamente a `Cancelada` con su motivo y la solicitante recibió correo.
- **Resultado obtenido (Falla):** La cita `14` sigue en estado `"Solicitada"` tres días después. No existe proceso automático en el servidor.
- **Evidencia:** `HTTP 200 {"data":[{"idCita":14,"titulo":"Valoración Sensibilidad Molar","estado":"Solicitada","idPaciente":1,"nombrePaciente":"Lucía Restrepo Gómez"...`

#### [ ] CPS-AGE-010-02 | Pasar a Inasistencia una cita Confirmada que nunca se inició
- **Requisito:** `RF-AGE-010` - Gestionar cita automática (Prioridad: Alta)
- **Defecto asociado:** `DEF-10` | **Tipo:** API (servidor)
- **Precondiciones:** Datos semilla: cita `13` (Sofía Carvajal) `Confirmada` para el `24/10/2026`.
- **Datos de prueba:** Fecha actual `27/10/2026`.
- **Pasos:** 1. Consultar el estado de la cita `13`.
- **Resultado esperado:** La cita pasó automáticamente a `Inasistencia` / `No asistió` a las 23:59 del día de la cita.
- **Resultado obtenido (Falla):** La cita `13` sigue en estado `"Confirmada"`.

#### [ ] CPS-AGE-011-01 | Enviar recordatorio 24 horas antes de la cita
- **Requisito:** `RF-AGE-011` - Enviar recordatorios citas (Prioridad: Alta)
- **Defecto asociado:** `DEF-10` | **Tipo:** API (servidor)
- **Precondiciones:** Cita `Confirmada` para mañana `28/10/2026` (`idCita: 136`, Ana Pérez).
- **Datos de prueba:** Cita creada dentro de la ventana de 24h previas.
- **Pasos:** 1. Crear la cita. 2. Esperar/ejecutar el proceso automático. 3. Revisar buzón y el campo de estado del recordatorio en la cita.
- **Resultado esperado:** La paciente recibe un único correo de recordatorio y la cita registra el estado del recordatorio como `"Enviado"`.
- **Resultado obtenido (Falla):** Recordatorios recibidos: `0`. El objeto cita no tiene ningún campo de estado de recordatorio y no existe job automático.
- **Evidencia:** `HTTP 200 {"data":[{"idCita":136,"titulo":"Recordatorio","estado":"Confirmada","idPaciente":6,"nombrePaciente":"Ana Pérez"...`

#### [ ] CPS-AGE-012-02 | La página pública deja elegir el servicio antes del día
- **Requisito:** `RF-AGE-012` - Seleccionar servicio profesional (Prioridad: Alta)
- **Defecto asociado:** `DEF-26` | **Tipo:** Pantalla (navegador)
- **Precondiciones:** Navegador sin sesión en la página pública de solicitud de citas.
- **Datos de prueba:** Servicio `"Ortodoncia"`.
- **Pasos:** 1. Abrir la página pública. 2. Buscar la lista de servicios odontológicos.
- **Resultado esperado:** Existe un selector de servicios y, al elegir `"Ortodoncia"`, solo se muestran los bloques disponibles de los profesionales que prestan ese servicio (Dra. Natalia Díaz).
- **Resultado obtenido (Falla):** No existe ningún campo para elegir el servicio (el único `<select>` de la página es Sexo: Femenino/Masculino/Indeterminado). El formulario siempre envía la solicitud quemada al Dr. Eduar Leal (`idProfesional: 1`).
- **Evidencia:** `evidencias/ui_02_sin_servicio.png`

#### [ ] CPS-AGE-013-01 | No marcar inasistencia antes de la hora de la cita
- **Requisito:** `RF-AGE-013` - Marcar inasistencia (Prioridad: Media)
- **Defecto asociado:** `DEF-05` | **Tipo:** API (servidor)
- **Precondiciones:** Cita de Ana Pérez `Confirmada` para el `10/11 10:00` (fecha futura respecto a hoy `27/10`).
- **Datos de prueba:** La Dra. Natalia envía cambio de estado a `"No asistió"` hoy `27/10`.
- **Pasos:** 1. Abrir la cita futura. 2. Marcar inasistencia (`"No asistió"`).
- **Resultado esperado:** El sistema rechaza la operación (`400`) porque la fecha/hora de la cita aún no ha ocurrido.
- **Resultado obtenido (Falla):** Se permitió marcar `"No asistió"` en una cita futura del `10/11` (`HTTP 200`).
- **Evidencia:** `HTTP 200 {"message":"Cita actualizada a estado No asistió.","data":{"id_cita":135,"estado":"No asistió"}}`

---

### Módulo 3: Pacientes e Historia Clínica (`CPS-HCL`)

#### [ ] CPS-HCL-001-03 | No crear paciente sin la autorización de datos
- **Requisito:** `RF-HCL-001` - Crear paciente (Prioridad: Alta)
- **Defecto asociado:** `DEF-07` | **Tipo:** API (servidor)
- **Precondiciones:** Sesión activa.
- **Datos de prueba:** Paciente adulto enviando `autorizacionDatos: false` vs omitiendo la propiedad `autorizacionDatos` en el JSON.
- **Pasos:** 1. Crear paciente sin enviar el campo `autorizacionDatos`.
- **Resultado esperado:** No se crea el paciente (`400 Bad Request`) y se señala el campo `autorizacionDatos` como obligatorio.
- **Resultado obtenido (Falla):** Con `autorizacionDatos: false` responde `HTTP 400`, pero **si se omite el campo en el request responde `HTTP 201`** (el backend asume `true` por defecto).
- **Evidencia:** `HTTP 201 {"message":"Paciente creado con historial clínico vacío.","data":{"idPaciente":14,"nombreCompleto":"Sin Campo Autorizacion","documentoIdentidad":"52999889"...`

#### [ ] CPS-HCL-001-06 | El acudiente y la autorización del paciente se conservan después de reiniciar el servidor
- **Requisito:** `RF-HCL-001` - Crear paciente (Prioridad: Alta)
- **Defecto asociado:** `DEF-23` | **Tipo:** API (servidor)
- **Precondiciones:** Paciente `"Sara Menor"` (`idPaciente: 15`) creada con acudiente `"Luis Pérez"` y autorización aceptada (`CPS-HCL-001-05`).
- **Datos de prueba:** Paciente Sara Menor (`id 15`).
- **Pasos:** 1. Reiniciar el servidor. 2. Consultar la ficha de Sara (`GET /api/v1/patients/15`).
- **Resultado esperado:** La ficha conserva el objeto `acudiente`, la prueba de autorización y `datosIncompletos: false`.
- **Resultado obtenido (Falla):** Después de reiniciar el servidor: `acudiente: null`, autorización perdida (`null`) y `datosIncompletos: true`.
- **Evidencia:** `HTTP 200 {"data":{"idPaciente":15,"nombreCompleto":"Sara Menor","documentoIdentidad":"1100223355","datosIncompletos":true,"idHistoria":10,"acudiente":null...`

#### [ ] CPS-HCL-004-01 | Ficha del paciente con datos, autorización y citas ("Agendado por")
- **Requisito:** `RF-HCL-004` - Visualizar pacientes (Prioridad: Alta)
- **Defecto asociado:** `DEF-16` | **Tipo:** API (servidor)
- **Precondiciones:** Paciente Ana Pérez (`id 6`) con citas registradas.
- **Datos de prueba:** `GET /api/v1/patients/6`
- **Pasos:** 1. Abrir/consultar la ficha de Ana Pérez.
- **Resultado esperado:** Se visualizan sus datos personales, la autorización y sus citas incluyendo estado y el campo `"Agendado por"`.
- **Resultado obtenido (Falla):** Devuelve los datos, autorización y 3 citas, pero ninguna cita incluye el dato `"Agendado por"`.
- **Evidencia:** `HTTP 200 {"data":{"idPaciente":6,"nombreCompleto":"Ana Pérez","documentoIdentidad":"52111222"...`

#### [ ] CPS-HCL-004-02 | La coordinadora no ve opciones clínicas en la lista de pacientes
- **Requisito:** `RF-HCL-004` - Visualizar pacientes (Prioridad: Alta)
- **Defecto asociado:** `DEF-17` | **Tipo:** Pantalla (navegador)
- **Precondiciones:** Andrea (coordinadora) con sesión iniciada en el frontend.
- **Datos de prueba:** Vista de lista de Pacientes.
- **Pasos:** 1. Entrar como coordinadora. 2. Abrir el módulo Pacientes.
- **Resultado esperado:** Para el rol Coordinadora NO deben renderizarse botones ni accesos a `"Historia clínica"`, `"Consentimientos"` ni `"Documentos clínicos"`.
- **Resultado obtenido (Falla):** Aparecen 6 botones `"Ver historia clínica"` visibles para la coordinadora, y al pulsarlos abre el expediente clínico completo (`"Historial Clínico Integral Resolución 1995 de 1999 Expediente médico de Andrés Felipe Ramos..."`).
- **Evidencia:** `evidencias/ui_07_coordinadora_pacientes.png` ; `evidencias/ui_07b_coordinadora_abre_historia.png`

#### [ ] CPS-HCL-005-03 | No abrir/guardar la historia de una cita que no está En consulta
- **Requisito:** `RF-HCL-005` - Crear historia clínica (Prioridad: Alta)
- **Defecto asociado:** `DEF-13` | **Tipo:** API (servidor)
- **Precondiciones:** Cita de Ana Pérez (`idCita: 127`) en estado `Confirmada` (para el `05/11`, no está `En consulta`).
- **Datos de prueba:** Se envía el `POST` de registro clínico sin indicar el estado de la cita (o enviando el payload estándar).
- **Pasos:** 1. Intentar guardar una evolución/historia clínica asociada a la cita `127` (`Confirmada`).
- **Resultado esperado:** El servidor consulta el estado real de la cita `127` en la BD, detecta que no está `"En consulta"` y rechaza la operación (`400/409`).
- **Resultado obtenido (Falla):** `HTTP 201 "Registro clínico guardado exitosamente."`. El servidor toma el estado de la cita que le manda el cliente (o asume `"En consulta"` por defecto) en lugar de consultarlo en la base de datos.
- **Evidencia:** `HTTP 201 {"message":"Registro clínico guardado exitosamente.","data":{"idEvolucion":2,"idHistoria":1,"idCita":127...`

#### [ ] CPS-HCL-006-01 | El profesional responsable edita la historia el mismo día con auditoría de valor anterior
- **Requisito:** `RF-HCL-006` - Editar historia clínica (Prioridad: Alta)
- **Defecto asociado:** `DEF-14` | **Tipo:** API (servidor)
- **Precondiciones:** Historia/evolución creada hoy (`idEvolucion: 1`, `idCita: 134`).
- **Datos de prueba:** Nuevo motivo `"Dolor en molar 46"`.
- **Pasos:** 1. Editar el motivo el mismo día de creación. 2. Guardar.
- **Resultado esperado:** Se guarda el cambio y el registro de auditoría/respuesta conserva tanto el valor anterior como el valor nuevo.
- **Resultado obtenido (Falla):** `HTTP 200 "Historia clínica actualizada dentro del plazo legal."`, pero no guarda ni devuelve el registro del valor anterior.
- **Evidencia:** `HTTP 200 {"message":"Historia clínica actualizada dentro del plazo legal.","data":{"idEvolucion":1,"idHistoria":2,"idCita":134...`

#### [ ] CPS-HCL-007-01 | La auxiliar registra un hallazgo en el odontograma durante la consulta
- **Requisito:** `RF-HCL-007` - Gestionar odontograma (Prioridad: Alta)
- **Defecto asociado:** `DEF-02` | **Tipo:** API (servidor)
- **Precondiciones:** Cita de hoy en estado `En consulta`. Sesión o petición de Milena (rol Auxiliar).
- **Datos de prueba:** Caries activa en la pieza `11`, cara vestibular; diligencia Milena (auxiliar).
- **Pasos:** 1. Abrir el odontograma. 2. Marcar la caries. 3. Guardar como auxiliar.
- **Resultado esperado:** Se guarda exitosamente (`200/201`) registrando el nombre de Milena en `"Diligenciado por"`.
- **Resultado obtenido (Falla):** `HTTP 403 {"message":"No tiene permiso para realizar esta acción"}` y `Diligenciado por` queda vacío/`undefined`.

#### [ ] CPS-HCL-007-03 | El odontograma de la siguiente consulta parte del último guardado
- **Requisito:** `RF-HCL-007` - Gestionar odontograma (Prioridad: Alta)
- **Defecto asociado:** `DEF-15` | **Tipo:** API (servidor)
- **Precondiciones:** Caries previamente guardada en la pieza `11` del paciente Luis Pérez (`idPaciente: 7`).
- **Datos de prueba:** `GET /api/v1/clinical-records/odontogram/latest/7`
- **Pasos:** 1. Consultar el último odontograma de Luis al iniciar una nueva consulta.
- **Resultado esperado:** `HTTP 200` devolviendo el último odontograma con la caries en la pieza `11`.
- **Resultado obtenido (Falla):** `HTTP 404 Cannot GET /api/v1/clinical-records/odontogram/latest/7`. La función está escrita en el controlador, pero no se publicó en `api.routes.ts`.

#### [ ] CPS-HCL-008-02 | La coordinadora (o visitante sin sesión) no puede abrir el historial clínico por dirección directa
- **Requisito:** `RF-HCL-008` - Consultar historial clínico (Prioridad: Alta)
- **Defecto asociado:** `DEF-01` | **Tipo:** API (servidor)
- **Precondiciones:** Historia clínica de Luis Pérez (`idPaciente: 7`) creada.
- **Datos de prueba:** Petición directa al endpoint de historial clínico sin sesión de profesional.
- **Pasos:** 1. Llamar directamente a la URL del historial clínico sin sesión o con rol no autorizado.
- **Resultado esperado:** Acceso bloqueado (`401/403`).
- **Resultado obtenido (Falla):** `HTTP 200`, entrega el historial clínico completo a cualquiera que llame a la URL sin sesión ni permiso.
- **Evidencia:** `HTTP 200 {"data":{"idHistoria":2,"idPaciente":7,"historial":[{"idCita":134,"profesionalResponsable":"Dr. Mateo Gómez","motivoConsulta":"Dolor en molar 46"...`

#### [ ] CPS-HCL-010-01 | Consultar los datos de un titular (paciente y acudiente)
- **Requisito:** `RF-HCL-010` - Consultar datos titular (Prioridad: Media)
- **Defecto asociado:** `DEF-15` | **Tipo:** API (servidor)
- **Precondiciones:** Luis Pérez (`documento: 79222333`) es paciente y además es acudiente de Sara Menor.
- **Datos de prueba:** `GET /api/v1/patients/holder/79222333`
- **Pasos:** 1. La coordinadora consulta los datos del titular por documento `79222333`.
- **Resultado esperado:** Devuelve sus datos en ambas calidades (como paciente y como acudiente), su autorización y sus citas, sin exponer datos clínicos sensibles.
- **Resultado obtenido (Falla):** `HTTP 404 Cannot GET /api/v1/patients/holder/79222333`. La función `exportHolderData` existe en el controlador de pacientes, pero no está publicada en `api.routes.ts`.

---

### Módulo 4: Consentimientos Informados (`CPS-CON`)

#### [ ] CPS-CON-001-01 | No asociar de nuevo un consentimiento que el paciente ya firmó
- **Requisito:** `RF-CON-001` - Seleccionar consentimiento informado (Prioridad: Alta)
- **Defecto asociado:** `DEF-19` | **Tipo:** API (servidor)
- **Precondiciones:** Ana Pérez (`idPaciente: 6`) ya tiene firmado el consentimiento `"Diseño de sonrisa"` (`idConsentimiento: 1`).
- **Datos de prueba:** Segunda petición de firma para `idConsentimiento: 1` e `idPaciente: 6`.
- **Pasos:** 1. Intentar registrar otra vez la firma de la misma plantilla para Ana.
- **Resultado esperado:** El sistema rechaza la operación (`400/409`) indicando que el consentimiento ya fue firmado por el paciente.
- **Resultado obtenido (Falla):** `HTTP 201 "Consentimiento firmado guardado exitosamente."`. Guardó una segunda firma duplicada.
- **Evidencia:** `HTTP 201 {"message":"Consentimiento firmado guardado exitosamente.","data":{"idConsentimiento":1,"idPaciente":6,"idCita":127,"archivoUrl":"https://pruebas.local/firmado-ana-2.pdf"...`

#### [ ] CPS-CON-002-02 | Firmar en la tablet desde el enlace del código QR
- **Requisito:** `RF-CON-002` - Firmar consentimiento informado (Prioridad: Alta)
- **Defecto asociado:** `DEF-21` | **Tipo:** Pantalla (navegador)
- **Precondiciones:** Paciente 1 (Lucía Restrepo) y plantilla activa. La tablet es otro navegador independiente sin sesión iniciada.
- **Datos de prueba:** Enlace `/tablet-sign/1`.
- **Pasos:** 1. Abrir el enlace en el navegador de la tablet. 2. Marcar `"He leído…"`. 3. Firmar en el recuadro. 4. Pulsar `"Guardar Firma"`.
- **Resultado esperado:** La tablet carga del backend los datos del paciente y la plantilla asociada al token/enlace, y al firmar persiste el consentimiento firmado en la BD.
- **Resultado obtenido (Falla):** La tablet muestra `"Paciente Titular" / ""` (no carga el paciente ni la plantilla). Al firmar no se guarda nada en el servidor (`0` consentimientos antes y después) porque la pantalla solo envía la petición si hay un paciente seleccionado en el estado local de ese mismo navegador.
- **Evidencia:** `evidencias/ui_12_firma_tablet.png`

#### [ ] CPS-CON-003-01 | La coordinadora (o usuario sin permiso) no puede abrir los consentimientos por dirección directa
- **Requisito:** `RF-CON-003` - Consultar consentimiento informado (Prioridad: Alta)
- **Defecto asociado:** `DEF-01` | **Tipo:** API (servidor)
- **Precondiciones:** Ana Pérez (`id 6`) tiene un consentimiento firmado.
- **Datos de prueba:** Petición directa sin sesión de profesional.
- **Pasos:** 1. Abrir la URL de consentimientos de Ana sin permiso.
- **Resultado esperado:** Acceso bloqueado (`401/403`) y registrado en auditoría.
- **Resultado obtenido (Falla):** `HTTP 200`, entrega la lista de consentimientos firmados sin verificar quién los pide.

#### [ ] CPS-CON-004-02 | No crear plantilla con nombre repetido
- **Requisito:** `RF-CON-004` - Crear plantilla consentimiento (Prioridad: Alta)
- **Defecto asociado:** `DEF-18` | **Tipo:** API (servidor)
- **Precondiciones:** Ya existe una plantilla llamada `"Diseño de sonrisa"`.
- **Datos de prueba:** Nueva plantilla con `nombre: "Diseño de sonrisa"`.
- **Pasos:** 1. Enviar creación de plantilla con el nombre repetido.
- **Resultado esperado:** Se rechaza con `400/409` indicando que ya existe una plantilla con ese nombre.
- **Resultado obtenido (Falla):** `HTTP 201 "Plantilla creada en versión 1."` (`idConsentimiento: 2` con el mismo nombre `"Diseño de sonrisa"`).

#### [ ] CPS-CON-005-01 | Un menor sin acudiente no puede firmar consentimiento
- **Requisito:** `RF-CON-005` - Exigir firma acudiente menor edad (Prioridad: Alta)
- **Defecto asociado:** `DEF-20` | **Tipo:** API (servidor)
- **Precondiciones:** Paciente menor de edad (`idPaciente: 15`, Sara Menor, nacida en `2014-03-01`).
- **Datos de prueba:** Registro de firma de consentimiento para el menor sin datos/validación de acudiente.
- **Pasos:** 1. Enviar petición de firma para un paciente menor de edad sin datos del acudiente.
- **Resultado esperado:** El servidor valida la edad del paciente, detecta que es menor sin acudiente válido en la firma y rechaza la operación (`400`).
- **Resultado obtenido (Falla):** `HTTP 201 "Consentimiento firmado guardado exitosamente."` sin pedir ni verificar los datos del acudiente.

#### [ ] CPS-CON-006-01 | Generar enlace de un solo uso para firmar en la tablet (vencimiento 15 min)
- **Requisito:** `RF-CON-006` - Habilitar firma en tablet (Prioridad: Alta)
- **Defecto asociado:** `DEF-21` | **Tipo:** API (servidor) / Frontend
- **Precondiciones:** Consentimiento pendiente de firma.
- **Datos de prueba:** Acción `"Habilitar firma en tablet"`.
- **Pasos:** 1. Pulsar `"Habilitar firma en tablet"`. 2. Revisar que el backend genere un token/enlace de un solo uso con expiración de 15 minutos.
- **Resultado esperado:** Se genera en el backend una sesión/token temporal de firma (15 min, un solo uso) que incluye `idPaciente`, `idCita` e `idConsentimiento`, y el QR apunta a ese enlace tokenizado.
- **Resultado obtenido (Falla):** El servidor no genera ningún enlace ni token: `PatientConsentsTab.tsx:130` construye una URL estática `signingUrl={/tablet-sign/${selectedConsentForQR?.idConsentimiento}}` sin token, sin paciente, sin vencimiento ni control de uso único.

#### [ ] CPS-CON-007-02 | No guardar una plantilla con texto/archivo vacío
- **Requisito:** `RF-CON-007` - Editar plantilla consentimiento (Prioridad: Media)
- **Defecto asociado:** `DEF-18` | **Tipo:** API (servidor)
- **Precondiciones:** Plantilla existente (`idConsentimiento: 1`).
- **Datos de prueba:** Actualización enviando texto/contenido o URL vacía.
- **Pasos:** 1. Editar la plantilla dejando el texto/archivo vacío. 2. Guardar.
- **Resultado esperado:** Se rechaza con `400 Bad Request` y no se incrementa la versión.
- **Resultado obtenido (Falla):** `HTTP 200 "Nueva versión de plantilla generada."`, incrementando a `version: 3`.

---

### Módulo 5: Documentos Clínicos (`CPS-DOC`)

#### [ ] CPS-DOC-001-01 | Generar orden de dos medicamentos con datos del paciente y firma en PDF real
- **Requisito:** `RF-DOC-001` - Generar orden medicamentos (Prioridad: Media)
- **Defecto asociado:** `DEF-22` | **Tipo:** API (servidor)
- **Precondiciones:** Cita de Ana Pérez (`idCita: 138`) `En consulta` con el Dr. Mateo.
- **Datos de prueba:** 1) Amoxicilina 500 mg c/8 h x 7 días; 2) Ibuprofeno 400 mg c/8 h x 3 días.
- **Pasos:** 1. Seleccionar Orden de medicamentos. 2. Registrar los 2 medicamentos. 3. Generar y abrir la URL del PDF resultante.
- **Resultado esperado:** Se genera y sirve un archivo `application/pdf` real con los datos del paciente, los 2 medicamentos, logotipo, marca de agua y firma (o espacio de firma).
- **Resultado obtenido (Falla):** `HTTP 201` guarda `"archivoPdfUrl": "/storage/clinical-documents/6/cita-138-orden-medicamentos-1793145278538-flattened.pdf"`, pero al abrir esa ruta el servidor devuelve `text/html; charset=utf-8` (el index HTML del SPA). No hay generador de PDF conectado en el backend ni ruta estática/endpoint que sirva el binario PDF.

#### [ ] CPS-DOC-005-02 | Visitante sin sesión ni rol no puede abrir los documentos clínicos por dirección directa
- **Requisito:** `RF-DOC-005` - Consultar documentos clínicos (Prioridad: Baja)
- **Defecto asociado:** `DEF-01` | **Tipo:** API (servidor)
- **Precondiciones:** Paciente Ana (`id 6`) con documentos clínicos generados.
- **Datos de prueba:** Petición `GET` sin cabecera de rol ni token de sesión.
- **Pasos:** 1. Abrir la dirección directa de documentos clínicos sin enviar cabecera de rol.
- **Resultado esperado:** Acceso bloqueado (`401/403`).
- **Resultado obtenido (Falla):** Si se envía cabecera `ROL-COA` responde `HTTP 403`, pero **si no se envía ninguna cabecera de rol responde `HTTP 200`** y entrega los 4 documentos clínicos.