import { PatientDomainError } from '../domain/patient.entity';
import {
  IPatientRepository,
  PatientProfileRecord,
} from '../domain/patient.repository.interface';

export interface GetPatientProfileInput {
  idPaciente?: number;
  documento?: string;
  requesterRoles?: string[];
}

export interface PatientProfileOutput extends PatientProfileRecord {
  mensajeHistorialCitas: string | null;
  opcionesClinicasVisibles: {
    historiaClinica: boolean;
    consentimientosInformados: boolean;
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

    // RF-HCL-004 v1.3 y Regla de Negocio 4: dos opciones clínicas en la ficha.
    // - "Historia clínica" (RF-HCL-008): solo ROL-ODO y ROL-ESP.
    // - "Consentimientos informados" (RF-CON-001, RF-CON-003): ROL-ODO, ROL-ESP y
    //   ROL-AUX (que toma consentimientos desde la ficha de cualquier paciente).
    // ROL-COA y ROL-ADM (por sí solo) no ven opciones clínicas.
    const roles = input.requesterRoles ?? [];
    const isProfessional = roles.includes('ROL-ODO') || roles.includes('ROL-ESP');
    const isAux = roles.includes('ROL-AUX');

    return {
      ...profile,
      mensajeHistorialCitas:
        profile.historialCitas.length === 0
          ? 'El paciente no tiene citas registradas'
          : null,
      opcionesClinicasVisibles: {
        historiaClinica: isProfessional,
        consentimientosInformados: isProfessional || isAux,
      },
    };
  }
}