// src/modules/appointments/ui/views/AppointmentDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';
import { DoctorOption } from '../components/ServiceSelector';
import {
  UserIcon,
  ClockIcon,
  PhoneIcon,
  FileTextIcon,
  ClipboardIcon,
  LockIcon,
} from '../../../../shared/ui/components/Icons';

export interface AppointmentDetailPageData {
  idCita: number;
  idPaciente: number;
  nombrePaciente: string;
  documentoIdentidad: string;
  telefono: string;
  correo: string;
  titulo: string;
  descripcion?: string;
  doctorNombre: string;
  idDoctor: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  sillon?: string;
  estado:
    | 'Confirmada'
    | 'En consulta'
    | 'En espera'
    | 'Completada'
    | 'Cancelada'
    | 'No asistió';
}

export interface AppointmentDetailPageProps {
  appointment: AppointmentDetailPageData;
  doctors?: DoctorOption[];
  onBack: () => void;
  onNavigateToPatientProfile?: (idPaciente: number) => void;
  onStartAttention?: (idCita: number, idPaciente: number) => void;
  onMarkNoShow?: (idCita: number, motivo: string) => Promise<void> | void;
  onCancelAppointment?: (idCita: number, motivo: string) => Promise<void> | void;
  onUpdateAppointment?: (
    idCita: number,
    data: {
      idDoctor?: number;
      titulo?: string;
      descripcion?: string;
      selectedBlocks?: string[];
    }
  ) => Promise<void> | void;
  onSignConsent?: (idConsentimiento: number) => void;
}

interface EditDaySlotItem {
  inicio: string;
  final: string;
  timeStart: string;
  timeEnd: string;
  label: string;
  isAssignedToThisAppt: boolean;
  isOccupiedByOther: boolean;
  occupantName?: string;
}

export const AppointmentDetailPage: React.FC<AppointmentDetailPageProps> = ({
  appointment: initialAppointment,
  doctors = [],
  onBack,
  onNavigateToPatientProfile,
  onStartAttention,
  onMarkNoShow,
  onCancelAppointment,
  onUpdateAppointment,
  onSignConsent,
}) => {
  const [appointment, setAppointment] = useState<AppointmentDetailPageData>(initialAppointment);

  // Modales
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReasonTag, setCancelReasonTag] = useState('');
  const [cancelReasonText, setCancelReasonText] = useState('');

  const [isNoShowModalOpen, setIsNoShowModalOpen] = useState(false);
  const [noShowReasonOption, setNoShowReasonOption] = useState('El paciente no llego ni informo');
  const [noShowCustomText, setNoShowCustomText] = useState('');

  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [selectedConsents, setSelectedConsents] = useState<number[]>([]);

  // Modo edición ("Editar Cita")
  const [isEditing, setIsEditing] = useState(false);
  const [editDoctorId, setEditDoctorId] = useState<number>(initialAppointment.idDoctor);
  const [editTitulo, setEditTitulo] = useState<string>(initialAppointment.titulo);
  const [editDescripcion, setEditDescripcion] = useState<string>(initialAppointment.descripcion || '');
  const [editSelectedBlocks, setEditSelectedBlocks] = useState<string[]>([]);
  const [editDaySlots, setEditDaySlots] = useState<EditDaySlotItem[]>([]);
  const [isLoadingEditSlots, setIsLoadingEditSlots] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Lista de doctores dinámicos
  const [doctorsList, setDoctorsList] = useState<DoctorOption[]>(doctors);

  // Datos dinámicos cargados desde base de datos
  const [clinicalHistories, setClinicalHistories] = useState<any[]>([]);
  const [isLoadingHistories, setIsLoadingHistories] = useState(false);
  const [consentItems, setConsentItems] = useState<any[]>([]);
  const [isLoadingConsents, setIsLoadingConsents] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);

  const { showAlert, AlertModalComponent } = useAlertModal();

  useEffect(() => {
    setAppointment(initialAppointment);
  }, [initialAppointment]);

  // Cargar lista de doctores si no vino por props
  useEffect(() => {
    if (doctors.length > 0) {
      setDoctorsList(doctors);
      return;
    }
    fetch('/api/v1/users')
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => {
        const userList: any[] = json.data || [];
        const candidates = userList
          .filter((u) => u.estado !== false)
          .map((u) => ({
            idUsuario: Number(u.id_usuario ?? u.idUsuario),
            nombreCompleto: u.nombre_completo ?? u.nombreCompleto ?? 'Doctor',
            especialidad:
              u.roles?.[0]?.nombreRol ||
              u.roles?.[0]?.nombre_rol ||
              'Odontología General',
          }));
        if (candidates.length > 0) {
          setDoctorsList(candidates);
        }
      })
      .catch(() => {});
  }, [doctors]);

  // Formateador de fecha en español (ej. Sábado 24 Octubre 2026)
  const formatSpanishHeaderDate = (dateStr: string) => {
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
      return `${days[d.getDay()]} ${day} ${months[d.getMonth()]} ${year}`;
    } catch {
      return dateStr;
    }
  };

  // 1. Cargar historial clínico real del paciente desde la base de datos
  useEffect(() => {
    if (!appointment.idPaciente) return;
    setIsLoadingHistories(true);
    fetch(`/api/v1/clinical-records/patient/${appointment.idPaciente}`)
      .then((res) => (res.ok ? res.json() : { data: {} }))
      .then((json) => {
        const hist: any[] = json.data?.historial || [];
        const formatted = hist.map((item: any, idx: number) => {
          let dateStr = 'Fecha no registrada';
          if (item.fechaHoraRegistro) {
            try {
              const d = new Date(item.fechaHoraRegistro);
              const months = [
                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
              ];
              dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
            } catch {
              dateStr = item.fechaHoraRegistro;
            }
          }
          return {
            id: item.idCita || idx,
            title:
              item.motivoConsulta ||
              item.procedimientoRealizado ||
              item.tratamiento ||
              `Consulta Odontológica #${item.idCita || idx + 1}`,
            fecha: dateStr,
            doctor: item.profesionalResponsable || appointment.doctorNombre,
          };
        });
        setClinicalHistories(formatted);
      })
      .catch((err) => {
        console.error('Error cargando historial clínico del paciente:', err);
        setClinicalHistories([]);
      })
      .finally(() => {
        setIsLoadingHistories(false);
      });
  }, [appointment.idPaciente, appointment.doctorNombre]);

  // 2. Cargar consentimientos informados reales del paciente desde la base de datos
  useEffect(() => {
    if (!appointment.idPaciente) return;
    setIsLoadingConsents(true);
    fetch(`/api/v1/consents/patient/${appointment.idPaciente}`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => {
        const raw: any[] = json.data || [];
        setConsentItems(raw);
      })
      .catch((err) => {
        console.error('Error cargando consentimientos del paciente:', err);
        setConsentItems([]);
      })
      .finally(() => {
        setIsLoadingConsents(false);
      });
  }, [appointment.idPaciente]);

  // 3. Cargar plantillas de consentimientos para modal de adjuntar
  useEffect(() => {
    fetch('/api/v1/consents/templates')
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => {
        setAvailableTemplates(json.data || []);
      })
      .catch(() => {
        setAvailableTemplates([]);
      });
  }, []);

  // 4. Cargar bloques para el modo de edición
  const handleOpenEditMode = () => {
    setIsEditing(true);
    setEditDoctorId(appointment.idDoctor);
    setEditTitulo(appointment.titulo);
    setEditDescripcion(appointment.descripcion || '');

    const cleanFecha = appointment.fecha.includes('T')
      ? appointment.fecha.split('T')[0]
      : appointment.fecha.split(' ')[0];

    setIsLoadingEditSlots(true);
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

        // Identificar bloques de otras citas vs bloques de esta cita
        const otherApptsBlockMap = new Map<string, string>();
        const thisApptBlocks: string[] = [];

        for (const appt of agenda) {
          if (Array.isArray(appt.bloques) && appt.estado !== 'Cancelada' && appt.estado !== 'Rechazada') {
            for (const b of appt.bloques) {
              const cleanB = String(b).replace('T', ' ').slice(0, 19);
              if (appt.idCita === appointment.idCita) {
                thisApptBlocks.push(cleanB);
              } else {
                otherApptsBlockMap.set(cleanB, appt.nombreProfesional || 'Otro doctor');
              }
            }
          }
        }

        const formatted: EditDaySlotItem[] = rawSlots.map((s: any) => {
          const cleanInicio = String(s.inicio || '').replace('T', ' ').slice(0, 19);
          const cleanFinal = String(s.final || '').replace('T', ' ').slice(0, 19);
          const timeStart = cleanInicio.split(' ')[1]?.slice(0, 5) || '00:00';
          const timeEnd = cleanFinal.split(' ')[1]?.slice(0, 5) || '00:00';
          const isAssignedToThisAppt = thisApptBlocks.includes(cleanInicio);
          const occupant = otherApptsBlockMap.get(cleanInicio);
          const isOccupiedByOther = Boolean(occupant) || (s.ocupacion === true && !isAssignedToThisAppt);

          return {
            inicio: cleanInicio,
            final: cleanFinal,
            timeStart,
            timeEnd,
            label: `${timeStart} – ${timeEnd}`,
            isAssignedToThisAppt,
            isOccupiedByOther,
            occupantName: occupant,
          };
        });

        setEditDaySlots(formatted);

        // Si ya tenía bloques asignados, seleccionarlos; si no, seleccionar el bloque de su hora inicio
        if (thisApptBlocks.length > 0) {
          setEditSelectedBlocks(thisApptBlocks.sort());
        } else {
          let reqHour = appointment.horaInicio.trim();
          if (reqHour.includes(':') && reqHour.split(':')[0].length === 1) {
            reqHour = '0' + reqHour;
          }
          const matchedSlot = formatted.find((s) => s.timeStart === reqHour || s.inicio.includes(reqHour));
          if (matchedSlot && !matchedSlot.isOccupiedByOther) {
            setEditSelectedBlocks([matchedSlot.inicio]);
          } else if (formatted.length > 0) {
            const firstAvailable = formatted.find((s) => !s.isOccupiedByOther);
            if (firstAvailable) {
              setEditSelectedBlocks([firstAvailable.inicio]);
            }
          }
        }
      })
      .catch((err) => {
        console.error('Error cargando bloques para edición de cita:', err);
      })
      .finally(() => {
        setIsLoadingEditSlots(false);
      });
  };

  // Toggle de selección de bloques en edición
  const handleToggleEditBlock = (slot: EditDaySlotItem) => {
    if (slot.isOccupiedByOther) return;

    setEditSelectedBlocks((prev) => {
      if (prev.includes(slot.inicio)) {
        if (prev.length === 1) return prev; // Mantener al menos 1
        return prev.filter((b) => b !== slot.inicio).sort();
      } else {
        return [...prev, slot.inicio].sort();
      }
    });
  };

  // Confirmar y guardar edición de cita
  const handleSaveEdit = async () => {
    if (editSelectedBlocks.length === 0) {
      showAlert({
        title: 'Horario Requerido',
        message: 'Debe seleccionar al menos un bloque de horario para la cita médica.',
        type: 'warning',
      });
      return;
    }

    try {
      setIsSavingEdit(true);

      if (onUpdateAppointment) {
        await onUpdateAppointment(appointment.idCita, {
          idDoctor: editDoctorId,
          titulo: editTitulo,
          descripcion: editDescripcion,
          selectedBlocks: editSelectedBlocks,
        });
      } else {
        const res = await fetch(`/api/v1/appointments/${appointment.idCita}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idDoctor: editDoctorId,
            titulo: editTitulo,
            descripcion: editDescripcion,
            selectedBlocks: editSelectedBlocks,
            idUsuarioGestor: 1,
            motivo: 'Modificación de cita desde el panel de detalle',
          }),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.message || 'Error al actualizar la cita');
        }
      }

      // Actualizar estado local de la cita
      const sorted = [...editSelectedBlocks].sort();
      const firstStart = sorted[0].split(' ')[1]?.slice(0, 5) || appointment.horaInicio;
      const lastBlock = sorted[sorted.length - 1];
      const lastD = new Date(lastBlock);
      const endD = new Date(lastD.getTime() + 30 * 60 * 1000);
      const computedEnd = `${endD.getHours().toString().padStart(2, '0')}:${endD.getMinutes().toString().padStart(2, '0')}`;
      const docSelected = doctorsList.find((d) => d.idUsuario === editDoctorId);

      setAppointment((prev) => ({
        ...prev,
        titulo: editTitulo,
        descripcion: editDescripcion,
        idDoctor: editDoctorId,
        doctorNombre: docSelected?.nombreCompleto || prev.doctorNombre,
        horaInicio: firstStart,
        horaFin: computedEnd,
      }));

      showAlert({
        title: '¡Cita Actualizada con Éxito!',
        message: 'Se han guardado las modificaciones del doctor, tratamiento y bloques de horario en la base de datos.',
        type: 'success',
      });

      setIsEditing(false);
    } catch (err: any) {
      showAlert({
        title: 'Error al actualizar cita',
        message: err.message || 'No fue posible guardar los cambios de la cita.',
        type: 'error',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Manejador de inasistencia (Modal 1 - Imagen 1)
  const handleConfirmNoShow = async () => {
    let fullReason = noShowReasonOption;
    if (noShowReasonOption === 'Otro') {
      fullReason = noShowCustomText.trim() || 'El paciente no se presentó (Otro motivo)';
    } else if (noShowCustomText.trim()) {
      fullReason = `${noShowReasonOption}: ${noShowCustomText.trim()}`;
    }

    try {
      if (onMarkNoShow) {
        await onMarkNoShow(appointment.idCita, fullReason);
      } else {
        const res = await fetch(`/api/v1/appointments/${appointment.idCita}/state`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nuevoEstado: 'No asistió',
            idUsuarioGestor: 1,
            motivo: fullReason,
            liberarBloques: false,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Error al registrar inasistencia.');
        }
      }

      setAppointment((prev) => ({ ...prev, estado: 'No asistió' }));
      setIsNoShowModalOpen(false);
      showAlert({
        title: 'Inasistencia Registrada',
        message: 'Se ha registrado la inasistencia del paciente conforme a la norma RF-AGE-013. Los bloques horarios se mantienen registrados.',
        type: 'warning',
      });
    } catch (err: any) {
      showAlert({
        title: 'Error al registrar inasistencia',
        message: err.message || 'No fue posible marcar la inasistencia.',
        type: 'error',
      });
    }
  };

  // Manejador de cancelación (Modal 2 - Imagen 2)
  const handleConfirmCancel = async () => {
    const fullReason = [cancelReasonTag, cancelReasonText].filter(Boolean).join(': ');
    if (!fullReason.trim()) {
      showAlert({
        title: 'Motivo de Cancelación Requerido',
        message: 'Por favor seleccione una categoría o escriba el motivo de la cancelación.',
        type: 'warning',
      });
      return;
    }

    try {
      if (onCancelAppointment) {
        await onCancelAppointment(appointment.idCita, fullReason);
      } else {
        const res = await fetch(`/api/v1/appointments/${appointment.idCita}/state`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nuevoEstado: 'Cancelada',
            idUsuarioGestor: 1,
            motivo: fullReason,
            liberarBloques: true,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Error al cancelar la cita.');
        }
      }

      setAppointment((prev) => ({ ...prev, estado: 'Cancelada' }));
      setIsCancelModalOpen(false);
      showAlert({
        title: 'Cita Cancelada',
        message: 'La cita médica ha sido cancelada y los bloques de horario han quedado liberados en la agenda.',
        type: 'info',
      });
    } catch (err: any) {
      showAlert({
        title: 'Error al cancelar cita',
        message: err.message || 'No fue posible anular la cita.',
        type: 'error',
      });
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'P';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // VISTA DE EDICIÓN: similar a la pestaña de aceptar solicitud (RF-AGE-006)
  if (isEditing) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 animate-fadeIn">
        <AlertModalComponent />

        {/* Encabezado con botón de volver */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#687380] hover:text-[#1E242B] transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Cancelar Edición y Volver
          </button>
          <span className="text-xs text-[#8F99A3]">Modo de Modificación de Cita Confirmada</span>
        </div>

        {/* Tarjeta de Edición Principal */}
        <div className="rounded-3xl border border-[#E2E6EA] border-t-5 border-t-[#D4AF37] bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-4 pb-4 border-b border-[#E2E6EA]">
            <div className="h-12 w-12 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] text-[#D4AF37] flex items-center justify-center shrink-0">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#1E242B]">
                Editar Cita Médica • #{appointment.idCita}
              </h1>
              <p className="text-xs text-[#687380] mt-0.5">
                Modifica el profesional a cargo, el procedimiento y ajusta los bloques de horario continuos en la agenda.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Columna Izquierda: Información del Paciente y Datos del Tratamiento */}
            <div className="lg:col-span-6 space-y-6">
              {/* Datos del Paciente (Solo Lectura) */}
              <div className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-5 space-y-4">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-[#D4AF37] tracking-wider">
                  <UserIcon size={14} color="#D4AF37" />
                  <h3>Paciente Programado</h3>
                </div>

                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-[#111827] text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                    {getInitials(appointment.nombrePaciente)}
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-[#1E242B]">{appointment.nombrePaciente}</h4>
                    <span className="text-xs text-[#687380]">Doc: {appointment.documentoIdentidad}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#E2E6EA] text-xs">
                  <div>
                    <span className="text-[11px] font-bold text-[#8F99A3] block">Teléfono</span>
                    <span className="font-semibold text-[#1E242B]">{appointment.telefono}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-[#8F99A3] block">Correo</span>
                    <span className="font-semibold text-[#1E242B]">{appointment.correo}</span>
                  </div>
                </div>
              </div>

              {/* Formulario de Modificación */}
              <div className="rounded-2xl border border-[#E2E6EA] bg-white p-5 space-y-4">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-[#D4AF37] tracking-wider">
                  <span>🩺</span>
                  <h3>Asignación Clínica</h3>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#1E242B]">Profesional Odontológico Encargado</label>
                  <select
                    value={editDoctorId}
                    onChange={(e) => setEditDoctorId(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#E2E6EA] p-2.5 text-xs text-[#1E242B] font-semibold bg-white focus:border-[#D4AF37] focus:outline-none cursor-pointer"
                  >
                    {doctorsList.map((doc) => (
                      <option key={doc.idUsuario} value={doc.idUsuario}>
                        {doc.nombreCompleto} {doc.especialidad ? `(${doc.especialidad})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#1E242B]">Procedimiento / Título de la Cita</label>
                  <input
                    type="text"
                    value={editTitulo}
                    onChange={(e) => setEditTitulo(e.target.value)}
                    placeholder="Ej. Valoración para Implante Dental"
                    className="w-full rounded-xl border border-[#E2E6EA] p-2.5 text-xs text-[#1E242B] font-semibold focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#1E242B]">Observaciones / Plan de Tratamiento</label>
                  <textarea
                    rows={4}
                    value={editDescripcion}
                    onChange={(e) => setEditDescripcion(e.target.value)}
                    placeholder="Detalles clínicos o instrucciones específicas para esta cita..."
                    className="w-full rounded-xl border border-[#E2E6EA] p-3 text-xs text-[#1E242B] focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Columna Derecha: Selector de Bloques Horarios Continuos */}
            <div className="lg:col-span-6 space-y-4">
              <div className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E6EA]">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-[#D4AF37] tracking-wider">
                    <ClockIcon size={14} color="#D4AF37" />
                    <h3>Bloques Horarios Disponibles</h3>
                  </div>
                  <span className="text-xs font-bold text-[#1E242B]">
                    {formatSpanishHeaderDate(appointment.fecha)}
                  </span>
                </div>

                <p className="text-xs text-[#687380] leading-relaxed">
                  Selecciona uno o más bloques contiguos (30 min c/u). Los bloques marcados en amarillo corresponden al horario de esta cita.
                </p>

                {isLoadingEditSlots ? (
                  <div className="py-12 text-center text-xs text-[#8F99A3]">
                    Consultando disponibilidad de bloques en la base de datos...
                  </div>
                ) : editDaySlots.length === 0 ? (
                  <div className="py-8 text-center rounded-xl border border-dashed border-[#E2E6EA] text-xs text-[#8F99A3]">
                    No hay bloques de horario generados en base de datos para esta fecha.
                  </div>
                ) : (
                  <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
                    {editDaySlots.map((slot) => {
                      const isSelected = editSelectedBlocks.includes(slot.inicio);
                      const isOccupied = slot.isOccupiedByOther;

                      return (
                        <div
                          key={slot.inicio}
                          onClick={() => handleToggleEditBlock(slot)}
                          className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all ${
                            isOccupied
                              ? 'border-[#E2E6EA] bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed opacity-75'
                              : isSelected
                              ? 'border-[#D4AF37] bg-[#FFFBEB] text-[#92400E] font-bold shadow-xs cursor-pointer'
                              : 'border-[#E2E6EA] bg-white text-[#1E242B] hover:bg-[#F8F9FA] cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isOccupied}
                              onChange={() => {}}
                              className="h-4 w-4 rounded accent-[#D4AF37] cursor-pointer"
                            />
                            <span className="font-semibold">{slot.label}</span>
                          </div>

                          <div>
                            {isOccupied ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEE2E2] text-[#DC2626]">
                                🔒 Ocupado ({slot.occupantName || 'Dr. Asignado'})
                              </span>
                            ) : isSelected ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#D4AF37] text-white">
                                ✓ Asignado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#059669]">
                                Disponible
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-3 border-t border-[#E2E6EA] flex items-center justify-between text-xs font-bold">
                  <span className="text-[#687380]">Duración seleccionada:</span>
                  <span className="px-3 py-1 rounded-full bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">
                    {editSelectedBlocks.length * 30} minutos ({editSelectedBlocks.length} bloque{editSelectedBlocks.length !== 1 ? 's' : ''})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Barra de Acciones de Edición */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E2E6EA]">
            <button
              type="button"
              disabled={isSavingEdit}
              onClick={() => setIsEditing(false)}
              className="px-5 py-2.5 rounded-xl border border-[#E2E6EA] text-xs font-bold text-[#687380] hover:bg-[#F3F4F6] cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={isSavingEdit || editSelectedBlocks.length === 0}
              onClick={handleSaveEdit}
              className="px-6 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C29E2F] text-black text-xs font-extrabold flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSavingEdit ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-black" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Guardando cambios...</span>
                </>
              ) : (
                <>
                  <span>✓</span>
                  <span>Guardar Cambios de la Cita</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // VISTA NORMAL: DETALLE DE CITA
  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 animate-fadeIn">
      <AlertModalComponent />

      {/* Botón Volver a la Agenda */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#687380] hover:text-[#1E242B] transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver a la Agenda
        </button>
      </div>

      {/* Tarjeta Principal de la Cita */}
      <div className="rounded-3xl border border-[#E2E6EA] border-l-6 border-l-[#D4AF37] bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] text-[#D4AF37] flex items-center justify-center shrink-0">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#1E242B]">
                  {appointment.titulo || 'Valoración Odontológica'}
                </h1>

                {/* Badge dinámico según estado */}
                {appointment.estado === 'Confirmada' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Confirmada
                  </span>
                )}
                {appointment.estado === 'En consulta' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#111827] text-white border border-[#111827]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]"></span>
                    En consulta
                  </span>
                )}
                {appointment.estado === 'En espera' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]">
                    <span>⏳</span> En espera
                  </span>
                )}
                {appointment.estado === 'Completada' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                    <span>✓</span> Completada
                  </span>
                )}
                {appointment.estado === 'No asistió' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5]">
                    <span>✕</span> No asistió
                  </span>
                )}
                {appointment.estado === 'Cancelada' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-[#F3F4F6] text-[#687380] border border-[#E5E7EB]">
                    <span>✕</span> Cancelada
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1.5 text-xs text-[#687380] font-medium">
                <ClockIcon size={14} color="#D4AF37" />
                <span>
                  {formatSpanishHeaderDate(appointment.fecha)} • {appointment.horaInicio} - {appointment.horaFin} hrs ({appointment.sillon || 'Gabinete 02'})
                </span>
              </div>

              <p className="mt-3 text-xs sm:text-sm text-[#4B5563] leading-relaxed max-w-3xl">
                {appointment.descripcion || 'Valoración clínica y diagnóstico general odontológico.'}
              </p>

              <div className="mt-4 flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-full bg-[#111827] text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {getInitials(appointment.doctorNombre)}
                </div>
                <span className="text-xs text-[#687380]">
                  Doctor encargado: <strong className="text-[#1E242B]">{appointment.doctorNombre}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Botones de Acción Inteligentes según Estado (SOLID) */}
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5 lg:self-start shrink-0">
            {appointment.estado === 'Confirmada' && (
              <>
                <button
                  type="button"
                  onClick={() => onStartAttention?.(appointment.idCita, appointment.idPaciente)}
                  className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#C29E2F] text-black text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <span>▶</span> Iniciar Cita
                </button>

                <button
                  type="button"
                  onClick={handleOpenEditMode}
                  className="px-3 py-2 rounded-xl border border-[#E2E6EA] bg-white text-[#1E242B] hover:bg-[#F3F4F6] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>✏</span> Editar Cita
                </button>

                <button
                  type="button"
                  onClick={() => setIsNoShowModalOpen(true)}
                  className="px-3 py-2 rounded-xl border border-[#E2E6EA] bg-white text-[#1E242B] hover:bg-[#F3F4F6] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-[#DC2626]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Marcar Inasistencia
                </button>

                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(true)}
                  className="px-3 py-2 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>✕</span> Cancelar Cita
                </button>
              </>
            )}

            {appointment.estado === 'En consulta' && (
              <button
                type="button"
                onClick={() => onStartAttention?.(appointment.idCita, appointment.idPaciente)}
                className="px-4 py-2 rounded-xl bg-[#111827] hover:bg-black text-[#D4AF37] text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <span>⚡</span> Continuar en Espacio Clínico
              </button>
            )}

            {appointment.estado === 'No asistió' && (
              <div className="px-3 py-1.5 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[11px] font-bold text-[#DC2626] flex items-center gap-1.5">
                <span>⚠️</span> Inasistencia registrada (Bloques conservados)
              </div>
            )}

            {appointment.estado === 'Cancelada' && (
              <div className="px-3 py-1.5 rounded-xl bg-[#F3F4F6] border border-[#E5E7EB] text-[11px] font-bold text-[#687380] flex items-center gap-1.5">
                <span>🚫</span> Cita cancelada (Bloques liberados)
              </div>
            )}

            {appointment.estado === 'Completada' && (
              <div className="px-3 py-1.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[11px] font-bold text-[#059669] flex items-center gap-1.5">
                <span>✓</span> Atención finalizada
              </div>
            )}
          </div>
        </div>
      </div>

      {/* INFORMACIÓN DEL PACIENTE */}
      <div className="rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-[#D4AF37] tracking-wider">
          <span>📋</span>
          <h3>Información del Paciente</h3>
        </div>

        <div className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-[#111827] text-white font-extrabold text-sm flex items-center justify-center shrink-0">
              {getInitials(appointment.nombrePaciente)}
            </div>
            <div>
              <span className="block text-[11px] font-bold text-[#8F99A3]">Nombre del Paciente</span>
              <button
                type="button"
                onClick={() => onNavigateToPatientProfile?.(appointment.idPaciente)}
                className="text-base font-extrabold text-[#1E242B] hover:text-[#D4AF37] hover:underline cursor-pointer transition-colors text-left flex items-center gap-1.5 group"
                title="Haga click para ver la información y ficha médica completa de este paciente"
              >
                <span>{appointment.nombrePaciente}</span>
                <span className="text-xs text-[#D4AF37] font-bold group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 text-xs">
            <div>
              <span className="block text-[11px] font-bold text-[#8F99A3] flex items-center gap-1.5">
                <PhoneIcon size={12} color="#D4AF37" /> Teléfono
              </span>
              <span className="font-extrabold text-[#1E242B]">{appointment.telefono}</span>
            </div>
            <div>
              <span className="block text-[11px] font-bold text-[#8F99A3] flex items-center gap-1.5">
                <span className="text-[#D4AF37]">✉</span> Correo Electrónico
              </span>
              <span className="font-extrabold text-[#1E242B]">{appointment.correo}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Historias Clínicas Traídas de la Base de Datos */}
      <div className="rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E6EA]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#111111] flex items-center justify-center shrink-0">
              <ClipboardIcon size={18} color="#D4AF37" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-[#1E242B]">Historias Clínicas</h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF3C7] text-[#92400E]">
                {clinicalHistories.length} historia{clinicalHistories.length !== 1 ? 's clínicas' : ' clínica'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToPatientProfile?.(appointment.idPaciente)}
            className="text-xs font-bold text-[#687380] hover:text-[#1E242B] flex items-center gap-1 cursor-pointer"
          >
            Ver antecedentes ⌃
          </button>
        </div>

        {isLoadingHistories ? (
          <div className="py-6 text-center text-xs text-[#8F99A3]">
            Consultando historias clínicas desde la base de datos...
          </div>
        ) : clinicalHistories.length === 0 ? (
          <div className="py-6 text-center rounded-2xl border border-dashed border-[#E2E6EA] text-xs text-[#8F99A3]">
            No hay historias clínicas ni evoluciones previas registradas para este paciente en la base de datos.
          </div>
        ) : (
          <div className="divide-y divide-[#E2E6EA]">
            {clinicalHistories.map((h, i) => (
              <div key={i} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                <div>
                  <span className="font-bold text-[#1E242B]">{h.title}</span>
                  {h.doctor && <span className="block text-[11px] text-[#687380] mt-0.5">{h.doctor}</span>}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-[#687380] font-medium">{h.fecha}</span>
                  <button
                    type="button"
                    onClick={() => onNavigateToPatientProfile?.(appointment.idPaciente)}
                    className="font-bold text-[#D4AF37] hover:text-[#B8942A] cursor-pointer"
                  >
                    Consultar →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Consentimientos Informados Traídos de la Base de Datos */}
      <div className="rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-[#E2E6EA]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#111827] text-white flex items-center justify-center shrink-0">
              📋
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-[#1E242B]">Consentimientos Informados</h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F3F4F6] text-[#4B5563]">
                {consentItems.length} documento{consentItems.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsConsentModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-[#D4AF37] hover:bg-[#C29E2F] text-black text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>+</span> Adjuntar consentimiento
            </button>
            <span className="text-xs text-[#687380] font-bold">Ver documentos ⌃</span>
          </div>
        </div>

        {isLoadingConsents ? (
          <div className="py-6 text-center text-xs text-[#8F99A3]">
            Consultando consentimientos desde la base de datos...
          </div>
        ) : consentItems.length === 0 ? (
          <div className="py-6 text-center rounded-2xl border border-dashed border-[#E2E6EA] text-xs text-[#8F99A3]">
            No hay consentimientos informados registrados para este paciente en la base de datos.
          </div>
        ) : (
          <div className="divide-y divide-[#E2E6EA]">
            {consentItems.map((c, i) => (
              <div
                key={c.id_consentimiento || c.id || i}
                className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <h4 className="font-bold text-[#1E242B]">
                    {c.nombre_plantilla || c.nombre_documento || c.title || 'Consentimiento Odontológico'}
                  </h4>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F3F4F6] text-[#687380] text-[11px] font-semibold">
                      ⚪ {c.firmado ? 'Firmado' : 'Sin firmar'}
                    </span>
                    {c.fecha_creacion && (
                      <span className="text-[11px] text-[#8F99A3]">{String(c.fecha_creacion).split('T')[0]}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!c.firmado && (
                    <button
                      type="button"
                      onClick={() => onSignConsent?.(c.id_consentimiento || c.id)}
                      className="px-3 py-1.5 rounded-xl border border-[#E2E6EA] text-[#1E242B] hover:bg-[#F3F4F6] font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <span>✏</span> Firmar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigateToPatientProfile?.(appointment.idPaciente)}
                    className="font-bold text-[#D4AF37] hover:text-[#B8942A] pl-2 cursor-pointer"
                  >
                    Consultar →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL 1: CONFIRMAR INASISTENCIA (Imagen 1) */}
      {isNoShowModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl border border-[#E2E6EA] bg-white p-6 sm:p-8 shadow-xl space-y-5">
            {/* Header del Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E6EA]">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0 border border-red-100">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 8l4 4m0-4l-4 4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-[#1E242B]">Confirmar Inasistencia</h3>
                  <p className="text-xs text-[#8F99A3]">Registro de no presentación del paciente a consulta</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNoShowModalOpen(false)}
                className="text-[#8F99A3] hover:text-[#1E242B] cursor-pointer text-base p-1"
              >
                ✕
              </button>
            </div>

            {/* Cuadro de Detalles */}
            <div className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-4 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[#8F99A3]">Paciente:</span>
                <span className="font-extrabold text-[#1E242B]">{appointment.nombrePaciente}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#8F99A3]">Cita:</span>
                <span className="font-bold text-[#1E242B]">{appointment.titulo}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#8F99A3]">Fecha y hora:</span>
                <span className="font-bold text-[#B45309]">
                  {formatSpanishHeaderDate(appointment.fecha)} • {appointment.horaInicio} - {appointment.horaFin} hrs
                </span>
              </div>
            </div>

            {/* Opciones de Inasistencia (Imagen 1) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#4B5563]">
                Motivo de la inasistencia (opcional):
              </label>

              <div className="space-y-2">
                {[
                  'El paciente no llego ni informo',
                  'El paciente informo que no podia asistir',
                  'Otro',
                ].map((opt) => (
                  <label
                    key={opt}
                    onClick={() => setNoShowReasonOption(opt)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      noShowReasonOption === opt
                        ? 'border-[#D4AF37] bg-[#FFFBEB]/40 text-[#1E242B]'
                        : 'border-[#E2E6EA] bg-white text-[#4B5563] hover:bg-[#F9FAFB]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        noShowReasonOption === opt
                          ? 'border-[#D4AF37] bg-white'
                          : 'border-[#D1D5DB]'
                      }`}
                    >
                      {noShowReasonOption === opt && (
                        <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                      )}
                    </div>
                    <span className="text-xs font-medium">{opt}</span>
                  </label>
                ))}
              </div>

              <textarea
                rows={3}
                placeholder="Especificar motivo de la inasistencia..."
                value={noShowCustomText}
                onChange={(e) => setNoShowCustomText(e.target.value)}
                className="w-full rounded-2xl border border-[#E2E6EA] p-3 text-xs text-[#1E242B] focus:border-[#D4AF37] focus:outline-none mt-2"
              />
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E6EA]">
              <button
                type="button"
                onClick={() => setIsNoShowModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#E2E6EA] text-xs font-bold text-[#687380] hover:bg-[#F3F4F6] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmNoShow}
                className="px-5 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>✓</span> Confirmar Inasistencia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CANCELAR CITA (Imagen 2) */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl border border-[#E2E6EA] border-t-4 border-t-[#D4AF37] bg-white p-6 sm:p-8 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E6EA]">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0 border border-red-100">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10 14l4 4m0-4l-4 4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#1E242B]">Cancelar Cita</h3>
                  <p className="text-xs text-[#8F99A3]">Registro de anulación y liberación de horario en agenda</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="text-[#8F99A3] hover:text-[#1E242B] cursor-pointer text-base p-1"
              >
                ✕
              </button>
            </div>

            <div className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-4 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[#8F99A3]">Paciente:</span>
                <span className="font-extrabold text-[#1E242B]">{appointment.nombrePaciente}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#8F99A3]">Cita:</span>
                <span className="font-bold text-[#1E242B]">{appointment.titulo}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#8F99A3]">Fecha y hora:</span>
                <span className="font-bold text-[#B45309]">
                  {formatSpanishHeaderDate(appointment.fecha)} • {appointment.horaInicio} - {appointment.horaFin} hrs
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase text-[#1E242B] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileTextIcon size={14} color="#D4AF37" /> MOTIVO DE CANCELACIÓN
                </span>
                <span className="text-[#DC2626] font-bold">* OBLIGATORIO</span>
              </label>

              <div className="flex flex-wrap gap-2">
                {['Inconveniente paciente', 'Reprogramación', 'Disponibilidad médica'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setCancelReasonTag(tag)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      cancelReasonTag === tag
                        ? 'border-[#D4AF37] bg-[#FFFBEB] text-[#92400E]'
                        : 'border-[#E2E6EA] bg-white text-[#687380] hover:bg-[#F3F4F6]'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                placeholder="Describe detalladamente el motivo de la cancelación de la cita..."
                value={cancelReasonText}
                onChange={(e) => setCancelReasonText(e.target.value)}
                className="w-full rounded-2xl border border-[#E2E6EA] p-3 text-xs text-[#1E242B] focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E6EA]">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#E2E6EA] text-xs font-bold text-[#687380] hover:bg-[#F3F4F6] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="px-5 py-2.5 rounded-xl bg-[#DC2626] text-white text-xs font-extrabold hover:bg-[#B91C1C] flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>✓</span> Confirmar cancelación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADJUNTAR CONSENTIMIENTOS */}
      {isConsentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl border border-[#E2E6EA] bg-white p-6 sm:p-8 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E6EA]">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-[#111111] flex items-center justify-center">
                  <FileTextIcon size={18} color="#D4AF37" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#1E242B]">Adjuntar Consentimientos Informados</h3>
                  <p className="text-xs text-[#8F99A3]">Selecciona plantillas registradas en base de datos para asociarlas a esta cita.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConsentModalOpen(false)}
                className="text-[#8F99A3] hover:text-[#1E242B] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-[#687380]">
              <span>Plantillas disponibles en el sistema:</span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E]">
                {selectedConsents.length} seleccionados
              </span>
            </div>

            {availableTemplates.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#8F99A3]">
                No hay plantillas de consentimientos configuradas en el sistema.
              </p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {availableTemplates.map((t) => {
                  const id = t.id_consentimiento || t.id_plantilla || t.id;
                  const isSelected = selectedConsents.includes(id);
                  return (
                    <div
                      key={id}
                      onClick={() => {
                        setSelectedConsents((prev) =>
                          isSelected ? prev.filter((item) => item !== id) : [...prev, id]
                        );
                      }}
                      className={`rounded-2xl border p-4 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#D4AF37] bg-[#FFFBEB]/40'
                          : 'border-[#E2E6EA] bg-white hover:bg-[#F8F9FA]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-1 h-4 w-4 rounded accent-[#D4AF37]"
                        />
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-extrabold text-[#1E242B]">{t.titulo || t.nombre}</h4>
                            <span className="text-[10px] text-[#8F99A3]">Activo</span>
                          </div>
                          <p className="text-[11px] text-[#687380] line-clamp-1">{t.descripcion || 'Plantilla oficial OdontoLeal'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E6EA]">
              <button
                type="button"
                onClick={() => setIsConsentModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#E2E6EA] text-xs font-bold text-[#687380] hover:bg-[#F3F4F6] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  showAlert({
                    title: 'Consentimientos Asociados',
                    message: `Se han seleccionado ${selectedConsents.length} plantillas para asociar a la atención médica.`,
                    type: 'success',
                  });
                  setIsConsentModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black text-xs font-extrabold hover:bg-[#C29E2F] flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>✓</span> Adjuntar seleccionados ({selectedConsents.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
