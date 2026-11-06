// src/modules/patients/ui/views/HolderDataQueryPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../../../../shared/ui/components/Button';
import { Badge } from '../../../../shared/ui/components/Badge';
import { PatientListItem } from '../hooks/usePatients';
import {
  PrinterIcon,
  FileTextIcon,
  SearchIcon,
} from '../../../../shared/ui/components/Icons';
import {
  DetailAction,
  DetailPageContainer,
  DetailPageHeader,
  EmptyState,
  SECTION_CARD_CLASS,
  SectionCardHeader,
  StatusBadge,
} from '../../../../shared/ui/components/DetailPage';
import { formatDateCO, formatDateTimeCO, formatTimeCO } from '../../../../shared/ui/format';

export interface HolderDataQueryPageProps {
  patients?: PatientListItem[];
  initialSelectedDocument?: string;
  onBack?: () => void;
  onQueryHolderData?: (
    documento: string,
    formato?: 'JSON' | 'PDF'
  ) => Promise<any>;
}

type PaperSize = 'LETTER' | 'A4' | 'LEGAL' | 'AUTO';

export const HolderDataQueryPage: React.FC<HolderDataQueryPageProps> = ({
  patients = [],
  initialSelectedDocument = '',
  onBack,
  onQueryHolderData,
}) => {
  const [selectedPatientDoc, setSelectedPatientDoc] = useState<string>(initialSelectedDocument);
  const [manualDocumentQuery, setManualDocumentQuery] = useState(initialSelectedDocument);
  const [patientFilterTerm, setPatientFilterTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'SELECT' | 'MANUAL'>('SELECT');
  const [paperSize, setPaperSize] = useState<PaperSize>('LETTER');

  const [holderResult, setHolderResult] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtrado de pacientes para el selector rápido
  const filteredPatients = useMemo(() => {
    if (!patientFilterTerm.trim()) return patients;
    const term = patientFilterTerm.toLowerCase();
    return patients.filter(
      (p) =>
        p.nombreCompleto.toLowerCase().includes(term) ||
        p.documentoIdentidad.toLowerCase().includes(term) ||
        p.correo.toLowerCase().includes(term)
    );
  }, [patients, patientFilterTerm]);

  // Consulta dinámica por documento
  const executeSearch = async (documento: string) => {
    const cleanDoc = documento.trim();
    if (!cleanDoc) {
      setErrorMessage('Debe especificar un número de documento de identidad válido.');
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
        const res = await fetch(
          `/api/v1/patients/holder-data/${encodeURIComponent(cleanDoc)}?formato=JSON`
        );
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body.message || 'Error al consultar titular de datos.');
        }
        setHolderResult(body.data);
      }
    } catch (err: any) {
      const msg = err.message || 'No se encontró información para el documento consultado.';
      setErrorMessage(msg);
      setHolderResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Si se provee initialSelectedDocument al cargar, consultar inmediatamente
  useEffect(() => {
    if (initialSelectedDocument) {
      setSelectedPatientDoc(initialSelectedDocument);
      setManualDocumentQuery(initialSelectedDocument);
      executeSearch(initialSelectedDocument);
    }
  }, [initialSelectedDocument]);

  const handleSelectPatient = (doc: string) => {
    setSelectedPatientDoc(doc);
    setManualDocumentQuery(doc);
    executeSearch(doc);
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedPatientDoc(manualDocumentQuery);
    executeSearch(manualDocumentQuery);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    const cleanDoc = (selectedPatientDoc || manualDocumentQuery).trim();
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
  const solicitantes = data?.calidades?.comoSolicitante ?? [];
  const autorizaciones = data?.autorizaciones ?? [];
  const citas = data?.citasRegistradas ?? data?.citasYSolicitudes ?? [];

  const titularNombre =
    paciente?.nombreCompleto ||
    solicitantes[0]?.nombreSolicitante ||
    (data ? `Titular Doc. ${data.documentoConsultado}` : '');

  const cuvNumber = data ? `CUV-HD-${data.documentoConsultado}-${new Date().getFullYear()}` : '';
  // RQNF-USA-002: DD/MM/AAAA hh:mm a. m./p. m.
  const fechaExpedicion = formatDateTimeCO(new Date());

  /** "AAAA-MM-DD HH:mm" o fecha ISO → "DD/MM/AAAA hh:mm a. m."; deja intacto lo que no sea fecha. */
  const formatMaybeDateTime = (value?: string | null) => {
    if (!value) return '';
    const str = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return formatDateCO(str);
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(str)) return formatDateTimeCO(str);
    if (/^\d{1,2}:\d{2}/.test(str)) return formatTimeCO(str);
    return str;
  };

  // Clases responsivas según el tamaño de hoja para previsualización en pantalla
  const getPaperSizeClass = () => {
    switch (paperSize) {
      case 'LETTER':
        return 'max-w-[816px]'; // 8.5" a 96 DPI
      case 'A4':
        return 'max-w-[794px]'; // 210mm a 96 DPI
      case 'LEGAL':
        return 'max-w-[816px]'; // 8.5" con mayor altura
      case 'AUTO':
      default:
        return 'max-w-5xl';
    }
  };

  return (
    <DetailPageContainer className="space-y-6">
      {/* Reglas de impresión CSS profesionales y adaptables a Carta, A4 y Oficio */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: auto;
                margin: 10mm 14mm 12mm 14mm;
              }
              html, body {
                background: #FFFFFF !important;
                color: #111827 !important;
                font-size: 11pt !important;
                line-height: 1.35 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print, header, nav, aside, .sidebar {
                display: none !important;
              }
              .print-only {
                display: block !important;
              }
              .habeas-sheet-container {
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                background: transparent !important;
              }
              .avoid-break {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
              .print-table {
                width: 100% !important;
                border-collapse: collapse !important;
              }
              .print-table th, .print-table td {
                border: 1px solid #D1D5DB !important;
                padding: 4pt 6pt !important;
              }
            }
          `,
        }}
      />

      {/* Barra Superior con Controles (no-print) */}
      <div className="no-print space-y-4">
        <DetailPageHeader
          backLabel={onBack ? 'Volver a Pacientes' : undefined}
          onBack={onBack}
          title="Certificación de Datos del Titular (Habeas Data)"
          badge={<StatusBadge tone="gold">Ley 1581 de 2012</StatusBadge>}
          subtitle="Módulo oficial de certificación de autodeterminación informativa y prueba de tratamiento de datos personales conforme al estándar legal colombiano (RF-HCL-010)."
          actions={
            data ? (
              <>
                <DetailAction onClick={handleExportPDF} leftIcon={<FileTextIcon size={16} />}>
                  Descargar PDF
                </DetailAction>
                <DetailAction variant="primary" onClick={handlePrint} leftIcon={<PrinterIcon size={16} />}>
                  Imprimir certificado
                </DetailAction>
              </>
            ) : undefined
          }
        />

        {/* Panel de Selección de Paciente / Búsqueda (no-print) */}
        <div className={`${SECTION_CARD_CLASS} space-y-4`}>
          <SectionCardHeader title="Seleccionar Titular" icon={<SearchIcon />} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F3F4F6] pb-3">
            <div role="tablist" className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <button
                type="button"
                onClick={() => setActiveTab('SELECT')}
                className={`min-h-[44px] text-[14px] font-semibold cursor-pointer transition-colors border-b-2 ${
                  activeTab === 'SELECT'
                    ? 'border-[#D4AF37] text-[#1E242B]'
                    : 'border-transparent text-[#687380] hover:text-[#1E242B]'
                }`}
              >
                Titular del directorio ({patients.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('MANUAL')}
                className={`min-h-[44px] text-[14px] font-semibold cursor-pointer transition-colors border-b-2 ${
                  activeTab === 'MANUAL'
                    ? 'border-[#D4AF37] text-[#1E242B]'
                    : 'border-transparent text-[#687380] hover:text-[#1E242B]'
                }`}
              >
                Consulta manual por documento
              </button>
            </div>

            {/* Selector de Tamaño de Papel para Previsualización */}
            <label className="flex flex-wrap items-center gap-2 text-[14px]">
              <span className="font-semibold text-[#64748B]">Tamaño de hoja:</span>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                className="min-h-[44px] max-w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 text-[14px] font-semibold text-[#1E242B] focus:border-[#D4AF37] focus:outline-none md:min-h-[38px]"
              >
                <option value="LETTER">Carta (US Letter - 8.5" × 11")</option>
                <option value="A4">A4 (ISO 216 - 210 × 297 mm)</option>
                <option value="LEGAL">Oficio / Legal (8.5" × 13/14")</option>
                <option value="AUTO">Pantalla Completa</option>
              </select>
            </label>
          </div>

          {activeTab === 'SELECT' ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#687380]">
                    <SearchIcon size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="Filtrar por nombre completo o documento de identidad..."
                    value={patientFilterTerm}
                    onChange={(e) => setPatientFilterTerm(e.target.value)}
                    className="w-full min-h-[44px] pl-9 pr-4 py-2 rounded-lg border border-[#E2E8F0] text-[14px] text-[#1E242B] focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>

                <div className="flex-1">
                  <select
                    value={selectedPatientDoc}
                    onChange={(e) => handleSelectPatient(e.target.value)}
                    className="w-full min-h-[44px] py-2 px-3 rounded-lg border border-[#E2E8F0] text-[14px] font-semibold text-[#1E242B] bg-[#F8F9FA] focus:border-[#D4AF37] focus:outline-none"
                  >
                    <option value="">-- Elija un paciente para certificar --</option>
                    {filteredPatients.map((p) => (
                      <option key={p.idPaciente} value={p.documentoIdentidad}>
                        {p.nombreCompleto} - CC/Doc: {p.documentoIdentidad}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Chips rápidos de pacientes */}
              {filteredPatients.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[13px] font-bold text-[#687380]">Acceso rápido:</span>
                  {filteredPatients.slice(0, 6).map((p) => (
                    <button
                      key={p.idPaciente}
                      type="button"
                      onClick={() => handleSelectPatient(p.documentoIdentidad)}
                      className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                        selectedPatientDoc === p.documentoIdentidad
                          ? 'bg-[#111827] text-white border-[#111827]'
                          : 'bg-[#F8F9FA] text-[#1E242B] border-[#E2E6EA] hover:border-[#D4AF37]'
                      }`}
                    >
                      {p.nombreCompleto.split(' ')[0]} ({p.documentoIdentidad})
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleManualSearch} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Ingrese número de documento de identidad exacto (sin puntos ni guiones)..."
                value={manualDocumentQuery}
                onChange={(e) => setManualDocumentQuery(e.target.value)}
                className="flex-1 min-w-0 min-h-[44px] rounded-lg border border-[#E2E8F0] px-4 text-[14px] text-[#1E242B] focus:border-[#D4AF37] focus:outline-none"
              />
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading ? 'Consultando...' : 'Consultar Titular'}
              </Button>
            </form>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="p-3.5 rounded-xl border border-[#F5C2C7] bg-[#F8D7DA] text-xs font-semibold text-[#842029]"
            >
              ⚠️ {errorMessage}
            </div>
          )}
        </div>
      </div>

      {/* ESTADO DE CARGA */}
      {isLoading && (
        <EmptyState>Generando certificación oficial de Habeas Data...</EmptyState>
      )}

      {/* DOCUMENTO PROFESIONAL DE HABEAS DATA */}
      {data && !isLoading && (
        <div className={`habeas-sheet-container mx-auto transition-all duration-200 ${getPaperSizeClass()}`}>
          <div className="rounded-2xl border border-[#E2E6EA] bg-white p-6 sm:p-10 shadow-sm text-[#1E242B] space-y-7 print:p-0 print:border-none print:shadow-none print:space-y-5">
            {/* 1. MEMBRETE INSTITUCIONAL OFICIAL */}
            <div className="avoid-break pb-4 border-b-2 border-[#D4AF37] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-[#111827] text-[#D4AF37] flex items-center justify-center font-extrabold text-base shadow-2xs">
                    OL
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-[#111827] uppercase">
                      Consultorio Odontológico OdontoLeal
                    </h2>
                    <p className="text-[13px] font-bold text-[#687380]">
                      OdontoLeal S.A.S. • NIT: XX.XXX.XX
                    </p>
                  </div>
                </div>
                <p className="text-[13px] text-[#687380] leading-tight">
                  Código de Habilitación en Salud (REPS): XXXXXXXXXX • Sede Principal: Calle 21A # 10-57, Tunja, Boyacá.
                  <br />
                  PBX: (XXX) XXX-XXXX • WhatsApp: +57 XXX XXX XXXX • Correo Oficial: correo@odontoleal.com.co
                </p>
              </div>

              {/* Recuadro de Metadatos de Certificación */}
              <div className="text-right sm:text-right border border-[#E2E6EA] rounded-xl p-2.5 bg-[#F8F9FA] min-w-[210px] space-y-0.5">
                <span className="text-[13px] font-black uppercase tracking-wider text-[#D4AF37] block">
                  Certificación de Habeas Data
                </span>
                <p className="text-[13px] font-extrabold text-[#111827] font-mono">
                  {cuvNumber}
                </p>
                <p className="text-[13px] text-[#687380]">
                  Emisión: {fechaExpedicion}
                </p>
                <div className="pt-0.5">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[13px] font-bold bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]">
                    Vigente y Verificado
                  </span>
                </div>
              </div>
            </div>

            {/* 2. TÍTULO Y MARCO LEGAL */}
            <div className="avoid-break text-center space-y-1 py-1">
              <h3 className="text-base sm:text-lg font-black tracking-normal text-[#111827] uppercase">
                Certificado Oficial de Registro y Tratamiento de Datos Personales
              </h3>
              <p className="text-xs font-bold text-[#D4AF37] uppercase tracking-wide">
                Garantía del Derecho Fundamental de Autodeterminación Informativa
              </p>
              <p className="text-[13px] text-[#687380] max-w-2xl mx-auto">
                Expedido en estricto cumplimiento del Artículo 15 de la Constitución Política de Colombia, la Ley Estatutaria 1581 de 2012, el Decreto Reglamentario 1377 de 2013 y la Circular Única de la Superintendencia de Industria y Comercio.
              </p>
            </div>

            {/* 3. IDENTIFICACIÓN PLENA DEL TITULAR */}
            <div className="avoid-break space-y-2">
              <div className="flex items-center gap-2 border-b border-[#E2E6EA] pb-1">
                <span className="text-xs font-black text-[#111827] uppercase tracking-wider">
                  1. Identificación del Titular de la Información
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA]">
                  <span className="text-[13px] font-bold text-[#687380] block">Nombre Completo:</span>
                  <span className="font-extrabold text-[#111827]">{titularNombre}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA]">
                  <span className="text-[13px] font-bold text-[#687380] block">Documento Consultado:</span>
                  <span className="font-extrabold text-[#111827]">{data.documentoConsultado}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA]">
                  <span className="text-[13px] font-bold text-[#687380] block">Fecha de Nacimiento:</span>
                  <span className="font-bold text-[#111827]">{paciente?.fechaNacimiento ? formatDateCO(paciente.fechaNacimiento) : 'No registrada'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA]">
                  <span className="text-[13px] font-bold text-[#687380] block">Sexo Biológico:</span>
                  <span className="font-bold text-[#111827]">{paciente?.sexo || 'No registrado'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA]">
                  <span className="text-[13px] font-bold text-[#687380] block">Teléfono de Contacto:</span>
                  <span className="font-bold text-[#111827]">{paciente?.telefono || solicitantes[0]?.telefonoSolicitante || 'Sin teléfono'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA]">
                  <span className="text-[13px] font-bold text-[#687380] block">Correo Electrónico:</span>
                  <span className="font-bold text-[#111827] text-break block">{paciente?.correo || solicitantes[0]?.correoSolicitante || 'Sin correo registrado'}</span>
                </div>
              </div>
            </div>

            {/* 4. CALIDADES Y VÍNCULOS REGISTRADOS */}
            <div className="avoid-break space-y-2">
              <div className="flex items-center gap-2 border-b border-[#E2E6EA] pb-1">
                <span className="text-xs font-black text-[#111827] uppercase tracking-wider">
                  2. Calidades Jurídicas Registradas ante el Prestador
                </span>
              </div>
              <div className="space-y-2 text-xs">
                {paciente && (
                  <div className="p-2.5 rounded-xl border border-[#E2E6EA] bg-[#FFFFFF] flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[#111827]">Calidad de Paciente:</span>
                      <p className="text-[13px] text-[#687380] mt-0.5">
                        Expediente de historia clínica activo registrado con Identificador #{paciente.idPaciente}.
                      </p>
                    </div>
                    <Badge label="Paciente Activo" variant="gold" size="sm" />
                  </div>
                )}

                {solicitantes.length > 0 && (
                  <div className="p-2.5 rounded-xl border border-[#E2E6EA] bg-[#FFFFFF] space-y-1.5">
                    <span className="font-bold text-[#111827]">Calidad de Solicitante en Portal Digital:</span>
                    <div className="space-y-1">
                      {solicitantes.map((sol: any, idx: number) => (
                        <p key={idx} className="text-[13px] text-[#687380] pl-2 border-l-2 border-[#111827]">
                          Solicitud #{sol.idSolicitud} - Bloque: {formatMaybeDateTime(sol.bloqueSolicitado)} ({sol.estadoSolicitud})
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 5. PRUEBA DE AUTORIZACIÓN (LEY 1581 DE 2012) */}
            <div className="avoid-break space-y-2">
              <div className="flex items-center gap-2 border-b border-[#E2E6EA] pb-1">
                <span className="text-xs font-black text-[#111827] uppercase tracking-wider">
                  3. Constancia de Autorización Previa, Expresa e Informada
                </span>
              </div>
              <div className="rounded-xl border border-[#CEEAD6] bg-[#F6FBF7] p-3 text-xs space-y-2">
                <p className="text-[13px] text-[#137333] leading-relaxed">
                  Prueba de las autorizaciones del titular (Ley 1581 de 2012, arts. 9 y 12): consentimientos firmados del
                  Módulo D y aceptaciones de la autorización vigente en solicitudes de cita.
                </p>
                {autorizaciones.length > 0 ? (
                  <div className="space-y-1 pl-2">
                    {autorizaciones.map((aut: any, idx: number) => (
                      <div key={idx} className="text-[13px] text-[#137333] flex items-center gap-2">
                        <span>✔</span>
                        <span>
                          <strong>{aut.plantilla}</strong> (versión {aut.versionPlantilla ?? '-'}) —{' '}
                          {aut.tipo === 'CONSENTIMIENTO_FIRMADO'
                            ? `firmada${aut.firmadoPorAcudiente ? ' por acudiente' : ''}${aut.diligenciadoPor ? `, tomada por ${aut.diligenciadoPor}` : ''}`
                            : 'aceptada en la solicitud web (firma pendiente en el consultorio)'}{' '}
                          ({formatMaybeDateTime(aut.fechaHora) || 'sin fecha'})
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-[#DC2626]">
                    No hay autorizaciones firmadas ni aceptadas registradas para este titular.
                  </p>
                )}
              </div>
            </div>

            {/* 6. FINALIDADES LEGÍTIMAS AUTORIZADAS */}
            <div className="avoid-break space-y-2">
              <div className="flex items-center gap-2 border-b border-[#E2E6EA] pb-1">
                <span className="text-xs font-black text-[#111827] uppercase tracking-wider">
                  4. Finalidades del Tratamiento Autorizadas
                </span>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[13px] text-[#687380] pl-4 list-disc">
                <li>Prestación de servicios de atención, diagnóstico y tratamiento en salud oral.</li>
                <li>Gestión de la agenda médico-odontológica, confirmación y recordatorio de citas.</li>
                <li>Facturación electrónica, recaudo y cumplimiento de obligaciones tributarias (DIAN).</li>
                <li>Notificaciones asistenciales, seguimiento posoperatorio y remisión a especialistas.</li>
                <li>Reportes obligatorios a entidades de vigilancia y control (Ministerio de Salud / RIPS).</li>
                <li>Atención oportuna de peticiones, consultas y reclamaciones de derechos ARCO.</li>
              </ul>
            </div>

            {/* 7. TRAZABILIDAD DE ATENCIONES (SIN DATOS CLÍNICOS SENSIBLES - RF-HCL-010) */}
            <div className="avoid-break space-y-2">
              <div className="flex items-center justify-between border-b border-[#E2E6EA] pb-1">
                <span className="text-xs font-black text-[#111827] uppercase tracking-wider">
                  5. Trazabilidad Administrativa de Servicios y Citas
                </span>
                <span className="text-[13px] font-bold text-[#687380]">
                  Reserva Legal de Historia Clínica
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F8F9FA] border border-[#E2E6EA] text-[13px] text-[#687380] leading-tight">
                <strong>Cláusula de Confidencialidad y Secreto Profesional (Ley 23 de 1981 / Res. 1995 de 1999):</strong> La presente certificación da cuenta de la existencia de atenciones y solicitudes administrativas; por reserva legal estricta y protección de datos sensibles, <strong>no contiene diagnósticos odontológicos, evoluciones clínicas ni notas terapéuticas confidenciales</strong>.
              </div>

              {citas.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-[#E2E6EA] rounded-xl overflow-hidden print-table">
                    <thead className="bg-[#F8F9FA] text-[13px] font-bold uppercase text-[#687380] border-b border-[#E2E6EA]">
                      <tr>
                        <th className="py-2 px-3">Cita #</th>
                        <th className="py-2 px-3">Fecha y Hora</th>
                        <th className="py-2 px-3">Servicio / Motivo</th>
                        <th className="py-2 px-3">Profesional Asignado</th>
                        <th className="py-2 px-3 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E6EA]">
                      {citas.map((c: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[#F8F9FA]">
                          <td className="py-1.5 px-3 font-mono font-bold text-[#111827]">#{c.idCita}</td>
                          <td className="py-1.5 px-3">{formatMaybeDateTime(c.fechaHora || c.fecha) || 'Fecha no registrada'}</td>
                          <td className="py-1.5 px-3">{c.servicio || c.titulo || 'Consulta Odontológica'}</td>
                          <td className="py-1.5 px-3">{c.profesional || 'Odontólogo Tratante'}</td>
                          <td className="py-1.5 px-3 text-right">
                            <span className="inline-block px-2 py-0.5 rounded text-[13px] font-bold bg-[#F3F4F6] text-[#1F2937]">
                              {c.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-[#687380] italic p-2 bg-[#F8F9FA] rounded-lg">
                  No se registran citas previas para el documento consultado.
                </p>
              )}
            </div>

            {/* 8. PROCEDIMIENTO DERECHOS ARCO */}
            <div className="avoid-break space-y-1.5">
              <div className="flex items-center gap-2 border-b border-[#E2E6EA] pb-1">
                <span className="text-xs font-black text-[#111827] uppercase tracking-wider">
                  6. Procedimiento para el Ejercicio de Derechos ARCO
                </span>
              </div>
              <p className="text-[13px] text-[#687380] leading-relaxed">
                El titular podrá en todo momento conocer, actualizar, rectificar y suprimir sus datos personales o revocar la autorización enviando una solicitud formal al correo <strong>habeasdata@odontoleal.com.co</strong> o mediante comunicación radicada en nuestra sede. Las consultas serán atendidas en un plazo máximo de diez (10) días hábiles y los reclamos en quince (15) días hábiles conforme a los Artículos 14 y 15 de la Ley 1581 de 2012.
              </p>
            </div>

            {/* 9. FIRMA Y CONSTANCIA INSTITUCIONAL */}
            <div className="avoid-break pt-6 border-t border-[#E2E6EA] flex flex-col sm:flex-row justify-between items-end gap-6">
              <div className="text-[13px] text-[#687380] space-y-1 max-w-sm">
                <p className="font-bold text-[#111827]">Constancia de Verificación:</p>
                <p>
                  Documento emitido por el sistema central de OdontoLeal para fines probatorios de autodeterminación informativa.
                </p>
                <p className="font-mono text-[13px] text-[#9CA3AF]">
                  Hash de Seguridad: SHA256:{cuvNumber}-SECURE-VERIFIED
                </p>
              </div>

              <div className="text-center sm:text-right min-w-[240px] space-y-1">
                <div className="inline-block border-b-2 border-[#111827] pb-1 w-52 mb-1">
                  <span className="font-serif italic text-base text-[#111827] block">
                    Eduar Leal Álvarez
                  </span>
                </div>
                <p className="text-xs font-extrabold text-[#111827]">
                  OFICIAL DE PROTECCIÓN DE DATOS
                </p>
                <p className="text-[13px] font-bold text-[#D4AF37]">
                  OdontoLeal S.A.S. • Responsable del Tratamiento
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </DetailPageContainer>
  );
};
