// src/modules/appointments/ui/views/PublicBookingPage.tsx
import React, { useState, useEffect } from 'react';
import { formatLongDateCO, formatTimeCO } from '../../../../shared/ui/format';
import { Button } from '../../../../shared/ui/components/Button';
import { Input } from '../../../../shared/ui/components/Input';
import { Modal } from '../../../../shared/ui/components/Modal';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';
import { Badge } from '../../../../shared/ui/components/Badge';
import { PrivacyNoticeModal } from '../../../patients/ui/components/PrivacyNoticeModal';
import { usePrivacyNotice } from '../../../consents/ui/hooks/usePrivacyNotice';
import { PublicNavbar } from '../../../../shared/ui/components/PublicNavbar';

export interface AvailableSlotItem {
  label: string;
  rawInicio: string;
}

export interface PublicBookingPageProps {
  onNavigateToStaffLogin?: () => void;
  /** RQNF-SEG-006: abre el aviso de privacidad completo (página pública). */
  onOpenPrivacyNotice?: () => void;
}

export const PublicBookingPage: React.FC<PublicBookingPageProps> = ({
  onNavigateToStaffLogin,
  onOpenPrivacyNotice,
}) => {
  // Datos del Paciente
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [documentoIdentidad, setDocumentoIdentidad] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [telefono, setTelefono] = useState('');
  const [genero, setGenero] = useState<'Femenino' | 'Masculino' | 'Indeterminado' | ''>('');
  const [correo, setCorreo] = useState('');
  const [motivoConsulta, setMotivoConsulta] = useState('');

  // RQNF-SEG-005 (ERS v1.3): se acepta el texto de la plantilla vigente de autorización del Módulo D;
  // la autorización firmada se toma después en el consultorio.
  const [autorizacionDatos, setAutorizacionDatos] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const { notice: privacyNotice } = usePrivacyNotice();

  // Fecha y Horario Dinámicos desde Base de Datos (estado = true AND ocupacion = false)
  const defaultDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [availableHours, setAvailableHours] = useState<AvailableSlotItem[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlotItem | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Modales
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showAlert, AlertModalComponent } = useAlertModal();

  // Función reutilizable para consultar bloques disponibles desde la base de datos
  const loadSlots = (dateStr: string) => {
    if (!dateStr) return;
    setIsLoadingSlots(true);
    fetch(`/api/v1/appointments/available-slots?fecha=${dateStr}`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => {
        const rawSlots: any[] = json.data || [];
        const formatted: AvailableSlotItem[] = rawSlots.map((s: any) => {
          const clean = String(s.inicio || '').trim();
          let timePart = clean;
          if (timePart.includes('T')) {
            timePart = timePart.split('T')[1];
          } else if (timePart.includes(' ')) {
            timePart = timePart.split(' ')[1];
          }
          const [hStr, mStr] = timePart.split(':');
          const h = Number(hStr);
          const m = (mStr || '00').replace(/\D/g, '').padStart(2, '0');
          // RQNF-USA-002: Formato colombiano 12 horas con 'a. m.' y 'p. m.' en minúsculas
          const period = h >= 12 ? 'p. m.' : 'a. m.';
          let h12 = h % 12;
          if (h12 === 0) h12 = 12;
          const label = `${h12.toString().padStart(2, '0')}:${m} ${period}`;
          const rawInicio = clean.includes('T') ? clean.replace('T', ' ').split('.')[0] : clean;
          return {
            label,
            rawInicio,
          };
        });

        setAvailableHours(formatted);
        if (formatted.length > 0) {
          setSelectedSlot(formatted[0]);
        } else {
          setSelectedSlot(null);
        }
      })
      .catch((err) => {
        console.error('Error al consultar horarios disponibles desde la base de datos:', err);
        setAvailableHours([]);
        setSelectedSlot(null);
      })
      .finally(() => {
        setIsLoadingSlots(false);
      });
  };

  // Consulta dinámica de bloques disponibles al cambiar la fecha seleccionada
  useEffect(() => {
    loadSlots(selectedDate);
  }, [selectedDate]);

  // Limpiar el formulario al aceptar el modal de confirmación final
  const handleCloseSuccessModal = () => {
    setIsSuccessModalOpen(false);
    setNombreCompleto('');
    setDocumentoIdentidad('');
    setFechaNacimiento('');
    setTelefono('');
    setGenero('');
    setCorreo('');
    setMotivoConsulta('');
    setAutorizacionDatos(false);
    setSelectedSlot(null);
    if (selectedDate) {
      loadSlots(selectedDate);
    }
  };

  const handlePreConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !nombreCompleto.trim() ||
      !documentoIdentidad.trim() ||
      !correo.trim() ||
      !telefono.trim() ||
      !fechaNacimiento.trim()
    ) {
      showAlert({
        title: 'Campos Obligatorios Incompletos',
        message:
          'Complete su nombre completo, documento de identidad, fecha de nacimiento, teléfono y correo electrónico antes de continuar.',
        type: 'warning',
      });
      return;
    }
    if (!/^\d+$/.test(documentoIdentidad.trim())) {
      showAlert({ title: 'Documento no válido', message: 'El documento debe contener solo dígitos.', type: 'warning' });
      return;
    }
    if (!/^\d{10}$/.test(telefono.trim())) {
      showAlert({ title: 'Teléfono no válido', message: 'El teléfono debe tener 10 dígitos.', type: 'warning' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      showAlert({ title: 'Correo no válido', message: 'El correo electrónico debe tener un formato válido (usuario@dominio).', type: 'warning' });
      return;
    }

    // DEF-07: Validación obligatoria de Ley 1581
    if (!autorizacionDatos) {
      showAlert({
        title: 'Autorización Requerida (Ley 1581)',
        message: 'Debe autorizar el tratamiento de sus datos personales conforme a la Ley 1581 de 2012 para continuar con la solicitud.',
        type: 'warning',
      });
      return;
    }

    if (!selectedSlot) {
      showAlert({
        title: 'Horario Requerido',
        message: 'Debe seleccionar un bloque de horario disponible para continuar con la solicitud.',
        type: 'warning',
      });
      return;
    }
    setIsConfirmModalOpen(true);
  };

  const handleFinalSubmit = async () => {
    if (!selectedSlot) return;
    setIsSubmitting(true);
    try {
      const payload = {
        nombreSolicitante: nombreCompleto.trim(),
        documentoSolicitante: documentoIdentidad.trim(),
        correoSolicitante: correo.trim().toLowerCase(),
        telefonoSolicitante: telefono.trim(),
        fechaNacimiento: fechaNacimiento.trim(),
        sexo: genero ? genero : undefined,
        bloqueSolicitado: selectedSlot.rawInicio,
        descripcion: motivoConsulta.trim() || 'Solicitud de valoración odontológica',
        autorizacionDatos: true,
        versionPlantillaAutorizacion: privacyNotice?.version,
      };

      const res = await fetch('/api/v1/appointments/public-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setIsConfirmModalOpen(false);
        showAlert({
          title: 'No se pudo registrar la solicitud',
          message: errJson.message || 'El bloque horario seleccionado ya no se encuentra disponible. Por favor seleccione otro horario.',
          type: 'error',
        });
        return;
      }

      setIsConfirmModalOpen(false);
      setIsSuccessModalOpen(true);
    } catch (err: any) {
      console.error('Error al enviar solicitud pública:', err.message);
      setIsConfirmModalOpen(false);
      showAlert({
        title: 'Error de Conexión',
        message: 'No fue posible comunicar con el servidor para registrar la cita. Verifique su conexión a internet.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid =
    Boolean(nombreCompleto.trim()) &&
    Boolean(documentoIdentidad.trim()) &&
    Boolean(telefono.trim()) &&
    Boolean(correo.trim()) &&
    Boolean(fechaNacimiento.trim()) &&
    Boolean(selectedSlot) &&
    autorizacionDatos &&
    !isLoadingSlots &&
    availableHours.length > 0;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1E242B] flex flex-col justify-between">
      <AlertModalComponent />

      {/* 1. Header Unificado con Marca OdontoLeal y Acceso Personal */}
      <PublicNavbar onNavigateToStaffLogin={onNavigateToStaffLogin} />

      {/* Contenedor Principal */}
      <main className="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E242B]">
            Solicitud de Cita Odontológica
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] max-w-xl mx-auto">
            Agenda tu valoración o tratamiento dental con nuestro equipo de profesionales de forma rápida y sin registros previos.
          </p>
        </div>

        {/* 2. Tarjeta Principal de Solicitud */}
        <form
          onSubmit={handlePreConfirm}
          className="rounded-3xl border border-[#E2E6EA] border-t-4 border-t-[#D4AF37] bg-white p-5 sm:p-8 shadow-md space-y-8"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Columna 1: 1. DATOS DEL PACIENTE */}
            <div className="space-y-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1E242B] flex items-center gap-2 pb-2 border-b border-[#E2E6EA]">
                <span className="h-6 w-6 rounded-full bg-[#111111] text-[#D4AF37] text-xs flex items-center justify-center font-bold shadow-2xs">
                  1
                </span>
                Datos del Paciente
              </h3>

              {/* Fila 1: Nombre Completo (100% de ancho) */}
              <Input
                label="Nombre Completo"
                required
                placeholder="Ejemplo: Marcela González Ramírez"
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
              />

              {/* Fila 2: Documento de Identidad y Fecha de Nacimiento (2 columnas iguales) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <Input
                  label="Documento de Identidad"
                  required
                  placeholder="1020304050"
                  value={documentoIdentidad}
                  onChange={(e) => setDocumentoIdentidad(e.target.value)}
                />

                <div className="w-full space-y-1.5 text-left">
                  <label
                    htmlFor="fecha-nacimiento"
                    className="block text-xs font-extrabold uppercase tracking-wider text-[#64748B]"
                  >
                    Fecha de Nacimiento <span className="ml-1 text-[#DC2626]">*</span>
                  </label>
                  <input
                    id="fecha-nacimiento"
                    type="date"
                    required
                    max={new Date().toISOString().split('T')[0]}
                    value={fechaNacimiento}
                    onChange={(e) => setFechaNacimiento(e.target.value)}
                    className="w-full h-[42px] min-h-[42px] rounded-xl border border-[#E2E6EA] bg-white px-3.5 py-2 text-sm text-[#1E242B] transition-colors focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30"
                  />
                </div>
              </div>

              {/* Fila 3: Teléfono y Género (2 columnas iguales) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <Input
                  label="Teléfono"
                  required
                  placeholder="3001234567"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />

                <div className="w-full space-y-1.5 text-left">
                  <label
                    htmlFor="genero"
                    className="block text-xs font-extrabold uppercase tracking-wider text-[#64748B]"
                  >
                    Género
                  </label>
                  <select
                    id="genero"
                    value={genero}
                    onChange={(e) => setGenero(e.target.value as any)}
                    className="w-full h-[42px] min-h-[42px] rounded-xl border border-[#E2E6EA] bg-white px-3.5 py-2 text-sm text-[#1E242B] transition-colors focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30"
                  >
                    <option value="">Seleccione género...</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Indeterminado">Indeterminado</option>
                  </select>
                </div>
              </div>

              {/* Fila 4: Correo Electrónico (100% de ancho) */}
              <Input
                type="email"
                label="Correo Electrónico"
                required
                placeholder="ejemplo@correo.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                helperText="Enviaremos la confirmación oficial a este correo"
              />

              {/* Fila 5: Motivo de la Cita / Detalle de Consulta (100% de ancho) */}
              <div className="w-full space-y-1.5 text-left">
                <label
                  htmlFor="motivo-consulta"
                  className="block text-xs font-extrabold uppercase tracking-wider text-[#64748B]"
                >
                  Motivo de la Cita / Detalle de Consulta
                </label>
                <textarea
                  id="motivo-consulta"
                  rows={4}
                  placeholder="Describe brevemente tus síntomas o el tratamiento que deseas consultar (ej: dolor en molar inferior, limpieza dental, valoración para diseño de sonrisa)..."
                  value={motivoConsulta}
                  onChange={(e) => setMotivoConsulta(e.target.value)}
                  className="w-full min-h-[108px] rounded-xl border border-[#E2E6EA] px-3.5 py-3 text-sm leading-[1.45] text-[#1E242B] placeholder-[#64748B] resize-y transition-colors focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30"
                  style={{ minHeight: '108px', padding: '12px 14px', lineHeight: 1.45, resize: 'vertical' }}
                />
              </div>
            </div>

            {/* Columna 2: 2. FECHA Y HORARIO DESEADO */}
            <div className="space-y-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1E242B] flex items-center gap-2 pb-2 border-b border-[#E2E6EA]">
                <span className="h-6 w-6 rounded-full bg-[#111111] text-[#D4AF37] text-xs flex items-center justify-center font-bold shadow-2xs">
                  2
                </span>
                Fecha y Horario Deseado
              </h3>

              {/* Selector de Fecha */}
              <div className="space-y-1.5 text-left">
                <label htmlFor="fecha-solicitada" className="block text-xs font-extrabold uppercase tracking-wider text-[#64748B]">
                  Seleccione el Día Deseado:
                </label>
                <input
                  id="fecha-solicitada"
                  type="date"
                  min={new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  max={new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full h-[42px] min-h-[42px] rounded-xl border border-[#E2E6EA] px-3.5 text-sm font-semibold text-[#1E242B] transition-colors focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30"
                />
                <p className="text-[13px] text-[#64748B] flex items-center gap-1.5 pt-0.5">
                  <span>💡</span>
                  <span>Puedes solicitar tu cita entre 5 y 60 días calendario a partir de hoy.</span>
                </p>
              </div>

              {/* Horario Disponible Dinámico */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#64748B]">
                    Horario Disponible:
                  </label>
                  {isLoadingSlots && (
                    <span className="text-[13px] font-medium text-[#B8942A] animate-pulse">
                      Consultando base de datos...
                    </span>
                  )}
                </div>

                {isLoadingSlots ? (
                  <div className="rounded-2xl border border-[#E2E6EA] bg-[#F8FAFC] p-6 text-center text-xs text-[#64748B]">
                    Cargando horarios disponibles...
                  </div>
                ) : availableHours.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#E2E6EA] bg-[#F8FAFC] p-6 text-center space-y-1">
                    <span className="text-2xl">📅</span>
                    <p className="text-xs font-bold text-[#1E242B]">
                      No hay horarios disponibles en esta fecha
                    </p>
                    <p className="text-[13px] text-[#64748B]">
                      Por favor seleccione otra fecha en el calendario.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5 max-h-64 sm:max-h-72 overflow-y-auto p-2 border border-[#E2E6EA] rounded-2xl bg-[#F8FAFC]">
                    {availableHours.map((slot, idx) => {
                      const isSelected = selectedSlot?.rawInicio === slot.rawInicio;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`min-h-[44px] rounded-xl border text-xs font-bold p-2.5 transition-all text-center flex items-center justify-between px-3 cursor-pointer ${
                            isSelected
                              ? 'border-[#D4AF37] bg-[#FBF6E6] text-[#1E242B] ring-2 ring-[#D4AF37]/50 shadow-xs'
                              : 'border-[#E2E6EA] bg-white text-[#64748B] hover:border-[#CBD2D9] hover:bg-[#F1F5F9]'
                          }`}
                        >
                          <span>{slot.label}</span>
                          {isSelected && <span className="text-[#D4AF37] font-bold">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Casilla de Autorización Ley 1581 y Enlaces — RQNF-SEG-005 */}
              <div className="pt-4 border-t border-[#E2E6EA]">
                <label className="flex items-start gap-3 min-h-[44px] py-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autorizacionDatos}
                    onChange={(e) => setAutorizacionDatos(e.target.checked)}
                    className="form-checkbox-custom"
                  />
                  {/* Párrafo de flujo continuo: los <span> actúan como enlaces inline puros.
                      No usar <button> aquí para evitar display:inline-flex por defecto del navegador. */}
                  <p style={{ textAlign: 'left', fontSize: '13.5px', lineHeight: 1.5, color: '#475569', margin: 0 }}>
                    He leído y acepto la{' '}
                    <span
                      role="button"
                      tabIndex={0}
                      style={{
                        display: 'inline',
                        fontWeight: 600,
                        color: '#B8942A',
                        textDecoration: 'underline',
                        textUnderlineOffset: '2px',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#111111')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#B8942A')}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsPrivacyModalOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsPrivacyModalOpen(true);
                        }
                      }}
                    >
                      {privacyNotice
                        ? `${privacyNotice.nombre} (versión ${privacyNotice.version})`
                        : 'autorización de tratamiento de datos personales'}
                    </span>{' '}
                    y el{' '}
                    <span
                      role="button"
                      tabIndex={0}
                      style={{
                        display: 'inline',
                        fontWeight: 600,
                        color: '#B8942A',
                        textDecoration: 'underline',
                        textUnderlineOffset: '2px',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#111111')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#B8942A')}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsPrivacyModalOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsPrivacyModalOpen(true);
                        }
                      }}
                    >
                      aviso de privacidad
                    </span>{' '}
                    del consultorio (<strong>Ley 1581 de 2012</strong>). La autorización firmada se toma en el consultorio.{' '}
                    <span style={{ color: '#DC2626', fontWeight: 700 }}>*</span>
                  </p>
                </label>
              </div>

              {/* Botón CTA Confirmar Solicitud de Cita */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!isFormValid}
                  className={`w-full min-h-[46px] rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    !isFormValid
                      ? 'bg-[#E2E8F0] text-[#94A3B8] border border-[#CBD5E1] cursor-not-allowed shadow-none'
                      : 'bg-[#D4AF37] text-[#111111] hover:bg-[#C9A227] shadow-sm active:scale-[0.99] cursor-pointer'
                  }`}
                >
                  <span>Confirmar Solicitud de Cita</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* 3. Tarjetas informativas inferiores de pie */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          <div className="rounded-2xl border border-[#E2E6EA] bg-white p-5 space-y-2 text-xs shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-lg">📅</span>
              <h4 className="font-extrabold text-[#1E242B] text-sm">Antelación de Reserva</h4>
            </div>
            <p className="text-[#64748B] leading-relaxed">
              Las citas deben solicitarse con mínimo 5 días calendario de anticipación y un máximo de 60 días (2 meses).
            </p>
          </div>

          <div className="rounded-2xl border border-[#E2E6EA] bg-white p-5 space-y-2 text-xs shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-lg">✉️</span>
              <h4 className="font-extrabold text-[#1E242B] text-sm">Confirmación y Recordatorio</h4>
            </div>
            <p className="text-[#64748B] leading-relaxed">
              Recibirás la confirmación formal por correo electrónico y aviso previo 24 horas antes.
            </p>
            <div className="pt-2 border-t border-[#F1F5F9] text-[11px] text-[#475569] space-y-0.5">
              <p className="font-semibold text-[#1E242B]">Canales de atención:</p>
              <p>
                Teléfono: <span className="font-medium text-[#1E242B]">+57 300 123 4567</span>
              </p>
              <p>
                Correo: <span className="font-medium text-[#1E242B]">citas@odontoleal.com</span>
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E2E6EA] bg-white p-5 space-y-2 text-xs shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-lg">📍</span>
              <h4 className="font-extrabold text-[#1E242B] text-sm">Ubicación Consultorio</h4>
            </div>
            <p className="text-[#64748B] leading-relaxed">
              Calle 21A # 10-57, Tunja, Boyacá.
            </p>
            <div className="pt-2 border-t border-[#F1F5F9] text-[11px] text-[#475569]">
              <p>Horario de atención: Lunes a Sábado de 07:00 a. m. a 07:00 p. m.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E2E6EA] bg-white py-5 px-4 text-center text-xs text-[#64748B] space-y-1.5 mt-auto">
        <div>© 2026 OdontoLeal • Consultorio Odontológico Dr. Eduar Leal Álvarez • Todos los derechos reservados.</div>
        <div>
          <button
            type="button"
            className="font-bold text-[#B8962E] hover:text-[#97741C] underline cursor-pointer focus:outline-none"
            onClick={() => (onOpenPrivacyNotice ? onOpenPrivacyNotice() : setIsPrivacyModalOpen(true))}
          >
            Aviso de privacidad y política de tratamiento de datos personales
          </button>
        </div>
      </footer>

      {/* Modal de Lectura de Aviso de Privacidad */}
      <PrivacyNoticeModal isOpen={isPrivacyModalOpen} onClose={() => setIsPrivacyModalOpen(false)} />

      {/* Modal 1: ¿Confirmar tu Solicitud de Cita? */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="¿Confirmar tu Solicitud de Cita?"
        subtitle="Por favor verifica los detalles de tu cita antes de enviar la solicitud formal."
        maxWidth="md"
        footer={
          <div className="flex items-center gap-3 w-full justify-end">
            <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleFinalSubmit}
              isLoading={isSubmitting}
              leftIcon={<span>✓</span>}
            >
              Confirmar Solicitud
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="rounded-2xl border border-[#E2E6EA] p-3.5 bg-[#F8F9FA] space-y-1">
            <span className="text-[13px] font-extrabold uppercase text-[#64748B]">Fecha y Horario Solicitado</span>
            <p className="font-extrabold text-[#1E242B] text-sm">
              {formatLongDateCO(selectedDate)} · {selectedSlot?.label || ''}
            </p>
          </div>

          <div className="rounded-2xl border border-[#E2E6EA] p-3.5 space-y-1">
            <span className="text-[13px] font-extrabold uppercase text-[#64748B]">Paciente</span>
            <p className="font-bold text-[#1E242B]">{nombreCompleto}</p>
            <p className="text-[#64748B]">
              C.C. {documentoIdentidad} • Tel: +57 {telefono}
              {genero ? ` • Género: ${genero}` : ''}
            </p>
            <p className="text-[#64748B]">{correo}</p>
          </div>

          <div className="rounded-2xl border border-[#E2E6EA] p-3.5 space-y-1">
            <span className="text-[13px] font-extrabold uppercase text-[#64748B]">Motivo</span>
            <p className="italic text-[#1E242B]">&ldquo;{motivoConsulta || 'Valoración odontológica'}&rdquo;</p>
          </div>
        </div>
      </Modal>

      {/* Modal 2: ¡Solicitud Confirmada! */}
      <Modal
        isOpen={isSuccessModalOpen}
        onClose={handleCloseSuccessModal}
        title={
          <div className="text-center w-full">
            <div className="h-12 w-12 rounded-full bg-[#E6F4EA] text-[#137333] flex items-center justify-center text-xl mx-auto mb-2">
              ✓
            </div>
            <span className="text-xl font-extrabold text-[#1E242B]">¡Solicitud Confirmada!</span>
          </div>
        }
        subtitle="Hemos recibido tu solicitud de cita odontológica. La coordinación de agendamiento revisará tus datos, te asignará el doctor correspondiente y te enviará la confirmación formal por correo electrónico."
        maxWidth="md"
        footer={
          <Button
            variant="primary"
            className="w-full"
            onClick={handleCloseSuccessModal}
          >
            Entendido / Aceptar ✓
          </Button>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="flex justify-center">
            <Badge label="Pendiente de aprobación" variant="warning" />
          </div>

          <div className="rounded-2xl border border-[#E2E6EA] p-4 bg-[#F8F9FA] space-y-2">
            <div>
              <span className="text-[13px] font-bold text-[#64748B]">FECHA Y HORA SOLICITADA</span>
              <p className="font-bold text-[#1E242B]">{formatLongDateCO(selectedDate)} · {selectedSlot?.label || ''}</p>
            </div>
            <div>
              <span className="text-[13px] font-bold text-[#64748B]">PACIENTE</span>
              <p className="font-bold text-[#1E242B]">
                {nombreCompleto} • {documentoIdentidad}
                {genero ? ` • ${genero}` : ''}
              </p>
            </div>
            <div>
              <span className="text-[13px] font-bold text-[#64748B]">CORREO DE NOTIFICACIÓN</span>
              <p className="font-bold text-[#1E242B]">{correo}</p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
