// src/modules/clinical-documents/__tests__/clinical-documents.test.ts
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  IClinicalDocumentRepository,
  CreateClinicalDocumentDTO,
  ClinicalDocumentRecord,
  ConsultationContextData,
} from '../domain/clinical-document.repository.interface';
import { PrescriptionEntity } from '../domain/prescription.entity';
import { SickLeaveEntity } from '../domain/sick-leave.entity';
import { ReferralEntity } from '../domain/referral.entity';

import {
  EmbedProfessionalSignatureService,
  AuthenticatedProfessionalActor,
} from '../application/embed-professional-signature.service';
import { GeneratePrescriptionUseCase } from '../application/generate-prescription.use-case';
import { GenerateSickLeaveUseCase } from '../application/generate-sick-leave.use-case';
import { GenerateReferralUseCase } from '../application/generate-referral.use-case';
import { GetClinicalDocumentsUseCase } from '../application/get-clinical-documents.use-case';

// Implementación en memoria del repositorio de documentos clínicos
class InMemoryClinicalDocumentRepository implements IClinicalDocumentRepository {
  public documents: Map<number, ClinicalDocumentRecord> = new Map();
  public contexts: Map<string, ConsultationContextData> = new Map();
  private docIdSeq = 1;

  async createClinicalDocument(
    dto: CreateClinicalDocumentDTO
  ): Promise<ClinicalDocumentRecord> {
    const id = this.docIdSeq++;
    const record: ClinicalDocumentRecord = {
      idDocumento: id,
      fecha: new Date(),
      idCita: dto.idCita,
      tipoDocumento: dto.tipoDocumento,
      archivoPdfUrl: dto.archivoPdfUrl,
      modoFirma: dto.modoFirma,
      detalles: dto.detalles,
      diligenciadoPor: dto.diligenciadoPor,
    };
    this.documents.set(id, record);
    return record;
  }

  async getDocumentsByPatient(idPaciente: number): Promise<ClinicalDocumentRecord[]> {
    return Array.from(this.documents.values()).sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
  }

  async getConsultationContext(
    idPaciente: number,
    idCita: number
  ): Promise<ConsultationContextData | null> {
    const key = `${idPaciente}_${idCita}`;
    return this.contexts.get(key) ?? null;
  }

  async hasActiveConsultationForPatient(idPaciente: number): Promise<boolean> {
    return Array.from(this.contexts.values()).some(
      (c) => c.paciente.idPaciente === idPaciente && c.cita.estado === 'En consulta'
    );
  }
}

describe('MÓDULO E: Documentos Clínicos (Órdenes, Incapacidades, Remisiones, RF-DOC-001 a RF-DOC-005)', () => {
  let repo: InMemoryClinicalDocumentRepository;
  let signatureService: EmbedProfessionalSignatureService;

  const DR_LEAL: AuthenticatedProfessionalActor = {
    idUsuario: 10,
    nombreCompleto: 'Dr. Eduar Leal Álvarez',
    roles: ['ROL-ODO', 'ROL-ADM'],
    firmaImagenUrl: 'https://odontoleal.com/signatures/dr_leal.png',
  };

  const DRA_DIAZ: AuthenticatedProfessionalActor = {
    idUsuario: 20,
    nombreCompleto: 'Dra. Natalia Díaz',
    roles: ['ROL-ESP'],
    firmaImagenUrl: null, // Sin imagen registrada
  };

  beforeEach(() => {
    repo = new InMemoryClinicalDocumentRepository();
    signatureService = new EmbedProfessionalSignatureService();

    // Contexto de consulta activa paciente adulto
    repo.contexts.set('101_501', {
      paciente: {
        idPaciente: 101,
        nombreCompleto: 'Carlos Mendoza',
        documentoIdentidad: '1099887766',
        fechaNacimiento: '1990-05-15',
        sexo: 'Masculino',
        idHistoria: 2001,
      },
      cita: {
        idCita: 501,
        idProfesionalResponsable: 10,
        nombreProfesionalResponsable: 'Dr. Eduar Leal Álvarez',
        firmaProfesionalUrl: 'https://odontoleal.com/signatures/dr_leal.png',
        estado: 'En consulta',
        fechaInicioCita: new Date(),
      },
    });

    // Contexto de consulta paciente menor de edad
    repo.contexts.set('102_502', {
      paciente: {
        idPaciente: 102,
        nombreCompleto: 'Mateo Gómez (Menor)',
        documentoIdentidad: '1199887766',
        fechaNacimiento: '2016-08-20', // 10 años
        sexo: 'Masculino',
        idHistoria: 2002,
        acudiente: {
          nombreCompleto: 'Valeria Gómez',
          documentoIdentidad: '63889900',
          parentesco: 'Madre',
          telefono: '3151112233',
        },
      },
      cita: {
        idCita: 502,
        idProfesionalResponsable: 10,
        nombreProfesionalResponsable: 'Dr. Eduar Leal Álvarez',
        firmaProfesionalUrl: 'https://odontoleal.com/signatures/dr_leal.png',
        estado: 'En consulta',
        fechaInicioCita: new Date(),
      },
    });
  });

  it('RF-DOC-001: Generar orden de medicamentos con datos del paciente, fármacos requeridos y firma del profesional', async () => {
    const useCase = new GeneratePrescriptionUseCase(repo, signatureService);

    const result = await useCase.execute({
      idPaciente: 101,
      idCita: 501,
      medicamentos: [
        {
          nombrePresentacion: 'Amoxicilina 500mg cápsulas',
          dosis: '1 cápsula cada 8 horas',
          frecuencia: 'Cada 8 horas',
          duracion: '7 días',
        },
        {
          nombrePresentacion: 'Ibuprofeno 600mg tabletas',
          dosis: '1 tableta cada 8 horas',
          frecuencia: 'Cada 8 horas',
          duracion: '3 días según dolor',
        },
      ],
      indicacionesAdicionales: 'Tomar con abundante agua después de las comidas',
      modoFirma: 'CON_FIRMA_REGISTRADA',
      actor: DR_LEAL,
    });

    assert.ok(result.documento.idDocumento);
    assert.strictEqual(result.documento.tipoDocumento, 'ORDEN_MEDICAMENTOS');
    assert.strictEqual(result.documento.modoFirma, 'CON_FIRMA_REGISTRADA');
    assert.strictEqual(result.documento.detalles.medicamentos?.length, 2);
    assert.strictEqual(result.documento.diligenciadoPor.nombreProfesional, 'Dr. Eduar Leal Álvarez');
  });

  it('RF-DOC-001: Rechazar generación de orden si el paciente tiene "Datos incompletos" o lista de medicamentos vacía', async () => {
    const useCase = new GeneratePrescriptionUseCase(repo, signatureService);

    // Contexto con paciente con datos incompletos (sin sexo)
    repo.contexts.set('103_503', {
      paciente: {
        idPaciente: 103,
        nombreCompleto: 'Paciente Incompleto',
        documentoIdentidad: '77665544',
        fechaNacimiento: '1995-01-01',
        sexo: null, // Falta sexo
        idHistoria: 2003,
      },
      cita: {
        idCita: 503,
        idProfesionalResponsable: 10,
        nombreProfesionalResponsable: 'Dr. Eduar Leal Álvarez',
        estado: 'En consulta',
      },
    });

    await assert.rejects(
      async () => {
        await useCase.execute({
          idPaciente: 103,
          idCita: 503,
          medicamentos: [
            {
              nombrePresentacion: 'Paracetamol 500mg',
              dosis: '1 tab',
              frecuencia: 'Cada 8h',
              duracion: '3 días',
            },
          ],
          actor: DR_LEAL,
        });
      },
      /el paciente tiene "Datos incompletos"/
    );

    // Medicamentos vacíos
    await assert.rejects(
      async () => {
        await useCase.execute({
          idPaciente: 101,
          idCita: 501,
          medicamentos: [],
          actor: DR_LEAL,
        });
      },
      /Debe registrar al menos un medicamento/
    );
  });

  it('RF-DOC-002: Generar incapacidad con cálculo de fechas de inicio y fin, y firma de acudiente para menores de 18 años', async () => {
    const useCase = new GenerateSickLeaveUseCase(repo, signatureService);

    const result = await useCase.execute({
      idPaciente: 102,
      idCita: 502,
      diasIncapacidad: 3,
      motivoIncapacidad: 'Exodoncia quirúrgica de molares temporales con reposo absoluto',
      modoFirma: 'CON_FIRMA_REGISTRADA',
      actor: DR_LEAL,
    });

    assert.ok(result.documento.idDocumento);
    assert.strictEqual(result.documento.tipoDocumento, 'INCAPACIDAD');
    assert.strictEqual(result.documento.detalles.diasIncapacidad, 3);
    assert.strictEqual(result.documento.detalles.requiereFirmaAcudiente, true);
    assert.strictEqual(result.documento.detalles.acudiente?.nombreCompleto, 'Valeria Gómez');
    assert.ok(result.documento.detalles.fechaInicioIncapacidad);
    assert.ok(result.documento.detalles.fechaFinIncapacidad);
  });

  it('RF-DOC-002: Rechazar incapacidad con días fuera de rango (debe ser entero entre 1 y 30)', async () => {
    const useCase = new GenerateSickLeaveUseCase(repo, signatureService);

    // Días = 31 (excede límite superior)
    await assert.rejects(
      async () => {
        await useCase.execute({
          idPaciente: 101,
          idCita: 501,
          diasIncapacidad: 31,
          motivoIncapacidad: 'Reposo prolongado no permitido',
          actor: DR_LEAL,
        });
      },
      /días de incapacidad deben ser un entero entre 1 y 30/
    );

    // Días = 0 (menor a límite inferior)
    await assert.rejects(
      async () => {
        await useCase.execute({
          idPaciente: 101,
          idCita: 501,
          diasIncapacidad: 0,
          motivoIncapacidad: 'Cero días',
          actor: DR_LEAL,
        });
      },
      /días de incapacidad deben ser un entero entre 1 y 30/
    );
  });

  it('RF-DOC-003: Generar remisión a especialidad del catálogo sin incluir nombres de especialistas específicos', async () => {
    const useCase = new GenerateReferralUseCase(repo, signatureService);

    const result = await useCase.execute({
      idPaciente: 101,
      idCita: 501,
      especialidadDestino: 'Endodoncia',
      motivoRemision: 'Tratamiento de conductos radiculares por necrosis pulpar en pieza 21',
      actor: DR_LEAL,
    });

    assert.ok(result.documento.idDocumento);
    assert.strictEqual(result.documento.tipoDocumento, 'REMISION');
    assert.strictEqual(result.documento.detalles.especialidadDestino, 'Endodoncia');
    assert.strictEqual(
      result.documento.detalles.motivoRemision,
      'Tratamiento de conductos radiculares por necrosis pulpar en pieza 21'
    );
  });

  it('RF-DOC-003: Exigir nombre de especialidad si se selecciona la opción "Otra"', async () => {
    const useCase = new GenerateReferralUseCase(repo, signatureService);

    await assert.rejects(
      async () => {
        await useCase.execute({
          idPaciente: 101,
          idCita: 501,
          especialidadDestino: 'Otra',
          otraEspecialidad: '', // Vacío
          motivoRemision: 'Remisión a patología oral',
          actor: DR_LEAL,
        });
      },
      /Debe escribir el nombre de la especialidad cuando selecciona "Otra"/
    );
  });

  it('RF-DOC-004: Insertar y fusionar firma del profesional (modo firma registrada vs firma manuscrita en blanco)', async () => {
    const useCase = new GeneratePrescriptionUseCase(repo, signatureService);

    // 1. Profesional con firma y modo 'CON_FIRMA_REGISTRADA'
    const resConFirma = await useCase.execute({
      idPaciente: 101,
      idCita: 501,
      medicamentos: [
        {
          nombrePresentacion: 'Clorhexidina 0.12% enjuague',
          dosis: '15 ml',
          frecuencia: 'Cada 12h',
          duracion: '10 días',
        },
      ],
      modoFirma: 'CON_FIRMA_REGISTRADA',
      actor: DR_LEAL,
    });
    assert.strictEqual(resConFirma.documento.modoFirma, 'CON_FIRMA_REGISTRADA');

    // 2. Profesional sin firma registrada -> Sale en blanco con aviso
    // Actualizamos contexto para cita con Dra. Díaz
    repo.contexts.set('101_505', {
      paciente: repo.contexts.get('101_501')!.paciente,
      cita: {
        idCita: 505,
        idProfesionalResponsable: 20,
        nombreProfesionalResponsable: 'Dra. Natalia Díaz',
        firmaProfesionalUrl: null,
        estado: 'En consulta',
      },
    });

    const resSinFirma = await useCase.execute({
      idPaciente: 101,
      idCita: 505,
      medicamentos: [
        {
          nombrePresentacion: 'Cera de ortodoncia',
          dosis: 'Aplicar en bracket',
          frecuencia: 'Según molestia',
          duracion: '30 días',
        },
      ],
      modoFirma: 'CON_FIRMA_REGISTRADA',
      actor: DRA_DIAZ,
    });
    assert.strictEqual(resSinFirma.documento.modoFirma, 'FIRMA_MANUSCRITA');
    assert.ok(
      resSinFirma.avisoFirma?.includes('campo de firma en blanco para firma manuscrita')
    );
  });

  it('RF-DOC-005: Consultar documentos clínicos del paciente segregando acceso por rol (ROL-ODO/ESP vs ROL-COA)', async () => {
    const getDocsUseCase = new GetClinicalDocumentsUseCase(repo);
    const prescrUseCase = new GeneratePrescriptionUseCase(repo, signatureService);

    // Crear un documento clínico previo
    await prescrUseCase.execute({
      idPaciente: 101,
      idCita: 501,
      medicamentos: [
        {
          nombrePresentacion: 'Ketorolaco 10mg sublingual',
          dosis: '1 tab',
          frecuencia: 'Cada 8h',
          duracion: '2 días',
        },
      ],
      actor: DR_LEAL,
    });

    // Coordinadora (ROL-COA): NO tiene acceso a documentos clínicos (Regla de Negocio 5)
    await assert.rejects(
      async () => {
        await getDocsUseCase.execute({
          idPaciente: 101,
          actor: { idUsuario: 30, roles: ['ROL-COA'] },
        });
      },
      /No tiene permiso para realizar esta acción/
    );

    // Odontólogo (ROL-ODO): SÍ puede consultar en solo lectura
    const odoDocs = await getDocsUseCase.execute({
      idPaciente: 101,
      actor: { idUsuario: 10, roles: ['ROL-ODO'] },
    });

    assert.strictEqual(odoDocs.soloLectura, true);
    assert.strictEqual(odoDocs.data.length, 1);
    assert.strictEqual(odoDocs.data[0].tipoDocumento, 'ORDEN_MEDICAMENTOS');
  });
});
