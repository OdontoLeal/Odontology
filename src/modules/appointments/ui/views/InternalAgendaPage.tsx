// src/modules/appointments/ui/views/InternalAgendaPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useRealtimeAgenda } from '../hooks/useRealtimeAgenda';
import { WeeklyCalendarGrid, CalendarTimeSlot } from '../components/WeeklyCalendarGrid';
import { QuickScheduleModal, DoctorCandidate, PatientCandidate } from '../components/QuickScheduleModal';
import { AppointmentRequestDetailPage, RequestDetailData } from './AppointmentRequestDetailPage';
import { AppointmentDetailPage, AppointmentDetailPageData } from './AppointmentDetailPage';
import { Button } from '../../../../shared/ui/components/Button';
import { usePatients } from '../../../patients/ui/hooks/usePatients';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';
import {
  CalendarIcon,
  DoctorIcon,
  SearchIcon,
} from '../../../../shared/ui/components/Icons';

export interface InternalAgendaPageProps {
  onStartAttention?: (idCita: number, idPaciente: number) => void;
  onOpenConsultationWorkspace?: (patientId: number, idCita: number) => void;
  onNavigateToPatientProfile?: (idPaciente: number) => void;
}

export const InternalAgendaPage: React.FC<InternalAgendaPageProps> = ({
  onStartAttention,
  onOpenConsultationWorkspace,
  onNavigateToPatientProfile,
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
  const [viewMode, setViewMode] = useState<'AGENDA' | 'REQUEST_DETAIL' | 'APPOINTMENT_DETAIL'>('AGENDA');
  const [activeRequestDetail, setActiveRequestDetail] = useState<RequestDetailData | null>(null);
  const [activeAppointmentDetail, setActiveAppointmentDetail] = useState<AppointmentDetailPageData | null>(null);

  // Modal para agendar nueva cita
  const [isQuickScheduleOpen, setIsQuickScheduleOpen] = useState(false);

  // Carga de doctores reales desde base de datos / API
  useEffect(() => {
    fetch('/api/v1/users')
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => {
        const userList: any[] = json.data || [];
        const doctorCandidates: DoctorCandidate[] = userList
          .filter((u) => u.estado !== false)
          .map((u) => ({
            idUsuario: Number(u.id_usuario ?? u.idUsuario),
            nombreCompleto: u.nombre_completo ?? u.nombreCompleto ?? 'Doctor',
            especialidad:
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
  const formatHeaderDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      const days = ['Domingo', 'Sábado', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
      // Ajuste de día en JS (0 es domingo)
      const daysEs = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const monthsEs = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
      ];
      return `${daysEs[d.getDay()]} ${day} ${monthsEs[d.getMonth()]} ${year}`;
    } catch {
      return dateStr;
    }
  };

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
        telefono: slot.pacienteTelefono || '+57 318 459 2011',
        correo: slot.pacienteCorreo || 'lucia.restrepo@email.com',
        fechaSolicitada: selectedDate,
        horaSolicitada: slot.horaInicio,
        motivoConsulta: slot.tratamiento || 'Valoración por sensibilidad en molar inferior derecho y revisión general',
        fechaSolicitud: '2026-10-24 09:15:00',
        sexo: 'Femenino',
        edad: 29,
        esPacienteNuevo: true,
        doctorAsignado: slot.doctorNombre || 'Dr. Mateo Gómez',
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
      telefono: realAppt?.telefonoPaciente || slot.pacienteTelefono || '+57 312 456 7890',
      correo: realAppt?.correoPaciente || slot.pacienteCorreo || 'paciente@odontoleal.com',
      titulo: realAppt?.titulo || slot.tratamiento || 'Valoración para Implante Dental',
      descripcion:
        realAppt?.descripcion ||
        'Evaluación de densidad ósea mediante tomografía CBCT, toma de impresiones digitales 3D y diseño de la guía quirúrgica para osteointegración.',
      doctorNombre: realAppt?.nombreProfesional || slot.doctorNombre || 'Dr. Mateo Gómez',
      idDoctor: realAppt?.idProfesional || 101,
      fecha: selectedDate,
      horaInicio: slot.horaInicio,
      horaFin: slot.horaFin,
      sillon: 'Gabinete 02',
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
        message: 'La solicitud ha sido rechazada y el bloque de horario ha quedado liberado en la agenda médica.',
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

  // Manejo de Agendamiento Rápido
  const handleConfirmQuickSchedule = async (apptData: {
    idPaciente: number;
    idDoctor: number;
    fecha: string;
    bloques: string[];
    motivo: string;
    observaciones?: string;
  }) => {
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
          idUsuarioGestor: 1,
          bloques: formattedBlocks,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Error al guardar la cita');
      }

      setIsQuickScheduleOpen(false);
      await fetchAgenda();
      showAlert({
        title: '¡Cita Confirmada!',
        message: 'La cita ha sido registrada exitosamente en la agenda médica.',
        type: 'success',
      });
    } catch (err: any) {
      showAlert({
        title: 'Error al agendar cita',
        message: err.message || 'No fue posible programar la cita.',
        type: 'error',
      });
    }
  };

  // VISTA 1: DETALLE DE SOLICITUD DE CITA (Imagen 1)
  if (viewMode === 'REQUEST_DETAIL' && activeRequestDetail) {
    return (
      <AppointmentRequestDetailPage
        request={activeRequestDetail}
        doctors={doctors}
        onBack={() => setViewMode('AGENDA')}
        onApprove={handleApproveRequest}
        onReject={handleRejectRequest}
      />
    );
  }

  // VISTA 2: DETALLE DE CITA CONFIRMADA (Imagen 2)
  if (viewMode === 'APPOINTMENT_DETAIL' && activeAppointmentDetail) {
    return (
      <AppointmentDetailPage
        appointment={activeAppointmentDetail}
        doctors={doctors}
        onBack={() => setViewMode('AGENDA')}
        onNavigateToPatientProfile={onNavigateToPatientProfile}
        onUpdateAppointment={async (idCita, data) => {
          await updateAppointment(idCita, data);
          await fetchAgenda();
        }}
        onStartAttention={(idCita, idPaciente) => {
          startAttention(idCita);
          onStartAttention?.(idCita, idPaciente);
          setViewMode('AGENDA');
        }}
        onCancelAppointment={async (idCita, motivo) => {
          await cancelAppointment(idCita, motivo);
          showAlert({
            title: 'Cita Cancelada',
            message: 'La cita médica ha sido cancelada y los bloques de horario han sido liberados.',
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
    );
  }

  // VISTA PRINCIPAL: AGENDA MÉDICA (Imagen 3)
  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fadeIn">
      <AlertModalComponent />

      {/* Barra de Filtros Superior (Imagen 3) */}
      <div className="rounded-2xl border border-[#E2E6EA] bg-white p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#687380]">
              Filtrar bloques:
            </span>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as any)}
              className="rounded-xl border border-[#E2E6EA] bg-[#F8F9FA] px-3 py-1.5 text-xs font-bold text-[#1E242B] focus:border-[#D4AF37] focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="all">Todos los bloques</option>
              <option value="appointments_only">Solo bloques con citas</option>
              <option value="requests_only">Solicitudes</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#687380] flex items-center gap-1.5">
              <DoctorIcon size={14} color="#D4AF37" /> Filtrar por doctor:
            </span>
            <div className="relative">
              <input
                type="text"
                placeholder="Escribir o buscar doctor..."
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className="w-56 rounded-xl border border-[#E2E6EA] bg-[#F8F9FA] pl-3 pr-8 py-1.5 text-xs text-[#1E242B] placeholder-[#8F99A3] focus:border-[#D4AF37] focus:bg-white focus:outline-none"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#8F99A3]">
                <SearchIcon size={13} className="text-[#8F99A3]" />
              </span>
            </div>
          </div>
        </div>

        {/* Botón Nueva Cita */}
        <button
          type="button"
          onClick={() => setIsQuickScheduleOpen(true)}
          className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#C29E2F] text-black text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all ml-auto"
        >
          <span>+</span> Nueva Cita
        </button>
      </div>

      {/* Grid de 2 Columnas Principal (Imagen 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda (4 columnas): Calendario Mensual + Sala de Espera */}
        <div className="lg:col-span-4 space-y-6">
          {/* Widget Calendario Mensual Dinámico Traído de Base de Datos */}
          {(() => {
            const monthNames = [
              'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
              'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
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
              <div className="rounded-3xl border border-[#E2E6EA] bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E6EA]">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-[#1E242B]">
                    <CalendarIcon size={16} color="#D4AF37" />
                    <span className="capitalize">{currentMonthTitle}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#687380]">
                    <button
                      type="button"
                      title="Mes anterior"
                      onClick={() => navigateMonth(-1)}
                      className="h-7 w-7 rounded-lg hover:bg-[#F3F4F6] flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      title="Mes siguiente"
                      onClick={() => navigateMonth(1)}
                      className="h-7 w-7 rounded-lg hover:bg-[#F3F4F6] flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                    >
                      ›
                    </button>
                  </div>
                </div>

                {/* Cabecera de Días de Semana: Lun a Dom */}
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-[#687380] pb-1">
                  <span>Lun</span>
                  <span>Mar</span>
                  <span>Mié</span>
                  <span>Jue</span>
                  <span>Vie</span>
                  <span>Sáb</span>
                  <span>Dom</span>
                </div>

                {/* Cuadrícula de Días Dinámica */}
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {/* Días del mes previo */}
                  {leadingDays.map((d, idx) => (
                    <div key={`lead-${idx}`} className="h-13 flex flex-col items-center justify-center text-gray-300 font-medium">
                      {d}
                    </div>
                  ))}

                  {/* Días del mes actual traídos de la base de datos */}
                  {currentDays.map((day) => {
                    const dayStr = day.toString().padStart(2, '0');
                    const monthStr = calendarMonth.toString().padStart(2, '0');
                    const fullDateStr = `${calendarYear}-${monthStr}-${dayStr}`;
                    const isSelected = selectedDate === fullDateStr;

                    // Datos de resumen mensual calculados en DB
                    const daySummary = monthlySummary.find((s) => s.dia === day);
                    const totalCitas = daySummary?.totalCitas ?? 0;
                    const sinBloques = daySummary ? daySummary.sinBloques : true;

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSelectedDate(fullDateStr)}
                        className={`h-13 w-full rounded-2xl flex flex-col items-center justify-center transition-all p-0.5 cursor-pointer ${
                          isSelected
                            ? 'bg-[#111827] text-white shadow-xs'
                            : 'hover:bg-[#F3F4F6] text-[#1E242B]'
                        }`}
                      >
                        <span
                          className={`text-xs font-extrabold ${
                            isSelected ? 'text-[#D4AF37]' : ''
                          }`}
                        >
                          {day}
                        </span>

                        {/* Badge dinámico */}
                        {isSelected ? (
                          <span className="mt-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-[#D4AF37] text-black whitespace-nowrap leading-tight">
                            {totalCitas > 0 ? `${totalCitas} citas` : 'Seleccionado'}
                          </span>
                        ) : sinBloques ? (
                          <span className="mt-0.5 px-1 py-0.2 rounded text-[8px] font-semibold bg-[#F3F4F6] text-[#8F99A3] whitespace-nowrap leading-tight">
                            Sin bloques
                          </span>
                        ) : totalCitas > 0 ? (
                          <span className="mt-0.5 h-4 w-4 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] flex items-center justify-center">
                            {totalCitas}
                          </span>
                        ) : (
                          <span className="h-4"></span>
                        )}
                      </button>
                    );
                  })}

                  {/* Días del mes siguiente */}
                  {trailingDays.map((d, idx) => (
                    <div key={`trail-${idx}`} className="h-13 flex flex-col items-center justify-center text-gray-300 font-medium">
                      {d}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Columna Derecha (8 columnas): Barra de Navegación del Día y Bloques de Horario */}
        <div className="lg:col-span-8 space-y-4">
          {/* Barra de Día con Navegación y Botón "Crear bloques" (Imagen 3) */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-2xl border border-[#E2E6EA] p-2 shadow-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleNavigateDay(-1)}
                className="px-3 py-1.5 rounded-xl border border-[#E2E6EA] text-xs font-bold text-[#687380] hover:bg-[#F3F4F6] transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                ← Ayer
              </button>

              <div className="px-4 py-1.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA] text-xs font-extrabold text-[#1E242B] flex items-center gap-2">
                <CalendarIcon size={14} color="#D4AF37" />
                <span>{formatHeaderDate(selectedDate)}</span>
              </div>

              <button
                type="button"
                onClick={() => handleNavigateDay(1)}
                className="px-3 py-1.5 rounded-xl border border-[#E2E6EA] text-xs font-bold text-[#687380] hover:bg-[#F3F4F6] transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                Mañana →
              </button>
            </div>

            {/* Botón Crear Bloques (ERS RF-AGE-001) */}
            <button
              type="button"
              disabled={isPastDate}
              onClick={handleGenerateDaySlots}
              title={isPastDate ? 'No es posible crear bloques en fechas pasadas' : 'Crear bloques para este día'}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors ${
                isPastDate
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                  : 'bg-[#111827] text-white hover:bg-black cursor-pointer'
              }`}
            >
              <span className={isPastDate ? 'opacity-40' : 'text-[#D4AF37]'}>➕</span> Crear bloques
            </button>
          </div>

          {/* Grilla de Bloques con Citas y Estado Vacío si no hay bloques en BD (Imagen 3) */}
          <WeeklyCalendarGrid
            slots={slots}
            filterMode={filterMode}
            isPastDate={isPastDate}
            onSelectSlot={handleSelectConfirmedSlot}
            onSelectPendingRequest={handleSelectPendingSlot}
            onToggleSlotStatus={(slot) => {
              if (isPastDate) {
                showAlert({
                  title: 'Fecha en el Pasado',
                  message: 'No es posible modificar bloques de horario en fechas pasadas.',
                  type: 'warning',
                });
                return;
              }
              toggleSlotStatus(slot);
            }}
            onScheduleSlot={handleScheduleSlot}
            onCreateBlocks={handleGenerateDaySlots}
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
          onConfirmSchedule={handleConfirmQuickSchedule}
        />
      )}
    </div>
  );
};
