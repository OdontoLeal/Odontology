import {
  AuthorizationMedium,
  DataAuthorizationVO,
} from '../domain/data-authorization.vo';
import {
  BackupContactInfo,
  GuardianInfo,
  Patient,
  PatientDomainError,
  PatientSex,
} from '../domain/patient.entity';
import {
  CreatedPatientResult,
  IPatientRepository,
} from '../domain/patient.repository.interface';

export interface CreatePatientInput {
  nombreCompleto: string;
  documentoIdentidad: string;
  fechaNacimiento: string;
  sexo?: PatientSex | null;
  telefono?: string | null;
  correo?: string | null;
  contactoRespaldo?: BackupContactInfo | null;
  acudiente?: GuardianInfo | null;
  autorizacionDatos: {
    autorizado: boolean;
    medio?: AuthorizationMedium;
    versionAvisoPrivacidad?: string;
    fechaHora?: Date | string;
    idUsuarioRegistro?: number | null;
  };
  creadoDesdeSolicitud?: boolean;
}

export class CreatePatientUseCase {
  constructor(private readonly patientRepository: IPatientRepository) {}

  public async execute(
    input: CreatePatientInput
  ): Promise<CreatedPatientResult> {
    if (!input.documentoIdentidad?.trim()) {
      throw new PatientDomainError(
        'documentoIdentidad',
        'El documento de identidad es obligatorio.',
        400
      );
    }

    // RF-HCL-001 Criterio de aceptación: Si el documento ya existe, rechazar y mostrar quién lo tiene
    const existingPatient = await this.patientRepository.findByDocument(
      input.documentoIdentidad.trim()
    );

    if (existingPatient) {
      throw new PatientDomainError(
        'documentoIdentidad',
        `El documento de identidad ${existingPatient.documentoIdentidad} ya se encuentra registrado a nombre del paciente ${existingPatient.nombreCompleto}.`,
        409
      );
    }

    // Construcción temporal para saber si es menor de edad al registrar la autorización
    const previewPatient = Patient.reconstitute({
      nombreCompleto: input.nombreCompleto || '',
      documentoIdentidad: input.documentoIdentidad,
      fechaNacimiento: input.fechaNacimiento || '2000-01-01',
    });

    const isMinor = previewPatient.isMinor();

    // RQNF-SEG-005: Autorización previa, expresa e informada obligatoria
    let dataAuthVO: DataAuthorizationVO;
    try {
      dataAuthVO = DataAuthorizationVO.create({
        autorizado: Boolean(input.autorizacionDatos?.autorizado),
        medio: input.autorizacionDatos?.medio ?? 'CONSULTORIO_WEB',
        versionAvisoPrivacidad:
          input.autorizacionDatos?.versionAvisoPrivacidad ?? '1.0',
        fechaHora: input.autorizacionDatos?.fechaHora ?? new Date(),
        idUsuarioRegistro: input.autorizacionDatos?.idUsuarioRegistro ?? null,
        firmadoPorAcudiente: isMinor,
      });
    } catch (error: any) {
      throw new PatientDomainError('autorizacionDatos', error.message, 400);
    }

    const patient = Patient.create({
      nombreCompleto: input.nombreCompleto,
      documentoIdentidad: input.documentoIdentidad,
      fechaNacimiento: input.fechaNacimiento,
      sexo: input.sexo ?? null,
      telefono: input.telefono ?? null,
      correo: input.correo ?? null,
      contactoRespaldo: input.contactoRespaldo ?? null,
      acudiente: input.acudiente ?? null,
      autorizacionDatos: dataAuthVO,
      creadoDesdeSolicitud: Boolean(input.creadoDesdeSolicitud),
    });

    return this.patientRepository.createPatient(patient);
  }
}