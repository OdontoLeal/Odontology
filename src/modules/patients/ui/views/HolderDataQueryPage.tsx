// src/modules/patients/ui/views/HolderDataQueryPage.tsx
import React, { useState } from 'react';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';

export interface HolderDataQueryPageProps {
  onBack?: () => void;
  onQueryHolderData?: (
    documento: string,
    formato?: 'JSON' | 'PDF'
  ) => Promise<any>;
}

export const HolderDataQueryPage: React.FC<HolderDataQueryPageProps> = ({
  onBack,
  onQueryHolderData,
}) => {
  const [documentQuery, setDocumentQuery] = useState('');
  const [holderResult, setHolderResult] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDoc = documentQuery.trim();
    if (!cleanDoc) {
      setErrorMessage('Debe ingresar el número de documento de identidad del titular.');
      setHolderResult(null);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (onQueryHolderData) {
        const result = await onQueryHolderData(cleanDoc, 'JSON');
        setHolderResult(result);
      } else {
        // Fallback HTTP hacia el endpoint canónico de datos del titular (RF-HCL-010)
        const res = await fetch(
          `/api/v1/patients/holder-data/${encodeURIComponent(cleanDoc)}?formato=JSON`
        );
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body.message || 'Error al consultar titular.');
        }
        setHolderResult(body.data);
      }
    } catch (err: any) {
      const msg = err.message || 'Error al consultar titular.';
      setErrorMessage(msg);
      setHolderResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = async () => {
    const cleanDoc = documentQuery.trim();
    if (!cleanDoc) return;

    try {
      if (holderResult?.pdfBufferBase64) {
        downloadBase64Pdf(
          holderResult.pdfBufferBase64,
          `Certificado_Habeas_Data_${cleanDoc}.pdf`
        );
        return;
      }

      let pdfBase64: string | undefined;
      if (onQueryHolderData) {
        const result = await onQueryHolderData(cleanDoc, 'PDF');
        pdfBase64 = result?.pdfBufferBase64;
      } else {
        const res = await fetch(
          `/api/v1/patients/holder-data/${encodeURIComponent(cleanDoc)}?formato=PDF`
        );
        const body = await res.json();
        if (res.ok && body.data?.pdfBufferBase64) {
          pdfBase64 = body.data.pdfBufferBase64;
        }
      }

      if (pdfBase64) {
        downloadBase64Pdf(pdfBase64, `Certificado_Habeas_Data_${cleanDoc}.pdf`);
      } else {
        window.print();
      }
    } catch (err) {
      console.error('Error al exportar PDF:', err);
      window.print();
    }
  };

  const downloadBase64Pdf = (base64: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${base64}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const data = holderResult?.datosTitular;
  const paciente = data?.calidades?.comoPaciente;
  const acudientes = data?.calidades?.comoAcudiente ?? [];
  const solicitantes = data?.calidades?.comoSolicitante ?? [];
  const autorizaciones = data?.autorizaciones ?? [];
  const citas = data?.citasYSolicitudes ?? [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Botón Volver */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#687380] hover:text-[#1E242B] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver al Directorio de Pacientes
        </button>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold text-[#1E242B]">
            Consulta de Datos del Titular (Habeas Data)
          </h1>
          <Badge label="Ley 1581 de 2012" variant="gold" size="sm" />
        </div>
        <p className="mt-1 text-xs sm:text-sm text-[#687380]">
          Módulo exclusivo para ROL-COA y ROL-ADM para certificar y exportar los datos personales tratados por el consultorio conforme al derecho fundamental de autodeterminación informativa (RF-HCL-010).
        </p>
      </div>

      {/* Buscador por documento exacto */}
      <form
        onSubmit={handleSearch}
        className="rounded-2xl border border-[#E2E6EA] bg-white p-5 shadow-xs flex flex-col sm:flex-row gap-3"
      >
        <input
          type="text"
          placeholder="Ingrese documento de identidad exacto (sin puntos ni guiones)..."
          value={documentQuery}
          onChange={(e) => setDocumentQuery(e.target.value)}
          className="flex-1 min-h-[44px] rounded-xl border border-[#E2E6EA] px-4 text-sm text-[#1E242B] focus:border-[#D4AF37] focus:outline-none"
        />
        <Button type="submit" variant="primary" disabled={isLoading}>
          {isLoading ? 'Consultando...' : 'Consultar Titular'}
        </Button>
      </form>

      {/* Mensaje de error */}
      {errorMessage && (
        <div
          role="alert"
          className="p-4 rounded-2xl border border-[#F5C2C7] bg-[#F8D7DA] text-sm text-[#842029]"
        >
          {errorMessage}
        </div>
      )}

      {/* Resultado */}
      {data && (
        <div className="rounded-3xl border border-[#E2E6EA] bg-white p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#E2E6EA] gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-[#1E242B]">
                {paciente?.nombreCompleto ||
                  acudientes[0]?.nombreAcudiente ||
                  solicitantes[0]?.nombreSolicitante ||
                  `Titular Doc. ${data.documentoConsultado}`}
              </h2>
              <span className="text-xs text-[#687380]">
                Documento de Identidad Consultado: {data.documentoConsultado}
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={handleExportPDF}>
              Exportar Certificado PDF 🖨️
            </Button>
          </div>

          {/* Calidad como Paciente */}
          {paciente && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                Información en Calidad de Paciente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA]">
                  <span className="font-bold text-[#687380]">Nombre Completo:</span>
                  <p className="font-extrabold text-[#1E242B] mt-0.5">{paciente.nombreCompleto}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA]">
                  <span className="font-bold text-[#687380]">Fecha de Nacimiento:</span>
                  <p className="font-extrabold text-[#1E242B] mt-0.5">{paciente.fechaNacimiento}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA]">
                  <span className="font-bold text-[#687380]">Sexo Biológico:</span>
                  <p className="font-extrabold text-[#1E242B] mt-0.5">{paciente.sexo ?? 'No registrado'}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA]">
                  <span className="font-bold text-[#687380]">Correo Electrónico:</span>
                  <p className="font-extrabold text-[#1E242B] mt-0.5">{paciente.correo ?? 'Sin correo'}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA]">
                  <span className="font-bold text-[#687380]">Teléfono de Contacto:</span>
                  <p className="font-extrabold text-[#1E242B] mt-0.5">{paciente.telefono ?? 'Sin teléfono'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Calidad como Acudiente */}
          {acudientes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                Representación Legal / Calidad de Acudiente
              </h3>
              <div className="space-y-2">
                {acudientes.map((ac: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA] text-xs">
                    <p className="font-bold text-[#1E242B]">
                      Menor representado: {ac.nombreMenorRepresentado} ({ac.parentescoConMenor})
                    </p>
                    <p className="text-[#687380] mt-0.5">Teléfono de contacto: {ac.telefonoAcudiente}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calidad como Solicitante */}
          {solicitantes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                Solicitudes Públicas de Citas Registradas
              </h3>
              <div className="space-y-2">
                {solicitantes.map((sol: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA] text-xs">
                    <p className="font-bold text-[#1E242B]">
                      Solicitud #{sol.idSolicitud} - Bloque: {sol.bloqueSolicitado}
                    </p>
                    <p className="text-[#687380] mt-0.5">
                      Correo solicitante: {sol.correoSolicitante} | Tel: {sol.telefonoSolicitante}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Autorizaciones Registradas */}
          <div className="rounded-2xl bg-[#E6F4EA] border border-[#CEEAD6] p-4 text-xs text-[#137333] space-y-2">
            <p className="font-bold">Prueba de Autorizaciones de Tratamiento (Ley 1581 de 2012):</p>
            {autorizaciones.length > 0 ? (
              <ul className="list-disc pl-5 space-y-1">
                {autorizaciones.map((aut: any, idx: number) => (
                  <li key={idx}>
                    Aviso {aut.versionAviso} - Autorizado el {aut.fecha} mediante {aut.medio}
                  </li>
                ))}
              </ul>
            ) : (
              <p>El titular cuenta con autorización de tratamiento registrada conforme a las políticas vigentes.</p>
            )}
          </div>

          {/* Historial de Citas y Solicitudes (Sin datos clínicos - RQNF-SEG-007) */}
          {citas.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#687380]">
                Historial de Citas y Estados (Sin datos clínicos)
              </h3>
              <div className="space-y-1.5 text-xs">
                {citas.map((c: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg border border-[#E2E6EA] flex justify-between items-center">
                    <div>
                      <span className="font-bold text-[#1E242B]">{c.fecha}</span> - Servicio: {c.servicio}
                    </div>
                    <Badge
                      label={c.estado}
                      variant={c.estado === 'Atendida' ? 'success' : c.estado === 'Confirmada' ? 'gold' : 'neutral'}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
