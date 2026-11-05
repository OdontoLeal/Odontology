// src/modules/appointments/ui/views/AppointmentDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { DetailPageContainer } from '../../../../shared/ui/components/DetailPage';
import { formatDateTimeCO, formatLongDateCO } from '../../../../shared/ui/format';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';
import { DoctorOption } from '../components/ServiceSelector';
import { AppointmentDetailHeader } from '../components/detail/AppointmentDetailHeader';
import { AppointmentPatientCard } from '../components/detail/AppointmentPatientCard';
import { AppointmentHistoryCard, HistoryItem } from '../components/detail/AppointmentHistoryCard';
import { AppointmentConsentsCard, ConsentItem } from '../components/detail/AppointmentConsentsCard';
import { AppointmentNoShowModal } from '../components/detail/AppointmentNoShowModal';
import { AppointmentCancelModal } from '../components/detail/AppointmentCancelModal';
import { AppointmentAttachConsentModal, ConsentTemplateItem } from '../components/detail/AppointmentAttachConsentModal';
import { AppointmentEditView, EditDaySlotItem } from '../components/detail/AppointmentEditView';

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
  doctorFirma?: string | null;
  idDoctor: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  sillon?: string;
  agendadoPor?: string;
  estado:
    | 'Confirmada'
    | 'En consulta'
    | 'Atendida'
    | 'Cancelada'
    | 'Inasistencia';
}

export interface AppointmentDetailPageProps {
  appointment: AppointmentDetailPageData;
  doctors?: DoctorOption[];
  onBack: () => void;
  onNavigateToPatientProfile?: (idPaciente: number) => void;
  canStartAttention?: boolean;
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

export const AppointmentDetailPage: React.FC<AppointmentDetailPageProps> = ({
  appointment: initialAppointment,
  doctors = [],
  onBack,
  onNavigateToPatientProfile,
  canStartAttention = true,
  onStartAttention,
  onMarkNoShow,
  onCancelAppointment,
  onUpdateAppointment,
  onSignConsent,
}) => {
  const [appointment, setAppointment] = useState<AppointmentDetailPageData>(initialAppointment);
  const isAttended = appointment.estado === 'Atendida';

  // Modales
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isNoShowModalOpen, setIsNoShowModalOpen] = useState(false);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);

  // Modo edición
  const [isEditing, setIsEditing] = useState(false);
  const [editDoctorId, setEditDoctorId] = useState<number>(initialAppointment.idDoctor);
  const [editTitulo, setEditTitulo] = useState<string>(initialAppointment.titulo);
  const [editDescripcion, setEditDescripcion] = useState<string>(initialAppointment.descripcion || '');
  const [editSelectedBlocks, setEditSelectedBlocks] = useState<string[]>([]);
  const [editDaySlots, setEditDaySlots] = useState<EditDaySlotItem[]>([]);
  const [isLoadingEditSlots, setIsLoadingEditSlots] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Catálogos y datos DB
  const [doctorsList, setDoctorsList] = useState<DoctorOption[]>(doctors);
  const [clinicalHistories, setClinicalHistories] = useState<HistoryItem[]>([]);
  const [isLoadingHistories, setIsLoadingHistories] = useState(false);
  const [consentItems, setConsentItems] = useState<ConsentItem[]>([]);
  const [isLoadingConsents, setIsLoadingConsents] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<ConsentTemplateItem[]>([]);

  const { showAlert, AlertModalComponent } = useAlertModal();

  useEffect(() => {
    setAppointment(initialAppointment);
  }, [initialAppointment]);

  // Cargar doctores si no fueron proporcionados
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
        if (candidates.length > 0) setDoctorsList(candidates);
      })
      .catch(() => {});
  }, [doctors]);

  // Formateador de fecha en español
  // RQNF-USA-002: "Lunes, 09/11/2026"
  const formatSpanishHeaderDate = (dateStr: string) =>
    dateStr ? formatLongDateCO(dateStr) : 'Fecha por confirmar';

  const getInitials = (name: string) => {
    if (!name) return 'P';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Cargar historial clínico (solo si no está atendida)
  useEffect(() => {
    if (isAttended || !appointment.idPaciente) return;
    setIsLoadingHistories(true);
    fetch(`/api/v1/clinical-records/patient/${appointment.idPaciente}`)
      .then((res) => (res.ok ? res.json() : { data: {} }))
      .then((json) => {
        const hist: any[] = json.data?.historial || [];
        const formatted: HistoryItem[] = hist.map((item: any, idx: number) => {
          const dateStr = item.fechaHoraRegistro
            ? formatDateTimeCO(item.fechaHoraRegistro)
            : 'Fecha no registrada';
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
        console.error('Error cargando historial clínico:', err);
        setClinicalHistories([]);
      })
      .finally(() => setIsLoadingHistories(false));
  }, [appointment.idPaciente, appointment.doctorNombre, isAttended]);

  // Cargar consentimientos del paciente y plantillas (solo si no está atendida)
  useEffect(() => {
    if (isAttended || !appointment.idPaciente) return;
    setIsLoadingConsents(true);
    fetch(`/api/v1/consents/patient/${appointment.idPaciente}`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => setConsentItems(json.data || []))
      .catch(() => setConsentItems([]))
      .finally(() => setIsLoadingConsents(false));

    fetch('/api/v1/consents/templates')
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => setAvailableTemplates(json.data || []))
      .catch(() => setAvailableTemplates([]));
  }, [appointment.idPaciente, isAttended]);

  // Modo edición: cargar bloques
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
          return {
            inicio: cleanInicio,
            final: cleanFinal,
            timeStart,
            timeEnd,
            label: `${timeStart} – ${timeEnd}`,
            isAssignedToThisAppt,
            isOccupiedByOther: Boolean(occupant) || (s.ocupacion === true && !isAssignedToThisAppt),
            occupantName: occupant,
          };
        });

        setEditDaySlots(formatted);
        if (thisApptBlocks.length > 0) {
          setEditSelectedBlocks(thisApptBlocks.sort());
        } else {
          const matchedSlot = formatted.find((s) => s.timeStart === appointment.horaInicio.trim());
          if (matchedSlot && !matchedSlot.isOccupiedByOther) {
            setEditSelectedBlocks([matchedSlot.inicio]);
          }
        }
      })
      .finally(() => setIsLoadingEditSlots(false));
  };

  const handleToggleEditBlock = (slot: EditDaySlotItem) => {
    if (slot.isOccupiedByOther) return;
    setEditSelectedBlocks((prev) =>
      prev.includes(slot.inicio)
        ? prev.length === 1 ? prev : prev.filter((b) => b !== slot.inicio).sort()
        : [...prev, slot.inicio].sort()
    );
  };

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
            motivo: 'Modificación de cita desde el panel de detalle',
          }),
        });
        if (!res.ok) throw new Error('Error al actualizar la cita');
      }

      const sorted = [...editSelectedBlocks].sort();
      const firstStart = sorted[0].split(' ')[1]?.slice(0, 5) || appointment.horaInicio;
      const endD = new Date(new Date(sorted[sorted.length - 1]).getTime() + 30 * 60 * 1000);
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
        message: 'Se han guardado las modificaciones en la base de datos.',
        type: 'success',
      });
      setIsEditing(false);
    } catch (err: any) {
      showAlert({
        title: 'Error al actualizar cita',
        message: err.message || 'No fue posible guardar los cambios.',
        type: 'error',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmNoShow = async (fullReason: string) => {
    try {
      if (onMarkNoShow) {
        await onMarkNoShow(appointment.idCita, fullReason);
      } else {
        await fetch(`/api/v1/appointments/${appointment.idCita}/state`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nuevoEstado: 'Inasistencia',
            motivo: fullReason,
            liberarBloques: false,
          }),
        });
      }
      setAppointment((prev) => ({ ...prev, estado: 'Inasistencia' }));
      showAlert({
        title: 'Inasistencia Registrada',
        message: 'Se ha registrado la inasistencia conforme a RF-AGE-012. Los bloques horarios se mantienen.',
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

  const handleConfirmCancel = async (fullReason: string) => {
    try {
      if (onCancelAppointment) {
        await onCancelAppointment(appointment.idCita, fullReason);
      } else {
        await fetch(`/api/v1/appointments/${appointment.idCita}/state`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nuevoEstado: 'Cancelada',
            motivo: fullReason,
            liberarBloques: true,
          }),
        });
      }
      setAppointment((prev) => ({ ...prev, estado: 'Cancelada' }));
      showAlert({
        title: 'Cita Cancelada',
        message: 'La cita médica ha sido cancelada y los bloques de horario han quedado liberados.',
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

  if (isEditing) {
    return (
      <>
        <AlertModalComponent />
        <AppointmentEditView
          appointment={appointment}
          doctorsList={doctorsList}
          editDoctorId={editDoctorId}
          editTitulo={editTitulo}
          editDescripcion={editDescripcion}
          editSelectedBlocks={editSelectedBlocks}
          editDaySlots={editDaySlots}
          isLoadingEditSlots={isLoadingEditSlots}
          isSavingEdit={isSavingEdit}
          formatSpanishHeaderDate={formatSpanishHeaderDate}
          getInitials={getInitials}
          onCancel={() => setIsEditing(false)}
          onDoctorChange={setEditDoctorId}
          onTituloChange={setEditTitulo}
          onDescripcionChange={setEditDescripcion}
          onToggleBlock={handleToggleEditBlock}
          onSave={handleSaveEdit}
        />
      </>
    );
  }

  return (
    <DetailPageContainer className="space-y-6">
      <AlertModalComponent />

      <AppointmentDetailHeader
        appointment={appointment}
        canStartAttention={canStartAttention}
        formatSpanishHeaderDate={formatSpanishHeaderDate}
        getInitials={getInitials}
        onBack={onBack}
        onStartAttention={onStartAttention}
        onOpenEditMode={handleOpenEditMode}
        onOpenNoShowModal={() => setIsNoShowModalOpen(true)}
        onOpenCancelModal={() => setIsCancelModalOpen(true)}
      />

      <AppointmentPatientCard
        appointment={appointment}
        getInitials={getInitials}
        onNavigateToPatientProfile={onNavigateToPatientProfile}
      />

      {/* En citas atendidas solo se muestra información del paciente y detalle de la cita (retira historias clínicas y consentimientos) */}
      {!isAttended && (
        <>
          <AppointmentHistoryCard
            idPaciente={appointment.idPaciente}
            clinicalHistories={clinicalHistories}
            isLoadingHistories={isLoadingHistories}
            onNavigateToPatientProfile={onNavigateToPatientProfile}
          />

          <AppointmentConsentsCard
            idPaciente={appointment.idPaciente}
            consentItems={consentItems}
            isLoadingConsents={isLoadingConsents}
            onOpenAttachModal={() => setIsConsentModalOpen(true)}
            onSignConsent={onSignConsent}
            onNavigateToPatientProfile={onNavigateToPatientProfile}
          />
        </>
      )}

      <AppointmentNoShowModal
        isOpen={isNoShowModalOpen}
        appointment={appointment}
        formatSpanishHeaderDate={formatSpanishHeaderDate}
        onClose={() => setIsNoShowModalOpen(false)}
        onConfirm={handleConfirmNoShow}
      />

      <AppointmentCancelModal
        isOpen={isCancelModalOpen}
        appointment={appointment}
        formatSpanishHeaderDate={formatSpanishHeaderDate}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleConfirmCancel}
      />

      <AppointmentAttachConsentModal
        isOpen={isConsentModalOpen}
        availableTemplates={availableTemplates}
        onClose={() => setIsConsentModalOpen(false)}
        onAttach={(ids) => {
          showAlert({
            title: 'Consentimientos Asociados',
            message: `Se han seleccionado ${ids.length} plantillas para asociar a la atención médica.`,
            type: 'success',
          });
        }}
      />
    </DetailPageContainer>
  );
};
