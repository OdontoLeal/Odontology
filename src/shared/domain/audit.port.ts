// src/shared/domain/audit.port.ts

/**
 * Ejecutor mínimo de consultas: el pool global o el cliente de una
 * transacción abierta. Permite que la entrada de auditoría se escriba en la
 * misma transacción que la operación (RQNF-SEG-009: "si la entrada no se
 * guarda, la operación tampoco").
 */
export interface QueryExecutor {
  query(text: string, params?: unknown[]): Promise<unknown>;
}

export type AuditAction =
  | 'CREAR'
  | 'MODIFICAR'
  | 'CAMBIAR_ESTADO'
  | 'ELIMINAR'
  | 'INICIO_SESION'
  | 'INICIO_SESION_FALLIDO'
  | 'CIERRE_SESION'
  | 'ACCESO_BLOQUEADO'
  | 'CONSULTA_TITULAR'
  | 'GENERAR_DOCUMENTO'
  | 'FIRMAR_CONSENTIMIENTO'
  | 'CORREO_FALLIDO'
  | 'CORRECCION_INTEGRIDAD'
  | (string & {});

export interface AuditEntry {
  /** Usuario autenticado; null si la acción es del "Sistema" o anónima. */
  idUsuario?: number | null;
  /** Nombre o correo legible del actor ("Sistema" en procesos automáticos). */
  actor: string;
  accion: AuditAction;
  /** Tabla o agregado afectado (p. ej. "paciente", "cita", "rbac"). */
  entidad: string;
  idRegistro?: string | number | null;
  valorAnterior?: unknown;
  valorNuevo?: unknown;
  detalle?: unknown;
}

export interface IAuditLog {
  record(entry: AuditEntry, executor?: QueryExecutor): Promise<void>;
}
