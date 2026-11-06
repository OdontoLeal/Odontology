// src/modules/patients/ui/views/PatientsDirectoryPage.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { usePatients, PatientListItem } from '../hooks/usePatients';
import { PatientForm, PatientFormData } from '../components/PatientForm';
import { PrivacyNoticeModal } from '../components/PrivacyNoticeModal';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { Modal } from '../../../../shared/ui/components/Modal';
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
import {
  PageList,
  ListCard,
  ListState,
  InitialsAvatar,
} from '../../../../shared/ui/components/PageList';
import { Pagination } from '../../../../shared/ui/components/Pagination';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';
import { useToast } from '../../../../shared/ui/hooks/useToast';

export interface PatientsDirectoryPageProps {
  onSelectPatient: (
    patient: PatientListItem,
    tab?: 'APPOINTMENTS' | 'CLINICAL' | 'CONSENTS' | 'DOCUMENTS'
  ) => void;
  onOpenPrivacyNotice?: () => void;
  onOpenHolderDataQuery?: () => void;
  canCreatePatient?: boolean;
  canAccessHabeasData?: boolean;
}

export const PatientsDirectoryPage: React.FC<PatientsDirectoryPageProps> = ({
  onSelectPatient,
  onOpenHolderDataQuery,
  canCreatePatient = true,
  canAccessHabeasData = false,
}) => {
  const { patients, isLoading, createPatient, updatePatient } = usePatients();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'document' | 'date'>('name');

  // Paginación (10 elementos por página idéntica a Doctores)
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Resetear a la página 1 cuando cualquier filtro o criterio cambie
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy]);

  // Modal de creación / edición y hooks de feedback
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientListItem | null>(null);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const { showAlert, AlertModalComponent } = useAlertModal();
  const { showToast, ToastContainerComponent } = useToast();

  // DEF-17 & CPS-HCL-004-02: Ocultar botón de historia clínica para Coordinadora (ROL-COA)
  const isCoordinator = useMemo(() => {
    try {
      const saved = window.sessionStorage.getItem('odontoleal_active_session_v1');
      if (!saved) return false;
      const parsed = JSON.parse(saved);
      const roles: any[] = parsed?.usuario?.roles || [];
      const roleCodes = roles.map((r) => (typeof r === 'string' ? r : r.codigoRol || r.nombreRol));
      const hasClinicalRole = roleCodes.some((rc) =>
        ['ROL-ODO', 'ROL-ESP', 'ROL-ADM'].includes(rc)
      );
      return roleCodes.includes('ROL-COA') && !hasClinicalRole;
    } catch {
      return false;
    }
  }, []);

  const filteredPatients = useMemo(() => {
    let result = [...patients];
    if (searchQuery.trim()) {
      const q = searchQuery
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      result = result.filter(
        (p) =>
          p.documentoIdentidad.includes(searchQuery.trim()) ||
          p.nombreCompleto
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .includes(q)
      );
    }

    if (sortBy === 'name') {
      result.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
    } else if (sortBy === 'document') {
      result.sort((a, b) => a.documentoIdentidad.localeCompare(b.documentoIdentidad));
    } else if (sortBy === 'date') {
      result.sort((a, b) => b.idPaciente - a.idPaciente);
    }
    return result;
  }, [patients, searchQuery, sortBy]);

  // Paginación: el scroll es el nativo de la página, nunca un contenedor interno
  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedPatients = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredPatients.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredPatients, safeCurrentPage]);

  const handleOpenCreate = () => {
    setEditingPatient(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (patient: PatientListItem) => {
    setEditingPatient(patient);
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = async (formData: PatientFormData) => {
    // RF-HCL-001 / RF-HCL-002: Validación previa de documento duplicado
    const existingDocPatient = patients.find(
      (p) =>
        p.documentoIdentidad.trim() === formData.documentoIdentidad.trim() &&
        (!editingPatient || p.idPaciente !== editingPatient.idPaciente)
    );

    if (existingDocPatient) {
      showAlert({
        title: 'Documento de Identidad Duplicado',
        type: 'error',
        children: (
          <div className="space-y-3 text-xs sm:text-sm text-[#4B5563]">
            <p>
              Ya existe un paciente registrado con el número de documento <strong>{formData.documentoIdentidad}</strong>:
            </p>
            <div className="rounded-xl border border-[#B91C1C]/25 bg-[#FEE2E2]/60 p-3 space-y-1 text-xs">
              <p className="font-bold text-[#1F2937]">Titular Registrado:</p>
              <p className="font-semibold text-[#1F2937] text-sm">{existingDocPatient.nombreCompleto}</p>
              <p className="text-[#64748B]">Documento: C.C. {existingDocPatient.documentoIdentidad}</p>
              {existingDocPatient.telefono && (
                <p className="text-[#64748B]">Teléfono: +57 {existingDocPatient.telefono}</p>
              )}
            </div>
            <p className="text-xs text-[#64748B]">
              Verifique el número ingresado o busque al paciente directamente desde el directorio para actualizar sus datos.
            </p>
          </div>
        ),
      });
      return;
    }

    try {
      if (editingPatient) {
        await updatePatient(editingPatient.idPaciente, formData);
        showToast({
          type: 'success',
          title: 'Ficha Actualizada',
          message: `Los datos del paciente ${formData.nombreCompleto} se han actualizado exitosamente.`,
        });
      } else {
        await createPatient(formData);
        showToast({
          type: 'success',
          title: 'Paciente Registrado',
          message: `El paciente ${formData.nombreCompleto} fue registrado en el sistema exitosamente.`,
        });
      }
      setIsFormModalOpen(false);
    } catch (err: any) {
      showAlert({
        title: 'No se pudo guardar el paciente',
        message: err?.message || 'Ocurrió un error al procesar el registro del paciente en el servidor.',
        type: 'error',
      });
    }
  };

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Directorio OdontoLeal"
        eyebrowDetail="Base de Pacientes Registrados"
        title="Pacientes"
        subtitle="Gestión y consulta de pacientes, historias clínicas e información de contacto."
        actions={
          <>
            {onOpenHolderDataQuery && canAccessHabeasData && (
              <PageHeaderAction variant="outline" onClick={onOpenHolderDataQuery}>
                Datos del Titular
              </PageHeaderAction>
            )}
            {canCreatePatient && (
              <PageHeaderAction
                variant="primary"
                onClick={handleOpenCreate}
                leftIcon={<PlusIcon />}
              >
                Nuevo paciente
              </PageHeaderAction>
            )}
          </>
        }
      />

      <PageToolbar aria-label="Filtros del directorio de pacientes">
        <ToolbarSearch
          placeholder="Buscar paciente por nombre o documento..."
          aria-label="Buscar paciente por nombre o documento"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 md:w-auto">
          <span className="whitespace-nowrap text-[13px] text-[#64748B]">
            <strong className="text-[#1E242B]">{filteredPatients.length}</strong>{' '}
            {filteredPatients.length === 1 ? 'registrado' : 'registrados'}
          </span>
          <ToolbarLabel>Ordenar por:</ToolbarLabel>
          <ToolbarSelect
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'document' | 'date')}
            aria-label="Ordenar pacientes"
            className="flex-1 md:flex-none"
          >
            <option value="name">Nombre (A - Z)</option>
            <option value="document">Documento de Identidad</option>
            <option value="date">Más recientes</option>
          </ToolbarSelect>
        </div>
      </PageToolbar>

      <PageList aria-label="Listado de pacientes">
        {isLoading ? (
          <ListState>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#FBF3D5] text-[#D4AF37]">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
            </div>
            <p className="text-sm font-bold text-[#1E242B]">Cargando directorio de pacientes...</p>
            <p className="text-xs text-[#64748B]">Obteniendo registros desde la base de datos...</p>
          </ListState>
        ) : filteredPatients.length === 0 ? (
          <ListState role="status">
            <p className="text-base font-bold text-[#1E242B]">No se encontraron pacientes</p>
            <p className="text-[13px] text-[#64748B]">
              Intente con otro término de búsqueda o registre un nuevo paciente con el botón
              superior.
            </p>
          </ListState>
        ) : (
          paginatedPatients.map((patient) => (
            <ListCard key={patient.idPaciente}>
              {/* Avatar + información principal (min-w-0 para permitir truncado) */}
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <InitialsAvatar name={patient.nombreCompleto} />

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2
                      onClick={() => onSelectPatient(patient)}
                      title={patient.nombreCompleto}
                      className="text-break cursor-pointer text-[15px] font-bold leading-snug text-[#1E242B] transition-colors hover:text-[#B8942A]"
                    >
                      {patient.nombreCompleto}
                    </h2>
                    <Badge
                      label={`CC ${patient.documentoIdentidad}`}
                      variant="neutral"
                      size="sm"
                      className="shrink-0 whitespace-nowrap"
                    />
                    {patient.edad !== undefined && (
                      <Badge
                        label={`${patient.edad} años`}
                        variant="gold"
                        size="sm"
                        className="shrink-0 whitespace-nowrap"
                      />
                    )}
                    {patient.datosIncompletos && (
                      <Badge
                        label="Datos incompletos"
                        variant="warning"
                        size="sm"
                        icon={<span>⚠️</span>}
                        className="shrink-0 whitespace-nowrap"
                      />
                    )}
                  </div>

                  {/* Datos de contacto */}
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#64748B]">
                    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                      <svg
                        className="h-3.5 w-3.5 text-[#D4AF37]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                      +57 {patient.telefono}
                    </span>
                    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                      <svg
                        className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      <span className="text-break" title={patient.correo}>
                        {patient.correo}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Acciones de la tarjeta */}
              <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:shrink-0 md:justify-end [&>*]:flex-[1_1_auto] md:[&>*]:flex-none">
                {!isCoordinator && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectPatient(patient, 'CLINICAL')}
                    leftIcon={
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    }
                  >
                    Ver historia clínica
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSelectPatient(patient, 'APPOINTMENTS')}
                  leftIcon={
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  }
                >
                  Historial de citas
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleOpenEdit(patient)}
                  leftIcon={
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  }
                >
                  Editar
                </Button>
              </div>
            </ListCard>
          ))
        )}
      </PageList>

      {!isLoading && (
        <Pagination
          currentPage={safeCurrentPage}
          pageSize={ITEMS_PER_PAGE}
          totalItems={filteredPatients.length}
          singularLabel="paciente registrado"
          pluralLabel="pacientes registrados"
          onPageChange={setCurrentPage}
        />
      )}

      {/* Footer Ley 1581 Habeas Data */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] pt-4 text-[13px] text-[#64748B]">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-[#137333]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <span>
            Historias clínicas encriptadas conforme a la Ley de Protección de Datos Médicos (Habeas
            Data).
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsPrivacyModalOpen(true)}
          className="underline transition-colors hover:text-[#B8942A]"
        >
          Aviso de Privacidad (Habeas Data)
        </button>
      </div>

      {/* Modal de Formulario Paciente */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingPatient ? 'Editar Ficha Clínica' : 'Registrar Nuevo Paciente'}
        subtitle={
          editingPatient
            ? `Paciente: ${editingPatient.nombreCompleto} (CC ${editingPatient.documentoIdentidad})`
            : 'Ficha médica base para apertura de historia clínica'
        }
        maxWidth="3xl"
      >
        <PatientForm
          isEditing={Boolean(editingPatient)}
          initialData={
            editingPatient
              ? {
                  idPaciente: editingPatient.idPaciente,
                  nombreCompleto: editingPatient.nombreCompleto,
                  documentoIdentidad: editingPatient.documentoIdentidad,
                  fechaNacimiento: editingPatient.fechaNacimiento,
                  sexo: editingPatient.sexo ?? undefined,
                  correo: editingPatient.correo,
                  telefono: editingPatient.telefono,
                }
              : undefined
          }
          onSubmit={handleFormSubmit}
          onCancel={() => setIsFormModalOpen(false)}
        />
      </Modal>

      {/* Modal de Aviso de Privacidad */}
      <PrivacyNoticeModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />

      {/* Diálogos Modales y Notificaciones Toast */}
      <AlertModalComponent />
      <ToastContainerComponent />
    </PageLayout>
  );
};
