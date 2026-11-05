// src/modules/patients/ui/views/PatientProfilePage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { PatientListItem } from '../hooks/usePatients';
import { PatientForm, PatientFormData } from '../components/PatientForm';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { Modal } from '../../../../shared/ui/components/Modal';
import { useClinicalRecord, ClinicalEvolutionEntry } from '../../../clinical-records/ui/hooks/useClinicalRecord';
import { EvolutionDetailModal } from '../../../clinical-records/ui/components/EvolutionDetailModal';
import { printCompleteClinicalHistory } from '../../../clinical-records/application/print-clinical-history.service';
import { useConsents } from '../../../consents/ui/hooks/useConsents';
import { QuickScheduleModal, DoctorCandidate } from '../../../appointments/ui/components/QuickScheduleModal';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';

export interface PatientProfilePageProps {
  patient: PatientListItem;
  initialTab?: 'APPOINTMENTS' | 'CLINICAL' | 'CONSENTS' | 'DOCUMENTS';
  onBack: () => void;
  onScheduleAppointment: (patient: PatientListItem) => void;
  onOpenConsultation: (patient: PatientListItem, idCita?: number) => void;
  onViewClinicalHistoryDetail: (idHistoria: number) => void;
  onSignConsent: (templateOrId: any) => void;
  onUpdatePatient: (id: number, data: PatientFormData) => Promise<void> | void;
  canScheduleAppointment?: boolean;
  canStartAttention?: boolean;
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
    fetch('/api/v1/users')
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

  // Historias clínicas reales
  const { history, isLoading: isHistoryLoading } = useClinicalRecord(patient.idPaciente);

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

  // Helper para formatear bloque horario
  const formatSlot = (bloques: string[]) => {
    if (!bloques || bloques.length === 0) return 'Horario por confirmar';
    const first = bloques[0];
    const parts = first.split(' ');
    const date = parts[0] || '';
    const time = (parts[1] || '').slice(0, 5);
    return `${date} • ${time} hrs`;
  };

  // Iniciales para el avatar
  const initials = patient.nombreCompleto
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Botón Volver */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#687380] hover:text-[#1E242B] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver a Pacientes
        </button>

        <div className="flex items-center gap-2">
          {history.length > 0 && !isCoordinator && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => printCompleteClinicalHistory({ patient, history })}
              leftIcon={<span>🖨️</span>}
            >
              Imprimir Historia Completa
            </Button>
          )}
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsEditModalOpen(true)}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            }
          >
            Editar Paciente
          </Button>
        </div>
      </div>

      {/* Header Ficha Médica */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E242B]">
            Ficha Médica del Paciente
          </h1>
          <Badge label="Expediente Activo" variant="success" size="sm" />
          {patient.datosIncompletos && (
            <Badge label="Datos Incompletos" variant="warning" size="sm" />
          )}
        </div>
        <p className="mt-1 text-xs sm:text-sm text-[#687380]">
          Expediente clínico integral, historial de citas, evoluciones clínicas y consentimientos.
        </p>
      </div>

      {/* Tarjeta de Resumen del Paciente */}
      <div className="rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center gap-6">
        <div className="h-16 w-16 rounded-2xl bg-[#1E242B] text-[#D4AF37] font-extrabold text-xl flex items-center justify-center flex-shrink-0 shadow-inner">
          {initials}
        </div>
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-extrabold text-[#1E242B]">
              {patient.nombreCompleto}
            </h2>
            <Badge label={`C.C. ${patient.documentoIdentidad}`} variant="neutral" />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#687380]">
            <span>🎂 {patient.edad ?? 28} años ({patient.fechaNacimiento})</span>
            <span>⚧ {patient.sexo}</span>
            <span>📞 +57 {patient.telefono}</span>
            <span>✉️ {patient.correo}</span>
          </div>
        </div>
      </div>

      {/* Contenedores en 2 Columnas: Citas vs Historias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna Izquierda: Citas Agendadas e Historial */}
        <div className="space-y-4 rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📅</span>
              <h3 className="text-base font-extrabold text-[#1E242B]">
                Citas Agendadas e Historial
              </h3>
            </div>
            {canScheduleAppointment && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsScheduleModalOpen(true)}
                leftIcon={
                  <svg className="h-4 w-4 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                }
              >
                Agendar Cita
              </Button>
            )}
          </div>

          {/* Próxima Cita Activa */}
          {isAppointmentsLoading ? (
            <div className="p-8 rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] text-center space-y-2">
              <div className="w-5 h-5 mx-auto border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-bold text-[#1E242B]">Cargando citas del paciente...</p>
            </div>
          ) : upcomingAppointments.length > 0 ? (
            (() => {
              const nextAppt = upcomingAppointments[0];
              return (
                <div className="rounded-2xl border-2 border-[#D4AF37]/50 bg-[#FBF6E6]/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-[#111111] text-[#D4AF37] text-[13px] font-extrabold uppercase">
                        Próxima Cita
                      </span>
                      <span className="text-xs font-bold text-[#1E242B]">
                        {formatSlot(nextAppt.bloques)}
                      </span>
                    </div>
                    <Badge
                      label={nextAppt.estado}
                      variant={nextAppt.estado === 'En consulta' ? 'gold' : 'info'}
                      size="sm"
                    />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-[#1E242B]">
                      {nextAppt.titulo}
                    </h4>
                    <p className="text-xs text-[#687380] mt-0.5">
                      👨‍⚕️ {nextAppt.nombreProfesional || 'Dr. Eduar Leal Álvarez'}
                    </p>
                    <p className="text-[13px] text-[#687380] mt-0.5">
                      <span className="font-semibold text-[#1E242B]">Agendado por:</span>{' '}
                      {nextAppt.agendadoPor || 'Portal Web'}
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EAD89B]/40">
                    {!isCoordinator && canStartAttention ? (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => onOpenConsultation(patient, nextAppt.idCita)}
                      >
                        Iniciar Atención Odontológica →
                      </Button>
                    ) : (
                      <span className="text-xs text-[#687380] italic">
                        Atención clínica a cargo del profesional asignado
                      </span>
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="rounded-2xl border border-dashed border-[#E2E6EA] p-6 text-center space-y-2">
              <span className="text-2xl">🗓️</span>
              <p className="text-xs font-semibold text-[#687380]">
                No hay citas activas o próximas programadas para este paciente.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsScheduleModalOpen(true)}
              >
                + Programar Nueva Cita
              </Button>
            </div>
          )}

          {/* Historial de Citas Pasadas */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#8F99A3]">
              Citas Anteriores
            </h4>

            {pastAppointments.length > 0 ? (
              pastAppointments.map((appt) => (
                <div
                  key={appt.idCita}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA] text-xs"
                >
                  <div>
                    <p className="font-bold text-[#1E242B]">{formatSlot(appt.bloques)}</p>
                    <p className="text-[#687380]">{appt.titulo} • {appt.nombreProfesional}</p>
                    <p className="text-[13px] text-[#8F99A3] mt-0.5">
                      <span className="font-semibold text-[#687380]">Agendado por:</span>{' '}
                      {appt.agendadoPor || 'Portal Web'}
                    </p>
                  </div>
                  <Badge
                    label={appt.estado}
                    variant={appt.estado === 'Atendida' ? 'success' : appt.estado === 'Cancelada' ? 'danger' : 'warning'}
                    size="sm"
                  />
                </div>
              ))
            ) : (
              <p className="text-xs text-[#8F99A3] italic py-2">
                No registra citas anteriores finalizadas.
              </p>
            )}
          </div>
        </div>

        {/* Columna Derecha: Historias Clínicas y Evoluciones */}
        <div className="space-y-4 rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📋</span>
              <h3 className="text-base font-extrabold text-[#1E242B]">
                Historias Clínicas y Evoluciones
              </h3>
            </div>
            <span className="text-xs text-[#8F99A3]">Seguimiento por procedimiento</span>
          </div>

          {isCoordinator ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center space-y-2">
              <span className="text-2xl">🔒</span>
              <p className="text-xs font-bold text-amber-800">
                Acceso clínico restringido a profesionales de la salud
              </p>
              <p className="text-[13px] text-amber-700">
                El perfil de Coordinadora de Atención (ROL-COA) no tiene permisos para consultar o auditar evoluciones clínicas (Ley 1581 / Res. 1995 de 1999).
              </p>
            </div>
          ) : isHistoryLoading ? (
            <div className="p-8 rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] text-center space-y-2">
              <div className="w-5 h-5 mx-auto border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-bold text-[#1E242B]">Cargando historial clínico...</p>
            </div>
          ) : history.length > 0 ? (
            <div className="space-y-3">
              <div className="space-y-2">
                {history.map((item) => (
                  <div
                    key={item.idEvolucion}
                    onClick={() => setSelectedEvolutionForView(item)}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-[#E2E6EA] bg-[#F8F9FA] hover:bg-white hover:border-[#D4AF37] transition-all cursor-pointer group shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-[#1E242B]">{item.fechaRegistro}</span>
                        <Badge label="Solo Lectura" variant="neutral" size="sm" />
                      </div>
                      <p className="text-xs text-[#687380] mt-0.5">{item.profesional.nombreCompleto}</p>
                      <p className="text-[13px] text-[#8F99A3] truncate max-w-xs">{item.procedimientoRealizado || item.motivoConsulta}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvolutionForView(item);
                      }}
                      className="text-xs font-bold text-[#D4AF37] group-hover:text-[#B8942A] inline-flex items-center gap-1"
                    >
                      Ver Evolución 👁️
                    </button>
                  </div>
                ))}
              </div>
              <div className="pt-2 text-right">
                <button
                  type="button"
                  onClick={() => onViewClinicalHistoryDetail(history[0]?.idHistoriaClinica || 1)}
                  className="text-xs font-bold text-[#687380] hover:text-[#1E242B] transition-colors"
                >
                  Ver expediente histórico completo →
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#E2E6EA] p-6 text-center space-y-2">
              <span className="text-2xl">📋</span>
              <p className="text-xs font-semibold text-[#687380]">
                No hay notas de evolución clínica registradas aún para este paciente.
              </p>
              <p className="text-[13px] text-[#8F99A3]">
                Las evoluciones se registrarán automáticamente al atender una cita.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sección Inferior: Consentimientos Informados */}
      <div className="rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">✍️</span>
            <div>
              <h3 className="text-base font-extrabold text-[#1E242B]">
                Consentimientos Informados
              </h3>
              <p className="text-xs text-[#8F99A3]">
                Documentación médico-legal validada y suscrita digitalmente.
              </p>
            </div>
          </div>
        </div>

        {isCoordinator ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center space-y-2">
            <span className="text-2xl">🔒</span>
            <p className="text-xs font-bold text-amber-800">
              Gestión de consentimientos clínicos restringida
            </p>
            <p className="text-[13px] text-amber-700">
              Solo el personal asistencial y odontólogos tratantes pueden visualizar y suscribir consentimientos informados médicos.
            </p>
          </div>
        ) : isConsentsLoading ? (
          <div className="p-4 rounded-2xl bg-[#F8F9FA] text-center text-xs text-[#687380]">
            Cargando consentimientos...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Consentimientos Firmados */}
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-3">
                Consentimientos Firmados ({patientConsents.length})
              </h4>
              {patientConsents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {patientConsents.map((c) => (
                    <div
                      key={c.idConsentimientoFirmado || c.idConsentimiento}
                      className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-4 flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <Badge label={`v${c.version}.0`} variant="neutral" size="sm" />
                          <Badge label="Firmado" variant="success" size="sm" />
                        </div>
                        <h4 className="mt-2 text-xs font-extrabold text-[#1E242B]">
                          {c.titulo}
                        </h4>
                        <p className="text-[13px] text-[#8F99A3] mt-1">
                          {c.fechaFirma || 'Fecha registrada'} • {c.firmadoPor}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (c.idConsentimientoFirmado) {
                            downloadConsentPdf(
                              c.idConsentimientoFirmado,
                              `Consentimiento_${c.titulo.replace(/\s+/g, '_')}_v${c.version}.pdf`
                            );
                          }
                        }}
                        className="text-xs font-bold text-[#D4AF37] hover:underline self-end flex items-center gap-1 cursor-pointer"
                      >
                        Descargar PDF 📄
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#8F99A3] italic">El paciente no tiene consentimientos firmados aún.</p>
              )}
            </div>

            {/* Plantillas Disponibles para Suscribir (RF-CON-001) */}
            <div className="pt-4 border-t border-[#E2E6EA]">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-3">
                Plantillas Médicas Disponibles
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                        className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-4 flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <Badge label={`v${tpl.version}.0`} variant="neutral" size="sm" />
                            {alreadySigned ? (
                              <Badge label="Ya suscrito" variant="neutral" size="sm" />
                            ) : (
                              <Badge label="Disponible" variant="info" size="sm" />
                            )}
                          </div>
                          <h4 className="mt-2 text-xs font-extrabold text-[#1E242B]">
                            {tpl.titulo}
                          </h4>
                          <p className="text-[13px] text-[#8F99A3] mt-1">
                            {alreadySigned
                              ? `El paciente ya firmó este consentimiento el ${alreadySigned.fechaFirma || 'previamente'}`
                              : 'Listo para toma de consentimiento'}
                          </p>
                        </div>
                        {!alreadySigned ? (
                          <button
                            type="button"
                            onClick={() => onSignConsent(tpl)}
                            className="text-xs font-bold text-[#D4AF37] hover:underline self-end inline-flex items-center gap-1 cursor-pointer"
                          >
                            Tomar Firma ✍️
                          </button>
                        ) : (
                          <span className="text-[13px] text-[#137333] font-semibold self-end">
                            ✓ Vigente
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>

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
    </div>
  );
};
