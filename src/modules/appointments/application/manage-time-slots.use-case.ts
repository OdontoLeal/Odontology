// src/modules/appointments/application/manage-time-slots.use-case.ts
import { ColombiaTime } from '../../../shared/domain/colombia-time.util';
import {
  IAppointmentAuditLoggerPort,
  IAppointmentRealtimeNotifierPort,
  IAppointmentRepository,
} from '../domain/appointment.repository.interface';
import { TimeSlotEntity } from '../domain/time-slot.entity';

export interface ManageTimeSlotsCommand {
  ejecutadoPorUsuario: string;
  idProfesional: number;
  fecha: string | Date; // Fecha base en formato "YYYY-MM-DD" o Date
  bloques: Array<string | Date>; // Lista de horas o fechas completas de los bloques a configurar
  accion: 'HABILITAR' | 'DESHABILITAR';
  fechaFinalRepeticionSemanal?: string | Date | null; // Opcional: hasta 6 meses desde hoy (RF-AGE-001)
  now?: Date;
}

export interface ManageTimeSlotsResult {
  message: string;
  totalBloquesAfectados: number;
  fechasAfectadas: string[];
}

export class ManageTimeSlotsUseCase {
  constructor(
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly auditLogger?: IAppointmentAuditLoggerPort,
    private readonly realtimeNotifier?: IAppointmentRealtimeNotifierPort
  ) {}

  public async execute(command: ManageTimeSlotsCommand): Promise<ManageTimeSlotsResult> {
    const now = command.now ?? new Date();

    if (!command.idProfesional) {
      throw new Error('Debe especificar el profesional para gestionar los bloques de horario (RF-AGE-001).');
    }

    if (!Array.isArray(command.bloques) || command.bloques.length === 0) {
      throw new Error('Debe seleccionar al menos un bloque de horario para realizar la acción.');
    }

    if (command.accion !== 'HABILITAR' && command.accion !== 'DESHABILITAR') {
      throw new Error('La acción debe ser HABILITAR o DESHABILITAR (RF-AGE-001).');
    }

    // 1. Validar que el profesional exista y esté activo
    const professional = await this.appointmentRepository.findUserById(command.idProfesional);
    if (!professional) {
      throw new Error(`El profesional con ID ${command.idProfesional} no fue encontrado en el sistema.`);
    }
    if (!professional.estado) {
      throw new Error(`El profesional ${professional.nombreCompleto} se encuentra inactivo (RF-USR-003).`);
    }

    // 2. Normalizar fecha base
    const baseDate =
      command.fecha instanceof Date
        ? new Date(command.fecha.getTime())
        : new Date(command.fecha.includes('T') ? command.fecha : `${command.fecha}T05:00:00Z`);

    if (Number.isNaN(baseDate.getTime())) {
      throw new Error('La fecha base indicada no es válida.');
    }

    // 3. Procesar repetición semanal si fue indicada
    const targetDates: Date[] = [baseDate];
    if (command.fechaFinalRepeticionSemanal) {
      const finalRepDate =
        command.fechaFinalRepeticionSemanal instanceof Date
          ? new Date(command.fechaFinalRepeticionSemanal.getTime())
          : new Date(
              command.fechaFinalRepeticionSemanal.includes('T')
                ? command.fechaFinalRepeticionSemanal
                : `${command.fechaFinalRepeticionSemanal}T23:59:59Z`
            );

      if (Number.isNaN(finalRepDate.getTime())) {
        throw new Error('La fecha final de repetición semanal no es válida.');
      }

      // Validar rango máximo 6 meses (RF-AGE-001)
      TimeSlotEntity.validateWeeklyRepetitionRange(baseDate, finalRepDate, now);

      // Generar semanas intermedias (cada 7 días el mismo día de la semana)
      let nextWeekDate = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      while (nextWeekDate.getTime() <= finalRepDate.getTime()) {
        targetDates.push(new Date(nextWeekDate.getTime()));
        nextWeekDate = new Date(nextWeekDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
    }

    // 4. Construir y validar todas las entidades TimeSlotEntity para cada fecha
    const slotsToPersist: TimeSlotEntity[] = [];
    const affectedDatesSet = new Set<string>();

    for (const targetDate of targetDates) {
      const dateKey = ColombiaTime.toDateKey(targetDate);
      affectedDatesSet.add(dateKey);

      for (const rawSlot of command.bloques) {
        let slotStartDate: Date;

        if (typeof rawSlot === 'string' && !rawSlot.includes('-')) {
          // Formato hora "HH:mm" ej "08:00" o "14:30"
          slotStartDate = ColombiaTime.parseColombiaSlot(dateKey, rawSlot);
        } else {
          const parsed = rawSlot instanceof Date ? rawSlot : new Date(rawSlot);
          if (Number.isNaN(parsed.getTime())) {
            throw new Error(`La hora o fecha de bloque "${rawSlot}" no es válida.`);
          }
          // Ajustar al día target correspondiente
          const hours = parsed.getUTCHours();
          const minutes = parsed.getUTCMinutes();
          const [y, m, d] = dateKey.split('-').map(Number);
          slotStartDate = new Date(Date.UTC(y, m - 1, d, hours, minutes, 0, 0));
        }

        const slotEntity = TimeSlotEntity.create({
          inicio: slotStartDate,
          idProfesional: command.idProfesional,
          estado: command.accion === 'HABILITAR',
          ocupacion: false,
        });

        // Validar si el bloque ya empezó (RF-AGE-001)
        if (slotEntity.hasStarted(now)) {
          throw new Error(
            `No se puede modificar un bloque de horario que ya empezó (${ColombiaTime.formatDateTime(
              slotEntity.inicio
            )}) (RF-AGE-001).`
          );
        }

        slotsToPersist.push(slotEntity);
      }
    }

    // 5. Si la acción es DESHABILITAR, verificar que ninguno de los bloques tenga citas u ocupación previa (Regla 1 / RF-AGE-001)
    if (command.accion === 'DESHABILITAR') {
      const existingSlots = await this.appointmentRepository.findSlotsByDates(
        slotsToPersist.map((s) => s.inicio)
      );

      for (const existing of existingSlots) {
        if (existing.ocupacion) {
          throw new Error(
            `No se puede deshabilitar el bloque ${ColombiaTime.formatDateTime(
              existing.inicio
            )} porque ya tiene una cita o solicitud asignada (RF-AGE-001).`
          );
        }
      }
    }

    // 6. Persistir bloques atómicamente
    await this.appointmentRepository.upsertTimeSlots(slotsToPersist);

    // 7. Registro de auditoría inalterable (RQNF-SEG-009)
    if (this.auditLogger) {
      await this.auditLogger.log({
        usuario: command.ejecutadoPorUsuario,
        accion: `Gestionar bloques horario: ${command.accion}`,
        registroAfectado: `profesional:${command.idProfesional}:bloques`,
        valorNuevo: {
          profesional: professional.nombreCompleto,
          accion: command.accion,
          totalBloques: slotsToPersist.length,
          fechas: Array.from(affectedDatesSet),
        },
      });
    }

    // 8. Notificación en tiempo real a clientes conectados (RQNF-DES-002)
    if (this.realtimeNotifier) {
      await this.realtimeNotifier.notifyAgendaChanged({
        type: 'SLOTS_UPDATED',
        payload: {
          idProfesional: command.idProfesional,
          accion: command.accion,
          fechas: Array.from(affectedDatesSet),
        },
      });
    }

    return {
      message: `Bloques de horario ${
        command.accion === 'HABILITAR' ? 'habilitados' : 'deshabilitados'
      } exitosamente (${slotsToPersist.length} bloques en ${affectedDatesSet.size} día(s)).`,
      totalBloquesAfectados: slotsToPersist.length,
      fechasAfectadas: Array.from(affectedDatesSet),
    };
  }
}
