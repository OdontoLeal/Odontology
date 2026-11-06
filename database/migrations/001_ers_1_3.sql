-- =====================================================================
-- 001_ers_1_3.sql
-- Alinea el esquema con la ERS v1.3 y con el plan de solución del
-- informe "informe_estado_casos_prueba_ERS_1.3.md" (§7).
-- Se ejecuta dentro de una transacción (ver migrate.ts).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Usuarios: contraseña temporal en BD y usuario técnico "Sistema"
--    (DEF-23, RF-USR-005, RF-AGE-010, Regla de Negocio 9)
-- ---------------------------------------------------------------------
ALTER TABLE public.usuario
  ADD COLUMN IF NOT EXISTS es_contrasena_temporal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS es_sistema boolean NOT NULL DEFAULT false;

INSERT INTO public.usuario
  (nombre_completo, documento_identidad, correo, telefono, contrasena_hash, estado, es_sistema)
VALUES
  ('Sistema', '0', 'sistema@odontoleal.local', NULL, '!sin-acceso', false, true)
ON CONFLICT (correo) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. Registro de auditoría inalterable (RQNF-SEG-009, DEF-14, D-31)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.registro_auditoria
(
    id_auditoria   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fecha          timestamptz  NOT NULL DEFAULT now(),
    id_usuario     integer
        CONSTRAINT fk_auditoria_usuario REFERENCES public.usuario
            ON UPDATE CASCADE ON DELETE RESTRICT,
    actor          varchar(150) NOT NULL,
    accion         varchar(120) NOT NULL,
    entidad        varchar(60)  NOT NULL,
    id_registro    varchar(60),
    valor_anterior jsonb,
    valor_nuevo    jsonb,
    detalle        jsonb
);

CREATE INDEX IF NOT EXISTS idx_auditoria_entidad_registro
    ON public.registro_auditoria (entidad, id_registro);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha
    ON public.registro_auditoria (fecha DESC);

CREATE OR REPLACE FUNCTION public.fn_auditoria_inalterable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'El registro de auditoría es inalterable (RQNF-SEG-009).';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auditoria_inalterable ON public.registro_auditoria;
CREATE TRIGGER trg_auditoria_inalterable
    BEFORE UPDATE OR DELETE ON public.registro_auditoria
    FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_inalterable();

DROP TRIGGER IF EXISTS trg_auditoria_no_truncate ON public.registro_auditoria;
CREATE TRIGGER trg_auditoria_no_truncate
    BEFORE TRUNCATE ON public.registro_auditoria
    FOR EACH STATEMENT EXECUTE FUNCTION public.fn_auditoria_inalterable();

-- ---------------------------------------------------------------------
-- 3. Sesiones revocadas al cerrar sesión (RF-USR-008, DEF-01).
--    Se guarda el hash SHA-256 del token, nunca el token.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sesion_revocada
(
    token_hash  char(64)    PRIMARY KEY,
    id_usuario  integer
        CONSTRAINT fk_sesion_revocada_usuario REFERENCES public.usuario
            ON UPDATE CASCADE ON DELETE CASCADE,
    revocada_en timestamptz NOT NULL DEFAULT now(),
    expira_en   timestamptz NOT NULL
);

-- ---------------------------------------------------------------------
-- 4. Bloqueo por intentos fallidos de inicio de sesión (RF-USR-005)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.intento_login
(
    correo            varchar(150) PRIMARY KEY,
    intentos_fallidos smallint     NOT NULL DEFAULT 0,
    bloqueado_hasta   timestamptz
);

-- ---------------------------------------------------------------------
-- 5. Borradores de cambios sin guardar al cerrar sesión (RF-USR-008)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.borrador_sesion
(
    id_usuario     integer      NOT NULL
        CONSTRAINT fk_borrador_usuario REFERENCES public.usuario
            ON UPDATE CASCADE ON DELETE CASCADE,
    formulario_id  varchar(120) NOT NULL,
    datos          jsonb        NOT NULL DEFAULT '{}'::jsonb,
    fecha_guardado timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT pk_borrador_sesion PRIMARY KEY (id_usuario, formulario_id)
);

-- ---------------------------------------------------------------------
-- 6. Estados de la cita: solo los 7 de la ERS (DEF-05, D-14) y estado
--    del recordatorio (RF-AGE-011)
-- ---------------------------------------------------------------------
UPDATE public.cita SET estado = 'Atendida'     WHERE estado = 'Completada';
UPDATE public.cita SET estado = 'Inasistencia' WHERE estado = 'No asistió';
UPDATE public.cita SET estado = 'Confirmada'   WHERE estado = 'En espera';
UPDATE public.cita SET estado = 'Solicitada'   WHERE estado = 'Pendiente de confirmación';

ALTER TABLE public.cita DROP CONSTRAINT IF EXISTS chk_cita_estado;
ALTER TABLE public.cita ADD CONSTRAINT chk_cita_estado CHECK (
    estado IN ('Solicitada', 'Confirmada', 'Rechazada', 'En consulta',
               'Atendida', 'Cancelada', 'Inasistencia')
);

ALTER TABLE public.cita
  ADD COLUMN IF NOT EXISTS recordatorio_estado varchar(12) NOT NULL DEFAULT 'Pendiente',
  ADD COLUMN IF NOT EXISTS recordatorio_causa  varchar(250),
  ADD COLUMN IF NOT EXISTS recordatorio_fecha  timestamptz;

ALTER TABLE public.cita DROP CONSTRAINT IF EXISTS chk_cita_recordatorio_estado;
ALTER TABLE public.cita ADD CONSTRAINT chk_cita_recordatorio_estado CHECK (
    recordatorio_estado IN ('Pendiente', 'Enviado', 'No enviado', 'Anulado')
);

-- Las citas ya cerradas no deben recibir recordatorio.
UPDATE public.cita SET recordatorio_estado = 'Anulado'
 WHERE estado IN ('Rechazada', 'Atendida', 'Cancelada', 'Inasistencia');

-- ---------------------------------------------------------------------
-- 7. Plantillas por tipo (ERS v1.3, RF-CON-004, RF-CON-005,
--    RQNF-SEG-005/006). Solo puede haber una plantilla activa de
--    autorización de datos y una de menores.
-- ---------------------------------------------------------------------
ALTER TABLE public.plantilla_consentimiento
  ADD COLUMN IF NOT EXISTS tipo varchar(20) NOT NULL DEFAULT 'PROCEDIMIENTO';

ALTER TABLE public.plantilla_consentimiento DROP CONSTRAINT IF EXISTS chk_plantilla_tipo;
ALTER TABLE public.plantilla_consentimiento ADD CONSTRAINT chk_plantilla_tipo CHECK (
    tipo IN ('PROCEDIMIENTO', 'AUTORIZACION_DATOS', 'MENORES')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_plantilla_tipo_especial_activa
    ON public.plantilla_consentimiento (tipo)
    WHERE estado AND tipo <> 'PROCEDIMIENTO';

-- Plantillas iniciales provisionales: el texto legal definitivo lo
-- entrega el cliente (ERS §7). El administrador las edita (RF-CON-007).
INSERT INTO public.plantilla_consentimiento (nombre, version, estado, texto_plantilla, tipo, id_usuario_modificador)
SELECT 'Autorización de tratamiento de datos personales', 1, true,
       'AVISO DE PRIVACIDAD Y AUTORIZACIÓN DE TRATAMIENTO DE DATOS PERSONALES' || chr(10) || chr(10) ||
       'Responsable del tratamiento: Consultorio Odontológico Dr. Eduar Leal Álvarez.' || chr(10) ||
       'Finalidades: agendamiento de citas, atención odontológica, historia clínica y envío de notificaciones de citas.' || chr(10) ||
       'Derechos del titular (Ley 1581 de 2012, art. 8): conocer, actualizar, rectificar y suprimir sus datos, y revocar esta autorización.' || chr(10) ||
       'Canales para consultas y reclamos: atención directa en el consultorio.' || chr(10) || chr(10) ||
       'Yo, {{nombre_paciente}}, identificado(a) con documento {{documento_paciente}}, autorizo de manera previa, expresa e informada el tratamiento de mis datos personales para las finalidades descritas.' || chr(10) || chr(10) ||
       '[Texto provisional pendiente de aprobación del cliente — ERS v1.3, sección 7]',
       'AUTORIZACION_DATOS', NULL
WHERE NOT EXISTS (
    SELECT 1 FROM public.plantilla_consentimiento WHERE tipo = 'AUTORIZACION_DATOS'
)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.plantilla_consentimiento (nombre, version, estado, texto_plantilla, tipo, id_usuario_modificador)
SELECT 'Consentimiento y autorización para menores de edad', 1, true,
       'CONSENTIMIENTO INFORMADO Y AUTORIZACIÓN DE TRATAMIENTO DE DATOS DE MENOR DE EDAD' || chr(10) || chr(10) ||
       'Paciente menor de edad: {{nombre_paciente}}, documento {{documento_paciente}}.' || chr(10) ||
       'Quien suscribe, en calidad de acudiente o representante legal, autoriza la atención odontológica del menor y el tratamiento de sus datos personales para las finalidades del aviso de privacidad del consultorio.' || chr(10) || chr(10) ||
       '{{datos_acudiente}}' || chr(10) || chr(10) ||
       '[Texto provisional pendiente de aprobación del cliente — ERS v1.3, sección 7]',
       'MENORES', NULL
WHERE NOT EXISTS (
    SELECT 1 FROM public.plantilla_consentimiento WHERE tipo = 'MENORES'
)
ON CONFLICT (nombre) DO NOTHING;

-- Un paciente firma una sola vez cada versión de una plantilla (RF-CON-001, DEF-19)
CREATE UNIQUE INDEX IF NOT EXISTS uq_consentimiento_paciente_version
    ON public.consentimiento_firmado (id_paciente, id_consentimiento, version_plantilla);

-- ---------------------------------------------------------------------
-- 8. Solicitud pública: aceptación de la plantilla vigente de
--    autorización (RQNF-SEG-005, D-22) y una sola solicitud pendiente
--    por documento (RF-AGE-003, D-19)
-- ---------------------------------------------------------------------
ALTER TABLE public.solicitud_cita
  ADD COLUMN IF NOT EXISTS id_plantilla_autorizacion integer
      CONSTRAINT fk_solicitud_plantilla_autorizacion REFERENCES public.plantilla_consentimiento
          ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS version_plantilla_autorizacion smallint,
  ADD COLUMN IF NOT EXISTS fecha_aceptacion_autorizacion timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitud_pendiente_por_documento
    ON public.solicitud_cita (documento_solicitante)
    WHERE estado;

-- ---------------------------------------------------------------------
-- 9. Historia clínica: autoría de la apertura y notas de evolución
--    propias (RF-HCL-005, RF-HCL-006, RF-HCL-009, D-24, D-28)
-- ---------------------------------------------------------------------
ALTER TABLE public.evolucion
  ADD COLUMN IF NOT EXISTS id_usuario_diligencio integer
      CONSTRAINT fk_evolucion_usuario_diligencio REFERENCES public.usuario
          ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.nota_evolucion
(
    id_nota                 integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    id_evolucion            integer     NOT NULL
        CONSTRAINT fk_nota_evolucion REFERENCES public.evolucion
            ON UPDATE CASCADE ON DELETE RESTRICT,
    tipo                    varchar(20) NOT NULL DEFAULT 'EVOLUCION',
    procedimiento_realizado text,
    texto                   text        NOT NULL,
    id_usuario_diligencio   integer     NOT NULL
        CONSTRAINT fk_nota_usuario REFERENCES public.usuario
            ON UPDATE CASCADE ON DELETE RESTRICT,
    fecha                   timestamp   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_nota_tipo CHECK (tipo IN ('EVOLUCION', 'NOTA_ACLARATORIA')),
    CONSTRAINT chk_nota_texto CHECK (btrim(texto) <> '')
);

CREATE INDEX IF NOT EXISTS idx_nota_evolucion_evolucion
    ON public.nota_evolucion (id_evolucion, fecha);

-- O-33: la evolución creada en I5-002 quedó en la historia del paciente 6
-- ligada a la cita 5 (paciente 5). Se mueve a la historia del paciente
-- de la cita (no se borra: Regla de Negocio 7) y se deja constancia.
INSERT INTO public.registro_auditoria (actor, accion, entidad, id_registro, valor_anterior, valor_nuevo, detalle)
SELECT 'Sistema', 'CORRECCION_INTEGRIDAD', 'evolucion', e.id_evolucion::text,
       jsonb_build_object('id_historia', e.id_historia),
       jsonb_build_object('id_historia', hc_cita.id_historia),
       jsonb_build_object('motivo', 'O-33: evolución ligada a la cita de otro paciente (migración 001)')
  FROM public.evolucion e
  JOIN public.cita c ON c.id_cita = e.id_cita
  JOIN public.historia_clinica hc_cita ON hc_cita.id_paciente = c.id_paciente
 WHERE e.id_historia <> hc_cita.id_historia;

UPDATE public.evolucion e
   SET id_historia = hc_cita.id_historia
  FROM public.cita c
  JOIN public.historia_clinica hc_cita ON hc_cita.id_paciente = c.id_paciente
 WHERE c.id_cita = e.id_cita
   AND e.id_historia <> hc_cita.id_historia;

-- D-25: la BD impide ligar una evolución a la cita de otro paciente.
CREATE OR REPLACE FUNCTION public.fn_evolucion_paciente_coherente() RETURNS trigger AS $$
DECLARE
  v_paciente_cita integer;
  v_paciente_historia integer;
BEGIN
  SELECT id_paciente INTO v_paciente_cita FROM public.cita WHERE id_cita = NEW.id_cita;
  SELECT id_paciente INTO v_paciente_historia FROM public.historia_clinica WHERE id_historia = NEW.id_historia;
  IF v_paciente_cita IS DISTINCT FROM v_paciente_historia THEN
    RAISE EXCEPTION 'La cita % no corresponde al paciente de la historia clínica %.', NEW.id_cita, NEW.id_historia;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_evolucion_paciente_coherente ON public.evolucion;
CREATE TRIGGER trg_evolucion_paciente_coherente
    BEFORE INSERT OR UPDATE OF id_cita, id_historia ON public.evolucion
    FOR EACH ROW EXECUTE FUNCTION public.fn_evolucion_paciente_coherente();

-- Regla de Negocio 7 y RQNF-FIA-003: historias, evoluciones, notas y
-- consentimientos firmados no se eliminan.
CREATE OR REPLACE FUNCTION public.fn_registro_clinico_no_eliminable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Los registros clínicos y consentimientos firmados no se pueden eliminar (Regla de Negocio 7).';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_historia_no_eliminable ON public.historia_clinica;
CREATE TRIGGER trg_historia_no_eliminable BEFORE DELETE ON public.historia_clinica
    FOR EACH ROW EXECUTE FUNCTION public.fn_registro_clinico_no_eliminable();

DROP TRIGGER IF EXISTS trg_evolucion_no_eliminable ON public.evolucion;
CREATE TRIGGER trg_evolucion_no_eliminable BEFORE DELETE ON public.evolucion
    FOR EACH ROW EXECUTE FUNCTION public.fn_registro_clinico_no_eliminable();

DROP TRIGGER IF EXISTS trg_nota_no_eliminable ON public.nota_evolucion;
CREATE TRIGGER trg_nota_no_eliminable BEFORE DELETE ON public.nota_evolucion
    FOR EACH ROW EXECUTE FUNCTION public.fn_registro_clinico_no_eliminable();

DROP TRIGGER IF EXISTS trg_consentimiento_no_eliminable ON public.consentimiento_firmado;
CREATE TRIGGER trg_consentimiento_no_eliminable BEFORE DELETE ON public.consentimiento_firmado
    FOR EACH ROW EXECUTE FUNCTION public.fn_registro_clinico_no_eliminable();

-- ---------------------------------------------------------------------
-- 10. Catálogo de permisos de la ERS v1.3 en los roles:
--     RF-AGE-013 (Marcar inasistencia) pasa a ser RF-AGE-012; se retiran
--     RF-AGE-012 antiguo (Seleccionar servicio), RF-AGE-004 (acción del
--     Sistema), RF-CON-006 y RF-DOC-005 (eliminados en la v1.2).
-- ---------------------------------------------------------------------
UPDATE public.rol r
   SET permisos = COALESCE((
         SELECT jsonb_agg(p ORDER BY p)
           FROM (
             SELECT DISTINCT p
               FROM jsonb_array_elements_text(r.permisos) AS t(p)
              WHERE p NOT IN ('RF-AGE-012', 'RF-AGE-013', 'RF-AGE-004', 'RF-CON-006', 'RF-DOC-005')
             UNION
             SELECT 'RF-AGE-012' WHERE r.permisos ? 'RF-AGE-013'
           ) s
       ), '[]'::jsonb);
