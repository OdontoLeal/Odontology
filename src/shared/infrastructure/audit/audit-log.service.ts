// src/shared/infrastructure/audit/audit-log.service.ts
import { AuditEntry, IAuditLog, QueryExecutor } from '../../domain/audit.port';
import { db } from '../database/database';

const toJson = (value: unknown): string | null =>
  value === undefined || value === null ? null : JSON.stringify(value);

/**
 * Adaptador de PostgreSQL para el registro de auditoría inalterable
 * (`public.registro_auditoria`, RQNF-SEG-009).
 *
 * No captura errores: si la entrada no se puede guardar, la operación que la
 * originó debe fallar (y, si comparte transacción, deshacerse).
 */
export class AuditLogService implements IAuditLog {
  public async record(entry: AuditEntry, executor: QueryExecutor = db): Promise<void> {
    await executor.query(
      `INSERT INTO public.registro_auditoria
         (id_usuario, actor, accion, entidad, id_registro, valor_anterior, valor_nuevo, detalle)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb);`,
      [
        entry.idUsuario ?? null,
        (entry.actor || 'Desconocido').slice(0, 150),
        String(entry.accion).slice(0, 120),
        entry.entidad.slice(0, 60),
        entry.idRegistro === undefined || entry.idRegistro === null
          ? null
          : String(entry.idRegistro).slice(0, 60),
        toJson(entry.valorAnterior),
        toJson(entry.valorNuevo),
        toJson(entry.detalle),
      ]
    );
  }
}

/** Instancia compartida (el servicio no guarda estado). */
export const auditLog: IAuditLog = new AuditLogService();
