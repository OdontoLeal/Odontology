// src/modules/patients/ui/views/PatientProfilePage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { PatientListItem } from '../hooks/usePatients';
import { PatientForm, PatientFormData } from '../components/PatientForm';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { Modal } from '../../../../shared/ui/components/Modal';
import { useClinicalRecord, ClinicalEvolutionEntry } from '../../../clinical-records/ui/hooks/useClinicalRecord';
import { OdontogramCanvas } from '../../../clinical-records/ui/components/OdontogramCanvas';
import { useConsents } from '../../../consents/ui/hooks/useConsents';

export interface PatientProfilePageProps {
  patient: PatientListItem;
  initialTab?: 'APPOINTMENTS' | 'CLINICAL' | 'CONSENTS' | 'DOCUMENTS';
  onBack: () => void;
  onScheduleAppointment: (patient: PatientListItem) => void;
  onOpenConsultation: (patient: PatientListItem, idCita?: number) => void;
  onViewClinicalHistoryDetail: (idHistoria: number) => void;
  onSignConsent: (idConsentimiento: number) => void;
  onUpdatePatient: (id: number, data: PatientFormData) => Promise<void> | void;
}

interface PatientAppointment {
  idCita: number;
  titulo: string;
  descripcion?: string | null;
  estado: string;
  idProfesional: number;
  nombreProfesional: string;
  bloques: string[];
}

export const PatientProfilePage: React.FC<PatientProfilePageProps> = ({
  patient,
  onBack,
  onScheduleAppointment,
  onOpenConsultation,
  onViewClinicalHistoryDetail,
  onSignConsent,
  onUpdatePatient,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEvolutionForView, setSelectedEvolutionForView] = useState<ClinicalEvolutionEntry | null>(null);
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [isAppointmentsLoading, setIsAppointmentsLoading] = useState(false);

  // Historias clínicas reales
  const { history, isLoading: isHistoryLoading } = useClinicalRecord(patient.idPaciente);

  // Consentimientos reales
  const { patientConsents, templates, fetchPatientConsents, isLoading: isConsentsLoading } = useConsents();

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
    fetchPatientConsents(patient.idPaciente);
  }, [fetchPatientAppointments, fetchPatientConsents, patient.idPaciente]);

  // Citas próximas / activas vs pasadas
  const upcomingAppointments = appointments.filter(
    (a) => a.estado === 'Confirmada' || a.estado === 'En consulta' || a.estado === 'Pendiente de confirmación'
  );
  const pastAppointments = appointments.filter(
    (a) => a.estado === 'Completada' || a.estado === 'Cancelada' || a.estado === 'No asistió'
  );

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
            <Button
              size="sm"
              variant="outline"
              onClick={() => onScheduleAppointment(patient)}
              leftIcon={
                <svg className="h-4 w-4 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              Agendar Cita
            </Button>
          </div>

          {/* Próxima Cita Activa */}
          {isAppointmentsLoading ? (
            <div className="p-4 rounded-2xl bg-[#F8F9FA] text-center text-xs text-[#687380]">
              Cargando citas del paciente...
            </div>
          ) : upcomingAppointments.length > 0 ? (
            (() => {
              const nextAppt = upcomingAppointments[0];
              return (
                <div className="rounded-2xl border-2 border-[#D4AF37]/50 bg-[#FBF6E6]/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-[#111111] text-[#D4AF37] text-[10px] font-extrabold uppercase">
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
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EAD89B]/40">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => onOpenConsultation(patient, nextAppt.idCita)}
                    >
                      Iniciar Atención Odontológica →
                    </Button>
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
                onClick={() => onScheduleAppointment(patient)}
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
                  </div>
                  <Badge
                    label={appt.estado}
                    variant={appt.estado === 'Completada' ? 'success' : appt.estado === 'Cancelada' ? 'danger' : 'warning'}
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

          {isHistoryLoading ? (
            <div className="p-4 rounded-2xl bg-[#F8F9FA] text-center text-xs text-[#687380]">
              Cargando historial clínico...
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
                      <p className="text-[11px] text-[#8F99A3] truncate max-w-xs">{item.procedimientoRealizado || item.motivoConsulta}</p>
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
              <p className="text-[11px] text-[#8F99A3]">
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

        {isConsentsLoading ? (
          <div className="p-4 rounded-2xl bg-[#F8F9FA] text-center text-xs text-[#687380]">
            Cargando consentimientos...
          </div>
        ) : patientConsents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {patientConsents.map((c) => (
              <div
                key={c.idConsentimiento}
                className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-4 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <Badge label={`v${c.version}.0`} variant="neutral" size="sm" />
                    <Badge
                      label={c.estado}
                      variant={c.estado === 'Firmado' ? 'success' : 'warning'}
                      size="sm"
                    />
                  </div>
                  <h4 className="mt-2 text-xs font-extrabold text-[#1E242B]">
                    {c.titulo}
                  </h4>
                  <p className="text-[11px] text-[#8F99A3] mt-1">
                    {c.fechaFirma || 'Fecha pendiente'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSignConsent(c.idConsentimiento)}
                  className="text-xs font-bold text-[#D4AF37] hover:underline self-end"
                >
                  {c.estado === 'Firmado' ? 'Consultar 👁️' : 'Firmar ✍️'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.slice(0, 3).map((tpl) => (
              <div
                key={tpl.idPlantilla}
                className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-4 flex flex-col justify-between space-y-3"
              >
                <div>
                  <Badge label={`v${tpl.version}.0`} variant="neutral" size="sm" />
                  <h4 className="mt-2 text-xs font-extrabold text-[#1E242B]">
                    {tpl.titulo}
                  </h4>
                  <p className="text-[11px] text-[#8F99A3] mt-1">Plantilla legal activa</p>
                </div>
                <button
                  type="button"
                  onClick={() => onSignConsent(tpl.idPlantilla)}
                  className="text-xs font-bold text-[#D4AF37] hover:underline self-end inline-flex items-center gap-1"
                >
                  Suscribir en Tablet ✍️
                </button>
              </div>
            ))}
            {templates.length === 0 && (
              <div className="col-span-3 text-center py-4 text-xs text-[#8F99A3]">
                No hay plantillas de consentimiento informados disponibles en el sistema.
              </div>
            )}
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
          initialData={patient}
          onSubmit={async (formData) => {
            await onUpdatePatient(patient.idPaciente, formData);
            setIsEditModalOpen(false);
          }}
          onCancel={() => setIsEditModalOpen(false)}
        />
      </Modal>

      {/* Modal Visor de Evolución Clínica (Solo Lectura • Registro Inmutable) */}
      <Modal
        isOpen={Boolean(selectedEvolutionForView)}
        onClose={() => setSelectedEvolutionForView(null)}
        title="Evolución Clínica Odontológica"
        subtitle={
          selectedEvolutionForView
            ? `Atención del ${selectedEvolutionForView.fechaRegistro} • ${selectedEvolutionForView.profesional.nombreCompleto}`
            : ''
        }
        maxWidth="4xl"
      >
        {selectedEvolutionForView && (
          <div className="space-y-6">
            {/* Header del profesional tratante y estado inmutable */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA]">
              <div>
                <p className="text-xs font-extrabold text-[#1E242B]">
                  👨‍⚕️ {selectedEvolutionForView.profesional.nombreCompleto}
                </p>
                <p className="text-[11px] text-[#687380] mt-0.5">
                  {selectedEvolutionForView.profesional.rol}
                  {selectedEvolutionForView.profesional.tarjetaProfesional && ` • TP: ${selectedEvolutionForView.profesional.tarjetaProfesional}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge label="Solo Lectura" variant="neutral" size="sm" />
                <Badge label="Registro Inmutable (Res. 1995/1999)" variant="gold" size="sm" />
              </div>
            </div>

            {/* Motivo y Diagnóstico */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] space-y-1">
                <span className="font-extrabold text-[10px] uppercase tracking-wider text-[#8F99A3] block">
                  Motivo de Consulta
                </span>
                <p className="text-[#1E242B] font-semibold leading-relaxed">
                  {selectedEvolutionForView.motivoConsulta || 'Consulta odontológica programada'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] space-y-1">
                <span className="font-extrabold text-[10px] uppercase tracking-wider text-[#8F99A3] block">
                  Diagnóstico (CIE-10)
                </span>
                <p className="text-[#1E242B] font-semibold leading-relaxed">
                  {selectedEvolutionForView.diagnostico || 'Evaluación clínica general'}
                </p>
              </div>
            </div>

            {/* Procedimiento Realizado */}
            <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] space-y-1 text-xs">
              <span className="font-extrabold text-[10px] uppercase tracking-wider text-[#8F99A3] block">
                Procedimiento Realizado
              </span>
              <p className="text-[#1E242B] font-medium leading-relaxed whitespace-pre-line">
                {selectedEvolutionForView.procedimientoRealizado || 'Sin procedimiento detallado'}
              </p>
            </div>

            {/* Observaciones Clínicas */}
            {selectedEvolutionForView.observaciones && (
              <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] space-y-1 text-xs">
                <span className="font-extrabold text-[10px] uppercase tracking-wider text-[#8F99A3] block">
                  Observaciones Clínicas / Evolución
                </span>
                <p className="text-[#4B5563] leading-relaxed whitespace-pre-line">
                  {selectedEvolutionForView.observaciones}
                </p>
              </div>
            )}

            {/* Acciones a Realizar / Recomendaciones */}
            {selectedEvolutionForView.accionesARealizar && (
              <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E2E6EA] space-y-1 text-xs">
                <span className="font-extrabold text-[10px] uppercase tracking-wider text-[#8F99A3] block">
                  Recomendaciones / Plan de Tratamiento
                </span>
                <p className="text-[#4B5563] leading-relaxed whitespace-pre-line">
                  {selectedEvolutionForView.accionesARealizar}
                </p>
              </div>
            )}

            {/* Odontograma Clínico en Modo Lectura */}
            {selectedEvolutionForView.odontograma && (
              <div className="space-y-2 pt-2 border-t border-[#E2E6EA]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase text-[#1E242B]">
                    Estado del Odontograma en esta consulta:
                  </span>
                  <span className="text-[11px] text-[#8F99A3] italic">
                    Modo Lectura • Simbología FDI Inalterable
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-[#E2E6EA]">
                  <OdontogramCanvas
                    key={selectedEvolutionForView.idEvolucion}
                    initialData={selectedEvolutionForView.odontograma}
                    readOnly={true}
                  />
                </div>
              </div>
            )}

            {/* Footer: Únicamente botón para cerrar (sin opciones de edición) */}
            <div className="flex justify-end pt-3 border-t border-[#E2E6EA]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedEvolutionForView(null)}
              >
                Cerrar Visualización
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
