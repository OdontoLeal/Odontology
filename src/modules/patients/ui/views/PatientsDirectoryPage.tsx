// src/modules/patients/ui/views/PatientsDirectoryPage.tsx
import React, { useState, useMemo } from 'react';
import { usePatients, PatientListItem } from '../hooks/usePatients';
import { PatientForm, PatientFormData } from '../components/PatientForm';
import { PrivacyNoticeModal } from '../components/PrivacyNoticeModal';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { Modal } from '../../../../shared/ui/components/Modal';

export interface PatientsDirectoryPageProps {
  onSelectPatient: (patient: PatientListItem, tab?: 'APPOINTMENTS' | 'CLINICAL' | 'CONSENTS' | 'DOCUMENTS') => void;
  onOpenPrivacyNotice?: () => void;
}

export const PatientsDirectoryPage: React.FC<PatientsDirectoryPageProps> = ({
  onSelectPatient,
}) => {
  const { patients, isLoading, createPatient, updatePatient } = usePatients();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'document' | 'date'>('name');

  // Modal de creación / edición
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientListItem | null>(null);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  const filteredPatients = useMemo(() => {
    let result = [...patients];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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

  const handleOpenCreate = () => {
    setEditingPatient(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (patient: PatientListItem) => {
    setEditingPatient(patient);
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = async (formData: PatientFormData) => {
    if (editingPatient) {
      await updatePatient(editingPatient.idPaciente, formData);
    } else {
      await createPatient(formData);
    }
    setIsFormModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb superior de diseño */}
      <div className="flex items-center justify-between text-xs text-[#8F99A3]">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-[#D4AF37] uppercase tracking-wider">
            ● Directorio OdontoLeal
          </span>
          <span>• Base de Pacientes Registrados</span>
        </div>
        <button
          type="button"
          onClick={() => setIsPrivacyModalOpen(true)}
          className="text-[#687380] hover:text-[#D4AF37] underline transition-colors"
        >
          Aviso de Privacidad (Habeas Data)
        </button>
      </div>

      {/* Header con Título y Botón Nuevo Paciente */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E242B]">
            Pacientes
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#687380]">
            Gestión y consulta centralizada de pacientes, historias clínicas e información de contacto médico-odontológico.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleOpenCreate}
          leftIcon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          Nuevo paciente
        </Button>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 rounded-2xl bg-white border border-[#E2E6EA] p-4 shadow-xs">
        {/* Totalizador */}
        <div className="flex items-center gap-2 text-sm text-[#1E242B]">
          <span className="text-[#D4AF37]">👥</span>
          <span className="font-bold">Total de Pacientes:</span>
          <span className="text-[#687380]">{filteredPatients.length} registrados</span>
        </div>

        {/* Input Buscador */}
        <div className="flex-1 max-w-md relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8F99A3]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar paciente por nombre o documento..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[40px] pl-10 pr-4 rounded-xl border border-[#E2E6EA] text-sm text-[#1E242B] placeholder-[#8F99A3] focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          />
        </div>

        {/* Selector de Orden */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#687380] font-bold">Ordenar por:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-xl border border-[#E2E6EA] bg-white px-3 py-2 text-xs font-semibold text-[#1E242B] focus:border-[#D4AF37] focus:outline-none"
          >
            <option value="name">Nombre (A - Z)</option>
            <option value="document">Documento de Identidad</option>
            <option value="date">Más recientes</option>
          </select>
        </div>
      </div>

      {/* Lista de Tarjetas de Pacientes */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12 text-[#8F99A3]">Cargando directorio de pacientes...</div>
        ) : filteredPatients.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-white border border-[#E2E6EA] p-8 space-y-2">
            <p className="text-base font-bold text-[#1E242B]">No se encontraron pacientes</p>
            <p className="text-xs text-[#8F99A3]">
              Intente con otro término de búsqueda o registre un nuevo paciente con el botón superior.
            </p>
          </div>
        ) : (
          filteredPatients.map((patient) => (
            <div
              key={patient.idPaciente}
              className="rounded-2xl border border-[#E2E6EA] bg-white p-5 shadow-xs hover:border-[#D4AF37]/60 hover:shadow-sm transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              {/* Información Principal del Paciente */}
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    onClick={() => onSelectPatient(patient)}
                    className="text-base font-extrabold text-[#1E242B] hover:text-[#D4AF37] cursor-pointer transition-colors"
                  >
                    {patient.nombreCompleto}
                  </h3>
                  <Badge
                    label={`CC ${patient.documentoIdentidad}`}
                    variant="neutral"
                    size="sm"
                  />
                  {patient.edad !== undefined && (
                    <Badge
                      label={`${patient.edad} años`}
                      variant="gold"
                      size="sm"
                    />
                  )}
                  {patient.datosIncompletos && (
                    <Badge
                      label="Datos incompletos"
                      variant="warning"
                      size="sm"
                      icon={<span>⚠️</span>}
                    />
                  )}
                </div>

                {/* Datos de Contacto */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-[#687380]">
                  <span className="inline-flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    +57 {patient.telefono}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {patient.correo}
                  </span>
                </div>
              </div>

              {/* Acciones de la Tarjeta */}
              <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSelectPatient(patient, 'CLINICAL')}
                  leftIcon={
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                >
                  Ver historia clínica
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSelectPatient(patient, 'APPOINTMENTS')}
                  leftIcon={
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  }
                >
                  Editar
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Ley 1581 Habeas Data */}
      <div className="flex items-center justify-between pt-4 border-t border-[#E2E6EA] text-[11px] text-[#8F99A3]">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-[#137333]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Historias clínicas encriptadas conforme a la Ley de Protección de Datos Médicos (Habeas Data).</span>
        </div>
        <div className="flex items-center gap-1 font-bold">
          <span className="h-6 w-6 rounded-lg bg-[#D4AF37] text-black flex items-center justify-center text-xs">
            1
          </span>
        </div>
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
                  sexo: editingPatient.sexo,
                  correo: editingPatient.correo,
                  telefono: editingPatient.telefono,
                  acudiente: editingPatient.acudiente,
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
    </div>
  );
};
