// src/modules/appointments/application/select-service.use-case.ts
import { SERVICES_CATALOG, DentalServiceConfig } from '../../../app/config/services-catalog.config';
import { ColombiaTime } from '../../../shared/domain/colombia-time.util';
import { IAppointmentRepository } from '../domain/appointment.repository.interface';
import { DentalServiceType } from '../domain/appointment.entity';

export interface SelectServiceQuery {
  servicio?: DentalServiceType;
  contexto: 'PUBLICO' | 'INTERNO';
  fechaReferencia?: string | Date; // Para contexto interno: semana elegida
  now?: Date;
}

export interface ServiceDetailDTO {
  codigo: string;
  nombre: DentalServiceType;
  descripcion: string;
  profesional: {
    idUsuario: number;
    nombreCompleto: string;
    rolRequerido: string;
  };
  tieneDisponibilidad: boolean;
  mensajeDisponibilidad?: string;
  colorIdentificador: string;
  duracionBloquesPorDefecto: number;
}

export interface SelectServiceResult {
  servicios: ServiceDetailDTO[];
  servicioSeleccionado?: ServiceDetailDTO;
}

export class SelectServiceUseCase {
  constructor(private readonly appointmentRepository: IAppointmentRepository) {}

  public async execute(query: SelectServiceQuery): Promise<SelectServiceResult> {
    const now = query.now ?? new Date();

    // 1. Obtener lista de profesionales activos por roles requeridos (ROL-ODO y ROL-ESP)
    const activeStaff = await this.appointmentRepository.findActiveStaffByRoleCodes([
      'ROL-ODO',
      'ROL-ESP',
    ]);

    const activeStaffByRole = new Map<string, (typeof activeStaff)[0]>();
    for (const staff of activeStaff) {
      for (const roleCode of staff.roles) {
        if (!activeStaffByRole.has(roleCode)) {
          activeStaffByRole.set(roleCode, staff);
        }
      }
    }

    const availableServicesDTO: ServiceDetailDTO[] = [];

    // 2. Evaluar cada servicio configurado en el catálogo (RQNF-MAN-001)
    for (const srv of SERVICES_CATALOG) {
      const assignedStaff = activeStaffByRole.get(srv.profesionalPorDefecto.rolRequerido);

      // Regla RF-AGE-012: Si el profesional está inactivo, el servicio no se muestra
      if (!assignedStaff || !assignedStaff.estado) {
        continue;
      }

      // 3. Comprobar disponibilidad de bloques según contexto
      let tieneDisponibilidad = false;
      let mensajeDisponibilidad: string | undefined;

      if (query.contexto === 'PUBLICO') {
        // En la sección pública: disponibilidad entre 5 y 60 días calendario (Regla 2 / RF-AGE-003)
        const startWindow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
        const endWindow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

        const slots = await this.appointmentRepository.getTimeSlots({
          idProfesional: assignedStaff.idUsuario,
          desde: startWindow,
          hasta: endWindow,
        });

        const availableCount = slots.filter((s) => s.isAvailable(now)).length;
        tieneDisponibilidad = availableCount > 0;
        if (!tieneDisponibilidad) {
          mensajeDisponibilidad = `El profesional ${assignedStaff.nombreCompleto} no cuenta con bloques disponibles entre los próximos 5 y 60 días calendario.`;
        }
      } else {
        // En agendamiento interno: disponibilidad en la semana elegida
        const refDate = query.fechaReferencia
          ? query.fechaReferencia instanceof Date
            ? query.fechaReferencia
            : new Date(query.fechaReferencia)
          : now;

        const { startMonday, endSunday } = ColombiaTime.getWeekRange(refDate);

        const slots = await this.appointmentRepository.getTimeSlots({
          idProfesional: assignedStaff.idUsuario,
          desde: startMonday,
          hasta: endSunday,
        });

        const availableCount = slots.filter((s) => s.isAvailable(now)).length;
        tieneDisponibilidad = availableCount > 0;
        if (!tieneDisponibilidad) {
          mensajeDisponibilidad = `El profesional no tiene bloques disponibles en la semana del ${ColombiaTime.formatDate(
            startMonday
          )} al ${ColombiaTime.formatDate(endSunday)}.`;
        }
      }

      availableServicesDTO.push({
        codigo: srv.codigo,
        nombre: srv.nombre,
        descripcion: srv.descripcion,
        profesional: {
          idUsuario: assignedStaff.idUsuario,
          nombreCompleto: assignedStaff.nombreCompleto,
          rolRequerido: srv.profesionalPorDefecto.rolRequerido,
        },
        tieneDisponibilidad,
        mensajeDisponibilidad,
        colorIdentificador: srv.colorIdentificador,
        duracionBloquesPorDefecto: srv.duracionBloquesPorDefecto,
      });
    }

    // 4. Si se solicitó un servicio específico, buscarlo y retornarlo
    let selectedDetail: ServiceDetailDTO | undefined;
    if (query.servicio) {
      selectedDetail = availableServicesDTO.find(
        (s) => s.nombre.toLowerCase().trim() === query.servicio!.toLowerCase().trim()
      );
      if (!selectedDetail) {
        throw new Error(
          `El servicio "${query.servicio}" no se encuentra disponible actualmente o su profesional está inactivo (RF-AGE-012).`
        );
      }
    }

    return {
      servicios: availableServicesDTO,
      servicioSeleccionado: selectedDetail,
    };
  }
}
