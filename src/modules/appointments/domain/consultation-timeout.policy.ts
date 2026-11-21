// src/modules/appointments/domain/consultation-timeout.policy.ts

export interface ConsultationTimeoutEvaluation {
  isOverdue: boolean;
  reason: 'GRACE_PERIOD_EXCEEDED' | 'HARD_TIMEOUT_EXCEEDED' | 'NONE';
  elapsedMinutes: number;
  overdueMinutes: number;
}

/**
 * Servicio de Dominio: Política de Vigencia Temporal de Consulta Activa (Clean Code & SOLID: SRP)
 * 
 * Reglas de negocio clínicas:
 * 1. Margen de Gracia (Grace Period): Tras culminar la franja horaria programada (ej. 30 o 60 min),
 *    se otorga una tolerancia de 45 minutos para procedimientos que se extiendan justificadamente.
 * 2. Límite Duro Absoluto (Hard Timeout): Ninguna atención ambulatoria puede permanecer "En consulta"
 *    por más de 180 minutos (3 horas) continuas sin considerarse abandonada/huérfana.
 */
export class ConsultationTimeoutPolicy {
  public static readonly DEFAULT_GRACE_MINUTES = 45;
  public static readonly DEFAULT_HARD_TIMEOUT_MINUTES = 180; // 3 horas

  /**
   * Calcula los minutos transcurridos entre dos fechas.
   */
  public static calculateElapsedMinutes(from: Date, to: Date = new Date()): number {
    const diffMs = to.getTime() - from.getTime();
    return Math.max(0, Math.floor(diffMs / (60 * 1000)));
  }

  /**
   * Verifica si una consulta ha superado su franja horaria programada + margen de gracia.
   */
  public static isGracePeriodExceeded(
    scheduledEndTime: Date,
    now: Date = new Date(),
    graceMinutes: number = ConsultationTimeoutPolicy.DEFAULT_GRACE_MINUTES
  ): boolean {
    const maxAllowedTime = new Date(scheduledEndTime.getTime() + graceMinutes * 60 * 1000);
    return now.getTime() > maxAllowedTime.getTime();
  }

  /**
   * Verifica si una consulta ha superado el límite duro absoluto desde su inicio.
   */
  public static isHardTimeoutExceeded(
    attentionStartTime: Date,
    now: Date = new Date(),
    hardTimeoutMinutes: number = ConsultationTimeoutPolicy.DEFAULT_HARD_TIMEOUT_MINUTES
  ): boolean {
    const elapsed = this.calculateElapsedMinutes(attentionStartTime, now);
    return elapsed >= hardTimeoutMinutes;
  }

  /**
   * Evalúa de forma exhaustiva el estado de vigencia de una consulta activa.
   */
  public static evaluateConsultationTimeout(params: {
    scheduledEndTime: Date;
    attentionStartTime?: Date;
    now?: Date;
    graceMinutes?: number;
    hardTimeoutMinutes?: number;
  }): ConsultationTimeoutEvaluation {
    const now = params.now ?? new Date();
    const graceMinutes = params.graceMinutes ?? ConsultationTimeoutPolicy.DEFAULT_GRACE_MINUTES;
    const hardTimeoutMinutes =
      params.hardTimeoutMinutes ?? ConsultationTimeoutPolicy.DEFAULT_HARD_TIMEOUT_MINUTES;

    const referenceStart = params.attentionStartTime ?? params.scheduledEndTime;
    const elapsedMinutes = this.calculateElapsedMinutes(referenceStart, now);

    // 1. Verificar Hard Timeout (>= 180 min)
    if (params.attentionStartTime && this.isHardTimeoutExceeded(params.attentionStartTime, now, hardTimeoutMinutes)) {
      const overdueMinutes = elapsedMinutes - hardTimeoutMinutes;
      return {
        isOverdue: true,
        reason: 'HARD_TIMEOUT_EXCEEDED',
        elapsedMinutes,
        overdueMinutes: Math.max(0, overdueMinutes),
      };
    }

    // 2. Verificar fin de franja horaria + gracia
    if (this.isGracePeriodExceeded(params.scheduledEndTime, now, graceMinutes)) {
      const scheduledLimitMs = params.scheduledEndTime.getTime() + graceMinutes * 60 * 1000;
      const overdueMinutes = Math.max(0, Math.floor((now.getTime() - scheduledLimitMs) / (60 * 1000)));
      return {
        isOverdue: true,
        reason: 'GRACE_PERIOD_EXCEEDED',
        elapsedMinutes,
        overdueMinutes,
      };
    }

    return {
      isOverdue: false,
      reason: 'NONE',
      elapsedMinutes,
      overdueMinutes: 0,
    };
  }
}
