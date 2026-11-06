// src/shared/infrastructure/audit/users-audit.adapter.ts
import { IAuditLog } from '../../domain/audit.port';
import { IAuditLoggerPort } from '../../../modules/users-auth/domain/user.repository.interface';
import { auditLog } from './audit-log.service';

/**
 * Adapta el puerto de auditoría del módulo de usuarios (`IAuditLoggerPort`,
 * con `registroAfectado` como "entidad:id") al registro de auditoría común.
 */
export class UsersAuditAdapter implements IAuditLoggerPort {
  constructor(private readonly audit: IAuditLog = auditLog) {}

  public async log(entry: {
    usuario: string;
    accion: string;
    registroAfectado: string;
    valorAnterior?: unknown;
    valorNuevo?: unknown;
  }): Promise<void> {
    const [entidad, ...rest] = String(entry.registroAfectado || 'usuarios').split(':');
    await this.audit.record({
      idUsuario: null,
      actor: entry.usuario,
      accion: entry.accion,
      entidad: entidad || 'usuarios',
      idRegistro: rest.join(':') || null,
      valorAnterior: entry.valorAnterior,
      valorNuevo: entry.valorNuevo,
    });
  }
}
