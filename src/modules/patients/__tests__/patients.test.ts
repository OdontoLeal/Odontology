// src/modules/patients/__tests__/patients.test.ts
// Pruebas del Módulo C (Parte 1) según la ERS v1.3: la ficha del paciente solo
// guarda identificación y contacto; la autorización de datos y el trato con
// menores se hacen con plantillas del Módulo D.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Patient } from '../domain/patient.entity';
import { BIOLOGICAL_SEX_VALUES } from '../../../shared/domain/biological-sex';
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

class InMemoryPatientRepository implements IPatientRepository {
  public patients: Map<number, Patient> = new Map();
  public auditHistory: any[] = [];
  private patientIdSeq = 1;

  async createPatient(patient: Patient, actor?: any): Promise<CreatedPatientResult> {
    const id = this.patientIdSeq++;
    const stored = Patient.reconstitute({ ...patient.toPrimitives(), idPaciente: id } as any);
    this.patients.set(id, stored);
    this.auditHistory.push({ accion: 'CREAR', idPaciente: id, actor });
    return {
      patient: stored.toPrimitives(),
      historiaClinicaBase: { id_historia: 1000 + id, fecha_creacion: new Date() },
    };
  }

  /** Simula un paciente creado al confirmar una solicitud pública (sin sexo). */
  seedFromRequest(props: { nombreCompleto: string; documentoIdentidad: string; fechaNacimiento: string }): number {
    const id = this.patientIdSeq++;
    this.patients.set(id, Patient.reconstitute({ ...props, idPaciente: id }));
    return id;
  }

  async updatePatient(idPaciente: number, patient: Patient, auditMeta?: any) {
    if (!this.patients.has(idPaciente)) return null;
    this.patients.set(idPaciente, patient);
    this.auditHistory.push({ accion: 'MODIFICAR', idPaciente, ...auditMeta });
    return patient.toPrimitives();
  }

  async findById(idPaciente: number): Promise<Patient | null> {
    return this.patients.get(idPaciente) ?? null;
  }

  async findByDocument(documentoIdentidad: string): Promise<Patient | null> {
    return Array.from(this.patients.values()).find((p) => p.documentoIdentidad === documentoIdentidad) ?? null;
  }

  async searchPatients(query?: string): Promise<PatientSearchItem[]> {
    const norm = (v: string) => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return Array.from(this.patients.values())
      .filter((p) => !query || norm(p.nombreCompleto).includes(norm(query)) || p.documentoIdentidad === query)
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

  async getPatientProfileByIdOrDoc(identifier: { idPaciente?: number; documento?: string }): Promise<PatientProfileRecord | null> {
    const patient = identifier.idPaciente
      ? this.patients.get(identifier.idPaciente)
      : Array.from(this.patients.values()).find((p) => p.documentoIdentidad === identifier.documento);
    if (!patient) return null;
    const prim = patient.toPrimitives();
    return {
      idPaciente: patient.idPaciente!,
      documentoIdentidad: patient.documentoIdentidad,
      nombreCompleto: patient.nombreCompleto,
      fechaNacimiento: patient.fechaNacimiento,
      edad: prim.edad ?? 0,
      esMenorDeEdad: prim.esMenorDeEdad,
      sexo: patient.sexo,
      telefono: patient.telefono,
      correo: patient.correo,
      datosIncompletos: patient.datosIncompletos,
      idHistoria: 1000 + patient.idPaciente!,
      historialCitas: [],
    };
  }

  async getHolderDataByDocument(documentoIdentidad: string): Promise<HolderDataRecord | null> {
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
        },
        comoSolicitante: [],
      },
      autorizaciones: [
        {
          tipo: 'CONSENTIMIENTO_FIRMADO',
          plantilla: 'Autorización de tratamiento de datos personales',
          versionPlantilla: 1,
          fechaHora: '2026-11-04 10:00',
          firmadoPorAcudiente: false,
          diligenciadoPor: 'Auxiliar QA',
        },
      ],
      citasRegistradas: [],
    };
  }
}

const adulto = {
  nombreCompleto: 'Andrés Camilo Pérez',
  documentoIdentidad: '1098765432',
  fechaNacimiento: '1990-08-15',
  sexo: 'Masculino' as const,
  telefono: '3001234567',
  correo: 'andres.perez@test.com',
};

describe('MÓDULO C (Parte 1): Gestión de Pacientes y Ficha Médica (RF-HCL-001 a RF-HCL-004, RF-HCL-010)', () => {
  let repo: InMemoryPatientRepository;

  beforeEach(() => {
    repo = new InMemoryPatientRepository();
  });

  it('RF-HCL-001: Crear paciente adulto con todos los datos y su historia clínica vacía, auditando al usuario', async () => {
    const result = await new CreatePatientUseCase(repo).execute({
      ...adulto,
      actor: { idUsuario: 3, actor: 'coa@odontoleal.co' },
    });

    assert.ok(result.patient.idPaciente);
    assert.strictEqual(result.patient.datosIncompletos, false);
    assert.ok(result.historiaClinicaBase.id_historia);
    assert.deepStrictEqual(repo.auditHistory[0].actor, { idUsuario: 3, actor: 'coa@odontoleal.co' });
  });

  it('RF-HCL-001 (v1.3): Un menor se registra sin acudiente; su trato va por la plantilla de menores', async () => {
    const result = await new CreatePatientUseCase(repo).execute({
      ...adulto,
      nombreCompleto: 'Niño Menor',
      documentoIdentidad: '1099887766',
      fechaNacimiento: '2015-05-10',
    });
    assert.strictEqual(result.patient.esMenorDeEdad, true);
    assert.strictEqual((result.patient as any).acudiente, undefined);
    assert.strictEqual((result.patient as any).autorizacionDatos, undefined);
  });

  it('RF-HCL-001: Todos los datos son obligatorios (sexo, teléfono y correo)', async () => {
    const useCase = new CreatePatientUseCase(repo);
    await assert.rejects(() => useCase.execute({ ...adulto, sexo: null }), /sexo del paciente es obligatorio/);
    await assert.rejects(() => useCase.execute({ ...adulto, telefono: null }), /teléfono del paciente es obligatorio/);
    await assert.rejects(() => useCase.execute({ ...adulto, correo: 'no-es-correo' }), /formato válido/);
    await assert.rejects(() => useCase.execute({ ...adulto, fechaNacimiento: '2999-01-01' }), /fecha futura/);
  });

  it('RF-HCL-001: Rechazar documento duplicado indicando a nombre de quién está registrado', async () => {
    const useCase = new CreatePatientUseCase(repo);
    await useCase.execute({ ...adulto, nombreCompleto: 'Laura Sofía Castro', documentoIdentidad: '1044556677' });
    await assert.rejects(
      () => useCase.execute({ ...adulto, documentoIdentidad: '1044556677' }),
      /ya se encuentra registrado a nombre del paciente Laura Sofía Castro/
    );
  });

  it('RF-HCL-002: Completar el sexo de un paciente de solicitud retira "Datos incompletos" y audita el valor anterior', async () => {
    const id = repo.seedFromRequest({
      nombreCompleto: 'Mariana Suarez',
      documentoIdentidad: '7788990011',
      fechaNacimiento: '1994-06-12',
    });
    assert.strictEqual((await repo.findById(id))!.datosIncompletos, true);

    const updated = await new UpdatePatientUseCase(repo).execute({
      idPaciente: id,
      idUsuarioActor: 3,
      actor: 'aux@odontoleal.co',
      changes: { sexo: 'Femenino', telefono: '3124445566', correo: 'mariana.suarez@test.com' },
    });

    assert.strictEqual(updated.datosIncompletos, false);
    const audit = repo.auditHistory.find((a) => a.accion === 'MODIFICAR');
    assert.strictEqual(audit.valorAnterior.sexo, null);
    assert.strictEqual(audit.actor, 'aux@odontoleal.co');
  });

  it('RF-HCL-002: Ignora campos ajenos a RF-HCL-001 enviados en el cuerpo (p. ej. acudiente)', async () => {
    const created = await new CreatePatientUseCase(repo).execute(adulto);
    const updated: any = await new UpdatePatientUseCase(repo).execute({
      idPaciente: created.patient.idPaciente!,
      changes: { telefono: '3009998877', acudiente: { nombreCompleto: 'X' } } as any,
    });
    assert.strictEqual(updated.telefono, '3009998877');
    assert.strictEqual(updated.acudiente, undefined);
  });

  it('RF-HCL-003: Buscar pacientes por nombre parcial sin tildes ni mayúsculas y por documento exacto', async () => {
    const createUseCase = new CreatePatientUseCase(repo);
    const searchUseCase = new SearchPatientsUseCase(repo);
    await createUseCase.execute({ ...adulto, nombreCompleto: 'Ana Pérez Rodríguez', documentoIdentidad: '63554433' });
    await createUseCase.execute({ ...adulto, nombreCompleto: 'Luis Pérez Gómez', documentoIdentidad: '1098112233' });

    assert.strictEqual((await searchUseCase.execute('perez')).data.length, 2);
    const resDoc = await searchUseCase.execute('63554433');
    assert.strictEqual(resDoc.data.length, 1);
    assert.strictEqual(resDoc.data[0].nombreCompleto, 'Ana Pérez Rodríguez');
    const resVacio = await searchUseCase.execute('NoExisteNadie');
    assert.strictEqual(resVacio.data.length, 0);
    assert.strictEqual(resVacio.message, 'ninguna coincidencia encontrada');
  });

  it('RF-HCL-004 (v1.3): Dos opciones clínicas; historia solo ODO/ESP, consentimientos también AUX', async () => {
    const created = await new CreatePatientUseCase(repo).execute(adulto);
    const profileUseCase = new GetPatientProfileUseCase(repo);
    const ver = (roles: string[]) =>
      profileUseCase.execute({ idPaciente: created.patient.idPaciente, requesterRoles: roles });

    const coa = await ver(['ROL-COA']);
    assert.deepStrictEqual(coa.opcionesClinicasVisibles, { historiaClinica: false, consentimientosInformados: false });
    const adm = await ver(['ROL-ADM']);
    assert.deepStrictEqual(adm.opcionesClinicasVisibles, { historiaClinica: false, consentimientosInformados: false });
    const odo = await ver(['ROL-ODO']);
    assert.deepStrictEqual(odo.opcionesClinicasVisibles, { historiaClinica: true, consentimientosInformados: true });
    const aux = await ver(['ROL-AUX']);
    assert.deepStrictEqual(aux.opcionesClinicasVisibles, { historiaClinica: false, consentimientosInformados: true });
    assert.strictEqual(odo.mensajeHistorialCitas, 'El paciente no tiene citas registradas');
  });

  it('RF-HCL-010: Consultar datos del titular restringido a ROL-COA y ROL-ADM, con sus autorizaciones del Módulo D', async () => {
    await new CreatePatientUseCase(repo).execute({ ...adulto, nombreCompleto: 'Héctor Julio Ramírez', documentoIdentidad: '1098654321' });
    const exportUseCase = new ExportHolderDataUseCase(repo);

    await assert.rejects(
      () => exportUseCase.execute({ documentoIdentidad: '1098654321', requesterRoles: ['ROL-AUX'] }),
      /No tiene permiso para realizar esta acción/
    );
    await assert.rejects(
      () => exportUseCase.execute({ documentoIdentidad: '0000', requesterRoles: ['ROL-COA'] }),
      /ninguna coincidencia encontrada/
    );

    const result = await exportUseCase.execute({ documentoIdentidad: '1098654321', requesterRoles: ['ROL-COA'] });
    assert.strictEqual(result.datosTitular.calidades.comoPaciente?.nombreCompleto, 'Héctor Julio Ramírez');
    assert.strictEqual((result.datosTitular.calidades as any).comoAcudiente, undefined);
    assert.strictEqual(result.datosTitular.autorizaciones[0].tipo, 'CONSENTIMIENTO_FIRMADO');
  });

  it('RF-HCL-010: Exportar el PDF "Datos personales del titular" (%PDF)', async () => {
    await new CreatePatientUseCase(repo).execute({ ...adulto, documentoIdentidad: '52431987' });
    const exportResult = await new ExportHolderDataUseCase(repo).execute({
      documentoIdentidad: '52431987',
      requesterRoles: ['ROL-ADM'],
      formato: 'PDF',
    });
    assert.ok(exportResult.pdfBufferBase64);
    const buffer = Buffer.from(exportResult.pdfBufferBase64!, 'base64');
    assert.strictEqual(buffer.subarray(0, 5).toString('utf-8'), '%PDF-');
    assert.ok(buffer.length > 500);
  });

  it('RF-HCL-001: Acepta sexo Ambiguo (<=10 caracteres para varchar(10)) y rechaza valores fuera del catálogo', async () => {
    for (const val of BIOLOGICAL_SEX_VALUES) {
      assert.ok(val.length <= 10, `El valor "${val}" excede varchar(10)`);
    }

    const useCase = new CreatePatientUseCase(repo);
    const created = await useCase.execute({
      ...adulto,
      documentoIdentidad: '1011223344',
      sexo: 'Ambiguo',
    });
    assert.strictEqual(created.patient.sexo, 'Ambiguo');

    await assert.rejects(
      () =>
        useCase.execute({
          ...adulto,
          documentoIdentidad: '1011223345',
          sexo: 'Indeterminado' as any,
        }),
      /Femenino, Masculino o Ambiguo/
    );
  });
});
