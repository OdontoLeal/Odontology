import { ClinicalEvolutionPayload } from '../infrastructure/clinical-record.model';
import {
  ActorContext,
  AppointmentState,
  AuthorshipMetadata,
  ClinicalDomainError,
  ClinicalRecordEntity,
} from './clinical-record.entity';

export type EvolutionTemplateCode =
  | 'operatoria'
  | 'cirugia_simple'
  | 'cirugia_compleja'
  | 'extraccion_quirurgica'
  | 'diseno_sonrisa'
  | 'urgencia';

export interface EvolutionTemplateDefinition {
  codigo: EvolutionTemplateCode;
  nombre: string;
  textoBloqueadoPrefix: string;
  camposObligatorios: string[];
  render(campos: Record<string, string>): string;
}

export class EvolutionNoteEntity {
  // RF-HCL-009: Catálogo base de plantillas de evolución con texto bloqueado y campos editables
  public static readonly TEMPLATES: Record<
    EvolutionTemplateCode,
    EvolutionTemplateDefinition
  > = {
    operatoria: {
      codigo: 'operatoria',
      nombre: 'Operatoria dental',
      textoBloqueadoPrefix:
        '[PLANTILLA OPERATORIA - TEXTO BLOQUEADO] Se realiza procedimiento de operatoria dental bajo aislamiento y protocolo adhesivo en',
      camposObligatorios: ['diente', 'superficie', 'lesion'],
      render: (c) =>
        `[PLANTILLA OPERATORIA - TEXTO BLOQUEADO] Se realiza procedimiento de operatoria dental bajo aislamiento y protocolo adhesivo en diente ${c.diente}, superficie ${c.superficie}, por lesión clínica de tipo ${c.lesion}. Paciente tolera el procedimiento sin complicaciones.`,
    },
    cirugia_simple: {
      codigo: 'cirugia_simple',
      nombre: 'Cirugía simple',
      textoBloqueadoPrefix:
        '[PLANTILLA CIRUGÍA SIMPLE - TEXTO BLOQUEADO] Previa asepsia, antisepsia y anestesia local infiltrativa/troncular, se realiza cirugía simple en',
      camposObligatorios: ['zona', 'hallazgo'],
      render: (c) =>
        `[PLANTILLA CIRUGÍA SIMPLE - TEXTO BLOQUEADO] Previa asepsia, antisepsia y anestesia local infiltrativa/troncular, se realiza cirugía simple en zona ${c.zona} por ${c.hallazgo}. Se Verifica hemostasia y se entregan recomendaciones posoperatorias.`,
    },
    cirugia_compleja: {
      codigo: 'cirugia_compleja',
      nombre: 'Cirugía compleja',
      textoBloqueadoPrefix:
        '[PLANTILLA CIRUGÍA COMPLEJA - TEXTO BLOQUEADO] Bajo anestesia local, se realiza abordaje quirúrgico con colgajo mucoperióstico y osteotomía en',
      camposObligatorios: ['zona', 'procedimientoEspecifico'],
      render: (c) =>
        `[PLANTILLA CIRUGÍA COMPLEJA - TEXTO BLOQUEADO] Bajo anestesia local, se realiza abordaje quirúrgico con colgajo mucoperióstico y osteotomía en ${c.zona} para ${c.procedimientoEspecifico}. Síntesis con sutura e indicaciones de signos de alarma.`,
    },
    extraccion_quirurgica: {
      codigo: 'extraccion_quirurgica',
      nombre: 'Extracción quirúrgica',
      textoBloqueadoPrefix:
        '[PLANTILLA EXTRACCIÓN QUIRÚRGICA - TEXTO BLOQUEADO] Previa anestesia local, sindesmotomía, luxación y exodoncia quirúrgica de pieza FDI',
      camposObligatorios: ['diente', 'motivoExodoncia'],
      render: (c) =>
        `[PLANTILLA EXTRACCIÓN QUIRÚRGICA - TEXTO BLOQUEADO] Previa anestesia local, sindesmotomía, luxación y exodoncia quirúrgica de pieza FDI ${c.diente} indicada por ${c.motivoExodoncia}. Cureteado alveolar, irrigación, hemostasia y sutura.`,
    },
    diseno_sonrisa: {
      codigo: 'diseno_sonrisa',
      nombre: 'Diseño de sonrisa',
      textoBloqueadoPrefix:
        '[PLANTILLA DISEÑO DE SONRISA - TEXTO BLOQUEADO] Se ejecuta fase estética de diseño de sonrisa en sector',
      camposObligatorios: ['sector', 'materialTecnica'],
      render: (c) =>
        `[PLANTILLA DISEÑO DE SONRISA - TEXTO BLOQUEADO] Se ejecuta fase estética de diseño de sonrisa en sector ${c.sector} empleando técnica/material ${c.materialTecnica}. Control oclusal, pulido y brillo final.`,
    },
    urgencia: {
      codigo: 'urgencia',
      nombre: 'Atención de urgencia',
      textoBloqueadoPrefix:
        '[PLANTILLA URGENCIA - TEXTO BLOQUEADO] Atención odontológica prioritaria de urgencia en pieza/zona',
      camposObligatorios: ['dienteOZona', 'diagnosticoUrgencia', 'manejoInmediato'],
      render: (c) =>
        `[PLANTILLA URGENCIA - TEXTO BLOQUEADO] Atención odontológica prioritaria de urgencia en pieza/zona ${c.dienteOZona} por ${c.diagnosticoUrgencia}, realizando manejo clínico inmediato: ${c.manejoInmediato}.`,
    },
  };

  // RF-HCL-009: Crear nota de evolución (texto libre o plantilla) o Nota Aclaratoria
  public static createEvolutionPayload(params: {
    actor: ActorContext;
    idProfesionalResponsableCita: number;
    estadoCita: AppointmentState | string;
    esNotaAclaratoria?: boolean;
    procedimientoRealizado: string;
    notaEvolucionTextoLibre?: string;
    plantillaCodigo?: EvolutionTemplateCode;
    camposPlantilla?: Record<string, string>;
    now?: Date;
  }): ClinicalEvolutionPayload {
    const now = params.now ?? new Date();

    if (params.esNotaAclaratoria) {
      // Las notas aclaratorias post-cierre solo las registra el profesional responsable (ROL-ODO o ROL-ESP)
      ClinicalRecordEntity.assertIsResponsibleProfessional(
        params.actor,
        params.idProfesionalResponsableCita
      );
    } else {
      // Registro normal de evolución: permitido mientras la cita está "En consulta" (ODO, ESP o AUX)
      // o hasta las 23:59 del mismo día para el profesional responsable
      const isResponsibleProf =
        (params.actor.roles.includes('ROL-ODO') ||
          params.actor.roles.includes('ROL-ESP')) &&
        params.actor.idUsuario === params.idProfesionalResponsableCita;
      const isAuxInActiveConsultation =
        params.actor.roles.includes('ROL-AUX') && params.estadoCita === 'En consulta';

      if (!isResponsibleProf && !isAuxInActiveConsultation) {
        throw new ClinicalDomainError(
          ClinicalRecordEntity.UNAUTHORIZED_MESSAGE,
          'FORBIDDEN'
        );
      }
    }

    if (!params.procedimientoRealizado || params.procedimientoRealizado.trim().length === 0) {
      throw new ClinicalDomainError(
        'El campo "procedimientoRealizado" es obligatorio en la evolución.',
        'BAD_REQUEST'
      );
    }

    const textoEvolucion = this.resolveNoteText(
      params.notaEvolucionTextoLibre,
      params.plantillaCodigo,
      params.camposPlantilla
    );

    const authorship: AuthorshipMetadata = {
      idUsuario: params.actor.idUsuario,
      nombreUsuario: params.actor.nombreUsuario,
      idProfesionalResponsable: params.idProfesionalResponsableCita,
      fechaHoraISO: ClinicalRecordEntity.getColombiaISOString(now),
    };

    return {
      tipoRegistro: params.esNotaAclaratoria
        ? 'NOTA_ACLARATORIA'
        : 'EVOLUCION_ODONTOGRAMA',
      procedimientoRealizado: params.procedimientoRealizado.trim(),
      notaEvolucion: textoEvolucion,
      diligenciadoPor: authorship,
    };
  }

  // RF-HCL-009: Validar edición de una nota de evolución existente
  public static updateExistingEvolutionPayload(params: {
    actor: ActorContext;
    idProfesionalResponsableCita: number;
    estadoCita: AppointmentState | string;
    fechaCreacionNota: Date;
    existingPayload: ClinicalEvolutionPayload;
    procedimientoRealizado: string;
    notaEvolucionTextoLibre?: string;
    plantillaCodigo?: EvolutionTemplateCode;
    camposPlantilla?: Record<string, string>;
    now?: Date;
  }): ClinicalEvolutionPayload {
    const now = params.now ?? new Date();

    if (params.existingPayload.tipoRegistro === 'NOTA_ACLARATORIA') {
      throw new ClinicalDomainError(
        'Las notas aclaratorias son inmutables y no pueden ser editadas.',
        'FORBIDDEN'
      );
    }

    // Regla de inmutabilidad después de las 23:59 UTC-5
    ClinicalRecordEntity.assertSameDayInColombia(params.fechaCreacionNota, now);

    const isResponsibleProf =
      (params.actor.roles.includes('ROL-ODO') ||
        params.actor.roles.includes('ROL-ESP')) &&
      params.actor.idUsuario === params.idProfesionalResponsableCita;

    const isAuxEditingOwnNoteInConsultation =
      params.actor.roles.includes('ROL-AUX') &&
      params.estadoCita === 'En consulta' &&
      params.existingPayload.diligenciadoPor.idUsuario === params.actor.idUsuario;

    if (!isResponsibleProf && !isAuxEditingOwnNoteInConsultation) {
      throw new ClinicalDomainError(
        ClinicalRecordEntity.UNAUTHORIZED_MESSAGE,
        'FORBIDDEN'
      );
    }

    if (!params.procedimientoRealizado || params.procedimientoRealizado.trim().length === 0) {
      throw new ClinicalDomainError(
        'El campo "procedimientoRealizado" es obligatorio.',
        'BAD_REQUEST'
      );
    }

    const textoEvolucion = this.resolveNoteText(
      params.notaEvolucionTextoLibre,
      params.plantillaCodigo,
      params.camposPlantilla
    );

    return {
      ...params.existingPayload,
      procedimientoRealizado: params.procedimientoRealizado.trim(),
      notaEvolucion: textoEvolucion,
      diligenciadoPor: {
        idUsuario: params.actor.idUsuario,
        nombreUsuario: params.actor.nombreUsuario,
        idProfesionalResponsable: params.idProfesionalResponsableCita,
        fechaHoraISO: ClinicalRecordEntity.getColombiaISOString(now),
      },
    };
  }

  private static resolveNoteText(
    textoLibre?: string,
    plantillaCodigo?: EvolutionTemplateCode,
    camposPlantilla?: Record<string, string>
  ): string {
    if (plantillaCodigo) {
      const template = this.TEMPLATES[plantillaCodigo];
      if (!template) {
        throw new ClinicalDomainError(
          `La plantilla "${plantillaCodigo}" no existe en el catálogo configurado.`,
          'BAD_REQUEST'
        );
      }

      const campos = camposPlantilla ?? {};
      for (const campo of template.camposObligatorios) {
        if (!campos[campo] || campos[campo].trim().length === 0) {
          throw new ClinicalDomainError(
            `El campo "${campo}" de la plantilla "${template.nombre}" es obligatorio.`,
            'BAD_REQUEST'
          );
        }
      }

      const rendered = template.render(
        Object.fromEntries(
          Object.entries(campos).map(([k, v]) => [k, v.trim()])
        )
      );

      // Verifica que el texto bloqueado permanezca intacto
      if (!rendered.startsWith(template.textoBloqueadoPrefix)) {
        throw new ClinicalDomainError(
          'El texto bloqueado de la plantilla de evolución no puede ser alterado.',
          'BAD_REQUEST'
        );
      }

      return textoLibre && textoLibre.trim().length > 0
        ? `${rendered} Observaciones adicionales: ${textoLibre.trim()}`
        : rendered;
    }

    if (!textoLibre || textoLibre.trim().length === 0) {
      throw new ClinicalDomainError(
        'El detalle de la evolución ("notaEvolucion") es obligatorio.',
        'BAD_REQUEST'
      );
    }

    return textoLibre.trim();
  }
}