import { PatientDomainError } from '../domain/patient.entity';
import {
  IPatientRepository,
  PatientProfileRecord,
} from '../domain/patient.repository.interface';

export interface GetPatientProfileInput {
  idPaciente?: number;
  documento?: string;
  requesterRoles?: string[];
  hasActiveConsultationWithPatient?: boolean;
}

export interface PatientProfileOutput extends PatientProfileRecord {
  mensajeHistorialCitas: string | null;
  opcionesClinicasVisibles: {
    historiaClinica: boolean;
    consentimientosInformados: boolean;
    documentosClinicos: boolean;
  };
}

export class GetPatientProfileUseCase {
  constructor(private readonly patientRepository: IPatientRepository) {}

  public async execute(
    input: GetPatientProfileInput
  ): Promise<PatientProfileOutput> {
    if (!input.idPaciente && !input.documento?.trim()) {
      throw new PatientDomainError(
        'identifier',
        'Debe proporcionar el ID o el documento de identidad del paciente.',
        400
      );
    }

    const profile = await this.patientRepository.getPatientProfileByIdOrDoc({
      idPaciente: input.idPaciente,
      documento: input.documento?.trim(),
    });

    if (!profile) {
      throw new PatientDomainError(
        'idPaciente',
        'Paciente no encontrado.',
        404
      );
    }

    // Regla de Negocio 5 y RF-HCL-004:
    // ROL-ODO y ROL-ESP ven siempre las 3 opciones clínicas en la ficha.
    // ROL-AUX solo accede durante una cita "En consulta" de ese paciente.
    // ROL-COA y ROL-ADM (por sí solo) no ven opciones clínicas.
    const roles = input.requesterRoles ?? [];
    const isProfessional =
      roles.includes('ROL-ODO') || roles.includes('ROL-ESP');
    const isAuxInActiveConsultation =
      roles.includes('ROL-AUX') &&
      Boolean(input.hasActiveConsultationWithPatient);

    const canAccessClinicalTabs =
      isProfessional || isAuxInActiveConsultation;

    return {
      ...profile,
      mensajeHistorialCitas:
        profile.historialCitas.length === 0
          ? 'El paciente no tiene citas registradas'
          : null,
      opcionesClinicasVisibles: {
        historiaClinica: canAccessClinicalTabs,
        consentimientosInformados: canAccessClinicalTabs,
        documentosClinicos: canAccessClinicalTabs,
      },
    };
  }
}