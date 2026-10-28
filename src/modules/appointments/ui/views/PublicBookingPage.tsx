// src/modules/appointments/ui/views/PublicBookingPage.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '../../../../shared/ui/components/Button';
import { Input } from '../../../../shared/ui/components/Input';
import { Modal } from '../../../../shared/ui/components/Modal';
import { useAlertModal } from '../../../../shared/ui/hooks/useAlertModal';
import { Badge } from '../../../../shared/ui/components/Badge';

export interface AvailableSlotItem {
  label: string;
  rawInicio: string;
}

export interface PublicBookingPageProps {
  onNavigateToStaffLogin?: () => void;
  onSubmitPublicBooking?: (bookingData: any) => Promise<void> | void;
}

export const PublicBookingPage: React.FC<PublicBookingPageProps> = ({
  onNavigateToStaffLogin,
  onSubmitPublicBooking,
}) => {
  // Datos del Paciente
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [documentoIdentidad, setDocumentoIdentidad] = useState('');
  const [genero, setGenero] = useState<'Femenino' | 'Masculino' | 'Indeterminado'>('Femenino');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [motivoConsulta, setMotivoConsulta] = useState('');

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
          const period = h >= 12 ? 'PM' : 'AM';
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

  // Consulta dinámica de bloques disponibles al cambiar la fecha
  useEffect(() => {
    loadSlots(selectedDate);
  }, [selectedDate]);

  // Limpiar el formulario al aceptar el modal de confirmación final
  const handleCloseSuccessModal = () => {
    setIsSuccessModalOpen(false);
    setNombreCompleto('');
    setDocumentoIdentidad('');
    setGenero('Femenino');
    setFechaNacimiento('');
    setTelefono('');
    setCorreo('');
    setMotivoConsulta('');
    setSelectedSlot(null);
    if (selectedDate) {
      loadSlots(selectedDate);
    }
  };

  const handlePreConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreCompleto.trim() || !documentoIdentidad.trim() || !correo.trim() || !telefono.trim()) {
      showAlert({
        title: 'Campos Obligatorios Incompletos',
        message: 'Por favor complete su Nombre Completo, Documento de Identidad, Teléfono de Contacto y Correo Electrónico antes de continuar.',
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
        fechaNacimiento: fechaNacimiento.trim() || undefined,
        sexo: genero,
        bloqueSolicitado: selectedSlot.rawInicio,
        descripcion: motivoConsulta.trim() || 'Solicitud de valoración general',
        idProfesional: 1, // Dr. Eduar Leal Álvarez
      };

      if (onSubmitPublicBooking) {
        await onSubmitPublicBooking(payload);
      }

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

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1E242B] flex flex-col justify-between">
      <AlertModalComponent />

      {/* Header Superior del Portal */}
      <header className="w-full border-b border-[#E2E6EA] bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#111111] text-[#D4AF37] font-extrabold flex items-center justify-center text-sm shadow-xs">
            OL
          </div>
          <div>
            <span className="text-base font-extrabold text-[#1E242B] tracking-tight block">
              Portal OdontoLeal
            </span>
            <span className="text-[11px] font-bold text-[#8F99A3]">
              Dr. Eduar Leal Álvarez • Dirección Médica
            </span>
          </div>
        </div>

        {onNavigateToStaffLogin && (
          <button
            type="button"
            onClick={onNavigateToStaffLogin}
            className="min-h-[40px] rounded-xl border border-[#E2E6EA] px-4 py-2 text-xs font-bold text-[#1E242B] hover:border-[#D4AF37] hover:bg-[#FBF6E6]/40 transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <svg className="h-4 w-4 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Ingresar al Sistema (Staff)
          </button>
        )}
      </header>

      {/* Contenedor Principal */}
      <main className="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="text-center space-y-2">
          <span className="inline-flex items-center rounded-full bg-[#FBF6E6] border border-[#EAD89B] px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-[#8F721A]">
            ✨ Atención a Pacientes
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E242B]">
            Solicitud de Cita Odontológica
          </h1>
          <p className="text-xs sm:text-sm text-[#687380] max-w-xl mx-auto">
            Agenda tu valoración o tratamiento dental con el Dr. Eduar Leal de forma rápida y sin registros previos.
          </p>
        </div>

        <form onSubmit={handlePreConfirm} className="rounded-3xl border border-[#E2E6EA] border-t-4 border-t-[#D4AF37] bg-white p-6 sm:p-8 shadow-md space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Columna 1: Datos del Paciente */}
            <div className="space-y-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1E242B] flex items-center gap-2 pb-2 border-b border-[#E2E6EA]">
                <span className="h-6 w-6 rounded-full bg-[#111111] text-[#D4AF37] text-xs flex items-center justify-center font-bold">
                  1
                </span>
                Datos del Paciente
              </h3>

              <Input
                label="Nombre Completo"
                required
                placeholder="Ejemplo: Marcela González Ramírez"
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Documento de Identidad"
                  required
                  placeholder="1020304050"
                  value={documentoIdentidad}
                  onChange={(e) => setDocumentoIdentidad(e.target.value)}
                />

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-1.5">
                    Género <span className="text-[#DC2626]">*</span>
                  </label>
                  <select
                    value={genero}
                    onChange={(e) => setGenero(e.target.value as any)}
                    className="w-full min-h-[44px] rounded-xl border border-[#E2E6EA] bg-white px-3 py-2 text-xs font-semibold text-[#1E242B] focus:border-[#D4AF37] focus:outline-none"
                  >
                    <option value="Femenino">Femenino</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Indeterminado">Indeterminado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-1.5">
                    Fecha de Nacimiento
                  </label>
                  <input
                    type="date"
                    value={fechaNacimiento}
                    onChange={(e) => setFechaNacimiento(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-[#E2E6EA] px-3 text-xs text-[#1E242B]"
                  />
                </div>

                <Input
                  label="Teléfono / WhatsApp"
                  required
                  placeholder="3001234567"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
              </div>

              <Input
                type="email"
                label="Correo Electrónico"
                required
                placeholder="ejemplo@correo.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                helperText="Enviaremos la confirmación oficial a este correo"
              />

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#687380] mb-1.5">
                  Motivo de la Cita / Detalle de Consulta
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe brevemente tus síntomas o el tratamiento que deseas consultar (ej: dolor en molar inferior, limpieza dental, valoración para diseño de sonrisa)..."
                  value={motivoConsulta}
                  onChange={(e) => setMotivoConsulta(e.target.value)}
                  className="w-full rounded-xl border border-[#E2E6EA] p-3 text-xs text-[#1E242B] focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
            </div>

            {/* Columna 2: Fecha y Horario */}
            <div className="space-y-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#1E242B] flex items-center gap-2 pb-2 border-b border-[#E2E6EA]">
                <span className="h-6 w-6 rounded-full bg-[#111111] text-[#D4AF37] text-xs flex items-center justify-center font-bold">
                  2
                </span>
                Fecha y Horario
              </h3>

              {/* Selector de Fecha */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#687380]">
                  Seleccione el Día Deseado:
                </label>
                <input
                  type="date"
                  min={new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  max={new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-[#E2E6EA] px-3 text-sm font-bold text-[#1E242B]"
                />
                <p className="text-[11px] text-[#8F99A3]">
                  💡 Reserva con antelación mínima de 5 días y máxima de 60 días (Regla 1).
                </p>
              </div>

              {/* Horario Disponible Dinámico desde Base de Datos */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#687380]">
                    Horario Disponible:
                  </label>
                  {isLoadingSlots && (
                    <span className="text-[11px] font-medium text-[#D4AF37] animate-pulse">
                      Consultando base de datos...
                    </span>
                  )}
                </div>

                {isLoadingSlots ? (
                  <div className="rounded-2xl border border-[#E2E6EA] bg-[#F8F9FA] p-6 text-center text-xs text-[#8F99A3]">
                    Cargando horarios disponibles...
                  </div>
                ) : availableHours.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#E2E6EA] bg-[#F8F9FA] p-6 text-center space-y-1">
                    <span className="text-xl">📅</span>
                    <p className="text-xs font-bold text-[#687380]">
                      No hay horarios disponibles para este día
                    </p>
                    <p className="text-[11px] text-[#8F99A3]">
                      Por favor seleccione otra fecha en el calendario.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
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
                              : 'border-[#E2E6EA] bg-white text-[#687380] hover:border-[#CBD2D9] hover:bg-[#F8F9FA]'
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

              <div className="pt-6">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={availableHours.length === 0 || !selectedSlot || isLoadingSlots}
                  className="w-full text-base py-3"
                  rightIcon={<span>→</span>}
                >
                  Confirmar Solicitud de Cita
                </Button>
              </div>
            </div>
          </div>
        </form>

        {/* Tarjetas informativas de pie */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-[#E2E6EA] bg-white p-4 space-y-1 text-xs">
            <span className="text-base">📅</span>
            <h4 className="font-extrabold text-[#1E242B]">Antelación de Reserva</h4>
            <p className="text-[#687380]">
              Las citas deben solicitarse con mínimo 5 días de anticipación y un máximo de 2 meses.
            </p>
          </div>

          <div className="rounded-2xl border border-[#E2E6EA] bg-white p-4 space-y-1 text-xs">
            <span className="text-base">✉️</span>
            <h4 className="font-extrabold text-[#1E242B]">Confirmación y Recordatorio</h4>
            <p className="text-[#687380]">
              Recibirás la confirmación formal por correo electrónico y aviso previo 24 horas antes.
            </p>
          </div>

          <div className="rounded-2xl border border-[#E2E6EA] bg-white p-4 space-y-1 text-xs">
            <span className="text-base">📍</span>
            <h4 className="font-extrabold text-[#1E242B]">Ubicación Consultorio</h4>
            <p className="text-[#687380]">
              Calle 127 # 14-54, Edificio Medical Prestige, Suite 402, Bogotá.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E2E6EA] bg-white py-4 text-center text-xs text-[#8F99A3]">
        © 2026 OdontoLeal • Presidencia Médica Dr. Eduar Leal • Todos los derechos reservados.
      </footer>

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
            <span className="text-[10px] font-extrabold uppercase text-[#8F99A3]">Fecha y Hora</span>
            <p className="font-extrabold text-[#1E242B] text-sm">
              {selectedDate} • {selectedSlot?.label || ''}
            </p>
          </div>

          <div className="rounded-2xl border border-[#E2E6EA] p-3.5 space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-[#8F99A3]">Paciente</span>
            <p className="font-bold text-[#1E242B]">{nombreCompleto}</p>
            <p className="text-[#687380]">C.C. {documentoIdentidad} • Tel: +57 {telefono}</p>
            <p className="text-[#687380]">{correo}</p>
          </div>

          <div className="rounded-2xl border border-[#E2E6EA] p-3.5 space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-[#8F99A3]">Motivo</span>
            <p className="italic text-[#1E242B]">&ldquo;{motivoConsulta || 'Valoración odontológica general'}&rdquo;</p>
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
        subtitle="Hemos recibido tu solicitud de cita odontológica. Se ha enviado un comprobante a tu correo y te notificaremos cuando sea aprobada formalmente."
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
              <span className="text-[10px] font-bold text-[#8F99A3]">FECHA Y HORA</span>
              <p className="font-bold text-[#1E242B]">{selectedDate} • {selectedSlot?.label || ''}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#8F99A3]">PACIENTE</span>
              <p className="font-bold text-[#1E242B]">{nombreCompleto} • {documentoIdentidad}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#8F99A3]">CORREO DE NOTIFICACIÓN</span>
              <p className="font-bold text-[#1E242B]">{correo}</p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
