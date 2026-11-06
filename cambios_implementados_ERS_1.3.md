# Cambios implementados — alineación con la ERS v1.3

- **Fecha:** 05/11/2026
- **Base:** rama `dev`, v3.2 (`71963d1`). **Sin commit**: todos los cambios están en el área de trabajo.
- **Origen:** plan de solución del informe `informe_estado_casos_prueba_ERS_1.3.md` (§7).
- **Verificación:** 107/107 pruebas automáticas, `tsc` sin errores, `npm run build` correcto y 17 comprobaciones de punta a punta contra la BD real (servidor local en el puerto 4555).

---

## 1. Base de datos (aplicado en la BD compartida)

Nueva carpeta `database/migrations/` como **única fuente de verdad** del esquema, con el ejecutor `npm run db:migrate` (`src/shared/infrastructure/database/migrate.ts`). Cada migración corre en una transacción y queda registrada en `schema_migrations`. Antes de aplicarla se probó en una transacción con `ROLLBACK`.

| Migración | Qué hace |
| :--- | :--- |
| `000_baseline.sql` | El esquema que había en producción (idempotente; no cambió nada en la BD existente). |
| `001_ers_1_3.sql` | Los cambios de la ERS v1.3 (tabla siguiente). |

| Cambio en la BD | Requisito / defecto |
| :--- | :--- |
| `registro_auditoria` inalterable (triggers que impiden UPDATE, DELETE y TRUNCATE) | RQNF-SEG-009, DEF-14, T-1 |
| `sesion_revocada` (hash SHA-256 del token, nunca el token) | RF-USR-008, DEF-01, CPS-USR-008-04 |
| `intento_login` (bloqueo de 15 min tras 5 intentos) | RF-USR-005 |
| `borrador_sesion` | RF-USR-008 |
| `usuario.es_contrasena_temporal` y usuario técnico **«Sistema»** (`es_sistema`, inactivo, sin acceso) | DEF-23, RF-AGE-010, Regla 9 |
| `chk_cita_estado`: solo los 7 estados de la ERS | DEF-05, D-14 |
| `cita.recordatorio_estado / _causa / _fecha` | RF-AGE-011 |
| `plantilla_consentimiento.tipo` (`PROCEDIMIENTO`, `AUTORIZACION_DATOS`, `MENORES`); una sola activa de cada tipo especial | RQNF-SEG-005/006, RF-CON-004/005 |
| Plantillas iniciales **provisionales** de autorización de datos y de menores (el texto legal lo entrega el cliente, ERS §7) | RQNF-SEG-005/006 |
| Firma única por paciente + plantilla + versión | RF-CON-001, DEF-19 |
| `solicitud_cita`: plantilla, versión y fecha de aceptación de la autorización; una sola solicitud pendiente por documento | D-22, D-19 |
| `evolucion.id_usuario_diligencio` y nueva tabla `nota_evolucion` | RF-HCL-005/006/009, D-24, D-28 |
| Trigger que impide ligar una evolución a la cita de otro paciente | D-25 |
| Corrección de **O-33**: la evolución 6 pasó a la historia del paciente de su cita (no se borró; quedó auditado) | O-33 |
| Triggers que impiden borrar historias, evoluciones, notas y consentimientos firmados | Regla de Negocio 7 |
| Permisos de los roles con la numeración v1.3 (`RF-AGE-013` → `RF-AGE-012`; se retiran `RF-AGE-004`, `RF-CON-006`, `RF-DOC-005`) | ERS v1.3 |

Se retiraron `database/schema.sql`, `database/DDL_ult_version.txt` y `init-db.ts` (estaban desalineados con producción). `npm run db:init` ahora ejecuta las migraciones.

---

## 2. Seguridad, sesión y auditoría (transversal)

| Cambio | Archivo(s) | Requisito / defecto |
| :--- | :--- | :--- |
| `authMiddleware` lee usuario, roles y permisos **de la BD en cada petición**: un usuario inactivado o con roles cambiados se ve afectado en su siguiente acción. Comprueba la revocación del token. | `security/auth.middleware.ts`, `security/access-control.ts` | RF-USR-002/003/008, DEF-01 |
| Cada ruta exige el permiso de su RF con `requirePermission` (antes ninguna lo usaba). | `app/routes/api.routes.ts` | D-15, DEF-01, CPS-SEG-003-02 |
| Mensaje único `«No tiene permiso para realizar esta acción»` y **auditoría de todo acceso bloqueado**, también los de reglas de contexto (`handleRequestError`). | `http/http-error.handler.ts` | RQNF-SEG-003, D-18 |
| Servicio de auditoría con puerto (`IAuditLog`) que escribe en la misma transacción de la operación en pacientes, citas, historia clínica y consentimientos; **sin errores silenciados**. | `shared/domain/audit.port.ts`, `shared/infrastructure/audit/*` | RQNF-SEG-009, D-31 |
| El actor siempre sale de la sesión: se ignoran `idUsuarioGestor`, `ejecutadoPorUsuario` y las cabeceras `x-user-role` del cliente (antes permitían suplantar). | controladores | Regla de Negocio 8 |
| Sin llave JWT por defecto en producción. | `security/token.service.ts` | RQNF-SEG-002 |
| Se dejó de imprimir el enlace de recuperación con el token. | `mail/mailer.service.ts` | D-17 |
| Los correos fallidos quedan auditados (`CORREO_FALLIDO`) sin interrumpir la operación. | `mail/mailer.service.ts` | RQNF-FIA-004 |
| Formato de fecha `DD/MM/AAAA` y hora de 12 h en un módulo compartido (correos, PDF y cron). | `shared/domain/colombia-format.ts` | RQNF-USA-002, D-21 |

---

## 3. Cambios por módulo

### Módulo A — Usuarios y roles
- Repositorio sin almacenes en memoria ni `users_metadata.json`: todo en la BD (DEF-23).
- **Defecto encontrado y corregido:** al editar un usuario con nueva contraseña temporal, se guardaba **sin cifrar** (el caso de uso no recibía el `hasher`). Además, la pantalla enviaba `contrasenaTemporal` y el backend esperaba `nuevaContrasenaTemporal`, así que el cambio se perdía.
- Se implementó `countActiveAdmins` (no quitar el último administrador) y el filtro por rol en la búsqueda.
- Catálogo de permisos con la numeración v1.3 en el dominio y en la pantalla de roles.
- Nuevos endpoints `GET/DELETE /auth/drafts` para los borradores de sesión.

### Módulo B — Agenda
- Máquina de estados de la ERS (`appointment-state.validator.ts`): solo el profesional responsable inicia y finaliza la atención, y solo en citas del día; inasistencia desde la hora de inicio hasta las 11:59 p. m.; cancelación con motivo (DEF-02, DEF-04, DEF-05, D-14).
- Finalizar exige la apertura con motivo de consulta: «Falta registrar el motivo de consulta» (RF-AGE-009, CPS-AGE-009-02).
- Se validan los bloques al agendar, confirmar y reprogramar: disponibles, contiguos, del mismo día y sin empezar. Antes, la confirmación ocupaba bloques sin verificarlos.
- Solicitud pública: datos obligatorios de RF-AGE-003, una sola solicitud pendiente por documento (D-19) y registro de la aceptación de la plantilla vigente (D-22).
- Correo de rechazo con el motivo (D-20). Los correos de reprogramación se envían solo si cambian la fecha, los bloques o el profesional.
- Los profesionales ven solo su agenda (RF-AGE-008).
- Se retiró el caso de uso «Seleccionar servicio» (`RF-AGE-012` antiguo, eliminado en la v1.3).

### Tareas automáticas (`cron.service.ts`)
Reescritas. Cada cambio va en su propia transacción, a nombre de «Sistema» y auditado:
- Solicitada sin gestionar → Cancelada a las 00:00 del día pedido, con correo al solicitante.
- Confirmada sin iniciar → Inasistencia (después de las 23:59, sin liberar bloques).
- **Nuevo:** En consulta sin finalizar → Atendida.
- Recordatorio de 24 h con estado guardado en la cita, sin duplicados tras un reinicio.
- Aviso diario de las 7:00 a. m. con SQL corregido (antes consultaba columnas inexistentes).

### Módulo C — Pacientes
- Ficha según RF-HCL-001 v1.3: sin acudiente, contacto de respaldo ni autorización; se eliminaron `patients_metadata.json` y `DataAuthorizationVO`.
- Todos los datos son obligatorios al crear un paciente. Se agregó «Indeterminado» al formulario.
- **Regresión de v3.2 retirada:** se inventaba `autorizado: true` cuando no llegaba la autorización (D-29).
- «Datos incompletos» pasa a ser un dato derivado (falta el sexo en pacientes creados desde una solicitud); no se guarda.
- Ficha con fecha, hora y «Agendado por» en cada cita (DEF-16). Opciones clínicas: historia solo ODO/ESP; consentimientos también AUX (RF-HCL-004).
- Datos del titular (RF-HCL-010): como paciente o solicitante, con sus autorizaciones (consentimientos firmados y aceptaciones en solicitudes). La consulta queda auditada. El PDF ya no afirma autorizaciones que no existen.

### Módulo C — Historia clínica
- `ClinicalAccessPolicy` (Regla de Negocio 4):
  - el responsable crea y edita mientras la cita está En consulta;
  - la auxiliar ve **solo la consulta en curso** (nuevo `GET /clinical-records/appointment/:idCita`), actualiza el odontograma y registra notas con su nombre;
  - COA y ADM solos, sin acceso.
  - Esto corrige la regresión de v3.2 en la que la auxiliar veía historias anteriores (D-30).
- Las evoluciones ya no sobrescriben la apertura (D-28). Las notas tienen autor propio. Las correcciones después del cierre son **notas aclaratorias** (RF-HCL-006/009).
- Edición solo En consulta, con valor anterior y nuevo en la auditoría (RF-HCL-006 v1.3).
- El historial incluye las inasistencias (RF-HCL-008).
- Se retiraron los casos de uso de edición «hasta las 23:59» y de plantillas con texto bloqueado (eliminados en la v1.3).

### Módulo D — Consentimientos
- Plantillas por tipo, con selector en la administración.
- Un menor solo firma con la plantilla de menores y por medio del acudiente; un adulto no usa esa plantilla (RF-CON-005 v1.3).
- Casilla de aceptación y firma obligatorias. Firma única por versión con el mensaje «El paciente ya firmó este consentimiento el DD/MM/AAAA».
- La auxiliar ve fuera de la consulta solo el estado (sin texto ni firma); el PDF solo lo abre con la cita En consulta (RF-CON-003).
- Aviso de privacidad **público** desde la plantilla vigente: `GET /api/v1/public/privacy-notice`, página `/aviso-privacidad` y enlaces desde el login, la reserva pública y su pie (DEF-28).
- Se retiró la firma por enlace/QR: rutas sin sesión, controlador, modal QR y lectura de token. La firma se hace dentro de la sesión (DEF-21, D-33).

### Módulo E — Documentos clínicos
- El PDF se genera en memoria y se devuelve en la respuesta. Se eliminaron la escritura en disco, `archivoPdfUrl` y la ruta `/storage/...` que fabricaba PDF «oficiales» (D-23, D-27).
- Generar un documento ya no crea filas de evolución y exige la apertura (D-24).
- La firma sale del profesional de la sesión. La incapacidad incluye fechas y campos en blanco para el acudiente de un menor (RF-DOC-002).
- **La pantalla de consulta ahora pide el PDF al servidor.** Antes «imprimía» un HTML propio sin la firma fusionada (DEF-22).
- Se retiraron `GET /clinical-documents/patient/:id` (RF-DOC-005), la pestaña de documentos y los modales sin uso.

### Pantallas (frontend)
- Agenda con los 7 estados de la ERS (sin «Completada», «No asistió», «En espera» ni «Pendiente de confirmación»). Ya no se envía el gestor desde el cliente.
- La consulta activa ya no fuerza «En consulta» al abrirse ni marca «Atendida» al guardar. Tras guardar, el profesional (RF-AGE-009) decide si finaliza; la auxiliar solo guarda.
- El guardado de la consulta ya no inventa motivo, diagnóstico ni procedimiento por defecto.

---

## 4. Pruebas

Se adaptaron a la ERS v1.3 las suites que verificaban reglas retiradas (acudiente en la ficha, edición hasta las 23:59, firma por tablet, documentos guardados). Varias pruebas que leían texto del código se cambiaron por pruebas de comportamiento. Se agregaron casos para:
- la plantilla de menores;
- la firma única por versión;
- la autorización activa única;
- la política de acceso clínico;
- la nota aclaratoria;
- la ausencia de documentos persistidos;
- las migraciones.

Las pruebas usan una auditoría en memoria y no escriben en la BD.

---

## 5. Pendiente o a tener en cuenta

1. **Desplegar** este código en Heroku: la BD ya está migrada y la versión desplegada sigue siendo la anterior.
2. **Textos legales**: las dos plantillas nuevas (autorización de datos y menores) tienen texto **provisional**. El administrador debe reemplazarlo con el del cliente (crea la versión 2).
3. **Contraseñas**: las contraseñas temporales asignadas antes al editar usuarios pudieron quedar sin cifrar (defecto corregido). Conviene restablecerlas.
4. **Auditoría de usuarios y roles**: se registra justo después de la operación, no en la misma transacción (en pacientes, citas, historia clínica y consentimientos sí va en la misma).
5. **Decisiones abiertas de la ERS** (§2.1 del informe):
   - profesional de una solicitud pública (se asigna al confirmar; por defecto, el primer odontólogo activo);
   - alcance de «Datos incompletos»;
   - solicitud pública de varios bloques (hoy, uno).
6. La carpeta local `storage/` (archivos de la versión anterior, ignorada por Git) no se borró porque el entorno no lo permitió. Ya no la usa ningún código: puede eliminarse a mano.
7. No se probó la interfaz en el navegador: se verificó con la compilación, las pruebas y las llamadas a la API.
