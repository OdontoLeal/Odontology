import {
  BackupContactInfo,
  GuardianInfo,
  Patient,
  PatientDomainError,
  PatientSex,
} from '../domain/patient.entity';
import { IPatientRepository } from '../domain/patient.repository.interface';

export interface UpdatePatientInput {
  idPaciente: number;
  idUsuarioActor?: number;
  changes: {
    nombreCompleto?: string;
    documentoIdentidad?: string;
    fechaNacimiento?: string;
    sexo?: PatientSex | null;
    telefono?: string | null;
    correo?: string | null;
    contactoRespaldo?: BackupContactInfo | null;
    acudiente?: GuardianInfo | null;
  };
}

export class UpdatePatientUseCase {
  constructor(private readonly patientRepository: IPatientRepository) {}

  public async execute(
    input: UpdatePatientInput
  ): Promise<ReturnType<Patient['toPrimitives']>> {
    if (!input.idPaciente || isNaN(input.idPaciente)) {
      throw new PatientDomainError(
        'idPaciente',
        'El identificador del paciente no es válido.',
        400
      );
    }

    const existingPatient = await this.patientRepository.findById(
      input.idPaciente
    );

    if (!existingPatient) {
      throw new PatientDomainError(
        'idPaciente',
        'Paciente no encontrado.',
        404
      );
    }

    // Captura del valor anterior para el registro de auditoría inalterable (RQNF-SEG-009)
    const previousSnapshot = existingPatient.toPrimitives();

    // RF-HCL-002: Si cambia el documento y ya pertenece a otro paciente, rechazar mostrando ese paciente
    if (
      input.changes.documentoIdentidad !== undefined &&
      input.changes.documentoIdentidad.trim() !==
        existingPatient.documentoIdentidad
    ) {
      const patientWithSameDoc = await this.patientRepository.findByDocument(
        input.changes.documentoIdentidad.trim()
      );

      if (
        patientWithSameDoc &&
        patientWithSameDoc.idPaciente !== input.idPaciente
      ) {
        throw new PatientDomainError(
          'documentoIdentidad',
          `El documento ${patientWithSameDoc.documentoIdentidad} ya está asociado a otro paciente: ${patientWithSameDoc.nombreCompleto} (Documento: ${patientWithSameDoc.documentoIdentidad}).`,
          409
        );
      }
    }

    existingPatient.update(input.changes);

    const updated = await this.patientRepository.updatePatient(
      input.idPaciente,
      existingPatient,
      {
        idUsuarioActor: input.idUsuarioActor,
        valorAnterior: previousSnapshot,
      }
    );

    if (!updated) {
      throw new PatientDomainError(
        'idPaciente',
        'Paciente no encontrado.',
        404
      );
    }

    return updated;
  }
}