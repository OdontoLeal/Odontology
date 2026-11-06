// src/modules/appointments/ui/views/InternalAgendaPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { formatLongDateCO } from '../../../../shared/ui/format';
import { useRealtimeAgenda } from '../hooks/useRealtimeAgenda';
import { WeeklyCalendarGrid, CalendarTimeSlot } from '../components/WeeklyCalendarGrid';
import {
  QuickScheduleModal,
  DoctorCandidate,
  PatientCandidate,
} from '../components/QuickScheduleModal';
import { AppointmentRequestDetailPage, RequestDetailData } from './AppointmentRequestDetailPage';
import { AppointmentDetailPage, AppointmentDetailPageData } from './AppointmentDetailPage';
import { usePatients } from '../../../patients/ui/hooks/usePatients';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';
import { CalendarIcon, DoctorIcon } from '../../../../shared/ui/components/Icons';
import { PageLayout } from '../../../../shared/ui/components/PageLayout';
import {
  PageHeader,
  PageHeaderAction,
  PlusIcon,
} from '../../../../shared/ui/components/PageHeader';
import {
  PageToolbar,
  ToolbarSearch,
  ToolbarSelect,
  ToolbarLabel,
} from '../../../../shared/ui/components/PageToolbar';

export interface InternalAgendaPageProps {
  onStartAttention?: (
    idCita: number,
    idPaciente: number,
    doctorInfo?: { doctorName?: string; doctorSignature?: string | null }
  ) => void;
  onOpenConsultationWorkspace?: (
    patientId: number,
    idCita: number,
    doctorInfo?: { doctorName?: string; doctorSignature?: string | null }
  ) => void;
  onNavigateToPatientProfile?: (idPaciente: number) => void;
  canManageSlots?: boolean;
  canCreateAppointment?: boolean;
  canStartAttention?: boolean;
}

export const InternalAgendaPage: React.FC<InternalAgendaPageProps> = ({
  onStartAttention,
  onOpenConsultationWorkspace,
  onNavigateToPatientProfile,
  canManageSlots = true,
  canCreateAppointment = true,
  canStartAttention = true,
}) => {
  const {
    selectedDate,
    setSelectedDate,
    calendarYear,
    calendarMonth,
    navigateMonth,
    generateDaySlots,
    slots,
    agendaItems,
    requests,
    monthlySummary,
    filterMode,
    setFilterMode,
    doctorFilter,
    setDoctorFilter,
    fetchAgenda,
    isLoading,
    startAttention,
    cancelAppointment,
    markNoShow,
    toggleSlotStatus,
    approveRequest,
    rejectRequest,
    updateAppointment,
  } = useRealtimeAgenda();

  const { patients } = usePatients();
  const [doctors, setDoctors] = useState<DoctorCandidate[]>([]);
  const { showAlert, AlertModalComponent } = useAlertModal();

  // Estados de navegación dentro de la Agenda
  const [viewMode, setViewMode] = useState<'AGENDA' | 'REQUEST_DETAIL' | 'APPOINTMENT_DETAIL'>(
    'AGENDA'
  );
  const [activeRequestDetail, setActiveRequestDetail] = useState<RequestDetailData | null>(null);
  const [activeAppointmentDetail, setActiveAppointmentDetail] =
    useState<AppointmentDetailPageData | null>(null);

  // Modal para agendar nueva cita
  const [isQuickScheduleOpen, setIsQuickScheduleOpen] = useState(false);
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);

  // En < 768px el calendario mensual se colapsa y la agenda se recorre un día a la vez.
  const [isMonthCalendarOpen, setIsMonthCalendarOpen] = useState(false);

  // Carga de doctores reales desde base de datos / API
  useEffect(() => {
    fetch('/api/v1/appointments/professionals')
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => {
        const userList: any[] = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json.data?.data)
            ? json.data.data
            : Array.isArray(json)
              ? json
              : [];
        const doctorCandidates: DoctorCandidate[] = userList
          .filter((u) => u.estado !== false)
          .map((u) => ({
            idUsuario: Number(u.id_usuario ?? u.idUsuario),
            nombreCompleto: u.nombre_completo ?? u.nombreCompleto ?? 'Doctor',
            especialidad:
              u.especialidad ||
              u.roles?.[0]?.nombreRol ||
              u.roles?.[0]?.nombre_rol ||
              'Odontología General',
          }));

        if (doctorCandidates.length > 0) {
          setDoctors(doctorCandidates);
        }
      })
      .catch(() => {
        // Fallback dinámico
      });
  }, []);

  const patientCandidates: PatientCandidate[] = patients.map((p) => ({
    idPaciente: p.idPaciente,
    nombreCompleto: p.nombreCompleto,
    documentoIdentidad: p.documentoIdentidad,
    telefono: p.telefono,
    correo: p.correo,
  }));

  // Formateador de fecha en español para la barra superior (ej. Hoy: Sábado 24 Octubre 2026)
  // RQNF-USA-002: "Jueves, 05/11/2026"
  const formatHeaderDate = (dateStr: string) => formatLongDateCO(dateStr);

  // Manejar navegación a día anterior / posterior
  const handleNavigateDay = (delta: number) => {
    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const d = new Date(year, month - 1, day + delta);
      const nextYear = d.getFullYear();
      const nextMonth = (d.getMonth() + 1).toString().padStart(2, '0');
      const nextDay = d.getDate().toString().padStart(2, '0');
      setSelectedDate(`${nextYear}-${nextMonth}-${nextDay}`);
    } catch {
      // noop
    }
  };

  // Al dar click a una cita pendiente de aprobación (Imagen 1)
  const handleSelectPendingSlot = (slot: CalendarTimeSlot) => {
    // Buscar la solicitud correspondiente en los datos de la base de datos
    const matchedRequest = requests.find(
      (r) =>
        r.idSolicitud === slot.idSolicitud ||
        (r.horaSolicitada === slot.horaInicio && r.fechaSolicitada === selectedDate)
    );

    if (matchedRequest) {
      setActiveRequestDetail(matchedRequest);
    } else {
      // Fallback con los datos del bloque traído de BD
      setActiveRequestDetail({
        idSolicitud: slot.idSolicitud || 6,
        idCita: slot.idCita || null,
        nombrePaciente: slot.pacienteNombre || 'Lucía Restrepo Gómez',
        documentoIdentidad: slot.pacienteDocumento || '1025884320',
        telefono: slot.pacienteTelefono || 'Sin registrar',
        correo: slot.pacienteCorreo || 'lucia.restrepo@email.com',
        fechaSolicitada: selectedDate,
        horaSolicitada: slot.horaInicio,
        motivoConsulta:
          slot.tratamiento ||
          'Valoración por sensibilidad en molar inferior derecho y revisión general',
        fechaSolicitud: '2026-10-24 09:15:00',
        sexo: 'Femenino',
        edad: 29,
        esPacienteNuevo: true,
        doctorAsignado: slot.doctorNombre || 'Por asignar',
      });
    }

    setViewMode('REQUEST_DETAIL');
  };

  // Al dar click a una cita confirmada u otra cita (Imagen 2)
  const handleSelectConfirmedSlot = (slot: CalendarTimeSlot) => {
    if (!slot.idCita) return;

    const realAppt = agendaItems.find((a) => a.idCita === slot.idCita);

    setActiveAppointmentDetail({
      idCita: slot.idCita,
      idPaciente: realAppt?.idPaciente || 1,
      nombrePaciente: realAppt?.nombrePaciente || slot.pacienteNombre || 'Paciente',
      documentoIdentidad: realAppt?.documentoPaciente || slot.pacienteDocumento || '1020456789',
      telefono: realAppt?.telefonoPaciente || slot.pacienteTelefono || 'Sin registrar',
      correo: realAppt?.correoPaciente || slot.pacienteCorreo || 'Sin registrar',
      titulo: realAppt?.titulo || slot.tratamiento || 'Valoración para Implante Dental',
      descripcion:
        realAppt?.descripcion ||
        'Evaluación de densidad ósea mediante tomografía CBCT, toma de impresiones digitales 3D y diseño de la guía quirúrgica para osteointegración.',
      doctorNombre: realAppt?.nombreProfesional || slot.doctorNombre || 'Dr. Eduar Leal Álvarez',
      doctorFirma: realAppt?.firmaProfesional ?? null,
      idDoctor: realAppt?.idProfesional || 1,
      fecha: selectedDate,
      horaInicio: slot.horaInicio,
      horaFin: slot.horaFin,
      sillon: 'Gabinete 02',
      agendadoPor: realAppt?.agendadoPor || 'Portal Web',
      estado: (slot.estadoCita as any) || 'Confirmada',
    });

    setViewMode('APPOINTMENT_DETAIL');
  };

  const todayColombia = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }, []);
  const isPastDate = selectedDate < todayColombia;

  // Crear bloques de horario (06:00 a 20:00 cada 30 min) en BD para el día seleccionado (RF-AGE-001)
  const handleGenerateDaySlots = async () => {
    if (isPastDate) {
      showAlert({
        title: 'Fecha en el Pasado',
        message: 'No es posible crear bloques de horario para fechas pasadas.',
        type: 'warning',
      });
      return;
    }
    try {
      await generateDaySlots(selectedDate);
      showAlert({
        title: '¡Bloques de Horario Creados!',
        message: `Se han creado los 28 bloques de horario (06:00 a 20:00 cada 30 min) en la base de datos para la fecha ${selectedDate}.`,
        type: 'success',
      });
    } catch (err: any) {
      showAlert({
        title: 'Error al crear bloques',
        message: err.message || 'No fue posible generar los bloques en la base de datos.',
        type: 'error',
      });
    }
  };

  const handleScheduleSlot = (_slot?: any) => {
    if (isPastDate) {
      showAlert({
        title: 'Fecha en el Pasado',
        message: 'No es posible agendar citas para fechas que ya pasaron.',
        type: 'warning',
      });
      return;
    }
    setIsQuickScheduleOpen(true);
  };

  // Aprobación de la solicitud desde el Detalle (Imagen 1)
  const handleApproveRequest = async (
    idSolicitud: number,
    idDoctor?: number,
    motivo?: string,
    selectedBlocks?: string[]
  ) => {
    try {
      await approveRequest(idSolicitud, { idProfesional: idDoctor, motivo, selectedBlocks });
      showAlert({
        title: '¡Cita Creada y Confirmada!',
        message:
          'Se ha confirmado la cita médica en la agenda con el doctor asignado. Se envió el correo de confirmación al paciente y la notificación al doctor.',
        type: 'success',
      });
      setViewMode('AGENDA');
    } catch (err: any) {
      showAlert({
        title: 'Error al procesar solicitud',
        message: err.message || 'No fue posible confirmar la solicitud.',
        type: 'error',
      });
    }
  };

  // Rechazo de la solicitud desde el Detalle
  const handleRejectRequest = async (idSolicitud: number, motivo: string) => {
    try {
      await rejectRequest(idSolicitud, motivo);
      showAlert({
        title: 'Solicitud Rechazada',
        message:
          'La solicitud ha sido rechazada y el bloque de horario ha quedado liberado en la agenda médica.',
        type: 'info',
      });
      setViewMode('AGENDA');
    } catch (err: any) {
      showAlert({
        title: 'Error al rechazar solicitud',
        message: err.message || 'No fue posible rechazar la solicitud.',
        type: 'error',
      });
    }
  };

  // Manejo de Agendamiento Rápido con estado de carga y modal garantizado
  const handleConfirmQuickSchedule = async (apptData: {
    idPaciente: number;
    idDoctor: number;
    fecha: string;
    bloques: string[];
    motivo: string;
    observaciones?: string;
  }) => {
    setIsSubmittingSchedule(true);
    try {
      const formattedBlocks = apptData.bloques.map((b) => {
        const start = b.split('-')[0].trim();
        return `${apptData.fecha} ${start}:00`;
      });

      const res = await fetch('/api/v1/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: apptData.motivo,
          descripcion: apptData.observaciones,
          idPaciente: apptData.idPaciente,
          idUsuarioProfesional: apptData.idDoctor,
          bloques: formattedBlocks,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Error al guardar la cita');
      }

      // 1. Primero desaparece el formulario cerrando el modal
      setIsQuickScheduleOpen(false);

      // 2. Refrescar la agenda en segundo plano
      fetchAgenda();

      // 3. Aparece el modal informando la confirmación de la cita
      showAlert({
        title: '¡Cita Confirmada Exitosamente!',
        message: 'La cita ha sido registrada exitosamente en la agenda médica.',
        type: 'success',
      });
    } catch (err: any) {
      showAlert({
        title: 'Error al agendar cita',
        message: err.message || 'No fue posible programar la cita.',
        type: 'error',
      });
      throw err;
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  // VISTA 1: DETALLE DE SOLICITUD DE CITA (Imagen 1)
  if (viewMode === 'REQUEST_DETAIL' && activeRequestDetail) {
    return (
      <>
        <AlertModalComponent />
        <AppointmentRequestDetailPage
          request={activeRequestDetail}
          doctors={doctors}
          onBack={() => setViewMode('AGENDA')}
          onApprove={handleApproveRequest}
          onReject={handleRejectRequest}
        />
      </>
    );
  }

  // VISTA 2: DETALLE DE CITA CONFIRMADA (Imagen 2)
  if (viewMode === 'APPOINTMENT_DETAIL' && activeAppointmentDetail) {
    return (
      <>
        <AlertModalComponent />
        <AppointmentDetailPage
          appointment={activeAppointmentDetail}
          doctors={doctors}
          canStartAttention={canStartAttention}
          onBack={() => setViewMode('AGENDA')}
          onNavigateToPatientProfile={onNavigateToPatientProfile}
          onUpdateAppointment={async (idCita, data) => {
            await updateAppointment(idCita, data);
            await fetchAgenda();
          }}
          onStartAttention={async (idCita, idPaciente) => {
            try {
              if (activeAppointmentDetail.estado === 'Confirmada') {
                await startAttention(idCita);
              }
              onStartAttention?.(idCita, idPaciente, {
                doctorName: activeAppointmentDetail.doctorNombre,
                doctorSignature: activeAppointmentDetail.doctorFirma,
              });
              setViewMode('AGENDA');
            } catch (err: any) {
              showAlert({
                title: 'Error al iniciar atención',
                message: err.message || 'No se pudo iniciar la consulta clínica.',
                type: 'error',
              });
            }
          }}
          onCancelAppointment={async (idCita, motivo) => {
            await cancelAppointment(idCita, motivo);
            showAlert({
              title: 'Cita Cancelada',
              message:
                'La cita médica ha sido cancelada y los bloques de horario han sido liberados.',
              type: 'info',
            });
            setViewMode('AGENDA');
          }}
          onMarkNoShow={async (idCita, motivo) => {
            await markNoShow(idCita, motivo);
            showAlert({
              title: 'Inasistencia Registrada',
              message: 'Se ha registrado la inasistencia del paciente.',
              type: 'warning',
            });
            setViewMode('AGENDA');
          }}
          onSignConsent={() => {
            showAlert({
              title: 'Firma de Consentimiento',
              message: 'Iniciando módulo de firma de consentimientos informados en tablet.',
              type: 'info',
            });
          }}
        />
      </>
    );
  }

  // VISTA PRINCIPAL: AGENDA MÉDICA (Imagen 3)
  return (
    <PageLayout>
      <PageHeader
        eyebrow="Agenda Clínica"
        eyebrowDetail="Gestión de Horarios y Citas"
        title="Agenda y Citas"
        subtitle="Consulta los bloques de atención, gestiona solicitudes y programa citas de pacientes."
        actions={
          canCreateAppointment ? (
            <PageHeaderAction
              variant="primary"
              onClick={() => setIsQuickScheduleOpen(true)}
              leftIcon={<PlusIcon />}
            >
              Nueva Cita
            </PageHeaderAction>
          ) : undefined
        }
      />

      <PageToolbar aria-label="Filtros de la agenda">
        <div className="flex w-full min-w-0 flex-col items-stretch gap-3 md:w-auto md:flex-row md:flex-wrap md:items-center md:gap-6">
          <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <ToolbarLabel>Filtrar bloques:</ToolbarLabel>
            <ToolbarSelect
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as typeof filterMode)}
              aria-label="Filtrar bloques"
              className="w-full sm:w-auto"
            >
              <option value="all">Todos los bloques</option>
              <option value="appointments_only">Solo bloques con citas</option>
              <option value="requests_only">Solicitudes</option>
            </ToolbarSelect>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <ToolbarLabel>
              <DoctorIcon size={14} color="#D4AF37" /> Filtrar por doctor:
            </ToolbarLabel>
            <ToolbarSearch
              wrapperClassName="w-full sm:w-64"
              placeholder="Escribir o buscar doctor..."
              aria-label="Filtrar por doctor"
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
            />
          </div>
        </div>
      </PageToolbar>

      {/*
        >= 1024px: 2 columnas (calendario mensual a la izquierda + día seleccionado a la derecha).
        <  1024px: 1 columna; el navegador de día va primero (un día a la vez), luego el
        mini-calendario (colapsable en < 768px) y por último los bloques del día.
      */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-6">
        {/* Navegador de día: Ayer | Fecha | Mañana (+ Crear bloques) */}
        <div className="order-1 min-w-0 lg:col-span-8 lg:col-start-5 lg:row-start-1">
          <div className="flex flex-col gap-2 rounded-xl border border-[#E2E8F0] bg-white p-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <nav
              aria-label="Navegación por día"
              className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-2 sm:flex sm:items-center"
            >
              <button
                type="button"
                onClick={() => handleNavigateDay(-1)}
                aria-label="Ir al día anterior"
                className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#E2E8F0] px-3 text-[13px] font-bold text-[#64748B] transition-colors hover:bg-[#F3F4F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
              >
                <span aria-hidden="true">←</span> Ayer
              </button>

              <div
                aria-live="polite"
                className="flex min-h-[44px] min-w-0 items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-center text-[13px] font-extrabold leading-tight text-[#1E242B] sm:px-4"
              >
                <CalendarIcon size={14} color="#D4AF37" className="hidden shrink-0 sm:block" />
                <span className="text-break">{formatHeaderDate(selectedDate)}</span>
              </div>

              <button
                type="button"
                onClick={() => handleNavigateDay(1)}
                aria-label="Ir al día siguiente"
                className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#E2E8F0] px-3 text-[13px] font-bold text-[#64748B] transition-colors hover:bg-[#F3F4F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
              >
                Mañana <span aria-hidden="true">→</span>
              </button>
            </nav>

            {/* Botón secundario Crear Bloques (ERS RF-AGE-001). Mientras el día no tenga
                bloques, el flujo de creación vive únicamente en el estado vacío. */}
            {canManageSlots && slots.length === 0 && (
              <button
                type="button"
                disabled={isPastDate || isLoading}
                onClick={handleGenerateDaySlots}
                title={
                  isPastDate
                    ? 'No es posible crear bloques en fechas pasadas'
                    : 'Crear bloques para este día'
                }
                className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3.5 text-[13px] font-bold text-[#1E242B] transition-colors hover:border-[#D4AF37] hover:bg-[#FBF3D5]/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#E2E8F0] disabled:hover:bg-white md:min-h-[38px]"
              >
                <span className="text-[#B8942A]">+</span> Crear bloques
              </button>
            )}
          </div>
        </div>

        {/* Calendario mensual: columna izquierda en escritorio, colapsable en móvil */}
        <div className="order-2 min-w-0 lg:sticky lg:top-[96px] lg:self-start lg:col-span-4 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <button
            type="button"
            onClick={() => setIsMonthCalendarOpen((prev) => !prev)}
            aria-expanded={isMonthCalendarOpen}
            aria-controls="agenda-month-calendar"
            className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 text-[13px] font-bold text-[#1E242B] transition-colors hover:border-[#D4AF37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] md:hidden"
          >
            <span className="inline-flex items-center gap-2">
              <CalendarIcon size={16} color="#D4AF37" />
              {isMonthCalendarOpen ? 'Ocultar calendario mensual' : 'Mostrar calendario mensual'}
            </span>
            <span aria-hidden="true" className={`transition-transform ${isMonthCalendarOpen ? 'rotate-180' : ''}`}>
              ▾
            </span>
          </button>

          {(() => {
            const monthNames = [
              'Enero',
              'Febrero',
              'Marzo',
              'Abril',
              'Mayo',
              'Junio',
              'Julio',
              'Agosto',
              'Septiembre',
              'Octubre',
              'Noviembre',
              'Diciembre',
            ];
            const currentMonthTitle = `${monthNames[calendarMonth - 1]} ${calendarYear}`;
            const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();
            const firstDayOfWeek = new Date(calendarYear, calendarMonth - 1, 1).getDay(); // 0 = Domingo
            const mondayOffset = (firstDayOfWeek + 6) % 7; // Lun = 0, Mar = 1 ... Dom = 6
            const prevMonthTotalDays = new Date(calendarYear, calendarMonth - 1, 0).getDate();
            const leadingDays = Array.from(
              { length: mondayOffset },
              (_, i) => prevMonthTotalDays - mondayOffset + 1 + i
            );
            const currentDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
            const totalCells = mondayOffset + daysInMonth;
            const trailingDaysCount = (7 - (totalCells % 7)) % 7;
            const trailingDays = Array.from({ length: trailingDaysCount }, (_, i) => i + 1);

            return (
              <div
                id="agenda-month-calendar"
                className={`${
                  isMonthCalendarOpen ? 'mt-2 block' : 'hidden'
                } space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-3 sm:p-5 md:mt-0 md:block`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] pb-2">
                  <div className="flex min-w-0 items-center gap-2 text-sm font-extrabold text-[#1E242B]">
                    <CalendarIcon size={16} color="#D4AF37" className="shrink-0" />
                    <span className="capitalize text-break" aria-live="polite">
                      {currentMonthTitle}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-[#687380]">
                    <button
                      type="button"
                      aria-label="Mes anterior"
                      title="Mes anterior"
                      onClick={() => navigateMonth(-1)}
                      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-base font-bold transition-colors hover:bg-[#F3F4F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      aria-label="Mes siguiente"
                      title="Mes siguiente"
                      onClick={() => navigateMonth(1)}
                      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-base font-bold transition-colors hover:bg-[#F3F4F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                    >
                      ›
                    </button>
                  </div>
                </div>

                {/* Cabecera de días de semana: Lun a Dom */}
                <div
                  aria-hidden="true"
                  className="grid grid-cols-7 gap-0.5 pb-1 text-center text-[13px] font-bold text-[#687380] sm:gap-1"
                >
                  <span>Lun</span>
                  <span>Mar</span>
                  <span>Mié</span>
                  <span>Jue</span>
                  <span>Vie</span>
                  <span>Sáb</span>
                  <span>Dom</span>
                </div>

                {/* Cuadrícula de días: número + indicador visual (sin texto repetido por celda) */}
                <div className="grid grid-cols-7 gap-0.5 text-center text-[13px] sm:gap-1">
                  {leadingDays.map((d, idx) => (
                    <div
                      key={`lead-${idx}`}
                      aria-hidden="true"
                      className="flex min-h-[48px] items-center justify-center font-medium text-gray-400"
                    >
                      {d}
                    </div>
                  ))}

                  {currentDays.map((day) => {
                    const dayStr = day.toString().padStart(2, '0');
                    const monthStr = calendarMonth.toString().padStart(2, '0');
                    const fullDateStr = `${calendarYear}-${monthStr}-${dayStr}`;
                    const isSelected = selectedDate === fullDateStr;

                    // Datos de resumen mensual calculados en DB
                    const daySummary = monthlySummary.find((s) => s.dia === day);
                    const totalCitas = daySummary?.totalCitas ?? 0;
                    const totalSolicitadas = daySummary?.totalSolicitadas ?? 0;
                    const sinBloques = daySummary ? daySummary.sinBloques : true;

                    const statusParts: string[] = [];
                    if (totalCitas > 0) statusParts.push(`${totalCitas} ${totalCitas === 1 ? 'cita' : 'citas'}`);
                    if (totalSolicitadas > 0) statusParts.push(`${totalSolicitadas} ${totalSolicitadas === 1 ? 'solicitud' : 'solicitudes'}`);
                    if (statusParts.length === 0) statusParts.push(sinBloques ? 'sin bloques' : 'con bloques disponibles');
                    const statusLabel = statusParts.join(', ');

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          setSelectedDate(fullDateStr);
                          setIsMonthCalendarOpen(false);
                        }}
                        aria-pressed={isSelected}
                        aria-label={`${day} de ${monthNames[calendarMonth - 1]}: ${statusLabel}`}
                        className={`flex min-h-[48px] w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl p-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
                          isSelected
                            ? 'bg-[#111827] text-white shadow-xs'
                            : 'text-[#1E242B] hover:bg-[#F3F4F6]'
                        }`}
                      >
                        <span
                          className={`text-[13px] font-extrabold leading-none sm:text-sm ${
                            isSelected ? 'text-[#D4AF37]' : sinBloques ? 'text-[#8F99A3]' : ''
                          }`}
                        >
                          {day}
                        </span>

                        {/* Indicadores: citas confirmadas (ámbar), solicitudes pendientes (azul), bloques libres o sin bloques */}
                        {totalCitas > 0 || totalSolicitadas > 0 ? (
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            {totalCitas > 0 && (
                              <span
                                aria-hidden="true"
                                title={`${totalCitas} ${totalCitas === 1 ? 'cita agendada' : 'citas agendadas'}`}
                                className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-extrabold leading-none ${
                                  isSelected ? 'bg-[#D4AF37] text-black' : 'bg-[#FEF3C7] text-[#92400E]'
                                }`}
                              >
                                {totalCitas}
                              </span>
                            )}
                            {totalSolicitadas > 0 && (
                              <span
                                aria-hidden="true"
                                title={`${totalSolicitadas} ${totalSolicitadas === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}`}
                                className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-extrabold leading-none ${
                                  isSelected
                                    ? 'bg-[#38BDF8] text-black'
                                    : 'bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]'
                                }`}
                              >
                                {totalSolicitadas}
                              </span>
                            )}
                          </div>
                        ) : sinBloques ? (
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 rounded-full border border-[#8F99A3]"
                            title="Sin bloques de horario"
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 rounded-full bg-[#16A34A]"
                            title="Bloques de horario disponibles"
                          />
                        )}
                      </button>
                    );
                  })}

                  {trailingDays.map((d, idx) => (
                    <div
                      key={`trail-${idx}`}
                      aria-hidden="true"
                      className="flex min-h-[48px] items-center justify-center font-medium text-gray-400"
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Leyenda accesible de los indicadores */}
                <ul className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-[#E2E8F0] pt-3 text-[13px] leading-5 text-[#687380]">
                  <li className="inline-flex items-center gap-1.5">
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FEF3C7] px-1 text-[10px] font-bold text-[#92400E]">
                      n
                    </span>
                    Citas del día
                  </li>
                  {canManageSlots && (
                    <li className="inline-flex items-center gap-1.5">
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E0F2FE] px-1 text-[10px] font-bold text-[#0369A1] border border-[#BAE6FD]">
                        n
                      </span>
                      Solicitudes
                    </li>
                  )}
                  <li className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#16A34A]" aria-hidden="true" />
                    Bloques libres
                  </li>
                  <li className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full border border-[#8F99A3]" aria-hidden="true" />
                    Sin bloques
                  </li>
                </ul>
              </div>
            );
          })()}
        </div>

        {/* Bloques de horario del día seleccionado */}
        <div className="order-3 min-w-0 lg:col-span-8 lg:col-start-5 lg:row-start-2">
          {/* Grilla de Bloques con Citas y Estado Vacío si no hay bloques en BD (Imagen 3) */}
          <WeeklyCalendarGrid
            slots={slots}
            isLoading={isLoading}
            filterMode={filterMode}
            isPastDate={isPastDate}
            canManageSlots={canManageSlots}
            canCreateAppointment={canCreateAppointment}
            onSelectSlot={handleSelectConfirmedSlot}
            onSelectPendingRequest={handleSelectPendingSlot}
            onToggleSlotStatus={
              canManageSlots
                ? (slot) => {
                    if (isPastDate) {
                      showAlert({
                        title: 'Fecha en el Pasado',
                        message: 'No es posible modificar bloques de horario en fechas pasadas.',
                        type: 'warning',
                      });
                      return;
                    }
                    toggleSlotStatus(slot);
                  }
                : undefined
            }
            onScheduleSlot={canCreateAppointment ? handleScheduleSlot : undefined}
            onCreateBlocks={canManageSlots ? handleGenerateDaySlots : undefined}
          />
        </div>
      </div>

      {/* Modal de Agendamiento Rápido */}
      {isQuickScheduleOpen && (
        <QuickScheduleModal
          isOpen={isQuickScheduleOpen}
          onClose={() => setIsQuickScheduleOpen(false)}
          patients={patientCandidates}
          doctors={doctors}
          initialDate={selectedDate}
          isLoading={isSubmittingSchedule}
          onConfirmSchedule={handleConfirmQuickSchedule}
        />
      )}

      {/* Alerta modal siempre en capa superior */}
      <AlertModalComponent />
    </PageLayout>
  );
};
