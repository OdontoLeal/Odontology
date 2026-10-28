// src/modules/patients/ui/views/HolderDataQueryPage.tsx
import React, { useState } from 'react';
import { usePatients, PatientListItem } from '../hooks/usePatients';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';

export const HolderDataQueryPage: React.FC = () => {
  const { patients } = usePatients();
  const [documentQuery, setDocumentQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientListItem | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const found = patients.find((p) => p.documentoIdentidad === documentQuery.trim());
    setSelectedPatient(found || null);
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold text-[#1E242B]">
            Consulta de Datos del Titular (Habeas Data)
          </h1>
          <Badge label="Ley 1581 de 2012" variant="gold" size="sm" />
        </div>
        <p className="mt-1 text-xs sm:text-sm text-[#687380]">
          Módulo exclusivo para ROL-COA y ROL-ADM para certificar y exportar los datos personales tratados por el consultorio médico conforme al derecho fundamental de autodeterminación informativa.
        </p>
      </div>

      {/* Buscador por documento exacto */}
      <form onSubmit={handleSearch} className="rounded-2xl border border-[#E2E6EA] bg-white p-5 shadow-xs flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Ingrese documento de identidad exacto (sin puntos ni guiones)..."
          value={documentQuery}
          onChange={(e) => setDocumentQuery(e.target.value)}
          className="flex-1 min-h-[44px] rounded-xl border border-[#E2E6EA] px-4 text-sm text-[#1E242B] focus:border-[#D4AF37] focus:outline-none"
        />
        <Button type="submit" variant="primary">
          Consultar Titular
        </Button>
      </form>

      {/* Resultado */}
      {selectedPatient && (
        <div className="rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E2E6EA]">
            <div>
              <h2 className="text-xl font-extrabold text-[#1E242B]">
                {selectedPatient.nombreCompleto}
              </h2>
              <span className="text-xs text-[#687380]">
                Documento de Identidad: C.C. {selectedPatient.documentoIdentidad}
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={handleExportPDF}>
              Exportar Certificado PDF 🖨️
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA]">
              <span className="font-bold text-[#687380]">Fecha de Nacimiento:</span>
              <p className="font-extrabold text-[#1E242B] mt-0.5">{selectedPatient.fechaNacimiento}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA]">
              <span className="font-bold text-[#687380]">Sexo Biológico:</span>
              <p className="font-extrabold text-[#1E242B] mt-0.5">{selectedPatient.sexo}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA]">
              <span className="font-bold text-[#687380]">Correo Electrónico:</span>
              <p className="font-extrabold text-[#1E242B] mt-0.5">{selectedPatient.correo}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA]">
              <span className="font-bold text-[#687380]">Teléfono de Contacto:</span>
              <p className="font-extrabold text-[#1E242B] mt-0.5">+57 {selectedPatient.telefono}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-[#E6F4EA] border border-[#CEEAD6] p-4 text-xs text-[#137333]">
            <p className="font-bold">Autorización de Tratamiento Vigente:</p>
            <p className="mt-1">
              El titular autorizó el tratamiento de sus datos de salud con fines asistenciales odontológicos conforme a la política vigente de OdontoLeal.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
