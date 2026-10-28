// src/modules/patients/__tests__/patients.test.ts
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Patient, PatientDomainError } from '../domain/patient.entity';
import { DataAuthorizationVO } from '../domain/data-authorization.vo';
import {
  IPatientRepository,
  CreatedPatientResult,
  PatientSearchItem,
  PatientProfileRecord,
  HolderDataRecord,
} from '../domain/patient.repository.interface';

import { CreatePatientUseCase } from '../application/create-patient.use-case';
import { UpdatePatientUseCase } from '../application/update-patient.use-case';
import { SearchPatientsUseCase } from '../application/search-patients.use-case';
import { GetPatientProfileUseCase } from '../application/get-patient-profile.use-case';
import { ExportHolderDataUseCase } from '../application/export-holder-data.use-case';

// Implementación en memoria del repositorio de pacientes cumpliendo IPatientRepository
class InMemoryPatientRepository implements IPatientRepository {
  public patients: Map<number, Patient> = new Map();
  public auditHistory: any[] = [];
  private patientIdSeq = 1;

  async createPatient(patient: Patient): Promise<CreatedPatientResult> {
    const id = this.patientIdSeq++;
    const stored = Patient.reconstitute({
      idPaciente: id,
      nombreCompleto: patient.nombreCompleto,
      documentoIdentidad: patient.documentoIdentidad,
      fechaNacimiento: patient.fechaNacimiento,
      sexo: patient.sexo,
      telefono: patient.telefono,
      correo: patient.correo,
      contactoRespaldo: patient.contactoRespaldo,
      acudiente: patient.acudiente,
      autorizacionDatos: patient.autorizacionDatos,
      creadoDesdeSolicitud: false,
    });
    this.patients.set(id, stored);

    return {
      patient: stored.toPrimitives(),
      historiaClinicaBase: {
        id_historia: 1000 + id,
        fecha_creacion: new Date(),
      },
    };
  }

  async updatePatient(
    idPaciente: number,
    patient: Patient,
    auditMeta?: {
      idUsuarioActor?: number;
      valorAnterior?: Record<string, unknown>;
    }
  ): Promise<ReturnType<Patient['toPrimitives']> | null> {
    if (!this.patients.has(idPaciente)) return null;
    this.patients.set(idPaciente, patient);
    if (auditMeta) {
      this.auditHistory.push({ idPaciente, ...auditMeta });
    }
    return patient.toPrimitives();
  }

  async findById(idPaciente: number): Promise<Patient | null> {
    return this.patients.get(idPaciente) ?? null;
  }

  async findByDocument(documentoIdentidad: string): Promise<Patient | null> {
    return (
      Array.from(this.patients.values()).find(
        (p) => p.documentoIdentidad === documentoIdentidad
      ) ?? null
    );
  }

  async searchPatients(query?: string): Promise<PatientSearchItem[]> {
    if (!query) {
      return Array.from(this.patients.values()).map((p) => ({
        idPaciente: p.idPaciente!,
        nombreCompleto: p.nombreCompleto,
        documentoIdentidad: p.documentoIdentidad,
        correo: p.correo,
        telefono: p.telefono,
        fechaNacimiento: p.fechaNacimiento,
        sexo: p.sexo,
        datosIncompletos: p.datosIncompletos,
      }));
    }

    const cleanQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return Array.from(this.patients.values())
      .filter((p) => {
        const normName = p.nombreCompleto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return normName.includes(cleanQuery) || p.documentoIdentidad.includes(cleanQuery);
      })
      .map((p) => ({
        idPaciente: p.idPaciente!,
        nombreCompleto: p.nombreCompleto,
        documentoIdentidad: p.documentoIdentidad,
        correo: p.correo,
        telefono: p.telefono,
        fechaNacimiento: p.fechaNacimiento,
        sexo: p.sexo,
        datosIncompletos: p.datosIncompletos,
      }));
  }

  async getPatientProfileByIdOrDoc(identifier: {
    idPaciente?: number;
    documento?: string;
  }): Promise<PatientProfileRecord | null> {
    const patient = identifier.idPaciente
      ? this.patients.get(identifier.idPaciente)
      : Array.from(this.patients.values()).find(
          (p) => p.documentoIdentidad === identifier.documento
        );

    if (!patient) return null;

    return {
      idPaciente: patient.idPaciente!,
      documentoIdentidad: patient.documentoIdentidad,
      nombreCompleto: patient.nombreCompleto,
      fechaNacimiento: patient.fechaNacimiento,
      sexo: patient.sexo,
      telefono: patient.telefono,
      correo: patient.correo,
      datosIncompletos: patient.datosIncompletos,
      idHistoria: 1000 + patient.idPaciente!,
      contactoRespaldo: patient.contactoRespaldo,
      acudiente: patient.acudiente,
      autorizacionDatos: patient.autorizacionDatos
        ? {
            autorizado: patient.autorizacionDatos.autorizado,
            fechaHora: patient.autorizacionDatos.fechaHora.toISOString(),
            medio: patient.autorizacionDatos.medio,
            versionAvisoPrivacidad: patient.autorizacionDatos.versionAvisoPrivacidad,
            idUsuarioRegistro: patient.autorizacionDatos.idUsuarioRegistro,
            firmadoPorAcudiente: patient.autorizacionDatos.firmadoPorAcudiente,
          }
        : null,
      historialCitas: [],
    };
  }

  async getHolderDataByDocument(
    documentoIdentidad: string
  ): Promise<HolderDataRecord | null> {
    const patient = await this.findByDocument(documentoIdentidad);
    if (!patient) return null;

    return {
      documentoConsultado: documentoIdentidad,
      calidades: {
        comoPaciente: {
          idPaciente: patient.idPaciente!,
          nombreCompleto: patient.nombreCompleto,
          documentoIdentidad: patient.documentoIdentidad,
          correo: patient.correo,
          telefono: patient.telefono,
          fechaNacimiento: patient.fechaNacimiento,
          sexo: patient.sexo,
          contactoRespaldo: patient.contactoRespaldo,
        },
        comoAcudiente: [],
        comoSolicitante: [],
      },
      autorizaciones: [
        {
          fechaHora: new Date().toISOString(),
          medio: 'CONSULTORIO_WEB',
          versionAvisoPrivacidad: 'v1.1',
          calidad: 'PACIENTE',
        },
      ],
      citasRegistradas: [],
    };
  }
}

describe('MÓDULO C (Parte 1): Gestión de Pacientes y Ficha Médica (RF-HCL-001 a RF-HCL-004, RF-HCL-010)', () => {
  let repo: InMemoryPatientRepository;

  beforeEach(() => {
    repo = new InMemoryPatientRepository();
  });

  it('RF-HCL-001: Crear paciente adulto con todos los campos obligatorios y autorización de datos', async () => {
    const useCase = new CreatePatientUseCase(repo);

    const result = await useCase.execute({
      nombreCompleto: 'Andrés Camilo Pérez',
      documentoIdentidad: '1098765432',
      fechaNacimiento: '1990-08-15',
      sexo: 'Masculino',
      telefono: '3001234567',
      correo: 'andres.perez@test.com',
      autorizacionDatos: {
        autorizado: true,
        medio: 'CONSULTORIO_WEB',
        versionAvisoPrivacidad: 'v1.1',
      },
    });

    assert.ok(result.patient.idPaciente);
    assert.strictEqual(result.patient.nombreCompleto, 'Andrés Camilo Pérez');
    assert.strictEqual(result.patient.documentoIdentidad, '1098765432');
    assert.strictEqual(result.patient.datosIncompletos, false);
    assert.ok(result.historiaClinicaBase.id_historia);
  });

  it('RF-HCL-001: Rechazar creación de paciente menor de 18 años sin acudiente obligatorio (Ley 27 de 1977)', async () => {
    const useCase = new CreatePatientUseCase(repo);

    await assert.rejects(
      async () => {
        await useCase.execute({
          nombreCompleto: 'Niño Menor Sin Acudiente',
          documentoIdentidad: '1099887766',
          fechaNacimiento: '2015-05-10', // Menor de edad (11 años)
          sexo: 'Masculino',
          telefono: '3009998877',
          correo: 'nino@test.com',
          autorizacionDatos: {
            autorizado: true,
            medio: 'CONSULTORIO_WEB',
          },
        });
      },
      /los datos del acudiente \(nombre, documento, parentesco y teléfono\) son obligatorios/
    );
  });

  it('RF-HCL-001: Rechazar creación de paciente sin autorización de tratamiento de datos personales (RQNF-SEG-005)', async () => {
    const useCase = new CreatePatientUseCase(repo);

    await assert.rejects(
      async () => {
        await useCase.execute({
          nombreCompleto: 'Paciente Sin Consentimiento',
          documentoIdentidad: '1055443322',
          fechaNacimiento: '1988-12-01',
          sexo: 'Femenino',
          telefono: '3157778899',
          correo: 'sin.consentimiento@test.com',
          autorizacionDatos: {
            autorizado: false, // Casilla desmarcada
          },
        });
      },
      /autorización previa, expresa e informada/
    );
  });

  it('RF-HCL-001: Rechazar documento duplicado indicando a nombre de quién está registrado', async () => {
    const useCase = new CreatePatientUseCase(repo);

    await useCase.execute({
      nombreCompleto: 'Laura Sofía Castro',
      documentoIdentidad: '1044556677',
      fechaNacimiento: '1996-03-20',
      sexo: 'Femenino',
      telefono: '3128889900',
      correo: 'laura@test.com',
      autorizacionDatos: { autorizado: true },
    });

    await assert.rejects(
      async () => {
        await useCase.execute({
          nombreCompleto: 'Otra Persona Con Mismo Documento',
          documentoIdentidad: '1044556677',
          fechaNacimiento: '1999-01-01',
          sexo: 'Masculino',
          telefono: '3114445566',
          correo: 'otra@test.com',
          autorizacionDatos: { autorizado: true },
        });
      },
      /ya se encuentra registrado a nombre del paciente Laura Sofía Castro/
    );
  });

  it('RF-HCL-002: Editar paciente actualizando datos y retirando la marca "Datos incompletos" al completarlos', async () => {
    const createUseCase = new CreatePatientUseCase(repo);
    const updateUseCase = new UpdatePatientUseCase(repo);

    // Paciente creado desde solicitud (nace con Datos incompletos al no tener sexo)
    const created = await createUseCase.execute({
      nombreCompleto: 'Mariana Suarez',
      documentoIdentidad: '7788990011',
      fechaNacimiento: '1994-06-12',
      creadoDesdeSolicitud: true,
      autorizacionDatos: { autorizado: true },
    });

    assert.strictEqual(created.patient.datosIncompletos, true);

    // Actualizar completando el sexo y datos de contacto
    const updated = await updateUseCase.execute({
      idPaciente: created.patient.idPaciente!,
      changes: {
        sexo: 'Femenino',
        telefono: '3124445566',
        correo: 'mariana.suarez@test.com',
      },
    });

    assert.strictEqual(updated.datosIncompletos, false);
    assert.strictEqual(updated.nombreCompleto, 'Mariana Suarez');
    assert.strictEqual(updated.sexo, 'Femenino');
  });

  it('RF-HCL-003: Buscar pacientes por nombre parcial sin tildes ni mayúsculas y por documento exacto', async () => {
    const createUseCase = new CreatePatientUseCase(repo);
    const searchUseCase = new SearchPatientsUseCase(repo);

    await createUseCase.execute({
      nombreCompleto: 'Ana Pérez Rodríguez',
      documentoIdentidad: '63554433',
      fechaNacimiento: '1985-02-14',
      sexo: 'Femenino',
      telefono: '3001112233',
      correo: 'ana.perez@test.com',
      autorizacionDatos: { autorizado: true },
    });

    await createUseCase.execute({
      nombreCompleto: 'Luis Pérez Gómez',
      documentoIdentidad: '1098112233',
      fechaNacimiento: '1992-11-05',
      sexo: 'Masculino',
      telefono: '3104445566',
      correo: 'luis.perez@test.com',
      autorizacionDatos: { autorizado: true },
    });

    // Búsqueda por "perez" sin tildes debe retornar ambos pacientes Pérez
    const resPerez = await searchUseCase.execute('perez');
    assert.strictEqual(resPerez.data.length, 2);

    // Búsqueda por documento exacto de Ana Pérez
    const resDoc = await searchUseCase.execute('63554433');
    assert.strictEqual(resDoc.data.length, 1);
    assert.strictEqual(resDoc.data[0].nombreCompleto, 'Ana Pérez Rodríguez');

    // Búsqueda sin coincidencias
    const resVacio = await searchUseCase.execute('NoExisteNadie');
    assert.strictEqual(resVacio.data.length, 0);
    assert.strictEqual(resVacio.message, 'ninguna coincidencia encontrada');
  });

  it('RF-HCL-004: Visualizar ficha de paciente segregando opciones clínicas según rol (Regla de Negocio 5)', async () => {
    const createUseCase = new CreatePatientUseCase(repo);
    const profileUseCase = new GetPatientProfileUseCase(repo);

    const created = await createUseCase.execute({
      nombreCompleto: 'Carlos Julio Barajas',
      documentoIdentidad: '13887766',
      fechaNacimiento: '1975-09-22',
      sexo: 'Masculino',
      telefono: '3159998877',
      correo: 'carlos.barajas@test.com',
      autorizacionDatos: { autorizado: true },
    });

    // Coordinadora (ROL-COA): NO debe ver opciones clínicas
    const profileCoa = await profileUseCase.execute({
      idPaciente: created.patient.idPaciente,
      requesterRoles: ['ROL-COA'],
    });
    assert.strictEqual(profileCoa.opcionesClinicasVisibles.historiaClinica, false);
    assert.strictEqual(profileCoa.opcionesClinicasVisibles.consentimientosInformados, false);
    assert.strictEqual(profileCoa.opcionesClinicasVisibles.documentosClinicos, false);

    // Odontólogo (ROL-ODO): SÍ debe ver las 3 opciones clínicas
    const profileOdo = await profileUseCase.execute({
      idPaciente: created.patient.idPaciente,
      requesterRoles: ['ROL-ODO'],
    });
    assert.strictEqual(profileOdo.opcionesClinicasVisibles.historiaClinica, true);
    assert.strictEqual(profileOdo.opcionesClinicasVisibles.consentimientosInformados, true);
    assert.strictEqual(profileOdo.opcionesClinicasVisibles.documentosClinicos, true);

    // Auxiliar (ROL-AUX) en consulta activa con el paciente: SÍ debe ver opciones
    const profileAuxInConsult = await profileUseCase.execute({
      idPaciente: created.patient.idPaciente,
      requesterRoles: ['ROL-AUX'],
      hasActiveConsultationWithPatient: true,
    });
    assert.strictEqual(profileAuxInConsult.opcionesClinicasVisibles.historiaClinica, true);

    // Auxiliar (ROL-AUX) sin consulta activa: NO debe ver opciones
    const profileAuxNoConsult = await profileUseCase.execute({
      idPaciente: created.patient.idPaciente,
      requesterRoles: ['ROL-AUX'],
      hasActiveConsultationWithPatient: false,
    });
    assert.strictEqual(profileAuxNoConsult.opcionesClinicasVisibles.historiaClinica, false);
  });

  it('RF-HCL-010: Consultar datos del titular (Habeas Data) restringido exclusivamente a ROL-COA y ROL-ADM', async () => {
    const createUseCase = new CreatePatientUseCase(repo);
    const exportUseCase = new ExportHolderDataUseCase(repo);

    await createUseCase.execute({
      nombreCompleto: 'Héctor Julio Ramírez',
      documentoIdentidad: '1098654321',
      fechaNacimiento: '1982-04-18',
      sexo: 'Masculino',
      telefono: '3158889900',
      correo: 'hector.ramirez@test.com',
      autorizacionDatos: { autorizado: true },
    });

    // Auxiliar (ROL-AUX) no tiene permisos de Habeas Data -> Rechazado
    await assert.rejects(
      async () => {
        await exportUseCase.execute({
          documentoIdentidad: '1098654321',
          requesterRoles: ['ROL-AUX'],
        });
      },
      /No tiene permiso para realizar esta acción/
    );

    // Coordinadora (ROL-COA) -> Consulta exitosa sin datos clínicos
    const exportResult = await exportUseCase.execute({
      documentoIdentidad: '1098654321',
      requesterRoles: ['ROL-COA'],
    });

    assert.ok(exportResult.datosTitular);
    assert.strictEqual(exportResult.datosTitular.documentoConsultado, '1098654321');
    assert.strictEqual(exportResult.datosTitular.calidades.comoPaciente?.nombreCompleto, 'Héctor Julio Ramírez');
    assert.strictEqual(exportResult.datosTitular.autorizaciones.length, 1);
  });
});
