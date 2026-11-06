// src/modules/clinical-records/application/clinical-access.policy.ts
import { ForbiddenError, SessionUser, hasPermission, hasRole } from '../../../shared/infrastructure/security/access-control';
import { AppointmentClinicalContext } from '../domain/clinical-record.repository.interface';
import { ClinicalWriteActor } from '../infrastructure/clinical-record.model';

/** Error de estado de la cita (409). */
export class ClinicalStateError extends Error {
  public readonly statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ClinicalStateError';
  }
}

/**
 * Regla de Negocio 4 (ERS v1.3) aplicada a una cita concreta.
 *
 * - El profesional responsable (ROL-ODO/ROL-ESP de la cita) crea y edita la
 *   historia de su consulta mientras está En consulta.
 * - La auxiliar (ROL-AUX), con su propio usuario y solo con la cita En
 *   consulta, ve esa historia, registra la evolución y actualiza el odontograma.
 * - ROL-COA y ROL-ADM por sí solos no acceden.
 * Toda negación se responde con el mensaje único de permisos (y se audita).
 */
export class ClinicalAccessPolicy {
  private static isResponsibleProfessional(user: SessionUser, cita: AppointmentClinicalContext): boolean {
    return hasRole(user, 'ROL-ODO', 'ROL-ESP') && user.idUsuario === cita.idProfesional;
  }

  private static isAssistant(user: SessionUser): boolean {
    return hasRole(user, 'ROL-AUX') && hasPermission(user, 'RF-HCL-009', 'RF-HCL-007');
  }

  /** Quién escribe en la consulta (apertura/edición o apoyo de la auxiliar). */
  static resolveWriter(user: SessionUser, cita: AppointmentClinicalContext): ClinicalWriteActor {
    const base = { idUsuario: user.idUsuario, nombreUsuario: user.nombreCompleto, correo: user.correo };

    if (this.isResponsibleProfessional(user, cita) && hasPermission(user, 'RF-HCL-005', 'RF-HCL-006')) {
      if (cita.estado !== 'En consulta') {
        throw new ClinicalStateError(
          'Solo se puede registrar o modificar la historia clínica mientras la cita está "En consulta".'
        );
      }
      return { ...base, esProfesionalResponsable: true };
    }

    // La auxiliar pierde el acceso cuando la cita deja de estar En consulta (RF-AGE-009, RF-HCL-007)
    if (this.isAssistant(user) && cita.estado === 'En consulta') {
      return { ...base, esProfesionalResponsable: false };
    }

    throw new ForbiddenError();
  }

  /** RF-HCL-006/009: nota aclaratoria después del cierre, solo el profesional responsable. */
  static resolveClarificationAuthor(user: SessionUser, cita: AppointmentClinicalContext): ClinicalWriteActor {
    if (!this.isResponsibleProfessional(user, cita) || !hasPermission(user, 'RF-HCL-009', 'RF-HCL-006')) {
      throw new ForbiddenError();
    }
    return {
      idUsuario: user.idUsuario,
      nombreUsuario: user.nombreCompleto,
      correo: user.correo,
      esProfesionalResponsable: true,
    };
  }

  /** Ver la historia de una consulta concreta (no el historial completo). */
  static assertCanViewConsultation(user: SessionUser, cita: AppointmentClinicalContext): void {
    if (hasRole(user, 'ROL-ODO', 'ROL-ESP') && hasPermission(user, 'RF-HCL-008', 'RF-HCL-005')) return;
    if (this.isAssistant(user) && cita.estado === 'En consulta') return;
    throw new ForbiddenError();
  }

  /** RF-HCL-008: el historial completo solo lo consultan ROL-ODO y ROL-ESP. */
  static assertCanViewHistory(user: SessionUser): void {
    if (!hasRole(user, 'ROL-ODO', 'ROL-ESP') || !hasPermission(user, 'RF-HCL-008')) {
      throw new ForbiddenError();
    }
  }
}
