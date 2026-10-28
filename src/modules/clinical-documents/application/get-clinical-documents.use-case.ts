import {
  ClinicalDocumentRecord,
  IClinicalDocumentRepository,
} from '../domain/clinical-document.repository.interface';

export interface GetClinicalDocumentsQuery {
  idPaciente: number;
  actor: {
    idUsuario: number;
    roles: string[];
  };
}

export interface GetClinicalDocumentsResult {
  message?: string;
  data: ReadonlyArray<ClinicalDocumentRecord>;
  soloLectura: true;
}

export class GetClinicalDocumentsUseCase {
  constructor(private readonly clinicalDocRepo: IClinicalDocumentRepository) {}

  public async execute(
    query: GetClinicalDocumentsQuery
  ): Promise<GetClinicalDocumentsResult> {
    if (!query.idPaciente || Number.isNaN(Number(query.idPaciente))) {
      throw new Error('Campo [idPaciente]: El identificador del paciente no es válido.');
    }

    await this.verificarAccesoSegunRol(query.idPaciente, query.actor.roles);

    const documentos = await this.clinicalDocRepo.getDocumentsByPatient(
      Number(query.idPaciente)
    );

    if (documentos.length === 0) {
      return {
        message: 'El paciente no tiene documentos clínicos registrados',
        data: Object.freeze([]),
        soloLectura: true,
      };
    }

    return {
      data: Object.freeze(documentos),
      soloLectura: true,
    };
  }

  private async verificarAccesoSegunRol(
    idPaciente: number,
    roles: string[] = []
  ): Promise<void> {
    const esProfesionalOdontologia = roles.some(
      (rol) => rol === 'ROL-ODO' || rol === 'ROL-ESP'
    );

    if (esProfesionalOdontologia) {
      return;
    }

    const esAuxiliar = roles.includes('ROL-AUX');
    if (esAuxiliar) {
      const tieneCitaEnConsulta =
        await this.clinicalDocRepo.hasActiveConsultationForPatient(idPaciente);
      if (tieneCitaEnConsulta) {
        return;
      }
    }

    // RQNF-SEG-003 y RF-DOC-005: Bloqueo estricto para ROL-COA, ROL-ADM (sin rol clínico) o ROL-AUX fuera de consulta
    throw new Error('No tiene permiso para realizar esta acción');
  }
}