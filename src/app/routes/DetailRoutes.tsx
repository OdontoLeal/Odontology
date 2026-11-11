// src/app/routes/DetailRoutes.tsx
import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { InternalAgendaPage } from '../../modules/appointments/ui/views';
import { ActiveConsultationPage, ClinicalHistoryListPage } from '../../modules/clinical-records/ui/views';
import { ConsentSigningPage } from '../../modules/consents/ui/views';
import { ConsentTemplateItem } from '../../modules/consents/ui/hooks/useConsents';
import { PatientListItem } from '../../modules/patients/ui/hooks/usePatients';
import { PatientFormData } from '../../modules/patients/ui/components/PatientForm';
import { HolderDataQueryPage, PatientProfilePage } from '../../modules/patients/ui/views';
import { Button } from '../../shared/ui/components/Button';
import { DetailPageContainer } from '../../shared/ui/components/DetailPage';
import { AccessCapabilities, calculatePatientAge } from './access-capabilities';
import {
  buildAgendaAppointmentPath,
  buildAgendaRequestPath,
  buildConsentSigningPath,
  buildConsultationPath,
  buildPatientClinicalHistoryPath,
  buildPatientProfilePath,
  ROUTES,
} from './paths';
import { useHydratedPatient } from './patient-hydration';

type AlertInvoker = (opts: {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}) => void;

const RouteStatusCard: React.FC<{
  title: string;
  message: string;
  backLabel: string;
  onBack: () => void;
  isError?: boolean;
}> = ({ title, message, backLabel, onBack, isError = false }) => (
  <DetailPageContainer>
    <div
      role={isError ? 'alert' : 'status'}
      className="mx-auto max-w-xl rounded-2xl border border-[#E2E6EA] border-t-4 border-t-[#D4AF37] bg-white p-8 text-center shadow-xs space-y-4"
    >
      <h2 className="text-xl font-extrabold text-[#1E242B]">{title}</h2>
      <p className="text-sm text-[#687380]">{message}</p>
      <div className="pt-2">
        <Button variant="outline" onClick={onBack}>
          ← {backLabel}
        </Button>
      </div>
    </div>
  </DetailPageContainer>
);

export const AgendaRoute: React.FC<{ capabilities: AccessCapabilities }> = ({ capabilities }) => {
  const navigate = useNavigate();
  const { idSolicitud, idCita } = useParams<{ idSolicitud?: string; idCita?: string }>();

  const routeViewMode = idSolicitud
    ? 'REQUEST_DETAIL'
    : idCita
      ? 'APPOINTMENT_DETAIL'
      : 'AGENDA';
  const routeEntityId = idSolicitud
    ? Number(idSolicitud)
    : idCita
      ? Number(idCita)
      : undefined;

  return (
    <>
      <InternalAgendaPage
        canManageSlots={capabilities.canManageSlots}
        canCreateAppointment={capabilities.canCreateAppointment}
        canStartAttention={capabilities.canStartAttention}
        canAssistConsultation={capabilities.canAssistConsultation}
        routeViewMode={routeViewMode}
        routeEntityId={routeEntityId}
        onOpenRequestDetail={(reqId) => navigate(buildAgendaRequestPath(reqId))}
        onOpenAppointmentDetail={(apptId) => navigate(buildAgendaAppointmentPath(apptId))}
        onReturnToAgenda={() => navigate(ROUTES.AGENDA)}
        onStartAttention={(citaId, idPaciente, doctorInfo) =>
          navigate(buildConsultationPath(citaId), {
            state: {
              idPaciente,
              doctorName: doctorInfo?.doctorName,
              doctorSignature: doctorInfo?.doctorSignature,
            },
          })
        }
        onOpenConsultationWorkspace={(idPaciente, citaId, doctorInfo) =>
          navigate(buildConsultationPath(citaId), {
            state: {
              idPaciente,
              doctorName: doctorInfo?.doctorName,
              doctorSignature: doctorInfo?.doctorSignature,
            },
          })
        }
        onNavigateToPatientProfile={(idPaciente) =>
          navigate(buildPatientProfilePath(idPaciente))
        }
      />
      <Outlet />
    </>
  );
};

interface ConsultationNavState {
  idPaciente?: number;
  patient?: PatientListItem;
  doctorName?: string;
  doctorSignature?: string | null;
}

export const ActiveConsultationRoute: React.FC<{
  patients: PatientListItem[];
  capabilities: AccessCapabilities;
  currentUserName: string;
  currentUserSignature?: string | null;
  showAlert: AlertInvoker;
}> = ({
  patients,
  capabilities,
  currentUserName,
  currentUserSignature = null,
  showAlert,
}) => {
  const navigate = useNavigate();
  const { idCita } = useParams<{ idCita: string }>();
  const location = useLocation();
  const navState = (location.state as ConsultationNavState | null) ?? null;

  const parsedCitaId = Number(idCita);
  const isValidCitaId = Boolean(parsedCitaId && !isNaN(parsedCitaId) && parsedCitaId > 0);

  const [resolvedCitaContext, setResolvedCitaContext] = useState<{
    idPaciente: number;
    doctorName?: string;
    doctorSignature?: string | null;
  } | null>(
    navState?.idPaciente
      ? {
          idPaciente: Number(navState.idPaciente),
          doctorName: navState.doctorName,
          doctorSignature: navState.doctorSignature,
        }
      : null
  );
  const [isLoadingCita, setIsLoadingCita] = useState(
    Boolean(isValidCitaId && !navState?.idPaciente)
  );
  const [citaError, setCitaError] = useState<string | null>(
    isValidCitaId ? null : 'El identificador de la cita indicado en la URL no es válido.'
  );

  useEffect(() => {
    if (!isValidCitaId) {
      setCitaError('El identificador de la cita indicado en la URL no es válido.');
      setIsLoadingCita(false);
      return;
    }

    if (navState?.idPaciente) {
      setResolvedCitaContext({
        idPaciente: Number(navState.idPaciente),
        doctorName: navState.doctorName,
        doctorSignature: navState.doctorSignature,
      });
      setIsLoadingCita(false);
      setCitaError(null);
      return;
    }

    let cancelled = false;
    setIsLoadingCita(true);
    setCitaError(null);

    fetch(`/api/v1/clinical-records/appointment/${parsedCitaId}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.data?.cita) {
          throw new Error(
            json?.message || 'No fue posible abrir la consulta clínica solicitada.'
          );
        }
        const cita = json.data.cita;
        if (!cancelled) {
          setResolvedCitaContext({
            idPaciente: Number(cita.idPaciente),
            doctorName: cita.nombreProfesional,
            doctorSignature: null,
          });
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setResolvedCitaContext(null);
          setCitaError(err?.message || 'Error al cargar el contexto de la consulta.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingCita(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isValidCitaId, parsedCitaId, navState?.idPaciente, navState?.doctorName, navState?.doctorSignature]);

  const {
    patient,
    isLoading: isLoadingPatient,
    error: patientError,
  } = useHydratedPatient(resolvedCitaContext?.idPaciente, {
    initialPatient: navState?.patient,
    cachedPatients: patients,
    enabled: Boolean(resolvedCitaContext?.idPaciente),
  });

  if (citaError) {
    return (
      <RouteStatusCard
        isError
        title="Consulta clínica no disponible"
        message={citaError}
        backLabel="Volver a la Agenda"
        onBack={() => navigate(ROUTES.AGENDA)}
      />
    );
  }

  if (isLoadingCita || !resolvedCitaContext || isLoadingPatient) {
    return (
      <RouteStatusCard
        title="Cargando espacio de consulta..."
        message="Obteniendo los datos de la cita y del paciente para continuar la atención."
        backLabel="Volver a la Agenda"
        onBack={() => navigate(ROUTES.AGENDA)}
      />
    );
  }

  if (patientError && !patient) {
    return (
      <RouteStatusCard
        isError
        title="No se pudo cargar al paciente"
        message={patientError}
        backLabel="Volver a la Agenda"
        onBack={() => navigate(ROUTES.AGENDA)}
      />
    );
  }

  const resolvedDoctorName =
    resolvedCitaContext.doctorName ||
    (capabilities.canEditClinicalOpening ? currentUserName : 'Profesional asignado');
  const resolvedDoctorSignature =
    resolvedCitaContext.doctorSignature ??
    (capabilities.canEditClinicalOpening ? currentUserSignature : null);

  return (
    <ActiveConsultationPage
      idPaciente={resolvedCitaContext.idPaciente}
      idCita={parsedCitaId}
      patientName={patient?.nombreCompleto || 'Paciente'}
      patientDoc={patient?.documentoIdentidad || ''}
      patientPhone={patient?.telefono || ''}
      patientEmail={patient?.correo || ''}
      patientAge={calculatePatientAge(patient)}
      patientSex={patient?.sexo ?? undefined}
      doctorName={resolvedDoctorName}
      doctorSignature={resolvedDoctorSignature}
      onBackToAgenda={() => navigate(ROUTES.AGENDA)}
      canFinishAttention={capabilities.canStartAttention}
      isAssistantMode={!capabilities.canEditClinicalOpening}
      canGenerateDocuments={capabilities.canGenerateClinicalDocuments}
      canViewClinicalHistory={capabilities.canViewClinicalHistory}
      onFinishConsultation={async (finishedCitaId) => {
        try {
          const res = await fetch(`/api/v1/appointments/${finishedCitaId}/state`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nuevoEstado: 'Atendida' }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showAlert({
              title: 'No se pudo finalizar la atención',
              message: err.message || 'Intente de nuevo.',
              type: 'warning',
            });
            return;
          }
        } catch (err) {
          console.error('Error finalizando cita:', err);
          return;
        }
        navigate(ROUTES.AGENDA);
      }}
    />
  );
};

export const PatientProfileRoute: React.FC<{
  patients: PatientListItem[];
  capabilities: AccessCapabilities;
  updatePatient: (id: number, data: PatientFormData) => Promise<void>;
  showAlert: AlertInvoker;
}> = ({ patients, capabilities, updatePatient, showAlert }) => {
  const navigate = useNavigate();
  const { idPaciente } = useParams<{ idPaciente: string }>();
  const location = useLocation();
  const state = location.state as { patient?: PatientListItem } | null;

  const parsedId = Number(idPaciente);
  const { patient, setPatient, isLoading, error } = useHydratedPatient(parsedId, {
    initialPatient: state?.patient,
    cachedPatients: patients,
  });

  if (isLoading) {
    return (
      <RouteStatusCard
        title="Cargando ficha del paciente..."
        message="Consultando la información clínica y administrativa."
        backLabel="Volver al Directorio"
        onBack={() => navigate(ROUTES.PATIENTS)}
      />
    );
  }

  if (error || !patient) {
    return (
      <RouteStatusCard
        isError
        title="Ficha de paciente no disponible"
        message={error || 'El paciente solicitado no existe o no tienes acceso.'}
        backLabel="Volver al Directorio"
        onBack={() => navigate(ROUTES.PATIENTS)}
      />
    );
  }

  return (
    <PatientProfilePage
      patient={patient}
      canScheduleAppointment={capabilities.canCreateAppointment}
      canStartAttention={capabilities.canStartAttention}
      canAssistConsultation={capabilities.canAssistConsultation}
      canViewClinicalHistory={capabilities.canViewClinicalHistory}
      onBack={() => navigate(ROUTES.PATIENTS)}
      onScheduleAppointment={() => navigate(ROUTES.AGENDA)}
      onOpenConsultation={async (targetPatient, idCita, estadoCita) => {
        if (idCita && estadoCita !== 'En consulta') {
          try {
            const res = await fetch(`/api/v1/appointments/${idCita}/state`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nuevoEstado: 'En consulta',
                motivo: 'Inicio de atención clínica',
              }),
            });
            if (!res.ok) {
              const errJson = await res.json().catch(() => ({}));
              if (!String(errJson.message).toLowerCase().includes('en consulta')) {
                showAlert({
                  title: 'No se pudo iniciar la atención',
                  message:
                    errJson.message || 'Error al cambiar el estado de la cita a "En consulta".',
                  type: 'error',
                });
                return;
              }
            }
          } catch (err: any) {
            showAlert({
              title: 'Error de conexión',
              message: err.message || 'No se pudo conectar con el servidor para iniciar la cita.',
              type: 'error',
            });
            return;
          }
        }
        if (!idCita) return;
        navigate(buildConsultationPath(idCita), {
          state: { idPaciente: targetPatient.idPaciente, patient: targetPatient },
        });
      }}
      onViewClinicalHistoryDetail={() => {
        if (capabilities.isCoordinatorOnly || !capabilities.canViewClinicalHistory) {
          showAlert({
            title: 'Acceso Restringido',
            message: 'No tiene permiso para realizar esta acción.',
            type: 'warning',
          });
          return;
        }
        navigate(buildPatientClinicalHistoryPath(patient.idPaciente), {
          state: { patient },
        });
      }}
      onSignConsent={(tplOrId) => {
        const templateObj =
          tplOrId && typeof tplOrId === 'object' ? (tplOrId as ConsentTemplateItem) : null;
        const idPlantilla = Number(templateObj?.idPlantilla ?? tplOrId ?? 1);
        navigate(buildConsentSigningPath(patient.idPaciente, idPlantilla), {
          state: { patient, template: templateObj ?? undefined },
        });
      }}
      onUpdatePatient={async (id, data) => {
        await updatePatient(id, data);
        setPatient((prev) => (prev ? { ...prev, ...data } : null));
      }}
    />
  );
};

export const ClinicalHistoryRoute: React.FC<{
  patients: PatientListItem[];
  capabilities: AccessCapabilities;
}> = ({ patients, capabilities }) => {
  const navigate = useNavigate();
  const { idPaciente } = useParams<{ idPaciente: string }>();
  const location = useLocation();
  const state = location.state as { patient?: PatientListItem } | null;

  const parsedId = Number(idPaciente);
  const isRestricted = capabilities.isCoordinatorOnly || !capabilities.canViewClinicalHistory;

  const { patient, isLoading, error } = useHydratedPatient(parsedId, {
    initialPatient: state?.patient,
    cachedPatients: patients,
    enabled: !isRestricted,
  });

  if (isRestricted) {
    return (
      <RouteStatusCard
        isError
        title="Acceso Restringido"
        message="No tiene permiso para visualizar el historial clínico integral del paciente."
        backLabel="Volver a la Ficha del Paciente"
        onBack={() =>
          navigate(parsedId > 0 ? buildPatientProfilePath(parsedId) : ROUTES.PATIENTS)
        }
      />
    );
  }

  if (isLoading) {
    return (
      <RouteStatusCard
        title="Cargando historial clínico..."
        message="Obteniendo los datos del paciente y sus evoluciones registradas."
        backLabel="Volver a la Ficha"
        onBack={() => navigate(buildPatientProfilePath(parsedId))}
      />
    );
  }

  if (error || !patient) {
    return (
      <RouteStatusCard
        isError
        title="Historial clínico no disponible"
        message={error || 'No se encontró el expediente del paciente solicitado.'}
        backLabel="Volver al Directorio"
        onBack={() => navigate(ROUTES.PATIENTS)}
      />
    );
  }

  return (
    <ClinicalHistoryListPage
      idPaciente={patient.idPaciente}
      patientName={patient.nombreCompleto}
      patientDoc={patient.documentoIdentidad}
      patientData={patient}
      onBack={() => navigate(buildPatientProfilePath(patient.idPaciente), { state: { patient } })}
    />
  );
};

export const ConsentSigningRoute: React.FC<{
  capabilities: AccessCapabilities;
}> = ({ capabilities }) => {
  const navigate = useNavigate();
  const { idPaciente, idPlantilla } = useParams<{ idPaciente: string; idPlantilla: string }>();
  const location = useLocation();
  const state = location.state as {
    patient?: PatientListItem;
    template?: { idPlantilla: number; titulo: string; cuerpoTexto: string };
  } | null;

  const parsedPatientId = Number(idPaciente);
  const parsedTemplateId = Number(idPlantilla);

  const { patient, isLoading: isLoadingPatient, error: patientError } = useHydratedPatient(
    parsedPatientId,
    { initialPatient: state?.patient }
  );

  const [template, setTemplate] = useState<{
    idPlantilla: number;
    titulo: string;
    cuerpoTexto: string;
  } | null>(
    state?.template && Number(state.template.idPlantilla) === parsedTemplateId
      ? state.template
      : null
  );
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(
    Boolean(parsedTemplateId > 0 && !template)
  );
  const [templateError, setTemplateError] = useState<string | null>(null);

  useEffect(() => {
    if (!capabilities.canAccessConsents) return;
    if (state?.template && Number(state.template.idPlantilla) === parsedTemplateId) {
      setTemplate(state.template);
      setIsLoadingTemplate(false);
      setTemplateError(null);
      return;
    }
    if (!parsedTemplateId || isNaN(parsedTemplateId) || parsedTemplateId <= 0) {
      setTemplateError('Plantilla de consentimiento no válida.');
      setIsLoadingTemplate(false);
      return;
    }

    let cancelled = false;
    setIsLoadingTemplate(true);
    setTemplateError(null);

    fetch('/api/v1/consents/templates')
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.message || 'No se pudo cargar la plantilla de consentimiento.');
        }
        const list: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        const match = list.find(
          (t) => Number(t.idConsentimiento ?? t.id_consentimiento ?? t.idPlantilla) === parsedTemplateId
        );
        if (!match) {
          throw new Error('Plantilla de consentimiento no encontrada.');
        }
        if (!cancelled) {
          setTemplate({
            idPlantilla: Number(
              match.idConsentimiento ?? match.id_consentimiento ?? match.idPlantilla
            ),
            titulo: match.nombre ?? match.titulo ?? 'Consentimiento Informado',
            cuerpoTexto: match.textoPlantilla ?? match.texto_plantilla ?? match.cuerpoTexto ?? '',
          });
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setTemplateError(err?.message || 'Error al cargar la plantilla de consentimiento.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingTemplate(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [capabilities.canAccessConsents, parsedTemplateId, state?.template]);

  if (!capabilities.canAccessConsents) {
    return (
      <RouteStatusCard
        isError
        title="Acceso Restringido"
        message="No tiene permisos para diligenciar o firmar consentimientos informados."
        backLabel="Volver a Pacientes"
        onBack={() => navigate(ROUTES.PATIENTS)}
      />
    );
  }

  if (isLoadingPatient || isLoadingTemplate) {
    return (
      <RouteStatusCard
        title="Preparando documento de consentimiento..."
        message="Cargando datos del paciente y texto vigente de la plantilla."
        backLabel="Volver a la Ficha"
        onBack={() =>
          navigate(parsedPatientId > 0 ? buildPatientProfilePath(parsedPatientId) : ROUTES.PATIENTS)
        }
      />
    );
  }

  if (patientError || templateError || !patient || !template) {
    return (
      <RouteStatusCard
        isError
        title="No se pudo abrir la firma de consentimiento"
        message={patientError || templateError || 'Falta información del paciente o de la plantilla.'}
        backLabel="Volver a la Ficha"
        onBack={() =>
          navigate(parsedPatientId > 0 ? buildPatientProfilePath(parsedPatientId) : ROUTES.PATIENTS)
        }
      />
    );
  }

  const age = calculatePatientAge(patient);
  const isMinor = age !== undefined ? age < 18 : false;

  return (
    <ConsentSigningPage
      tituloConsentimiento={template.titulo}
      cuerpoTexto={template.cuerpoTexto}
      nombrePaciente={patient.nombreCompleto}
      documentoPaciente={patient.documentoIdentidad}
      isMinor={isMinor}
      onConsentSigned={async (payload) => {
        const res = await fetch('/api/v1/consents/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idConsentimiento: template.idPlantilla,
            idPaciente: patient.idPaciente,
            firmaBase64: payload.firmaBase64,
            aceptado: true,
            firmaPorAcudiente: payload.firmaPorAcudiente,
            nombreDocumentoAcudiente: payload.nombreDocumentoAcudiente,
            textoFirmado: payload.textoFirmado,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'No se pudo guardar el consentimiento.');
        }
      }}
      onExit={() =>
        navigate(buildPatientProfilePath(patient.idPaciente), {
          state: { patient },
        })
      }
    />
  );
};

export const HolderDataQueryRoute: React.FC<{
  patients: PatientListItem[];
  capabilities: AccessCapabilities;
  getHolderData: (documento: string, formato?: 'JSON' | 'PDF') => Promise<any>;
}> = ({ patients, capabilities, getHolderData }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const state = location.state as { documento?: string } | null;

  if (!capabilities.canAccessHabeasData) {
    return (
      <RouteStatusCard
        isError
        title="Consulta Habeas Data no disponible"
        message="Su rol actual no dispone de permisos para consultar o exportar datos del titular."
        backLabel="Volver al Directorio"
        onBack={() => navigate(ROUTES.PATIENTS)}
      />
    );
  }

  const initialDoc = searchParams.get('doc') ?? state?.documento ?? '';

  return (
    <HolderDataQueryPage
      patients={patients}
      initialSelectedDocument={initialDoc}
      onBack={() => navigate(ROUTES.PATIENTS)}
      onQueryHolderData={getHolderData}
    />
  );
};
