// src/modules/clinical-documents/infrastructure/clinical-document.repository.ts
import { db } from '../../../shared/infrastructure/database/database';
import { auditLog } from '../../../shared/infrastructure/audit/audit-log.service';
import {
  ConsultationContextData,
  GeneratedClinicalDocument,
  IClinicalDocumentRepository,
} from '../domain/clinical-document.repository.interface';

/**
 * Módulo E (ERS v1.2/v1.3): los documentos se generan en memoria y no se
 * almacenan; tampoco crean filas en `evolucion` (D-24, D-27). Solo se lee el
 * contexto de la consulta y se audita la generación.
 */
export class ClinicalDocumentRepository implements IClinicalDocumentRepository {
  async getConsultationContext(idPaciente: number, idCita: number): Promise<ConsultationContextData | null> {
    const { rows } = await db.query(
      `SELECT p.id_paciente,
              p.nombre_completo AS "pacienteNombre",
              p.documento_identidad AS "pacienteDocumento",
              p.fecha_nacimiento AS "fechaNacimiento",
              p.sexo,
              hc.id_historia AS "idHistoria",
              c.id_cita AS "idCita",
              c.id_usuario AS "idProfesionalResponsable",
              c.estado AS "estadoCita",
              u.nombre_completo AS "nombreProfesionalResponsable",
              u.firma_base64 AS "firmaProfesional",
              (SELECT MIN(bc.id_bloque) FROM public.bloques_citas bc WHERE bc.id_cita = c.id_cita) AS "fechaInicioCita",
              EXISTS (
                SELECT 1 FROM public.evolucion e
                 WHERE e.id_cita = c.id_cita AND TRIM(COALESCE(e.motivo_consulta, '')) <> ''
              ) AS "tieneApertura"
         FROM public.paciente p
         JOIN public.historia_clinica hc ON hc.id_paciente = p.id_paciente
         JOIN public.cita c ON c.id_paciente = p.id_paciente AND c.id_cita = $2
         JOIN public.usuario u ON u.id_usuario = c.id_usuario
        WHERE p.id_paciente = $1;`,
      [idPaciente, idCita]
    );
    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      paciente: {
        idPaciente: row.id_paciente,
        nombreCompleto: row.pacienteNombre,
        documentoIdentidad: row.pacienteDocumento,
        fechaNacimiento: row.fechaNacimiento,
        sexo: row.sexo,
        idHistoria: row.idHistoria,
      },
      cita: {
        idCita: row.idCita,
        idProfesionalResponsable: row.idProfesionalResponsable,
        nombreProfesionalResponsable: row.nombreProfesionalResponsable,
        firmaProfesionalUrl: row.firmaProfesional || null,
        estado: row.estadoCita,
        fechaInicioCita: row.fechaInicioCita,
      },
      tieneApertura: Boolean(row.tieneApertura),
    };
  }

  async recordGeneration(documento: Omit<GeneratedClinicalDocument, 'pdfBase64'>): Promise<void> {
    await auditLog.record({
      idUsuario: documento.diligenciadoPor.idUsuario,
      actor: documento.diligenciadoPor.nombreProfesional,
      accion: 'GENERAR_DOCUMENTO',
      entidad: 'documento_clinico',
      idRegistro: `cita:${documento.idCita}`,
      detalle: {
        idPaciente: documento.idPaciente,
        tipoDocumento: documento.tipoDocumento,
        modoFirma: documento.modoFirma,
        detalles: documento.detalles,
      },
    });
  }
}
