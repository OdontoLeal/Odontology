// src/modules/appointments/ui/views/AppointmentRequestDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '../../../../shared/ui/components/Button';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';
import {
  ClockIcon,
  FileTextIcon,
  UserIcon,
} from '../../../../shared/ui/components/Icons';

export interface RequestDetailData {
  idSolicitud: number;
  idCita?: number | null;
  nombrePaciente: string;
  documentoIdentidad: string;
  telefono: string;
  correo: string;
  fechaSolicitada: string;
  horaSolicitada: string;
  motivoConsulta: string;
  fechaSolicitud?: string;
  sexo?: string;
  edad?: number;
  esPacienteNuevo?: boolean;
  doctorAsignado?: string;
}

export interface RequestReviewDoctorOption {
  idUsuario: number;
  nombreCompleto: string;
  especialidad?: string;
}

export interface AppointmentRequestDetailPageProps {
  request: RequestDetailData;
  doctors?: RequestReviewDoctorOption[];
  onBack: () => void;
  onApprove: (
    idSolicitud: number,
    idDoctor?: number,
    motivo?: string,
    selectedBlocks?: string[]
  ) => Promise<void> | void;
  onReject: (idSolicitud: number, motivo: string) => Promise<void> | void;
  isLoading?: boolean;
}

interface DaySlotItem {
  inicio: string;
  final: string;
  timeStart: string;
  timeEnd: string;
  label: string;
  isRequested: boolean;
  isOccupied: boolean;
  doctorOccupant?: string;
}

export const AppointmentRequestDetailPage: React.FC<AppointmentRequestDetailPageProps> = ({
  request,
  doctors = [],
  onBack,
  onApprove,
  onReject,
  isLoading = false,
}) => {
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<number>(() => {
    if (doctors.length > 0) return doctors[0].idUsuario;
    return 101; // Dr. Mateo Gómez
  });
  const [tituloCita, setTituloCita] = useState(request.motivoConsulta || 'Valoración Odontológica');
  const [isProcessing, setIsProcessing] = useState(false);
  const { showAlert, AlertModalComponent } = useAlertModal();

  // Estados para selección de bloques de horario continuos (Imagen 1)
  const [daySlots, setDaySlots] = useState<DaySlotItem[]>([]);
  const [selectedBlockStarts, setSelectedBlockStarts] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Formateo de fecha en español (ej. Jueves 29 de Octubre de 2026)
  const formatSpanishDate = (dateStr: string) => {
    if (!dateStr) return 'Fecha por confirmar';
    try {
      const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
      const [year, month, day] = cleanDate.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
      ];
      return `${days[d.getDay()]} ${day} de ${months[d.getMonth()]} de ${year}`;
    } catch {
      return dateStr;
    }
  };

  // Cargar bloques de la base de datos para la fecha solicitada
  useEffect(() => {
    if (!request.fechaSolicitada) return;
    const cleanFecha = request.fechaSolicitada.includes('T')
      ? request.fechaSolicitada.split('T')[0]
      : request.fechaSolicitada.split(' ')[0];

    setIsLoadingSlots(true);
    Promise.all([
      fetch(`/api/v1/appointments/slots?desde=${cleanFecha} 00:00:00&hasta=${cleanFecha} 23:59:59`).then(
        (r) => (r.ok ? r.json() : { data: [] })
      ),
      fetch(`/api/v1/appointments/agenda?fecha=${cleanFecha}`).then((r) =>
        r.ok ? r.json() : { data: [] }
      ),
    ])
      .then(([slotsRes, agendaRes]) => {
        const rawSlots: any[] = slotsRes.data || [];
        const agenda: any[] = agendaRes.data || [];

        // Mapear doctores u ocupantes por bloque
        const occupantMap = new Map<string, string>();
        for (const appt of agenda) {
          if (Array.isArray(appt.bloques) && appt.estado !== 'Rechazada') {
            for (const b of appt.bloques) {
              const cleanB = String(b).replace('T', ' ').slice(0, 19);
              occupantMap.set(cleanB, appt.nombreProfesional || 'Dr. Gómez');
            }
          }
        }

        let reqHour = request.horaSolicitada.trim();
        if (reqHour.includes(':') && reqHour.split(':')[0].length === 1) {
          reqHour = '0' + reqHour;
        }

        const formatted: DaySlotItem[] = rawSlots.map((s: any) => {
          const cleanInicio = String(s.inicio || '').replace('T', ' ').slice(0, 19);
          const cleanFinal = String(s.final || '').replace('T', ' ').slice(0, 19);
          const timeStart = cleanInicio.split(' ')[1]?.slice(0, 5) || '00:00';
          const timeEnd = cleanFinal.split(' ')[1]?.slice(0, 5) || '00:00';
          const isRequested = timeStart === reqHour || cleanInicio.includes(reqHour);
          const occupant = occupantMap.get(cleanInicio);
          const isOccupied = s.ocupacion === true && !isRequested;

          return {
            inicio: cleanInicio,
            final: cleanFinal,
            timeStart,
            timeEnd,
            label: `${timeStart} – ${timeEnd}`,
            isRequested,
            isOccupied,
            doctorOccupant: occupant,
          };
        });

        setDaySlots(formatted);

        // Inicializar con el bloque solicitado por el paciente
        const requestedSlot = formatted.find((s) => s.isRequested);
        if (requestedSlot) {
          setSelectedBlockStarts([requestedSlot.inicio]);
        } else if (formatted.length > 0) {
          const firstAvailable = formatted.find((s) => !s.isOccupied);
          if (firstAvailable) {
            setSelectedBlockStarts([firstAvailable.inicio]);
          }
        }
      })
      .catch((err) => {
        console.error('Error cargando bloques para el detalle de la solicitud:', err);
      })
      .finally(() => {
        setIsLoadingSlots(false);
      });
  }, [request.fechaSolicitada, request.horaSolicitada]);

  // Selección de bloques continuos (1 bloque = 30 min)
  const handleToggleBlock = (slot: DaySlotItem) => {
    if (slot.isOccupied) return;

    setSelectedBlockStarts((prev) => {
      if (prev.includes(slot.inicio)) {
        if (prev.length === 1) return prev; // Mantener al menos 1 seleccionado
        return prev.filter((b) => b !== slot.inicio).sort();
      }

      if (prev.length === 0) return [slot.inicio];

      const sorted = [...prev].sort();
      const firstStart = sorted[0];
      const lastStart = sorted[sorted.length - 1];

      const slotIndex = daySlots.findIndex((s) => s.inicio === slot.inicio);
      const firstIndex = daySlots.findIndex((s) => s.inicio === firstStart);
      const lastIndex = daySlots.findIndex((s) => s.inicio === lastStart);

      // Si es contiguo al final o al inicio
      if (slotIndex === lastIndex + 1 || slotIndex === firstIndex - 1) {
        return [...prev, slot.inicio].sort();
      }

      // Si no es contiguo, iniciar una nueva selección contigua a partir de este bloque
      return [slot.inicio];
    });
  };

  // Cálculo dinámico del banner de resumen (Imagen 1)
  const sortedSelected = [...selectedBlockStarts].sort();
  const selectedCount = sortedSelected.length;
  const firstSelectedSlot = daySlots.find((s) => s.inicio === sortedSelected[0]);
  const lastSelectedSlot = daySlots.find((s) => s.inicio === sortedSelected[sortedSelected.length - 1]);

  const startHourDisplay = firstSelectedSlot?.timeStart || request.horaSolicitada || '09:00';
  const endHourDisplay = lastSelectedSlot?.timeEnd || '09:30';

  const totalMinutes = selectedCount * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  let durationLabel = '';
  if (hours > 0 && minutes > 0) {
    durationLabel = `${hours} hora${hours > 1 ? 's' : ''} ${minutes} min total`;
  } else if (hours > 0) {
    durationLabel = `${hours} hora${hours > 1 ? 's' : ''} total`;
  } else {
    durationLabel = `${minutes} min total`;
  }

  const continuousCountLabel =
    selectedCount > 1
      ? `${selectedCount} bloques continuos seleccionados`
      : '1 bloque seleccionado';

  // Cálculo de iniciales
  const getInitials = (name: string) => {
    if (!name) return 'P';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Formateo de DNI con puntos: 1025884320 -> 1.025.884.320
  const formatDni = (dni: string) => {
    if (!dni) return 'Sin documento';
    const digits = dni.replace(/\D/g, '');
    if (!digits) return dni;
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const handleConfirmReject = () => {
    if (!motivoRechazo.trim()) {
      showAlert({
        title: 'Motivo de Rechazo Requerido',
        message: 'Debe ingresar el motivo por el cual se rechaza la solicitud de cita para notificar al paciente.',
        type: 'warning',
      });
      return;
    }
    onReject(request.idSolicitud, motivoRechazo.trim());
    setIsRejectModalOpen(false);
  };

  // Manejador de confirmación con elemento de carga explícito
  const handleApproveClick = async () => {
    if (selectedBlockStarts.length === 0) {
      showAlert({
        title: 'Horario Requerido',
        message: 'Debe seleccionar al menos un bloque de horario para agendar la cita.',
        type: 'warning',
      });
      return;
    }
    setIsProcessing(true);
    try {
      await onApprove(request.idSolicitud, selectedDoctorId, tituloCita, selectedBlockStarts);
    } catch (err: any) {
      showAlert({
        title: 'Error al confirmar cita',
        message: err.message || 'No fue posible confirmar la solicitud.',
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 animate-fadeIn relative">
      <AlertModalComponent />

      {/* Modal / Overlay de Procesamiento de Solicitud */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl border border-[#E2E6EA] bg-white p-8 shadow-2xl text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-[#FEF9E7] border-2 border-[#D4AF37] flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-[#D4AF37] animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-[#1E242B]">Confirmando Cita Médica</h3>
              <p className="text-xs text-[#687380] leading-relaxed">
                Estamos registrando la cita en la base de datos, ocupando los bloques seleccionados y enviando las confirmaciones por correo electrónico al paciente y al doctor...
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F3F4F6] text-[11px] font-semibold text-[#8F99A3]">
              <span className="h-2 w-2 rounded-full bg-[#D4AF37] animate-pulse"></span>
              Por favor espere un momento
            </div>
          </div>
        </div>
      )}

      {/* Botón Superior: Volver */}
      <div>
        <button
          type="button"
          onClick={onBack}
          disabled={isProcessing}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#687380] hover:text-[#1E242B] transition-colors cursor-pointer disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver a Solicitudes de Citas
        </button>
      </div>

      {/* Cabecera Principal con Acciones */}
      <div className="rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] flex items-center justify-center shrink-0">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#1E242B]">
                Detalle de Solicitud de Cita
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]"></span>
                Pendiente de Aprobación
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-[#687380]">
              Revisa la información enviada por el paciente y confirma o rechaza la reserva en la agenda médica.
            </p>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => setIsRejectModalOpen(true)}
            disabled={isLoading || isProcessing}
            className="px-4 py-2.5 rounded-xl border border-[#FCA5A5] text-[#DC2626] bg-white hover:bg-[#FEF2F2] text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            Rechazar Solicitud
          </button>

          <button
            type="button"
            onClick={handleApproveClick}
            disabled={isLoading || isProcessing || selectedBlockStarts.length === 0}
            className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C29E2F] text-black text-xs font-extrabold transition-all shadow-xs inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <svg className="w-4 h-4 animate-spin text-black" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Creando cita...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Crear cita</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grid de 2 Columnas Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda (6 cols): Información Solicitada, Motivo y Asignación de Profesional */}
        <div className="lg:col-span-6 space-y-6">
          {/* Card 1: Fecha y Horario Solicitado Originalmente */}
          <div className="rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-sm font-extrabold text-[#1E242B]">
              <ClockIcon size={16} color="#D4AF37" />
              <h3>Fecha y Horario Solicitado por el Paciente</h3>
            </div>

            <div className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-extrabold uppercase text-[#8F99A3] tracking-wider flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Fecha Solicitada
                </span>
                <p className="mt-1 text-base font-extrabold text-[#1E242B]">
                  {formatSpanishDate(request.fechaSolicitada)}
                </p>
              </div>

              <div className="sm:text-right">
                <span className="text-[11px] font-extrabold uppercase text-[#8F99A3] tracking-wider flex items-center sm:justify-end gap-1.5">
                  <svg className="w-3.5 h-3.5 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Hora Solicitada
                </span>
                <p className="mt-1 text-base font-extrabold text-[#1E242B]">
                  {request.horaSolicitada}
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Motivo de Consulta Registrado */}
          <div className="rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-sm font-extrabold text-[#1E242B]">
              <FileTextIcon size={16} color="#D4AF37" />
              <h3>Motivo de Consulta Registrado</h3>
            </div>

            <div className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-5 space-y-3">
              <p className="text-sm italic text-[#374151] font-medium leading-relaxed">
                "{request.motivoConsulta}"
              </p>
              <div className="flex items-center gap-1.5 text-xs text-[#059669] font-medium pt-1 border-t border-[#E2E6EA]">
                <svg className="w-4 h-4 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  Registrado vía formulario web de solicitud el 24 de Octubre de 2026 a las 09:15 AM
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Asignación de Profesional y Detalles de la Cita */}
          <div className="rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-sm font-extrabold text-[#1E242B]">
              <span className="text-[#D4AF37]">🩺</span>
              <h3>Asignación de Profesional y Cita Médica</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#687380] mb-1.5">
                  Profesional Odontológico Asignado:
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#E2E6EA] bg-[#F8F9FA] px-3 py-2 text-xs font-bold text-[#1E242B] focus:border-[#D4AF37] focus:bg-white focus:outline-none"
                >
                  {doctors.length > 0 ? (
                    doctors.map((d) => (
                      <option key={d.idUsuario} value={d.idUsuario}>
                        {d.nombreCompleto} ({d.especialidad || 'Odontología General'})
                      </option>
                    ))
                  ) : (
                    <option value={101}>Dr. Mateo Gómez (Odontología General)</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#687380] mb-1.5">
                  Título / Tratamiento de la Cita:
                </label>
                <input
                  type="text"
                  maxLength={50}
                  value={tituloCita}
                  onChange={(e) => setTituloCita(e.target.value)}
                  placeholder="Ej. Valoración Odontológica General"
                  className="w-full rounded-xl border border-[#E2E6EA] bg-[#F8F9FA] px-3 py-2 text-xs font-medium text-[#1E242B] focus:border-[#D4AF37] focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Card 4: Impacto de la Confirmación (Alert Box) */}
          <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-5 flex items-start gap-3">
            <span className="text-base text-[#D97706] mt-0.5">ⓘ</span>
            <div className="space-y-1">
              <h4 className="text-xs font-extrabold text-[#92400E]">
                Impacto de la confirmación
              </h4>
              <p className="text-xs text-[#78350F] leading-relaxed">
                Al hacer click en <strong>Crear cita</strong>, se confirmará formalmente la cita en la agenda del doctor seleccionado, todos los bloques seleccionados ({startHourDisplay} a {endHourDisplay}) quedarán ocupados en la base de datos y se enviará de inmediato el correo de confirmación al <strong>paciente</strong> y la notificación al <strong>doctor</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Columna Derecha (6 cols): Datos del Paciente arriba y Bloques Horarios Disponibles abajo */}
        <div className="lg:col-span-6 space-y-6">
          {/* Card 1: Datos del Paciente */}
          <div className="rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E6EA]">
              <div className="flex items-center gap-2 text-sm font-extrabold text-[#1E242B]">
                <UserIcon size={16} color="#D4AF37" />
                <h3>Datos del Paciente</h3>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                {request.esPacienteNuevo !== false ? 'Paciente Nueva' : 'Paciente Registrado'}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-[#111827] text-white font-extrabold text-lg flex items-center justify-center shrink-0 shadow-xs border-2 border-white">
                {getInitials(request.nombrePaciente)}
              </div>
              <div>
                <h4 className="text-base font-extrabold text-[#1E242B]">
                  {request.nombrePaciente}
                </h4>
                <p className="text-xs font-medium text-[#687380] mt-0.5">
                  DNI: {formatDni(request.documentoIdentidad)}
                </p>
                <div className="mt-1.5">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F3F4F6] text-[#4B5563]">
                    {request.sexo || 'Femenino'} • {request.edad || 29} años
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-[#E2E6EA] text-xs">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-[#F8F9FA] border border-[#E2E6EA] flex items-center justify-center text-[#687380] shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <span className="block text-[10px] font-extrabold uppercase text-[#8F99A3]">
                    Teléfono Móvil
                  </span>
                  <span className="font-bold text-[#1E242B]">
                    {request.telefono || '+57 318 459 2011'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-[#F8F9FA] border border-[#E2E6EA] flex items-center justify-center text-[#687380] shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <span className="block text-[10px] font-extrabold uppercase text-[#8F99A3]">
                    Correo Electrónico
                  </span>
                  <span className="font-bold text-[#1E242B] break-all">
                    {request.correo}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Bloques Horarios Disponibles (Ubicado abajo a la derecha, debajo de datos del paciente, Imagen 1) */}
          <div className="rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-[#1E242B]">Bloques Horarios Disponibles</h3>
              <p className="text-xs text-[#687380] mt-0.5">
                Selecciona bloques continuos (1 bloque = 30 minutos)
              </p>
            </div>

            {/* Banner de Resumen de Selección (Dorado, Imagen 1) */}
            <div className="rounded-2xl border border-[#D4AF37] bg-[#FEF9E7] p-4 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#D4AF37] text-white flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-[#1E242B]">
                    {startHourDisplay} – {endHourDisplay} hrs ({durationLabel})
                  </h4>
                  <p className="text-xs text-[#687380] font-medium mt-0.5">
                    {continuousCountLabel}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs font-bold text-[#059669] shrink-0">
                <span>✓</span>
                <span>Válido</span>
              </div>
            </div>

            {/* Listado de Bloques de Horario con Scroll Interno */}
            {isLoadingSlots ? (
              <div className="p-8 text-center text-xs text-[#8F99A3]">
                Cargando bloques de horario desde la base de datos...
              </div>
            ) : daySlots.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-[#E2E6EA] text-xs text-[#8F99A3]">
                No hay bloques de horario generados para este día. Cree los bloques desde la agenda médica.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
                {daySlots.map((slot) => {
                  const isSelected = selectedBlockStarts.includes(slot.inicio);
                  const selectedIdx = sortedSelected.indexOf(slot.inicio);

                  if (isSelected) {
                    return (
                      <div
                        key={slot.inicio}
                        onClick={() => handleToggleBlock(slot)}
                        className="rounded-2xl border-2 border-[#D4AF37] bg-[#FEFDF5] p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full bg-[#D4AF37]"></span>
                          <span className="text-sm font-extrabold text-[#1E242B]">{slot.label}</span>
                        </div>
                        <span className="text-xs font-bold text-[#1E242B]">
                          Bloque {selectedIdx + 1} Seleccionado
                        </span>
                      </div>
                    );
                  }

                  if (slot.isRequested) {
                    return (
                      <div
                        key={slot.inicio}
                        onClick={() => handleToggleBlock(slot)}
                        className="rounded-2xl border-2 border-[#7DD3FC] bg-white p-3.5 flex items-center justify-between cursor-pointer transition-all hover:bg-[#F0F9FF]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full bg-[#0284C7]"></span>
                          <span className="text-sm font-extrabold text-[#1E242B]">{slot.label}</span>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#0284C7] text-white shadow-2xs">
                          Solicitado (Pendiente)
                        </span>
                      </div>
                    );
                  }

                  if (slot.isOccupied) {
                    return (
                      <div
                        key={slot.inicio}
                        className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-3.5 flex items-center justify-between opacity-60 cursor-not-allowed"
                      >
                        <div className="flex items-center gap-3 text-[#9CA3AF]">
                          <span className="h-3 w-3 rounded-full bg-[#CBD2D9]"></span>
                          <span className="text-sm font-semibold line-through">{slot.label}</span>
                        </div>
                        <span className="text-xs font-semibold text-[#8F99A3]">
                          Ocupado {slot.doctorOccupant ? `(${slot.doctorOccupant})` : ''}
                        </span>
                      </div>
                    );
                  }

                  // Disponible
                  return (
                    <div
                      key={slot.inicio}
                      onClick={() => handleToggleBlock(slot)}
                      className="rounded-2xl border border-[#E2E6EA] bg-white p-3.5 flex items-center justify-between cursor-pointer hover:border-[#CBD2D9] hover:bg-[#F8F9FA] transition-all"
                    >
                      <div className="flex items-center gap-3 text-[#1E242B]">
                        <span className="h-3 w-3 rounded-full border-2 border-[#CBD2D9]"></span>
                        <span className="text-sm font-bold">{slot.label}</span>
                      </div>
                      <span className="text-xs font-medium text-[#687380]">
                        Disponible
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Leyenda de Estados de Bloques (Imagen 1) */}
            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-[#687380] border-t border-[#E2E6EA]">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-[#D4AF37]"></span>
                <span>Seleccionado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-[#0284C7]"></span>
                <span>Solicitado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full border-2 border-[#CBD2D9]"></span>
                <span>Disponible</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-[#CBD2D9]"></span>
                <span>Ocupado</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Rechazo de Solicitud */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E6EA]">
              <h3 className="text-base font-extrabold text-[#DC2626] flex items-center gap-2">
                <span>🚫</span> Rechazar Solicitud de Cita
              </h3>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="text-[#8F99A3] hover:text-[#1E242B] text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#687380]">
              Indica el motivo de rechazo para liberar el bloque de horario y notificar al paciente solicitante:
            </p>
            <textarea
              rows={3}
              placeholder="Ej. El horario solicitado no tiene disponibilidad médica o los datos no pudieron ser verificados..."
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              className="w-full rounded-2xl border border-[#E2E6EA] p-3 text-xs text-[#1E242B] focus:border-[#D4AF37] focus:outline-none"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setIsRejectModalOpen(false)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleConfirmReject} isLoading={isLoading}>
                Confirmar Rechazo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
