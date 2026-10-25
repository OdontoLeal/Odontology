// src/modules/clinical-records/ui/hooks/useClinicalRecord.ts
import { useState, useCallback, useEffect } from 'react';
import { OdontogramDataDTO } from '../../infrastructure/clinical-record.model';
import { OdontogramEntity } from '../../domain/odontogram.entity';

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
  };
  motivoConsulta: string;
  enfermedadActual?: string;
  procedimientoRealizado: string;
  diagnostico: string;
  accionesARealizar?: string;
  observaciones?: string;
  odontograma: OdontogramDataDTO;
  notasAclaratorias?: Array<{
    idNota: string;
    texto: string;
    fechaRegistro: string;
    autor: string;
  }>;
}

export function useClinicalRecord(idPaciente: number, apiBaseUrl = '/api/v1') {
  const [history, setHistory] = useState<ClinicalEvolutionEntry[]>([]);
  const [currentOdontogram, setCurrentOdontogram] = useState<OdontogramDataDTO>(() =>
    OdontogramEntity.createBlankOdontogramJSON()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!idPaciente) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/clinical-records/patient/${idPaciente}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        if (Array.isArray(data.evoluciones)) {
          setHistory(
            data.evoluciones.map((ev: any) => ({
              idEvolucion: Number(ev.idEvolucion ?? ev.id_evolucion),
              idHistoriaClinica: Number(ev.idHistoriaClinica ?? ev.id_historia),
              idCita: Number(ev.idCita ?? ev.id_cita),
              fechaRegistro: String(ev.fechaRegistro ?? ev.fecha ?? '').replace('T', ' ').slice(0, 16),
              profesional: {
                idUsuario: Number(ev.profesional?.idUsuario ?? 1),
                nombreCompleto: ev.profesional?.nombreCompleto || 'Dr. Eduar Leal Álvarez',
                rol: ev.profesional?.rol || 'Odontólogo General',
                tarjetaProfesional: ev.profesional?.tarjetaProfesional,
              },
              motivoConsulta: ev.motivoConsulta || ev.evolucion?.motivoConsulta || 'Consulta odontológica',
              enfermedadActual: ev.enfermedadActual || ev.evolucion?.enfermedadActual,
              procedimientoRealizado: ev.procedimientoRealizado || ev.evolucion?.procedimientoRealizado || '',
              diagnostico: ev.diagnostico || ev.evolucion?.diagnostico || '',
              accionesARealizar: ev.accionesARealizar || ev.evolucion?.accionesARealizar,
              observaciones: ev.observaciones || ev.evolucion?.observaciones,
              odontograma: ev.odontograma || ev.evolucion?.odontograma || OdontogramEntity.createBlankOdontogramJSON(),
              notasAclaratorias: ev.notasAclaratorias || ev.evolucion?.notasAclaratorias || [],
            }))
          );
        } else if (Array.isArray(data.historial)) {
          const mappedEntries: ClinicalEvolutionEntry[] = [];
          for (let i = 0; i < data.historial.length; i++) {
            const item = data.historial[i];
            if (Array.isArray(item.notasEvolucion) && item.notasEvolucion.length > 0) {
              for (const note of item.notasEvolucion) {
                mappedEntries.push({
                  idEvolucion: Number(note.idEvolucion || item.idCita),
                  idHistoriaClinica: Number(data.idHistoria || 1),
                  idCita: Number(item.idCita),
                  fechaRegistro: String(note.diligenciadoPor?.fechaHoraISO || item.fechaHoraRegistro || '').replace('T', ' ').slice(0, 16),
                  profesional: {
                    idUsuario: Number(note.diligenciadoPor?.idUsuario || 1),
                    nombreCompleto: note.diligenciadoPor?.nombreUsuario || item.profesionalResponsable || 'Dr. Eduar Leal Álvarez',
                    rol: note.diligenciadoPor?.rol || 'Odontólogo General',
                  },
                  motivoConsulta: item.motivoConsulta || 'Consulta Odontológica',
                  enfermedadActual: item.antecedentes?.enfermedadActual,
                  procedimientoRealizado: note.procedimientoRealizado || note.notaEvolucion || 'Atención odontológica realizada',
                  diagnostico: note.notaEvolucion || 'Diagnóstico clínico',
                  accionesARealizar: note.accionesARealizar,
                  observaciones: note.notaEvolucion,
                  odontograma: item.odontograma || OdontogramEntity.createBlankOdontogramJSON(),
                  notasAclaratorias: [],
                });
              }
            } else {
              mappedEntries.push({
                idEvolucion: Number(item.idCita || i + 1),
                idHistoriaClinica: Number(data.idHistoria || 1),
                idCita: Number(item.idCita || i + 1),
                fechaRegistro: String(item.fechaHoraRegistro || '').replace('T', ' ').slice(0, 16),
                profesional: {
                  idUsuario: 1,
                  nombreCompleto: item.profesionalResponsable || 'Dr. Eduar Leal Álvarez',
                  rol: 'Odontólogo General',
                },
                motivoConsulta: item.motivoConsulta || 'Consulta Odontológica',
                enfermedadActual: item.antecedentes?.enfermedadActual,
                procedimientoRealizado: item.motivoConsulta || 'Atención odontológica',
                diagnostico: item.motivoConsulta || 'Diagnóstico clínico',
                observaciones: item.motivoConsulta,
                odontograma: item.odontograma || OdontogramEntity.createBlankOdontogramJSON(),
                notasAclaratorias: [],
              });
            }
          }
          setHistory(mappedEntries);
        } else {
          setHistory([]);
        }

        if (data.ultimoOdontograma) {
          setCurrentOdontogram(data.ultimoOdontograma);
        } else if (Array.isArray(data.historial) && data.historial[0]?.odontograma) {
          setCurrentOdontogram(data.historial[0].odontograma);
        }
      }
    } catch (err: any) {
      console.error('Error fetching clinical history:', err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, idPaciente]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const saveEvolutionEntry = useCallback(
    async (entryData: Partial<ClinicalEvolutionEntry>) => {
      setIsLoading(true);
      setError(null);
      try {
        const notaEvolucionFinal =
          (entryData as any).notaEvolucion ||
          entryData.observaciones ||
          entryData.procedimientoRealizado ||
          (entryData.motivoConsulta ? `Atención realizada por motivo: ${entryData.motivoConsulta}` : 'Evolución clínica odontológica registrada.');

        const payload = {
          tipoRegistro: 'EVOLUCION_ODONTOGRAMA',
          motivoConsulta: entryData.motivoConsulta || 'Consulta Odontológica',
          enfermedadActual: entryData.enfermedadActual || '',
          procedimientoRealizado: entryData.procedimientoRealizado || 'Valoración y atención odontológica',
          notaEvolucion: notaEvolucionFinal,
          diagnostico: entryData.diagnostico || 'Control y valoración clínica',
          accionesARealizar: entryData.accionesARealizar || '',
          observaciones: entryData.observaciones || '',
          odontograma: entryData.odontograma || currentOdontogram,
          diligenciadoPor: {
            idUsuario: entryData.profesional?.idUsuario || 1,
            nombreCompleto: entryData.profesional?.nombreCompleto || 'Dr. Eduar Leal Álvarez',
            rol: entryData.profesional?.rol || 'Odontólogo General',
            fechaHoraISO: new Date().toISOString(),
          },
        };

        const res = await fetch(`${apiBaseUrl}/clinical-records/evolutions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idPaciente,
            idCita: entryData.idCita || 1,
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
          fechaRegistro: new Date().toISOString().replace('T', ' ').slice(0, 16),
          profesional: {
            idUsuario: 1,
            nombreCompleto: 'Dr. Eduar Leal Álvarez',
            rol: 'Odontólogo General',
          },
          motivoConsulta: entryData.motivoConsulta || 'Consulta clínica',
          enfermedadActual: entryData.enfermedadActual,
          procedimientoRealizado: entryData.procedimientoRealizado || '',
          diagnostico: entryData.diagnostico || '',
          accionesARealizar: entryData.accionesARealizar,
          observaciones: entryData.observaciones,
          odontograma: entryData.odontograma || currentOdontogram,
        };

        setHistory((prev) => [newEntry, ...prev]);
        if (entryData.odontograma) {
          setCurrentOdontogram(entryData.odontograma);
        }
        return newEntry;
      } catch (err: any) {
        console.error('Error saving evolution entry:', err.message);
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl, currentOdontogram, idPaciente]
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
