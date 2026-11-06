// src/modules/patients/application/create-patient.use-case.ts
import { Patient, PatientDomainError, PatientSex } from '../domain/patient.entity';
import {
  CreatedPatientResult,
  IPatientRepository,
  PatientAuditActor,
} from '../domain/patient.repository.interface';

/**
 * RF-HCL-001 (ERS v1.3): documento, nombre, sexo, fecha de nacimiento,
 * teléfono y correo. La autorización de datos y el trato con menores se
 * registran como consentimientos del Módulo D, no aquí.
 */
export interface CreatePatientInput {
  nombreCompleto: string;
  documentoIdentidad: string;
  fechaNacimiento: string;
  sexo?: PatientSex | null;
  telefono?: string | null;
  correo?: string | null;
  actor?: PatientAuditActor;
}

export class CreatePatientUseCase {
  constructor(private readonly patientRepository: IPatientRepository) {}

  public async execute(input: CreatePatientInput): Promise<CreatedPatientResult> {
    if (!input.documentoIdentidad?.trim()) {
      throw new PatientDomainError('documentoIdentidad', 'El documento de identidad es obligatorio.', 400);
    }

    // Criterio de aceptación: documento repetido → se rechaza y se muestra quién lo tiene
    const existingPatient = await this.patientRepository.findByDocument(input.documentoIdentidad.trim());
    if (existingPatient) {
      throw new PatientDomainError(
        'documentoIdentidad',
        `El documento de identidad ${existingPatient.documentoIdentidad} ya se encuentra registrado a nombre del paciente ${existingPatient.nombreCompleto}.`,
        409
      );
    }

    const patient = Patient.create({
      nombreCompleto: input.nombreCompleto,
      documentoIdentidad: input.documentoIdentidad,
      fechaNacimiento: input.fechaNacimiento,
      sexo: input.sexo ?? null,
      telefono: input.telefono ?? null,
      correo: input.correo ?? null,
    });

    return this.patientRepository.createPatient(patient, input.actor);
  }
}
