// src/modules/appointments/application/get-weekly-agenda.use-case.ts
import { ColombiaTime } from '../../../shared/domain/colombia-time.util';
import {
  AgendaAppointmentItemDTO,
  AgendaSlotDTO,
  DayAgendaDTO,
  IAppointmentRepository,
  WeeklyAgendaDTO,
} from '../domain/appointment.repository.interface';
import { AppointmentEntity, AppointmentState, DentalServiceType } from '../domain/appointment.entity';

export interface GetWeeklyAgendaQuery {
  idUsuarioConsultor: number;
  rolesConsultor: string[];
  semanaFechaReferencia?: string | Date; // Fecha de referencia para la semana (por defecto hoy)
  idProfesional?: number; // Seleccionado por COA / AUX / ADM
  filtroPaciente?: string; // Búsqueda por documento o nombre de paciente
  filtroEstado?: AppointmentState; // Filtro por estado de la cita
}

export class GetWeeklyAgendaUseCase {
  constructor(private readonly appointmentRepository: IAppointmentRepository) {}

  public async execute(query: GetWeeklyAgendaQuery): Promise<WeeklyAgendaDTO> {
    const roles = query.rolesConsultor.map((r) => r.toUpperCase());
    const isAdmin = roles.includes('ROL-ADM') || roles.some((r) => r.includes('ADMIN'));
    const isDoctor =
      roles.includes('ROL-ODO') ||
      roles.includes('ROL-ESP') ||
      roles.some((r) => r.includes('ODONT') || r.includes('ESPECIALISTA'));

    // 1. Resolver profesional a consultar según reglas de acceso (Regla 3 / RF-AGE-008)
    let targetProfessionalId: number;

    if (isDoctor && !isAdmin) {
      // ROL-ODO y ROL-ESP solo ven su agenda propia (RF-AGE-008)
      targetProfessionalId = query.idUsuarioConsultor;
    } else {
      // ROL-COA, ROL-AUX y ROL-ADM eligen al profesional
      if (!query.idProfesional) {
        throw new Error('Debe seleccionar al profesional para visualizar la agenda semanal (RF-AGE-008).');
      }
      targetProfessionalId = query.idProfesional;
    }

    const professionalUser = await this.appointmentRepository.findUserById(targetProfessionalId);
    if (!professionalUser) {
      throw new Error(`El profesional con ID ${targetProfessionalId} no fue encontrado.`);
    }

    // 2. Determinar rango de la semana (Lunes a Domingo en hora de Colombia)
    const refDate = query.semanaFechaReferencia
      ? query.semanaFechaReferencia instanceof Date
        ? query.semanaFechaReferencia
        : new Date(
            query.semanaFechaReferencia.includes('T')
              ? query.semanaFechaReferencia
              : `${query.semanaFechaReferencia}T12:00:00Z`
          )
      : new Date();

    const { startMonday, endSunday, weekDays } = ColombiaTime.getWeekRange(refDate);

    // 3. Consultar bloques de horario del profesional en la semana
    const timeSlots = await this.appointmentRepository.getTimeSlots({
      idProfesional: targetProfessionalId,
      desde: startMonday,
      hasta: endSunday,
    });

    // 4. Consultar citas del profesional en la semana
    const appointments = await this.appointmentRepository.findAppointmentsByProfessionalAndRange(
      targetProfessionalId,
      startMonday,
      endSunday
    );

    // Pre-cargar datos completos de pacientes de las citas encontradas
    const patientIds = Array.from(new Set(appointments.map((a) => a.idPaciente)));
    const patientsMap = new Map<number, { nombre: string; documento: string; telefono: string | null; correo: string | null }>();

    for (const pid of patientIds) {
      const p = await this.appointmentRepository.findPatientById(pid);
      if (p) {
        patientsMap.set(pid, {
          nombre: p.nombreCompleto,
          documento: p.documentoIdentidad,
          telefono: p.telefono,
          correo: p.correo,
        });
      }
    }

    // 5. Aplicar filtros sobre las citas:
    // Regla RF-AGE-008: "Las citas en estado Cancelada o Rechazada solo aparecen al filtrar por su estado"
    const filteredAppointments = appointments.filter((cita) => {
      // Si no hay filtro de estado explícito, excluir Cancelada y Rechazada
      if (!query.filtroEstado) {
        if (cita.estado === 'Cancelada' || cita.estado === 'Rechazada') {
          return false;
        }
      } else {
        if (cita.estado !== query.filtroEstado) {
          return false;
        }
      }

      // Filtro por paciente (nombre o documento)
      if (query.filtroPaciente && query.filtroPaciente.trim()) {
        const term = query.filtroPaciente.trim().toLowerCase();
        const pInfo = patientsMap.get(cita.idPaciente);
        const matchName = pInfo?.nombre.toLowerCase().includes(term) ?? false;
        const matchDoc = pInfo?.documento.toLowerCase().includes(term) ?? false;
        if (!matchName && !matchDoc) {
          return false;
        }
      }

      return true;
    });

    // Mapa rápido de bloques a cita
    const blockToAppointmentMap = new Map<number, { cita: AppointmentEntity; itemDTO: AgendaAppointmentItemDTO }>();

    for (const cita of filteredAppointments) {
      const pInfo = patientsMap.get(cita.idPaciente);
      const itemDTO: AgendaAppointmentItemDTO = {
        idCita: cita.idCita!,
        titulo: cita.titulo,
        descripcion: cita.descripcion,
        estado: cita.estado,
        idPaciente: cita.idPaciente,
        nombrePaciente: pInfo?.nombre ?? 'Paciente',
        telefonoPaciente: pInfo?.telefono ?? null,
        correoPaciente: pInfo?.correo ?? null,
        servicio: cita.servicio,
        idProfesional: cita.idUsuario,
        nombreProfesional: professionalUser.nombreCompleto,
        bloques: [...cita.bloques],
        agendadoPorId: cita.agendadoPorId,
        agendadoPor: cita.agendadoPorNombre,
        estadoRecordatorio: cita.estadoRecordatorio,
        causaFalloRecordatorio: cita.causaFalloRecordatorio,
        historialCambios: [...cita.historialCambios],
      };

      for (const blockDate of cita.bloques) {
        blockToAppointmentMap.set(blockDate.getTime(), { cita, itemDTO });
      }
    }

    // 6. Contar solicitudes (Solicitada) por día de la semana (RF-AGE-008)
    const pendingRequestsCountByDay = new Map<string, number>();
    for (const cita of appointments) {
      if (cita.estado === 'Solicitada') {
        const dayKey = ColombiaTime.toDateKey(cita.horaInicio);
        pendingRequestsCountByDay.set(dayKey, (pendingRequestsCountByDay.get(dayKey) ?? 0) + 1);
      }
    }

    // 7. Organizar por días de la semana (Lunes a Domingo)
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const daysResult: DayAgendaDTO[] = [];

    for (let i = 0; i < weekDays.length; i++) {
      const dayDate = weekDays[i];
      const dayKey = ColombiaTime.toDateKey(dayDate);

      // Filtrar bloques correspondientes a este día
      const daySlots = timeSlots
        .filter((slot) => ColombiaTime.isSameDay(slot.inicio, dayDate))
        .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

      const agendaSlots: AgendaSlotDTO[] = daySlots.map((slot) => {
        const match = blockToAppointmentMap.get(slot.inicio.getTime());

        // Colores accesibles (RQNF-USA-001): Verde = Disponible, Rojo = Ocupado, Gris = Deshabilitado
        let colorEstado: 'verde' | 'rojo' | 'gris';
        let etiquetaEstado: 'Disponible' | 'Ocupado' | 'Deshabilitado';

        if (!slot.estado) {
          colorEstado = 'gris';
          etiquetaEstado = 'Deshabilitado';
        } else if (slot.ocupacion || match !== undefined) {
          colorEstado = 'rojo';
          etiquetaEstado = 'Ocupado';
        } else {
          colorEstado = 'verde';
          etiquetaEstado = 'Disponible';
        }

        return {
          inicio: slot.inicio,
          final: slot.final,
          inicioFormateado: ColombiaTime.formatTime12h(slot.inicio),
          finalFormateado: ColombiaTime.formatTime12h(slot.final),
          estado: slot.estado,
          ocupacion: slot.ocupacion || match !== undefined,
          colorEstado,
          etiquetaEstado,
          cita: match?.itemDTO,
        };
      });

      daysResult.push({
        fecha: dayKey,
        fechaFormateada: ColombiaTime.formatDate(dayDate),
        nombreDia: dayNames[i],
        citasSolicitadasCount: pendingRequestsCountByDay.get(dayKey) ?? 0,
        bloques: agendaSlots,
      });
    }

    const detectedService: DentalServiceType = professionalUser.roles.some((r) =>
      r.toUpperCase().includes('ORTODON') || r.toUpperCase().includes('ESP')
    )
      ? 'Ortodoncia'
      : 'Odontología general';

    return {
      semanaInicio: ColombiaTime.formatDate(startMonday),
      semanaFin: ColombiaTime.formatDate(endSunday),
      idProfesional: professionalUser.idUsuario,
      nombreProfesional: professionalUser.nombreCompleto,
      servicio: detectedService,
      dias: daysResult,
      totalCitasSemana: filteredAppointments.length,
    };
  }
}
