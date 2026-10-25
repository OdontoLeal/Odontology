// src/modules/appointments/ui/hooks/useRealtimeAgenda.ts
import { useState, useEffect, useCallback } from 'react';
import { CalendarTimeSlot } from '../components/WeeklyCalendarGrid';
import { RequestDetailData } from '../views/AppointmentRequestDetailPage';

export interface MonthlyDaySummaryItem {
  fecha: string;
  dia: number;
  totalCitas: number;
  totalBloques: number;
  sinBloques: boolean;
}

export function useRealtimeAgenda(apiBaseUrl = '/api/v1') {
  // Fecha seleccionada en formato YYYY-MM-DD (por defecto 2026-10-24 según las especificaciones)
  const [selectedDate, setSelectedDate] = useState('2026-10-24');
  const [calendarYear, setCalendarYear] = useState(2026);
  const [calendarMonth, setCalendarMonth] = useState(10); // 1 = Enero ... 12 = Diciembre
  const [slots, setSlots] = useState<CalendarTimeSlot[]>([]);
  const [agendaItems, setAgendaItems] = useState<any[]>([]);
  const [requests, setRequests] = useState<RequestDetailData[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlyDaySummaryItem[]>([]);
  const [filterMode, setFilterMode] = useState<'appointments_only' | 'all' | 'requests_only'>(
    'all'
  );
  const [doctorFilter, setDoctorFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincronizar automáticamente mes y año del calendario izquierdo al cambiar de fecha con Ayer/Mañana
  useEffect(() => {
    if (!selectedDate) return;
    try {
      const clean = selectedDate.includes('T') ? selectedDate.split('T')[0] : selectedDate.split(' ')[0];
      const parts = clean.split('-');
      if (parts.length >= 2) {
        const y = Number(parts[0]);
        const m = Number(parts[1]);
        if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
          setCalendarYear((prevY) => (prevY !== y ? y : prevY));
          setCalendarMonth((prevM) => (prevM !== m ? m : prevM));
        }
      }
    } catch {
      // noop
    }
  }, [selectedDate]);

  // Formateador robusto de horas HH:mm a partir de timestamp SQL ("2026-11-01 06:00:00") o ISO string
  const formatTimeHHmm = (dateStr: string | Date): string => {
    if (!dateStr) return '00:00';
    if (typeof dateStr === 'string') {
      let clean = dateStr.trim();
      // Si contiene 'Z', convertir considerando la zona local del usuario
      if (clean.includes('Z')) {
        const d = new Date(clean);
        if (!isNaN(d.getTime())) {
          return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        }
      }
      // Si es formato SQL "YYYY-MM-DD HH:mm:ss" o "YYYY-MM-DDTHH:mm:ss" sin zona
      let timePart = clean;
      if (timePart.includes('T')) {
        timePart = timePart.split('T')[1];
      } else if (timePart.includes(' ')) {
        timePart = timePart.split(' ')[1];
      }
      if (timePart.includes(':')) {
        const segments = timePart.split(':');
        const h = segments[0].replace(/\D/g, '').padStart(2, '0');
        const m = (segments[1] || '00').replace(/\D/g, '').padStart(2, '0');
        return `${h}:${m}`;
      }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? '00:00'
      : `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  // Calcular hora fin sumando 30 minutos a una hora HH:mm
  const add30Minutes = (timeHHmm: string): string => {
    const [h, m] = timeHHmm.split(':').map(Number);
    const totalMinutes = h * 60 + m + 30;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  };

  // Fetch agenda real desde base de datos
  const fetchAgenda = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Obtener citas de la agenda médica desde la base de datos
      const agendaRes = await fetch(`${apiBaseUrl}/appointments/agenda`);
      const agendaJson = agendaRes.ok ? await agendaRes.json() : { data: [] };
      const agendaItems: any[] = agendaJson.data || [];
      setAgendaItems(agendaItems);

      // 2. Obtener solicitudes pendientes registradas en solicitud_cita
      const requestsRes = await fetch(`${apiBaseUrl}/appointments/requests`);
      const requestsJson = requestsRes.ok ? await requestsRes.json() : { data: [] };
      const rawRequests: any[] = requestsJson.data || [];

      const formattedRequests: RequestDetailData[] = rawRequests.map((r: any) => ({
        idSolicitud: r.idSolicitud,
        idCita: r.idCita || null,
        nombrePaciente: r.nombrePaciente,
        documentoIdentidad: r.documentoIdentidad,
        telefono: r.telefono || '+57 318 459 2011',
        correo: r.correo,
        fechaSolicitada: r.fechaSolicitada,
        horaSolicitada: r.horaSolicitada,
        motivoConsulta: r.motivoConsulta,
        fechaSolicitud: r.fechaSolicitud,
        sexo: r.sexo || 'Femenino',
        edad: 29,
        esPacienteNuevo: r.esPacienteNuevo !== false,
        doctorAsignado: r.doctorAsignado || 'Dr. Mateo Gómez',
      }));
      setRequests(formattedRequests);

      // 3. Obtener bloques de horario de la base de datos para la fecha seleccionada
      const slotsRes = await fetch(
        `${apiBaseUrl}/appointments/slots?desde=${selectedDate} 00:00:00&hasta=${selectedDate} 23:59:59`
      );
      const slotsJson = slotsRes.ok ? await slotsRes.json() : { data: [] };
      const rawSlots: any[] = slotsJson.data || [];

      // 4. Obtener resumen mensual dinámico para el mes activo en el calendario
      const summaryRes = await fetch(
        `${apiBaseUrl}/appointments/monthly-summary?year=${calendarYear}&month=${calendarMonth}`
      );
      const summaryJson = summaryRes.ok ? await summaryRes.json() : { data: [] };
      setMonthlySummary(summaryJson.data || []);

      // Mapear citas por bloque
      // Cada cita puede abarcar múltiples bloques contiguos (ej. Carlos Mendoza: 08:30 y 09:00 -> 08:30 a 09:30)
      const appointmentMap = new Map<number, any>();
      const processedAppointmentIds = new Set<number>();
      const blockToApptId = new Map<string, number>();

      for (const appt of agendaItems) {
        if (Array.isArray(appt.bloques)) {
          for (const b of appt.bloques) {
            // Normalizar string de fecha
            const cleanKey = String(b).replace('T', ' ').slice(0, 19);
            blockToApptId.set(cleanKey, appt.idCita);
          }
          appointmentMap.set(appt.idCita, appt);
        }
      }

      // Procesar bloques agrupando citas contiguas
      const unifiedSlots: CalendarTimeSlot[] = [];
      let slotIndex = 1;

      for (const raw of rawSlots) {
        const rawInicioStr = String(raw.inicio).replace('T', ' ').slice(0, 19);
        const apptId = blockToApptId.get(rawInicioStr);

        // CASO A: El bloque contiene una cita
        if (apptId) {
          // Si esta cita ya fue procesada en un bloque previo (cita contigua), la omitimos
          if (processedAppointmentIds.has(apptId)) {
            continue;
          }

          const appt = appointmentMap.get(apptId);
          processedAppointmentIds.add(apptId);

          // Determinar hora de inicio y fin real de la cita contigua
          const apptBlocks: string[] = (appt.bloques || [])
            .map((b: any) => String(b).replace('T', ' ').slice(0, 19))
            .filter((b: string) => b.startsWith(selectedDate))
            .sort();

          const firstBlock = apptBlocks[0] || rawInicioStr;
          const lastBlock = apptBlocks[apptBlocks.length - 1] || rawInicioStr;

          const horaInicio = formatTimeHHmm(firstBlock);
          // La hora fin es el final del último bloque de 30 min
          const horaFin = add30Minutes(formatTimeHHmm(lastBlock));

          // Verificar si corresponde a una solicitud pendiente
          const isPending =
            appt.estado === 'Solicitada' ||
            appt.estado === 'Pendiente de confirmación';

          unifiedSlots.push({
            idBloque: slotIndex++,
            horaInicio,
            horaFin,
            inicioTimestamp: firstBlock,
            habilitado: true,
            idCita: appt.idCita,
            idSolicitud: appt.idSolicitud || null,
            pacienteNombre: appt.nombrePaciente,
            pacienteDocumento: appt.documentoPaciente,
            pacienteTelefono: appt.telefonoPaciente,
            pacienteCorreo: appt.correoPaciente,
            tratamiento: appt.titulo,
            doctorNombre: appt.nombreProfesional,
            estadoCita: isPending ? 'Pendiente de confirmación' : appt.estado,
          });
        } else {
          // CASO B: Bloque libre o no habilitado
          const horaInicio = formatTimeHHmm(raw.inicio);
          const horaFin = formatTimeHHmm(raw.final) || add30Minutes(horaInicio);

          // Verificar si alguna solicitud pendiente sin cita formal reservó este bloque
          const matchedRequest = formattedRequests.find(
            (r) => r.fechaSolicitada === selectedDate && r.horaSolicitada === horaInicio
          );

          if (matchedRequest) {
            unifiedSlots.push({
              idBloque: slotIndex++,
              horaInicio,
              horaFin,
              inicioTimestamp: rawInicioStr,
              habilitado: true,
              idCita: matchedRequest.idCita || 999,
              idSolicitud: matchedRequest.idSolicitud,
              pacienteNombre: matchedRequest.nombrePaciente,
              pacienteDocumento: matchedRequest.documentoIdentidad,
              pacienteTelefono: matchedRequest.telefono,
              pacienteCorreo: matchedRequest.correo,
              tratamiento: matchedRequest.motivoConsulta,
              doctorNombre: matchedRequest.doctorAsignado || 'Dr. Mateo Gómez',
              estadoCita: 'Pendiente de confirmación',
            });
          } else {
            unifiedSlots.push({
              idBloque: slotIndex++,
              horaInicio,
              horaFin,
              inicioTimestamp: rawInicioStr,
              habilitado: raw.estado === true,
              idCita: null,
              idSolicitud: null,
              pacienteNombre: null,
              tratamiento: null,
              doctorNombre: null,
              estadoCita: null,
            });
          }
        }
      }

      setSlots(unifiedSlots);
    } catch (err: any) {
      console.error('Error fetching real agenda from database:', err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, selectedDate, calendarYear, calendarMonth]);

  useEffect(() => {
    fetchAgenda();
  }, [fetchAgenda]);

  // Filtrado de citas por doctor si hay texto en doctorFilter
  const displaySlots = slots.filter((slot) => {
    if (!doctorFilter.trim()) return true;
    const term = doctorFilter.toLowerCase().trim();
    return slot.doctorNombre?.toLowerCase().includes(term) ?? false;
  });

  // Transiciones de estado de cita en la base de datos (RF-AGE-009, RF-AGE-013)
  const changeStateAPI = async (
    idCita: number,
    nuevoEstado: string,
    motivo: string,
    liberarBloques?: boolean
  ) => {
    try {
      const res = await fetch(`${apiBaseUrl}/appointments/${idCita}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nuevoEstado,
          idUsuarioGestor: 1,
          motivo,
          liberarBloques,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Error al cambiar estado de cita');
      }
      await fetchAgenda();
    } catch (err: any) {
      console.error('Error al actualizar estado:', err.message);
      setError(err.message);
      throw err;
    }
  };

  const startAttention = useCallback((idCita: number) => {
    changeStateAPI(idCita, 'En consulta', 'Inicio de atención clínica');
  }, []);

  const endAttention = useCallback((idCita: number) => {
    changeStateAPI(idCita, 'Completada', 'Atención finalizada con éxito');
  }, []);

  const cancelAppointment = useCallback((idCita: number, motivo: string) => {
    changeStateAPI(idCita, 'Cancelada', motivo, true);
  }, []);

  const markNoShow = useCallback((idCita: number, motivo: string) => {
    changeStateAPI(idCita, 'No asistió', motivo, false);
  }, []);

  const toggleSlotStatus = useCallback(
    async (slot: CalendarTimeSlot) => {
      try {
        let inicio = slot.inicioTimestamp;
        if (!inicio) {
          const cleanH = slot.horaInicio ? slot.horaInicio.split(':') : ['08', '00'];
          const h = (cleanH[0] || '08').replace(/\D/g, '').padStart(2, '0');
          const m = (cleanH[1] || '00').replace(/\D/g, '').padStart(2, '0');
          inicio = `${selectedDate} ${h}:${m}:00`;
        }
        if (inicio.includes('T')) {
          inicio = inicio.replace('T', ' ').split('.')[0];
        }
        const res = await fetch(`${apiBaseUrl}/appointments/slots/toggle`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inicio }),
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.message || 'No fue posible cambiar el estado del bloque.');
        }
        await fetchAgenda();
      } catch (err: any) {
        console.error('Error toggling slot:', err.message);
        setError(err.message);
        throw err;
      }
    },
    [apiBaseUrl, selectedDate, fetchAgenda]
  );

  // Crear 28 bloques de horario de 30 min (06:00 a 20:00) en base de datos para la fecha seleccionada (RF-AGE-001)
  const generateDaySlots = useCallback(
    async (fecha: string) => {
      try {
        setIsLoading(true);
        const res = await fetch(`${apiBaseUrl}/appointments/generate-day-slots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fecha }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Error al generar los bloques.');
        }
        await fetchAgenda();
      } catch (err: any) {
        console.error('Error generating slots:', err.message);
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl, fetchAgenda]
  );

  // Navegar mes dinámico del calendario izquierdo
  const navigateMonth = useCallback(
    (delta: number) => {
      let nextMonth = calendarMonth + delta;
      let nextYear = calendarYear;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      } else if (nextMonth < 1) {
        nextMonth = 12;
        nextYear -= 1;
      }
      setCalendarYear(nextYear);
      setCalendarMonth(nextMonth);
      const mStr = nextMonth.toString().padStart(2, '0');
      setSelectedDate(`${nextYear}-${mStr}-01`);
    },
    [calendarYear, calendarMonth]
  );

  // RF-AGE-005: Aprobación formal de solicitud creando la cita y enviando correo de confirmación
  const approveRequest = useCallback(
    async (
      idSolicitud: number,
      options?: {
        idProfesional?: number;
        motivo?: string;
        idUsuarioGestor?: number;
        selectedBlocks?: string[];
      }
    ) => {
      try {
        const res = await fetch(`${apiBaseUrl}/appointments/requests/${idSolicitud}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idUsuarioGestor: options?.idUsuarioGestor || 1,
            aprobar: true,
            motivo: options?.motivo || 'Solicitud aprobada y confirmada en agenda médica',
            idProfesional: options?.idProfesional,
            selectedBlocks: options?.selectedBlocks,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Error al aprobar la solicitud de cita.');
        }

        await fetchAgenda();
      } catch (err: any) {
        console.error('Error approving request:', err.message);
        throw err;
      }
    },
    [apiBaseUrl, fetchAgenda]
  );

  // Rechazo formal de solicitud liberando el horario
  const rejectRequest = useCallback(
    async (idSolicitud: number, motivo: string) => {
      try {
        const res = await fetch(`${apiBaseUrl}/appointments/requests/${idSolicitud}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idUsuarioGestor: 1,
            aprobar: false,
            motivo,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Error al rechazar la solicitud.');
        }

        await fetchAgenda();
      } catch (err: any) {
        console.error('Error rejecting request:', err.message);
        throw err;
      }
    },
    [apiBaseUrl, fetchAgenda]
  );

  // RF-AGE-006: Editar cita confirmada
  const updateAppointment = useCallback(
    async (
      idCita: number,
      data: {
        idDoctor?: number;
        titulo?: string;
        descripcion?: string;
        selectedBlocks?: string[];
        motivo?: string;
      }
    ) => {
      try {
        const res = await fetch(`${apiBaseUrl}/appointments/${idCita}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            idUsuarioGestor: 1,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Error al actualizar la cita.');
        }

        await fetchAgenda();
        return await res.json();
      } catch (err: any) {
        console.error('Error updating appointment:', err.message);
        throw err;
      }
    },
    [apiBaseUrl, fetchAgenda]
  );

  return {
    selectedDate,
    setSelectedDate,
    calendarYear,
    setCalendarYear,
    calendarMonth,
    setCalendarMonth,
    navigateMonth,
    slots: displaySlots,
    allSlots: slots,
    agendaItems,
    requests,
    monthlySummary,
    filterMode,
    setFilterMode,
    doctorFilter,
    setDoctorFilter,
    isLoading,
    error,
    fetchAgenda,
    generateDaySlots,
    startAttention,
    endAttention,
    cancelAppointment,
    markNoShow,
    toggleSlotStatus,
    approveRequest,
    rejectRequest,
    updateAppointment,
  };
}
