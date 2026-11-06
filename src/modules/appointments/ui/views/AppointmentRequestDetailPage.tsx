// src/modules/appointments/ui/views/AppointmentRequestDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '../../../../shared/ui/components/Button';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';
import {
  DetailAction,
  DetailPageContainer,
  DetailPageHeader,
  EmptyState,
  InfoIcons,
  InfoItem,
  SECTION_CARD_CLASS,
  SectionCardHeader,
  StatusBadge,
  UserAvatar,
} from '../../../../shared/ui/components/DetailPage';
import {
  formatDateTimeCO,
  formatLongDateCO,
  formatTimeCO,
} from '../../../../shared/ui/format';
import {
  ClockIcon,
  FileTextIcon,
  UserIcon,
  StethoscopeIcon,
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
    return 0;
  });

  useEffect(() => {
    if (doctors.length > 0 && (!selectedDoctorId || !doctors.some((d) => d.idUsuario === selectedDoctorId))) {
      setSelectedDoctorId(doctors[0].idUsuario);
    }
  }, [doctors, selectedDoctorId]);
  const [tituloCita, setTituloCita] = useState(request.motivoConsulta || 'Valoración Odontológica');
  const [isProcessing, setIsProcessing] = useState(false);
  const { showAlert, AlertModalComponent } = useAlertModal();

  // Estados para selección de bloques de horario continuos (Imagen 1)
  const [daySlots, setDaySlots] = useState<DaySlotItem[]>([]);
  const [selectedBlockStarts, setSelectedBlockStarts] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Formateo de fecha en español (ej. Jueves 29 de Octubre de 2026)
  const formatSpanishDate = (dateStr: string) =>
    dateStr ? formatLongDateCO(dateStr) : 'Fecha por confirmar';

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
    if (!selectedDoctorId || selectedDoctorId === 0) {
      showAlert({
        title: 'Profesional Requerido',
        message: 'Debe seleccionar un profesional odontológico para asignar la cita.',
        type: 'warning',
      });
      return;
    }
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
    <DetailPageContainer className="relative space-y-6">
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
              <h3 className="text-[16px] font-bold leading-6 text-[#1E242B]">Confirmando Cita Médica</h3>
              <p className="text-xs text-[#687380] leading-relaxed">
                Estamos registrando la cita en la base de datos, ocupando los bloques seleccionados y enviando las confirmaciones por correo electrónico al paciente y al doctor...
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F3F4F6] text-[13px] font-semibold text-[#8F99A3]">
              <span className="h-2 w-2 rounded-full bg-[#D4AF37] animate-pulse"></span>
              Por favor espere un momento
            </div>
          </div>
        </div>
      )}

      <DetailPageHeader
        backLabel="Volver a la Agenda"
        onBack={isProcessing ? undefined : onBack}
        title="Detalle de Solicitud de Cita"
        badge={<StatusBadge tone="info">Pendiente de aprobación</StatusBadge>}
        subtitle="Revisa la información enviada por el paciente y confirma o rechaza la reserva en la agenda médica."
        actions={
          <>
            <DetailAction
              variant="danger"
              onClick={() => setIsRejectModalOpen(true)}
              disabled={isLoading || isProcessing}
            >
              Rechazar solicitud
            </DetailAction>
            <DetailAction
              variant="primary"
              onClick={handleApproveClick}
              disabled={isLoading || isProcessing || selectedBlockStarts.length === 0 || !selectedDoctorId}
            >
              {isProcessing ? 'Creando cita...' : 'Crear cita'}
            </DetailAction>
          </>
        }
      />

      {/* Grid de 2 Columnas Principal */}
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda (6 cols): Información Solicitada, Motivo y Asignación de Profesional */}
        <div className="min-w-0 lg:col-span-6 space-y-6">
          {/* Card 1: Fecha y Horario Solicitado Originalmente */}
          <div className={SECTION_CARD_CLASS}>
            <SectionCardHeader title="Fecha y Horario Solicitados" icon={<ClockIcon />} />

            <div className="rounded-lg bg-[#F8FAFC] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-[13px] font-extrabold uppercase text-[#8F99A3] tracking-wider flex items-center gap-1.5">
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
                <span className="text-[13px] font-extrabold uppercase text-[#8F99A3] tracking-wider flex items-center sm:justify-end gap-1.5">
                  <svg className="w-3.5 h-3.5 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Hora Solicitada
                </span>
                <p className="mt-1 text-base font-extrabold text-[#1E242B]">
                  {formatTimeCO(request.horaSolicitada)}
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Motivo de Consulta Registrado */}
          <div className={SECTION_CARD_CLASS}>
            <SectionCardHeader title="Motivo de Consulta Registrado" icon={<FileTextIcon />} />

            <div className="rounded-lg bg-[#F8FAFC] p-4 space-y-3">
              <p className="text-sm italic text-[#374151] font-medium leading-relaxed">
                "{request.motivoConsulta}"
              </p>
              <div className="flex items-center gap-1.5 text-xs text-[#059669] font-medium pt-1 border-t border-[#E2E6EA]">
                <svg className="w-4 h-4 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  Registrado vía formulario web de solicitud
                  {request.fechaSolicitud ? ` el ${formatDateTimeCO(request.fechaSolicitud)}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Asignación de Profesional y Detalles de la Cita */}
          <div className={SECTION_CARD_CLASS}>
            <SectionCardHeader title="Asignación de Profesional y Cita Médica" icon={<StethoscopeIcon />} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#687380] mb-1.5">
                  Profesional Odontológico Asignado:
                </label>
                <select
                  value={selectedDoctorId || ''}
                  onChange={(e) => setSelectedDoctorId(Number(e.target.value))}
                  disabled={doctors.length === 0}
                  className="w-full rounded-xl border border-[#E2E6EA] bg-[#F8F9FA] px-3 py-2 text-xs font-bold text-[#1E242B] focus:border-[#D4AF37] focus:bg-white focus:outline-none disabled:opacity-60"
                >
                  {doctors.length > 0 ? (
                    doctors.map((d) => (
                      <option key={d.idUsuario} value={d.idUsuario}>
                        {d.nombreCompleto} ({d.especialidad || 'Odontología General'})
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>No hay profesionales disponibles</option>
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
                Al hacer click en <strong>Crear cita</strong>, se confirmará formalmente la cita en la agenda del doctor seleccionado, todos los bloques seleccionados ({formatTimeCO(startHourDisplay)} a {formatTimeCO(endHourDisplay)}) quedarán ocupados en la base de datos y se enviará de inmediato el correo de confirmación al <strong>paciente</strong> y la notificación al <strong>doctor</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Columna Derecha (6 cols): Datos del Paciente arriba y Bloques Horarios Disponibles abajo */}
        <div className="min-w-0 lg:col-span-6 space-y-6">
          {/* Card 1: Datos del Paciente */}
          <div className={SECTION_CARD_CLASS}>
            <SectionCardHeader
              title="Datos del Paciente"
              icon={<UserIcon />}
              action={
                <StatusBadge tone="info">
                  {request.esPacienteNuevo !== false ? 'Paciente nuevo' : 'Paciente registrado'}
                </StatusBadge>
              }
            />

            <div className="space-y-4">
              <div className="flex min-w-0 items-center gap-4">
                <UserAvatar name={request.nombrePaciente} size="md" />
                <div className="min-w-0">
                  <p className="text-break text-[18px] font-bold leading-6 text-[#1E242B]">
                    {request.nombrePaciente}
                  </p>
                  <p className="mt-0.5 text-[14px] text-[#64748B]">
                    Documento: {formatDni(request.documentoIdentidad)}
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-6 gap-y-3 rounded-lg bg-[#F8FAFC] p-4">
                <InfoItem icon={InfoIcons.age} label="Edad" value={request.edad ? `${request.edad} años` : null} />
                <InfoItem icon={InfoIcons.sex} label="Sexo" value={request.sexo} />
                <InfoItem icon={InfoIcons.phone} label="Teléfono" value={request.telefono || 'Sin registrar'} />
                <InfoItem icon={InfoIcons.mail} label="Correo electrónico" value={request.correo} />
              </dl>
            </div>
          </div>

          {/* Card 2: Bloques Horarios Disponibles (Ubicado abajo a la derecha, debajo de datos del paciente, Imagen 1) */}
          <div className={SECTION_CARD_CLASS}>
            <SectionCardHeader
              title="Bloques Horarios Disponibles"
              icon={<ClockIcon />}
              description="Selecciona bloques continuos (1 bloque = 30 minutos)"
            />

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
                    {formatTimeCO(startHourDisplay)} – {formatTimeCO(endHourDisplay)} ({durationLabel})
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
              <EmptyState>Cargando bloques de horario desde la base de datos...</EmptyState>
            ) : daySlots.length === 0 ? (
              <EmptyState>
                No hay bloques de horario generados para este día. Cree los bloques desde la agenda médica.
              </EmptyState>
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
                          <span className="text-sm font-extrabold text-[#1E242B]">{formatTimeCO(slot.label)}</span>
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
                          <span className="text-sm font-extrabold text-[#1E242B]">{formatTimeCO(slot.label)}</span>
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
                          <span className="text-sm font-semibold line-through">{formatTimeCO(slot.label)}</span>
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
                        <span className="text-sm font-bold">{formatTimeCO(slot.label)}</span>
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
    </DetailPageContainer>
  );
};
