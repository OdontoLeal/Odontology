// src/modules/patients/ui/views/PatientProfilePage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { PatientListItem } from '../hooks/usePatients';
import { PatientForm, PatientFormData } from '../components/PatientForm';
import { Modal } from '../../../../shared/ui/components/Modal';
import { useClinicalRecord, ClinicalEvolutionEntry } from '../../../clinical-records/ui/hooks/useClinicalRecord';
import { EvolutionDetailModal } from '../../../clinical-records/ui/components/EvolutionDetailModal';
import { printCompleteClinicalHistory } from '../../../clinical-records/application/print-clinical-history.service';
import { useConsents } from '../../../consents/ui/hooks/useConsents';
import { QuickScheduleModal, DoctorCandidate } from '../../../appointments/ui/components/QuickScheduleModal';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';
import {
  CalendarIcon,
  ClipboardIcon,
  FileTextIcon,
  PrinterIcon,
  UserIcon,
} from '../../../../shared/ui/components/Icons';
import {
  DetailAction,
  DetailPageContainer,
  DetailPageHeader,
  EmptyState,
  PatientSummaryBanner,
  SectionAction,
  SectionCard,
  StatusBadge,
  StatusTone,
} from '../../../../shared/ui/components/DetailPage';
import { formatDateCO, formatTimeCO } from '../../../../shared/ui/format';

export interface PatientProfilePageProps {
  patient: PatientListItem;
  initialTab?: 'APPOINTMENTS' | 'CLINICAL' | 'CONSENTS' | 'DOCUMENTS';
  onBack: () => void;
  onScheduleAppointment: (patient: PatientListItem) => void;
  onOpenConsultation: (patient: PatientListItem, idCita?: number, estadoCita?: string) => void;
  onViewClinicalHistoryDetail: (idHistoria: number) => void;
  onSignConsent: (templateOrId: any) => void;
  onUpdatePatient: (id: number, data: PatientFormData) => Promise<void> | void;
  canScheduleAppointment?: boolean;
  canStartAttention?: boolean;
  canAssistConsultation?: boolean;
  canViewClinicalHistory?: boolean;
}

interface PatientAppointment {
  idCita: number;
  titulo: string;
  descripcion?: string | null;
  estado: string;
  idProfesional: number;
  nombreProfesional: string;
  bloques: string[];
  agendadoPor?: string;
}

export const PatientProfilePage: React.FC<PatientProfilePageProps> = ({
  patient,
  onBack,
  onScheduleAppointment: _onScheduleAppointment,
  onOpenConsultation,
  onViewClinicalHistoryDetail,
  onSignConsent,
  onUpdatePatient,
  canScheduleAppointment = true,
  canStartAttention = true,
  canAssistConsultation,
  canViewClinicalHistory = true,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEvolutionForView, setSelectedEvolutionForView] = useState<ClinicalEvolutionEntry | null>(null);
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [isAppointmentsLoading, setIsAppointmentsLoading] = useState(false);
  const { showAlert, AlertModalComponent } = useAlertModal();
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);
  const [doctors, setDoctors] = useState<DoctorCandidate[]>([]);

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
      .catch(() => {});
  }, []);

  // DEF-17 & CPS-HCL-004-02: Detectar si el usuario activo es Coordinadora (ROL-COA)
  const isCoordinator = React.useMemo(() => {
    try {
      const saved = window.sessionStorage.getItem('odontoleal_active_session_v1');
      if (!saved) return false;
      const parsed = JSON.parse(saved);
      const roles: any[] = parsed?.usuario?.roles || [];
      const roleCodes = roles.map((r) => (typeof r === 'string' ? r : r.codigoRol || r.nombreRol));
      const hasClinicalRole = roleCodes.some((rc) => ['ROL-ODO', 'ROL-ESP', 'ROL-ADM'].includes(rc));
      return roleCodes.includes('ROL-COA') && !hasClinicalRole;
    } catch {
      return false;
    }
  }, []);

  // Historias clínicas reales (solo roles con RF-HCL-008 consultan historial completo)
  const canReadFullHistory = canViewClinicalHistory && !isCoordinator;
  const { history, isLoading: isHistoryLoading } = useClinicalRecord(
    patient.idPaciente,
    '/api/v1',
    undefined,
    { enabled: canReadFullHistory }
  );

  // Consentimientos reales
  const { patientConsents, templates, fetchPatientConsents, downloadConsentPdf, isLoading: isConsentsLoading } = useConsents();

  // Cargar citas reales del paciente
  const fetchPatientAppointments = useCallback(async () => {
    setIsAppointmentsLoading(true);
    try {
      const res = await fetch(`/api/v1/appointments/agenda?idPaciente=${patient.idPaciente}`);
      if (res.ok) {
        const json = await res.json();
        setAppointments(json.data || []);
      }
    } catch (err) {
      console.error('Error fetching patient appointments:', err);
    } finally {
      setIsAppointmentsLoading(false);
    }
  }, [patient.idPaciente]);

  useEffect(() => {
    fetchPatientAppointments();
    if (!isCoordinator) {
      fetchPatientConsents(patient.idPaciente);
    }
  }, [fetchPatientAppointments, fetchPatientConsents, patient.idPaciente, isCoordinator]);

  // Citas próximas / activas vs pasadas
  const upcomingAppointments = appointments.filter(
    (a) => a.estado === 'Confirmada' || a.estado === 'En consulta' || a.estado === 'Solicitada'
  );
  const pastAppointments = appointments.filter(
    (a) => a.estado === 'Atendida' || a.estado === 'Cancelada' || a.estado === 'Inasistencia'
  );

  // Manejo de Agendamiento de Nueva Cita desde la ficha del paciente
  const handleConfirmSchedule = async (apptData: {
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
        throw new Error(errJson.message || 'Error al agendar la cita');
      }

      // 1. Desaparece el formulario (cerrar el modal)
      setIsScheduleModalOpen(false);

      // 2. Refrescar citas del paciente inmediatamente
      await fetchPatientAppointments();

      // 3. Aparece el modal informando la confirmación de la cita
      showAlert({
        title: '¡Cita Confirmada Exitosamente!',
        message: 'La cita ha sido registrada exitosamente en la agenda del paciente.',
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

  // Helper para formatear el bloque horario (RQNF-USA-002): "01/11/2026 · 09:30 a. m."
  const formatSlot = (bloques: string[]) => {
    if (!bloques || bloques.length === 0) return 'Horario por confirmar';
    const [date = '', time = ''] = bloques[0].split(' ');
    return `${formatDateCO(date)} · ${formatTimeCO(time.slice(0, 5))}`;
  };

  const appointmentTone = (estado: string): StatusTone =>
    estado === 'Atendida' || estado === 'Confirmada'
      ? 'success'
      : estado === 'Cancelada' || estado === 'Inasistencia'
        ? 'danger'
        : estado === 'En consulta'
          ? 'dark'
          : 'warning';

  const restrictedNotice = (title: string, text: string) => (
    <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-6 text-center">
      <p className="text-[14px] font-semibold text-[#92400E]">🔒 {title}</p>
      <p className="mt-1 text-[13px] leading-5 text-[#B45309]">{text}</p>
    </div>
  );

  return (
    <DetailPageContainer className="space-y-6">
      <DetailPageHeader
        backLabel="Volver a Pacientes"
        onBack={onBack}
        title="Ficha Médica del Paciente"
        badge={
          <>
            <StatusBadge tone="success">Expediente activo</StatusBadge>
            {patient.datosIncompletos && <StatusBadge tone="warning">Datos incompletos</StatusBadge>}
          </>
        }
        subtitle="Expediente clínico integral, historial de citas, evoluciones clínicas y consentimientos."
        actions={
          <>
            {canReadFullHistory && history.length > 0 && (
              <DetailAction
                onClick={() => printCompleteClinicalHistory({ patient, history })}
                leftIcon={<PrinterIcon size={16} />}
              >
                Imprimir historia completa
              </DetailAction>
            )}
            <DetailAction
              variant="primary"
              onClick={() => setIsEditModalOpen(true)}
              leftIcon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              }
            >
              Editar paciente
            </DetailAction>
          </>
        }
      />

      {/* Banner de identificación del paciente */}
      <SectionCard title="Información del Paciente" icon={<UserIcon />}>
        <PatientSummaryBanner
          nombre={patient.nombreCompleto}
          documento={`C.C. ${patient.documentoIdentidad}`}
          edad={patient.edad ?? null}
          fechaNacimiento={patient.fechaNacimiento ? formatDateCO(patient.fechaNacimiento) : null}
          sexo={patient.sexo ?? null}
          telefono={patient.telefono ? `+57 ${patient.telefono}` : null}
          correo={patient.correo}
        />
      </SectionCard>

      {/* 2 columnas: Citas | Historias clínicas */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <SectionCard
          title="Citas Agendadas e Historial"
          icon={<CalendarIcon />}
          count={pastAppointments.length > 0 ? `${pastAppointments.length}` : undefined}
          action={
            canScheduleAppointment ? (
              <DetailAction onClick={() => setIsScheduleModalOpen(true)} leftIcon={<span>+</span>}>
                Agendar cita
              </DetailAction>
            ) : undefined
          }
        >
          <div className="space-y-5">
            {/* Próxima cita activa */}
            {isAppointmentsLoading ? (
              <EmptyState>Cargando citas del paciente...</EmptyState>
            ) : upcomingAppointments.length > 0 ? (
              (() => {
                const nextAppt =
                  upcomingAppointments.find((a) => a.estado === 'En consulta') ??
                  upcomingAppointments[0];
                const canOpenThisAppt =
                  !isCoordinator &&
                  (nextAppt.estado === 'En consulta'
                    ? Boolean(canStartAttention || canAssistConsultation)
                    : nextAppt.estado === 'Confirmada' && canStartAttention);
                const openButtonLabel =
                  nextAppt.estado === 'En consulta'
                    ? canStartAttention
                      ? 'Continuar atención odontológica →'
                      : 'Asistir atención odontológica →'
                    : 'Iniciar atención odontológica →';

                return (
                  <div className="space-y-3 rounded-lg border border-[#D4AF37]/60 bg-[#FFFBEB]/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone="dark">Próxima cita</StatusBadge>
                        <span className="text-[14px] font-semibold text-[#1E242B]">
                          {formatSlot(nextAppt.bloques)}
                        </span>
                      </div>
                      <StatusBadge tone={appointmentTone(nextAppt.estado)}>{nextAppt.estado}</StatusBadge>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-break text-[14px] font-semibold text-[#1E242B]">{nextAppt.titulo}</h3>
                      <p className="mt-0.5 text-[13px] text-[#64748B]">
                        {nextAppt.nombreProfesional || 'Dr. Eduar Leal Álvarez'} · Agendado por:{' '}
                        {nextAppt.agendadoPor || 'Portal Web'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#EAD89B]/50 pt-3">
                      {canOpenThisAppt ? (
                        <DetailAction
                          variant="primary"
                          onClick={() => onOpenConsultation(patient, nextAppt.idCita, nextAppt.estado)}
                        >
                          {openButtonLabel}
                        </DetailAction>
                      ) : (
                        <span className="text-[13px] italic text-[#64748B]">
                          Atención clínica a cargo del profesional asignado
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              <EmptyState
                action={
                  canScheduleAppointment ? (
                    <DetailAction onClick={() => setIsScheduleModalOpen(true)}>
                      + Programar nueva cita
                    </DetailAction>
                  ) : undefined
                }
              >
                No hay citas activas o próximas programadas para este paciente.
              </EmptyState>
            )}

            {/* Citas anteriores */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-[#64748B]">Citas anteriores</h3>
                {pastAppointments.length > 3 && (
                  <span className="text-[12px] font-medium text-[#94A3B8]">
                    Desliza para ver más ({pastAppointments.length})
                  </span>
                )}
              </div>
              {pastAppointments.length > 0 ? (
                <div className="max-h-[260px] overflow-y-auto overscroll-contain pr-1.5 focus:outline-none">
                  <ul className="divide-y divide-[#F3F4F6]">
                    {pastAppointments.map((appt) => (
                      <li
                        key={appt.idCita}
                        className="flex min-w-0 flex-wrap items-start justify-between gap-2 py-3 first:pt-1"
                      >
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-[#1E242B]">{formatSlot(appt.bloques)}</p>
                          <p className="text-break text-[13px] text-[#64748B]">
                            {appt.titulo} · {appt.nombreProfesional}
                          </p>
                          <p className="text-[13px] text-[#64748B]">
                            Agendado por: {appt.agendadoPor || 'Portal Web'}
                          </p>
                        </div>
                        <StatusBadge tone={appointmentTone(appt.estado)}>{appt.estado}</StatusBadge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <EmptyState>No registra citas anteriores finalizadas.</EmptyState>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Historias Clínicas y Evoluciones"
          icon={<ClipboardIcon />}
          count={canReadFullHistory && history.length > 0 ? `${history.length}` : undefined}
          action={
            canReadFullHistory && history.length > 0 ? (
              <SectionAction
                onClick={() => onViewClinicalHistoryDetail(history[0]?.idHistoriaClinica || 1)}
              >
                Ver expediente histórico completo →
              </SectionAction>
            ) : undefined
          }
        >
          {!canReadFullHistory ? (
            restrictedNotice(
              'Acceso clínico restringido a profesionales tratantes',
              isCoordinator
                ? 'El perfil de Coordinadora de Atención (ROL-COA) no tiene permisos para consultar o auditar evoluciones clínicas (Ley 1581 / Res. 1995 de 1999).'
                : 'El historial completo de consultas pasadas es exclusivo de los odontólogos tratantes (RF-HCL-008). Para registrar evolución u odontograma de una cita activa, use la opción de la cita "En consulta".'
            )
          ) : isHistoryLoading ? (
            <EmptyState>Cargando historial clínico...</EmptyState>
          ) : history.length > 0 ? (
            <div className="max-h-[320px] overflow-y-auto overscroll-contain pr-1.5 focus:outline-none">
              <ul className="space-y-2">
                {history.map((item) => (
                  <li key={item.idEvolucion}>
                    <button
                      type="button"
                      onClick={() => setSelectedEvolutionForView(item)}
                      className="group flex w-full min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-left transition-colors hover:border-[#D4AF37] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                    >
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-semibold text-[#1E242B]">{item.fechaRegistro}</span>
                          <StatusBadge tone="neutral">Solo lectura</StatusBadge>
                        </span>
                        <span className="mt-0.5 block text-[13px] text-[#64748B]">
                          {item.profesional.nombreCompleto}
                        </span>
                        <span className="text-break block text-[13px] text-[#64748B]">
                          {item.procedimientoRealizado || item.motivoConsulta}
                        </span>
                      </span>
                      <span className="text-[14px] font-semibold text-[#B8942A] group-hover:underline">
                        Ver evolución →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState>
              No hay notas de evolución clínica registradas aún para este paciente. Las evoluciones se
              registran automáticamente al atender una cita.
            </EmptyState>
          )}
        </SectionCard>
      </div>

      {/* Consentimientos informados */}
      <SectionCard
        title="Consentimientos Informados"
        icon={<FileTextIcon />}
        count={!isCoordinator ? `${patientConsents.length} firmado${patientConsents.length !== 1 ? 's' : ''}` : undefined}
        description="Documentación médico-legal validada y suscrita digitalmente."
      >
        {isCoordinator ? (
          restrictedNotice(
            'Gestión de consentimientos clínicos restringida',
            'Solo el personal asistencial y odontólogos tratantes pueden visualizar y suscribir consentimientos informados médicos.'
          )
        ) : isConsentsLoading ? (
          <EmptyState>Cargando consentimientos...</EmptyState>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-[14px] font-semibold text-[#64748B]">
                Consentimientos firmados ({patientConsents.length})
              </h3>
              {patientConsents.length > 0 ? (
                <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {patientConsents.map((c) => (
                    <div
                      key={c.idConsentimientoFirmado || c.idConsentimiento}
                      className="flex min-w-0 flex-col justify-between gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <StatusBadge tone="neutral">{`v${c.version}.0`}</StatusBadge>
                          <StatusBadge tone="success">Firmado</StatusBadge>
                        </div>
                        <h4 className="text-break mt-2 text-[14px] font-semibold text-[#1E242B]">{c.titulo}</h4>
                        <p className="mt-1 text-[13px] text-[#64748B]">
                          {c.fechaFirma ? formatDateCO(c.fechaFirma) : 'Fecha registrada'} · {c.firmadoPor}
                        </p>
                      </div>
                      <SectionAction
                        className="self-end"
                        onClick={() => {
                          if (c.idConsentimientoFirmado) {
                            downloadConsentPdf(
                              c.idConsentimientoFirmado,
                              `Consentimiento_${c.titulo.replace(/\s+/g, '_')}_v${c.version}.pdf`
                            );
                          }
                        }}
                      >
                        Descargar PDF
                      </SectionAction>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>El paciente no tiene consentimientos firmados aún.</EmptyState>
              )}
            </div>

            {/* Plantillas disponibles para suscribir (RF-CON-001) */}
            <div className="border-t border-[#F3F4F6] pt-4">
              <h3 className="mb-3 text-[14px] font-semibold text-[#64748B]">Plantillas médicas disponibles</h3>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3">
                {templates
                  // RF-CON-005 (ERS v1.3): a un menor solo se le toma la plantilla de menores (firma el acudiente);
                  // a un adulto, cualquiera excepto esa.
                  .filter((t) => t.activo && ((patient.edad ?? 18) < 18 ? t.tipo === 'MENORES' : t.tipo !== 'MENORES'))
                  .map((tpl) => {
                    const alreadySigned = patientConsents.find(
                      (c) => c.idPlantilla === tpl.idPlantilla && c.version === tpl.version
                    );
                    return (
                      <div
                        key={tpl.idPlantilla}
                        className="flex min-w-0 flex-col justify-between gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <StatusBadge tone="neutral">{`v${tpl.version}.0`}</StatusBadge>
                            {alreadySigned ? (
                              <StatusBadge tone="neutral">Ya suscrito</StatusBadge>
                            ) : (
                              <StatusBadge tone="info">Disponible</StatusBadge>
                            )}
                          </div>
                          <h4 className="text-break mt-2 text-[14px] font-semibold text-[#1E242B]">{tpl.titulo}</h4>
                          <p className="mt-1 text-[13px] text-[#64748B]">
                            {alreadySigned
                              ? `El paciente ya firmó este consentimiento el ${alreadySigned.fechaFirma ? formatDateCO(alreadySigned.fechaFirma) : 'previamente'}`
                              : 'Listo para toma de consentimiento'}
                          </p>
                        </div>
                        {!alreadySigned ? (
                          <DetailAction className="self-end" onClick={() => onSignConsent(tpl)}>
                            Tomar firma
                          </DetailAction>
                        ) : (
                          <span className="self-end text-[13px] font-semibold text-[#047857]">✓ Vigente</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Modal de Edición del Paciente */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Editar Ficha Clínica"
        subtitle={`Actualice los datos personales de ${patient.nombreCompleto}`}
        maxWidth="3xl"
      >
        <PatientForm
          isEditing
          initialData={{ ...patient, sexo: patient.sexo ?? undefined }}
          onSubmit={async (formData) => {
            await onUpdatePatient(patient.idPaciente, formData);
            setIsEditModalOpen(false);
          }}
          onCancel={() => setIsEditModalOpen(false)}
        />
      </Modal>

      {/* Modal Visor de Ficha Detallada de Evolución (Compartido) */}
      <EvolutionDetailModal
        evolution={selectedEvolutionForView}
        isOpen={Boolean(selectedEvolutionForView)}
        onClose={() => setSelectedEvolutionForView(null)}
      />

      {/* Modal de Nueva Cita para el Paciente */}
      {isScheduleModalOpen && (
        <QuickScheduleModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          patients={[
            {
              idPaciente: patient.idPaciente,
              nombreCompleto: patient.nombreCompleto,
              documentoIdentidad: patient.documentoIdentidad,
              telefono: patient.telefono,
              correo: patient.correo,
            },
          ]}
          initialSelectedPatient={{
            idPaciente: patient.idPaciente,
            nombreCompleto: patient.nombreCompleto,
            documentoIdentidad: patient.documentoIdentidad,
            telefono: patient.telefono,
            correo: patient.correo,
          }}
          doctors={doctors}
          isLoading={isSubmittingSchedule}
          onConfirmSchedule={handleConfirmSchedule}
        />
      )}

      {/* Alerta modal en capa superior */}
      <AlertModalComponent />
    </DetailPageContainer>
  );
};
