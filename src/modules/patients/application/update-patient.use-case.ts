import { Patient, PatientChanges, PatientDomainError } from '../domain/patient.entity';
import { IPatientRepository } from '../domain/patient.repository.interface';

export interface UpdatePatientInput {
  idPaciente: number;
  idUsuarioActor?: number;
  actor?: string;
  changes: PatientChanges;
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

    // Solo se aceptan los campos de RF-HCL-001 (se ignora cualquier otro dato del cuerpo).
    const { nombreCompleto, documentoIdentidad, fechaNacimiento, sexo, telefono, correo } = input.changes ?? {};
    existingPatient.update({ nombreCompleto, documentoIdentidad, fechaNacimiento, sexo, telefono, correo });

    const updated = await this.patientRepository.updatePatient(
      input.idPaciente,
      existingPatient,
      {
        idUsuarioActor: input.idUsuarioActor,
        actor: input.actor,
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