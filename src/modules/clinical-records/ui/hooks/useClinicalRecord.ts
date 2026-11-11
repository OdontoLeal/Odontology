// src/modules/clinical-records/ui/hooks/useClinicalRecord.ts
import { useState, useCallback, useEffect } from 'react';
import { formatDateTimeCO } from '../../../../shared/ui/format';
import { OdontogramDataDTO } from '../../infrastructure/clinical-record.model';
import { OdontogramEntity } from '../../domain/odontogram.entity';

export interface ConsultationNoteViewItem {
  idNota: string;
  tipo: string;
  procedimientoRealizado?: string | null;
  texto: string;
  fecha: string;
  autor: string;
}

export interface ClinicalEvolutionEntry {
  idEvolucion: number;
  idHistoriaClinica: number;
  idCita: number;
  fechaRegistro: string;
  profesional: {
    idUsuario: number;
    nombreCompleto: string;
    rol: string;
    tarjetaProfesional?: string;
    firmaBase64?: string | null;
  };
  motivoConsulta: string;
  enfermedadActual?: string;
  antecedentesClinicos?: any;
  habitosHigiene?: any;
  examenEstomatognatico?: any;
  examenFisicoObservaciones?: string;
  procedimientoRealizado: string;
  diagnostico: string;
  diagnosticoGenerado?: string;
  accionesARealizar?: string;
  observaciones?: string;
  hallazgosObservaciones?: string;
  odontograma: OdontogramDataDTO;
  planManejo?: any;
  notasEvolucion?: ConsultationNoteViewItem[];
  notasAclaratorias?: Array<{
    idNota: string;
    texto: string;
    fechaRegistro: string;
    autor: string;
  }>;
}

export interface UseClinicalRecordOptions {
  enabled?: boolean;
  preferAppointmentEndpoint?: boolean;
}

/**
 * Historia clínica del paciente para la consulta en curso.
 * ROL-ODO/ROL-ESP leen el historial completo (RF-HCL-008). La auxiliar no puede
 * (Regla de Negocio 4): usa solo la historia de esa consulta (`/clinical-records/appointment/:idCita`).
 */
export function useClinicalRecord(
  idPaciente: number,
  apiBaseUrl = '/api/v1',
  idCita?: number,
  options?: UseClinicalRecordOptions
) {
  const enabled = options?.enabled !== false;
  const preferAppointmentEndpoint = options?.preferAppointmentEndpoint === true;

  const [history, setHistory] = useState<ClinicalEvolutionEntry[]>([]);
  const [currentOdontogram, setCurrentOdontogram] = useState<OdontogramDataDTO>(() =>
    OdontogramEntity.createBlankOdontogramJSON()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!idPaciente || !enabled) {
      setHistory([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      let consultaOnly = preferAppointmentEndpoint && Boolean(idCita);
      let res = await fetch(
        consultaOnly
          ? `${apiBaseUrl}/clinical-records/appointment/${idCita}`
          : `${apiBaseUrl}/clinical-records/patient/${idPaciente}`
      );
      if (!consultaOnly && res.status === 403 && idCita) {
        res = await fetch(`${apiBaseUrl}/clinical-records/appointment/${idCita}`);
        consultaOnly = true;
      }
      if (res.ok) {
        const json = await res.json();
        let data = json.data || json;
        if (consultaOnly) {
          // Solo la historia de esta consulta; el odontograma de partida es el último guardado
          const latest = await fetch(`${apiBaseUrl}/clinical-records/odontogram/latest/${idPaciente}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null);
          data = {
            evoluciones: data.registro ? [data.registro] : [],
            ultimoOdontograma: data.registro?.odontograma ?? latest?.data ?? null,
          };
        }
        const checkHasFindings = (o: any): boolean => {
          if (!o || !o.cuadrantes) return false;
          for (const q of Object.values(o.cuadrantes) as any[]) {
            if (!q?.piezas) continue;
            for (const t of Object.values(q.piezas) as any[]) {
              if (t?.caras) {
                for (const c of Object.values(t.caras) as any[]) {
                  if (c?.caries_activa || c?.restauracion_resina || c?.sellante_fosas || c?.desgaste_faceta) return true;
                }
              }
              if (t?.simbolos_tecnicos) {
                const s = t.simbolos_tecnicos;
                if (s.diente_extraido || s.extraccion_requerida || s.corona || s.implante || s.protesis_fija || s.endodoncia || s.puente) return true;
              }
              if (t?.nota_clinica?.descripcion) return true;
            }
          }
          return false;
        };

        if (Array.isArray(data.evoluciones)) {
          setHistory(
            data.evoluciones.map((ev: any) => {
              let evoOdonto = ev.odontograma || ev.evolucion?.odontograma;
              if (typeof evoOdonto === 'string') {
                try { evoOdonto = JSON.parse(evoOdonto); } catch {}
              }
              if (!evoOdonto || !evoOdonto.cuadrantes) {
                evoOdonto = OdontogramEntity.createBlankOdontogramJSON();
              }
              const rawNotas: any[] = Array.isArray(ev.notas) ? ev.notas : [];
              const notasEvolucion: ConsultationNoteViewItem[] = rawNotas
                .filter((n) => n.tipo !== 'NOTA_ACLARATORIA')
                .map((n) => ({
                  idNota: String(n.idNota ?? ''),
                  tipo: n.tipo ?? 'EVOLUCION',
                  procedimientoRealizado: n.procedimientoRealizado ?? null,
                  texto: n.texto ?? '',
                  fecha: formatDateTimeCO(n.fecha),
                  autor: n.diligenciadoPor?.nombreUsuario ?? 'Personal clínico',
                }));
              const notasAclaratorias =
                rawNotas.length > 0
                  ? rawNotas
                      .filter((n) => n.tipo === 'NOTA_ACLARATORIA')
                      .map((n) => ({
                        idNota: String(n.idNota ?? ''),
                        texto: n.texto ?? '',
                        fechaRegistro: formatDateTimeCO(n.fecha),
                        autor: n.diligenciadoPor?.nombreUsuario ?? 'Profesional',
                      }))
                  : ev.notasAclaratorias || ev.evolucion?.notasAclaratorias || [];

              return {
                idEvolucion: Number(ev.idEvolucion ?? ev.id_evolucion),
                idHistoriaClinica: Number(ev.idHistoriaClinica ?? ev.id_historia),
                idCita: Number(ev.idCita ?? ev.id_cita),
                fechaRegistro: formatDateTimeCO(ev.fechaRegistro ?? ev.fecha),
                profesional: {
                  idUsuario: Number(ev.profesional?.idUsuario ?? ev.idUsuario ?? 1),
                  nombreCompleto: ev.profesionalResponsable || ev.profesional?.nombreCompleto || 'Profesional asignado',
                  rol: ev.profesional?.rol || 'Odontólogo General',
                  tarjetaProfesional: ev.profesional?.tarjetaProfesional,
                  firmaBase64: ev.profesionalFirma || ev.evolucion?.diligenciadoPor?.firmaBase64 || null,
                },
                motivoConsulta: ev.motivoConsulta ?? ev.evolucion?.motivoConsulta ?? '',
                enfermedadActual: ev.enfermedadActual || ev.evolucion?.enfermedadActual,
                antecedentesClinicos: ev.antecedentesClinicos || ev.evolucion?.antecedentesClinicos || ev.evolucion?.antecedentes,
                habitosHigiene: ev.habitosHigiene || ev.evolucion?.habitosHigiene,
                examenEstomatognatico: ev.examenEstomatognatico || ev.evolucion?.examenEstomatognatico,
                examenFisicoObservaciones: ev.examenFisicoObservaciones || ev.evolucion?.examenFisicoObservaciones,
                procedimientoRealizado: ev.procedimientoRealizado || ev.evolucion?.procedimientoRealizado || '',
                diagnostico: ev.diagnosticoGenerado || ev.diagnostico || ev.evolucion?.diagnostico || '',
                diagnosticoGenerado: ev.diagnosticoGenerado || ev.evolucion?.diagnosticoGenerado,
                accionesARealizar: ev.accionesARealizar || ev.evolucion?.accionesARealizar,
                observaciones: ev.hallazgosObservaciones || ev.observaciones || ev.evolucion?.observaciones,
                hallazgosObservaciones: ev.hallazgosObservaciones || ev.evolucion?.hallazgosObservaciones,
                odontograma: evoOdonto,
                planManejo: ev.planManejo || ev.evolucion?.planManejo,
                notasEvolucion,
                notasAclaratorias,
              };
            })
          );
        } else if (Array.isArray(data.historial)) {
          const mappedEntries: ClinicalEvolutionEntry[] = [];
          for (let i = 0; i < data.historial.length; i++) {
            const item = data.historial[i];
            let odonto = item.odontograma;
            if (typeof odonto === 'string') {
              try { odonto = JSON.parse(odonto); } catch {}
            }
            if (!odonto || !odonto.cuadrantes) {
              odonto = OdontogramEntity.createBlankOdontogramJSON();
            }
            const rawHistoryNotes: any[] = Array.isArray(item.notasEvolucion) ? item.notasEvolucion : [];
            const notasEvolucion: ConsultationNoteViewItem[] = rawHistoryNotes
              .filter((n) => n.idNota && n.tipoRegistro !== 'NOTA_ACLARATORIA')
              .map((n) => ({
                idNota: String(n.idNota),
                tipo: n.tipoRegistro ?? 'EVOLUCION',
                procedimientoRealizado: n.procedimientoRealizado ?? null,
                texto: n.notaEvolucion ?? '',
                fecha: formatDateTimeCO(n.diligenciadoPor?.fechaHoraISO),
                autor: n.diligenciadoPor?.nombreUsuario ?? 'Personal clínico',
              }));
            const notasAclaratorias = rawHistoryNotes
              .filter((n) => n.idNota && n.tipoRegistro === 'NOTA_ACLARATORIA')
              .map((n) => ({
                idNota: String(n.idNota),
                texto: n.notaEvolucion ?? '',
                fechaRegistro: formatDateTimeCO(n.diligenciadoPor?.fechaHoraISO),
                autor: n.diligenciadoPor?.nombreUsuario ?? 'Profesional',
              }));

            const motivo = item.motivoConsulta || '';
            const proc = item.procedimientoRealizado || '';
            const diag = item.diagnosticoGenerado || item.diagnostico || '';
            const obs = item.hallazgosObservaciones || '';

            mappedEntries.push({
              idEvolucion: Number(item.notasEvolucion?.[0]?.idEvolucion || item.idCita || i + 1),
              idHistoriaClinica: Number(data.idHistoria || 1),
              idCita: Number(item.idCita || i + 1),
              fechaRegistro: formatDateTimeCO(
                item.notasEvolucion?.[0]?.diligenciadoPor?.fechaHoraISO || item.fechaHoraRegistro
              ),
              profesional: {
                idUsuario: Number(item.notasEvolucion?.[0]?.diligenciadoPor?.idUsuario || 1),
                nombreCompleto:
                  item.profesionalResponsable ||
                  item.notasEvolucion?.[0]?.diligenciadoPor?.nombreUsuario ||
                  'Profesional asignado',
                rol: item.notasEvolucion?.[0]?.diligenciadoPor?.rol || 'Odontólogo General',
              },
              motivoConsulta: motivo,
              enfermedadActual: item.enfermedadActual || item.antecedentes?.enfermedadActual,
              antecedentesClinicos: item.antecedentesClinicos || item.antecedentes,
              habitosHigiene: item.habitosHigiene,
              examenEstomatognatico: item.examenEstomatognatico,
              examenFisicoObservaciones: item.examenFisicoObservaciones,
              procedimientoRealizado: proc,
              diagnostico: diag,
              diagnosticoGenerado: item.diagnosticoGenerado,
              accionesARealizar: item.accionesARealizar,
              observaciones: obs,
              hallazgosObservaciones: item.hallazgosObservaciones,
              odontograma: odonto,
              planManejo: item.planManejo,
              notasEvolucion,
              notasAclaratorias,
            });
          }
          setHistory(mappedEntries);
        } else {
          setHistory([]);
        }

        if (data.ultimoOdontograma && checkHasFindings(data.ultimoOdontograma)) {
          setCurrentOdontogram(data.ultimoOdontograma);
        } else if (data.historial && data.historial.length > 0) {
          const firstWithFindings = data.historial.find(
            (h: any) => h.odontograma && checkHasFindings(h.odontograma)
          );
          if (firstWithFindings) {
            let o = firstWithFindings.odontograma;
            if (typeof o === 'string') {
              try { o = JSON.parse(o); } catch {}
            }
            setCurrentOdontogram(o);
          } else {
            const firstWithOdonto = data.historial.find(
              (h: any) => h.odontograma && h.odontograma.cuadrantes
            );
            if (firstWithOdonto) {
              let o = firstWithOdonto.odontograma;
              if (typeof o === 'string') {
                try { o = JSON.parse(o); } catch {}
              }
              setCurrentOdontogram(o);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching clinical record:', err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, idPaciente, idCita, enabled, preferAppointmentEndpoint]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const saveEvolutionEntry = useCallback(
    async (entryData: Partial<ClinicalEvolutionEntry>) => {
      setIsLoading(true);
      setError(null);
      try {
        const rawNote =
          (entryData as any).notaEvolucion ||
          entryData.hallazgosObservaciones ||
          entryData.observaciones ||
          entryData.procedimientoRealizado ||
          '';
        const notaEvolucionFinal = typeof rawNote === 'string' ? rawNote.trim() : '';

        const payload = {
          tipoRegistro: 'EVOLUCION_ODONTOGRAMA',
          motivoConsulta: entryData.motivoConsulta || '',
          enfermedadActual: entryData.enfermedadActual || '',
          antecedentesClinicos: entryData.antecedentesClinicos || {},
          habitosHigiene: entryData.habitosHigiene || {},
          examenEstomatognatico: entryData.examenEstomatognatico || {},
          examenFisicoObservaciones: entryData.examenFisicoObservaciones || '',
          procedimientoRealizado: entryData.procedimientoRealizado || '',
          ...(notaEvolucionFinal ? { notaEvolucion: notaEvolucionFinal } : {}),
          diagnostico: entryData.diagnostico || '',
          diagnosticoGenerado: entryData.diagnosticoGenerado || entryData.diagnostico || '',
          accionesARealizar: entryData.accionesARealizar || '',
          observaciones: entryData.observaciones || '',
          hallazgosObservaciones: entryData.hallazgosObservaciones || entryData.observaciones || '',
          planManejo: entryData.planManejo || {},
          odontograma: entryData.odontograma || currentOdontogram,
        };

        const res = await fetch(`${apiBaseUrl}/clinical-records/evolutions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idPaciente,
            idCita: entryData.idCita ?? idCita,
            motivoConsulta: entryData.motivoConsulta,
            enfermedadActual: entryData.enfermedadActual,
            antecedentesClinicos: entryData.antecedentesClinicos,
            habitosHigiene: entryData.habitosHigiene,
            examenEstomatognatico: entryData.examenEstomatognatico,
            examenFisicoObservaciones: entryData.examenFisicoObservaciones,
            odontograma: entryData.odontograma || currentOdontogram,
            procedimientoRealizado: entryData.procedimientoRealizado,
            diagnosticoGenerado: entryData.diagnosticoGenerado || entryData.diagnostico,
            accionesARealizar: entryData.accionesARealizar,
            hallazgosObservaciones: entryData.hallazgosObservaciones || entryData.observaciones,
            planManejo: entryData.planManejo,
            payload,
          }),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.message || 'Error al guardar evolución clínica');
        }

        const json = await res.json();
        const createdRow = json.data || json;

        const newEntry: ClinicalEvolutionEntry = {
          idEvolucion: Number(createdRow.idEvolucion || Date.now()),
          idHistoriaClinica: Number(createdRow.idHistoria || 1),
          idCita: entryData.idCita || 1,
          fechaRegistro: formatDateTimeCO(new Date()),
          profesional: {
            idUsuario: 1,
            nombreCompleto: 'Dr. Eduar Leal Álvarez',
            rol: 'Odontólogo General',
          },
          motivoConsulta: entryData.motivoConsulta || 'Consulta clínica',
          enfermedadActual: entryData.enfermedadActual,
          antecedentesClinicos: entryData.antecedentesClinicos,
          habitosHigiene: entryData.habitosHigiene,
          examenEstomatognatico: entryData.examenEstomatognatico,
          examenFisicoObservaciones: entryData.examenFisicoObservaciones,
          procedimientoRealizado: entryData.procedimientoRealizado || '',
          diagnostico: entryData.diagnostico || '',
          diagnosticoGenerado: entryData.diagnosticoGenerado || entryData.diagnostico,
          accionesARealizar: entryData.accionesARealizar,
          observaciones: entryData.observaciones,
          hallazgosObservaciones: entryData.hallazgosObservaciones || entryData.observaciones,
          odontograma: entryData.odontograma || currentOdontogram,
          planManejo: entryData.planManejo,
        };

        setHistory((prev) => [newEntry, ...prev]);
        if (entryData.odontograma) {
          setCurrentOdontogram(entryData.odontograma);
        }
        await fetchHistory();
        return newEntry;
      } catch (err: any) {
        console.error('Error saving evolution entry:', err.message);
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl, currentOdontogram, idPaciente, idCita, fetchHistory]
  );

  return {
    history,
    currentOdontogram,
    isLoading,
    error,
    fetchHistory,
    saveEvolutionEntry,
  };
}
