// src/modules/patients/ui/components/PatientForm.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '../../../../shared/ui/components/Button';
import { Input } from '../../../../shared/ui/components/Input';
import { Badge } from '../../../../shared/ui/components/Badge';

export interface PatientFormData {
  idPaciente?: number;
  nombreCompleto: string;
  documentoIdentidad: string;
  fechaNacimiento: string; // YYYY-MM-DD
  sexo: 'Femenino' | 'Masculino' | 'Indeterminado';
  correo: string;
  telefono: string;
  acudiente?: {
    nombreCompleto: string;
    documentoIdentidad: string;
    parentesco: string;
    telefono: string;
  };
}

export interface PatientFormProps {
  initialData?: Partial<PatientFormData>;
  isEditing?: boolean;
  onSubmit: (data: PatientFormData) => Promise<void> | void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const PatientForm: React.FC<PatientFormProps> = ({
  initialData,
  isEditing = false,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [nombreCompleto, setNombreCompleto] = useState(initialData?.nombreCompleto || '');
  const [documentoIdentidad, setDocumentoIdentidad] = useState(initialData?.documentoIdentidad || '');
  const [fechaNacimiento, setFechaNacimiento] = useState(initialData?.fechaNacimiento || '');
  const [sexo, setSexo] = useState<'Femenino' | 'Masculino' | 'Indeterminado'>(
    initialData?.sexo || 'Femenino'
  );
  const [correo, setCorreo] = useState(initialData?.correo || '');
  const [telefono, setTelefono] = useState(initialData?.telefono || '');

  // Guardian info for minors (<18 years)
  const [guardianNombre, setGuardianNombre] = useState(initialData?.acudiente?.nombreCompleto || '');
  const [guardianDocumento, setGuardianDocumento] = useState(initialData?.acudiente?.documentoIdentidad || '');
  const [guardianParentesco, setGuardianParentesco] = useState(initialData?.acudiente?.parentesco || 'Madre');
  const [guardianTelefono, setGuardianTelefono] = useState(initialData?.acudiente?.telefono || '');

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calcular edad
  const calculateAge = (dobString: string): number | null => {
    if (!dobString) return null;
    const parts = dobString.split('-');
    if (parts.length !== 3) return null;
    const birthDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  };

  const calculatedAge = calculateAge(fechaNacimiento);
  const isMinor = calculatedAge !== null && calculatedAge < 18;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nombreCompleto.trim()) {
      newErrors.nombreCompleto = 'El nombre completo es obligatorio.';
    }
    if (!documentoIdentidad.trim()) {
      newErrors.documentoIdentidad = 'El documento de identidad es obligatorio.';
    } else if (!/^\d+$/.test(documentoIdentidad.trim())) {
      newErrors.documentoIdentidad = 'El documento solo debe contener números.';
    }

    if (!correo.trim()) {
      newErrors.correo = 'El correo electrónico es obligatorio.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      newErrors.correo = 'El correo electrónico no tiene un formato válido.';
    }

    if (!telefono.trim()) {
      newErrors.telefono = 'El teléfono móvil es obligatorio.';
    } else if (!/^\d{10}$/.test(telefono.trim().replace(/\D/g, ''))) {
      newErrors.telefono = 'El teléfono debe contener 10 dígitos numéricos.';
    }

    if (!fechaNacimiento.trim()) {
      newErrors.fechaNacimiento = 'La fecha de nacimiento es obligatoria.';
    }

    if (isMinor) {
      if (!guardianNombre.trim()) {
        newErrors.guardianNombre = 'El nombre del acudiente es obligatorio para menores de edad.';
      }
      if (!guardianDocumento.trim()) {
        newErrors.guardianDocumento = 'El documento del acudiente es obligatorio.';
      }
      if (!guardianTelefono.trim()) {
        newErrors.guardianTelefono = 'El teléfono del acudiente es obligatorio.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const formattedData: PatientFormData = {
      idPaciente: initialData?.idPaciente,
      nombreCompleto: nombreCompleto.trim(),
      documentoIdentidad: documentoIdentidad.trim(),
      fechaNacimiento,
      sexo,
      correo: correo.trim().toLowerCase(),
      telefono: telefono.trim().replace(/\D/g, ''),
      acudiente: isMinor
        ? {
            nombreCompleto: guardianNombre.trim(),
            documentoIdentidad: guardianDocumento.trim(),
            parentesco: guardianParentesco.trim(),
            telefono: guardianTelefono.trim().replace(/\D/g, ''),
          }
        : undefined,
    };

    onSubmit(formattedData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Banner de datos */}
      <div className="rounded-2xl bg-[#FBF6E6] border border-[#EAD89B] p-4 text-xs text-[#8F721A] flex items-center gap-3">
        <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          {isEditing
            ? 'Actualice los datos personales y de contacto del paciente en el sistema médico de OdontoLeal.'
            : 'Crea la ficha base del paciente en el sistema médico de OdontoLeal para aperturar su historia clínica y agenda de citas.'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Nombre completo */}
        <Input
          label="Nombre Completo"
          required
          placeholder="Ej: Sofía Mariana Carvajal Duque"
          value={nombreCompleto}
          onChange={(e) => setNombreCompleto(e.target.value)}
          error={errors.nombreCompleto}
        />

        {/* Documento de Identidad */}
        <div>
          <Input
            label="Documento de Identidad"
            required
            disabled={isEditing}
            placeholder="Ej: 1020456789"
            value={documentoIdentidad}
            onChange={(e) => setDocumentoIdentidad(e.target.value)}
            error={errors.documentoIdentidad}
            helperText={
              isEditing
                ? 'El documento de identidad es inmodificable para preservar la trazabilidad médica.'
                : 'C.C., T.I., Registro Civil o Pasaporte (solo dígitos)'
            }
          />
        </div>

        {/* Correo Electrónico */}
        <Input
          type="email"
          label="Correo Electrónico"
          required
          placeholder="sofia.carvajal@email.com"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          error={errors.correo}
        />

        {/* Teléfono Móvil */}
        <Input
          type="tel"
          label="Teléfono Móvil / WhatsApp"
          required
          placeholder="3158901234"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          error={errors.telefono}
          helperText="10 dígitos para confirmaciones y recordatorios por correo"
        />

        {/* Fecha de Nacimiento */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380]">
              Fecha de Nacimiento <span className="text-[#DC2626]">*</span>
            </label>
            {calculatedAge !== null && (
              <Badge
                label={`Edad: ${calculatedAge} años`}
                variant={isMinor ? 'warning' : 'neutral'}
                size="sm"
              />
            )}
          </div>
          <input
            type="date"
            max={new Date().toISOString().split('T')[0]}
            className={`w-full min-h-[44px] rounded-xl border bg-white px-3.5 py-2 text-sm text-[#1E242B] transition-colors focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 ${
              errors.fechaNacimiento
                ? 'border-[#DC2626]'
                : 'border-[#E2E6EA] hover:border-[#CBD2D9]'
            }`}
            value={fechaNacimiento}
            onChange={(e) => setFechaNacimiento(e.target.value)}
          />
          {errors.fechaNacimiento && (
            <p className="mt-1 text-xs font-semibold text-[#DC2626]">
              {errors.fechaNacimiento}
            </p>
          )}
        </div>

        {/* Sexo Biológico */}
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-2">
            Sexo Biológico <span className="text-[#DC2626]">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSexo('Femenino')}
              className={`min-h-[44px] rounded-xl border font-bold text-sm transition-all ${
                sexo === 'Femenino'
                  ? 'bg-[#1E242B] text-white border-[#1E242B] shadow-xs'
                  : 'bg-white text-[#687380] border-[#E2E6EA] hover:border-[#D4AF37]'
              }`}
            >
              Femenino
            </button>
            <button
              type="button"
              onClick={() => setSexo('Masculino')}
              className={`min-h-[44px] rounded-xl border font-bold text-sm transition-all ${
                sexo === 'Masculino'
                  ? 'bg-[#1E242B] text-white border-[#1E242B] shadow-xs'
                  : 'bg-white text-[#687380] border-[#E2E6EA] hover:border-[#D4AF37]'
              }`}
            >
              Masculino
            </button>
          </div>
        </div>
      </div>

      {/* Sección Condicional: Datos del Acudiente para Menores de Edad (< 18 años) */}
      {isMinor && (
        <div className="rounded-2xl border-2 border-dashed border-[#D4AF37] bg-[#FBF6E6]/40 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Badge label="Menor de Edad (Ley 27 de 1977)" variant="warning" />
            <h4 className="text-sm font-extrabold text-[#1E242B]">
              Información Obligatoria del Acudiente / Representante Legal
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre del Acudiente"
              required
              placeholder="Ej: Carlos Carvajal"
              value={guardianNombre}
              onChange={(e) => setGuardianNombre(e.target.value)}
              error={errors.guardianNombre}
            />
            <Input
              label="Documento del Acudiente"
              required
              placeholder="Ej: 79845123"
              value={guardianDocumento}
              onChange={(e) => setGuardianDocumento(e.target.value)}
              error={errors.guardianDocumento}
            />
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-1.5">
                Parentesco <span className="text-[#DC2626]">*</span>
              </label>
              <select
                value={guardianParentesco}
                onChange={(e) => setGuardianParentesco(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[#E2E6EA] bg-white px-3.5 py-2 text-sm text-[#1E242B] focus:border-[#D4AF37] focus:outline-none"
              >
                <option value="Madre">Madre</option>
                <option value="Padre">Padre</option>
                <option value="Tutor Legal">Tutor Legal</option>
                <option value="Familiar Responsable">Familiar Responsable</option>
              </select>
            </div>
            <Input
              label="Teléfono del Acudiente"
              required
              placeholder="3101234567"
              value={guardianTelefono}
              onChange={(e) => setGuardianTelefono(e.target.value)}
              error={errors.guardianTelefono}
            />
          </div>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E2E6EA]">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          leftIcon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          }
        >
          {isEditing ? 'Guardar Cambios' : 'Crear Ficha de Paciente'}
        </Button>
      </div>
    </form>
  );
};
