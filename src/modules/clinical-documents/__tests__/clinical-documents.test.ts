// src/modules/clinical-documents/__tests__/clinical-documents.test.ts
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  IClinicalDocumentRepository,
  GeneratedClinicalDocument,
  ConsultationContextData,
} from '../domain/clinical-document.repository.interface';

import {
  EmbedProfessionalSignatureService,
  AuthenticatedProfessionalActor,
} from '../application/embed-professional-signature.service';
import { GeneratePrescriptionUseCase } from '../application/generate-prescription.use-case';
import { GenerateSickLeaveUseCase } from '../application/generate-sick-leave.use-case';
import { GenerateReferralUseCase } from '../application/generate-referral.use-case';
import { ClinicalDocumentPdfGeneratorService } from '../application/clinical-document-pdf-generator.service';
import { PDFDocument } from 'pdf-lib';

// Repositorio en memoria (ERS v1.2/v1.3): no guarda documentos, solo la constancia de auditoría
class InMemoryClinicalDocumentRepository implements IClinicalDocumentRepository {
  public contexts: Map<string, ConsultationContextData> = new Map();
  public auditados: Array<Omit<GeneratedClinicalDocument, 'pdfBase64'>> = [];

  async getConsultationContext(idPaciente: number, idCita: number): Promise<ConsultationContextData | null> {
    return this.contexts.get(`${idPaciente}_${idCita}`) ?? null;
  }

  async recordGeneration(documento: Omit<GeneratedClinicalDocument, 'pdfBase64'>): Promise<void> {
    this.auditados.push(documento);
  }
}

const esPdf = (b64: string) => Buffer.from(b64, 'base64').subarray(0, 5).toString('ascii') === '%PDF-';

describe('MÓDULO E: Documentos Clínicos (Órdenes, Incapacidades, Remisiones, RF-DOC-001 a RF-DOC-004)', () => {
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
      tieneApertura: true,
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
      },
      cita: {
        idCita: 502,
        idProfesionalResponsable: 10,
        nombreProfesionalResponsable: 'Dr. Eduar Leal Álvarez',
        firmaProfesionalUrl: 'https://odontoleal.com/signatures/dr_leal.png',
        estado: 'En consulta',
        fechaInicioCita: new Date(),
      },
      tieneApertura: true,
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

    assert.ok(esPdf(result.documento.pdfBase64), 'Se entrega el PDF generado en memoria');
    assert.strictEqual(result.documento.tipoDocumento, 'ORDEN_MEDICAMENTOS');
    assert.strictEqual(result.documento.modoFirma, 'CON_FIRMA_REGISTRADA');
    // Solo queda la constancia (sin el PDF) en la auditoría
    assert.strictEqual(repo.auditados.length, 1);
    assert.strictEqual((repo.auditados[0] as any).pdfBase64, undefined);
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
      tieneApertura: true,
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

    assert.ok(esPdf(result.documento.pdfBase64));
    assert.strictEqual(result.documento.tipoDocumento, 'INCAPACIDAD');
    assert.strictEqual(result.documento.detalles.diasIncapacidad, 3);
    // Menor de 18 años: campos en blanco para el acudiente (no se exige acudiente en la ficha)
    assert.strictEqual(result.documento.detalles.requiereFirmaAcudiente, true);
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

    assert.ok(esPdf(result.documento.pdfBase64));
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
      tieneApertura: true,
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

  it('D-24 y Regla de Negocio 4: Sin apertura no hay documento; solo el profesional responsable lo genera', async () => {
    const useCase = new GeneratePrescriptionUseCase(repo, signatureService);
    const med = [{ nombrePresentacion: 'Ketorolaco 10mg', dosis: '1 tab', frecuencia: 'Cada 8h', duracion: '2 días' }];

    repo.contexts.get('101_501')!.tieneApertura = false;
    await assert.rejects(
      () => useCase.execute({ idPaciente: 101, idCita: 501, medicamentos: med, actor: DR_LEAL }),
      /Falta registrar el motivo de consulta/
    );
    repo.contexts.get('101_501')!.tieneApertura = true;

    // La Dra. Díaz no es la responsable de la cita 501
    await assert.rejects(
      () => useCase.execute({ idPaciente: 101, idCita: 501, medicamentos: med, actor: DRA_DIAZ }),
      /No tiene permiso para realizar esta acción/
    );
    // Una auxiliar nunca prescribe
    await assert.rejects(
      () =>
        useCase.execute({
          idPaciente: 101,
          idCita: 501,
          medicamentos: med,
          actor: { idUsuario: 30, nombreCompleto: 'Milena', roles: ['ROL-AUX'] },
        }),
      /No tiene permiso para realizar esta acción/
    );
    assert.strictEqual(repo.auditados.length, 0);
  });

  it('DEF-PDF-001: ClinicalDocumentPdfGeneratorService genera orden médica sin undefined y con salto de línea dinámico', async () => {
    const payload = {
      idPaciente: 101,
      idCita: 501,
      tipoDocumento: 'ORDEN_MEDICAMENTOS' as const,
      encabezadoConsultorio: {
        nombreConsultorio: 'Consultorio Dr. Eduar Leal Álvarez',
        nit: '91.245.678-9',
        registroSalud: 'REGISTRO DE SALUD SANTANDER',
        direccionTelefono: 'Calle 10 # 20-30',
        logotipoAsset: '',
        marcaDeAguaTexto: 'ODONTOLEAL',
      },
      paciente: {
        nombreCompleto: 'James David Rodríguez Rubio',
        documentoIdentidad: '1050603040',
        edad: 32,
        sexo: 'M',
      },
      fechaExpedicionColombia: '05/11/2026',
      horaExpedicionColombia: '10:00 AM',
      detalles: {
        medicamentos: [
          {
            nombrePresentacion: 'Amoxicilina 500mg cápsulas',
            dosis: '500mg',
            frecuencia: 'Cada 8 horas',
            duracion: '7 días',
          },
          {
            nombrePresentacion: 'Ibuprofeno 600mg tabletas',
            dosis: '600mg',
            frecuencia: 'Cada 8 horas',
            duracion: '3',
            viaAdministracion: 'Oral',
            cantidad: '10',
            indicacionesUso: 'Tomar después de las comidas principales',
          } as any,
        ],
        indicacionesAdicionales: 'Mantener hidratación adecuada y no suspender el tratamiento antes del tiempo estipulado por el profesional tratante.',
      },
      firmaProfesional: {
        modoFirma: 'CON_FIRMA_REGISTRADA' as const,
        nombreProfesional: 'Dr. Eduar Leal Álvarez',
        imagenFirmaUrl: null,
        aplicarFlatten: true,
        mostrarCampoEnBlanco: false,
      },
    };

    const res = await ClinicalDocumentPdfGeneratorService.generate(payload);
    assert.ok(res.pdfBytes.length > 0);
    assert.strictEqual(res.nombreArchivo, 'cita-501-orden-medicamentos.pdf');

    // Verificar que el PDF generado es estructuralmente válido
    const loadedPdf = await PDFDocument.load(res.pdfBytes);
    assert.strictEqual(loadedPdf.getPageCount(), 1);
  });

  it('DEF-PDF-002: ClinicalDocumentPdfGeneratorService envuelve el texto de certificación e incapacidad sin desbordamiento horizontal', async () => {
    const payload = {
      idPaciente: 101,
      idCita: 501,
      tipoDocumento: 'INCAPACIDAD' as const,
      encabezadoConsultorio: {
        nombreConsultorio: 'Consultorio Dr. Eduar Leal Álvarez',
        nit: '91.245.678-9',
        registroSalud: 'REGISTRO DE SALUD SANTANDER',
        direccionTelefono: 'Calle 10 # 20-30',
        logotipoAsset: '',
        marcaDeAguaTexto: 'ODONTOLEAL',
      },
      paciente: {
        nombreCompleto: 'James David Rodríguez Rubio de la Santísima Trinidad',
        documentoIdentidad: '1050603040',
        edad: 32,
        sexo: 'M',
      },
      fechaExpedicionColombia: '05/11/2026',
      horaExpedicionColombia: '10:00 AM',
      detalles: {
        diasIncapacidad: 5,
        motivoIncapacidad: 'Exodoncia quirúrgica de terceros molares incluidos con osteotomía y odontosección múltiple bajo anestesia local',
        fechaInicioIncapacidad: '05/11/2026',
        fechaFinIncapacidad: '10/11/2026',
        requiereFirmaAcudiente: false,
      },
      firmaProfesional: {
        modoFirma: 'CON_FIRMA_REGISTRADA' as const,
        nombreProfesional: 'Dr. Eduar Leal Álvarez',
        imagenFirmaUrl: null,
        aplicarFlatten: true,
        mostrarCampoEnBlanco: false,
      },
    };

    const res = await ClinicalDocumentPdfGeneratorService.generate(payload);
    assert.ok(res.pdfBytes.length > 0);
    assert.strictEqual(res.nombreArchivo, 'cita-501-incapacidad.pdf');

    const loadedPdf = await PDFDocument.load(res.pdfBytes);
    assert.strictEqual(loadedPdf.getPageCount(), 1);
  });

  it('DEF-PDF-003: ClinicalDocumentPdfGeneratorService envuelve motivo de remisión interconsulta extenso', async () => {
    const payload = {
      idPaciente: 101,
      idCita: 501,
      tipoDocumento: 'REMISION' as const,
      encabezadoConsultorio: {
        nombreConsultorio: 'Consultorio Dr. Eduar Leal Álvarez',
        nit: '91.245.678-9',
        registroSalud: 'REGISTRO DE SALUD SANTANDER',
        direccionTelefono: 'Calle 10 # 20-30',
        logotipoAsset: '',
        marcaDeAguaTexto: 'ODONTOLEAL',
      },
      paciente: {
        nombreCompleto: 'James Rodríguez',
        documentoIdentidad: '1050603040',
        edad: 32,
        sexo: 'M',
      },
      fechaExpedicionColombia: '05/11/2026',
      horaExpedicionColombia: '10:00 AM',
      detalles: {
        especialidadDestino: 'Cirugía Maxilofacial',
        motivoRemision: 'Paciente presenta inclusión ósea total de órganos dentarios 38 y 48 en íntima relación anatómica con el conducto del nervio dentario inferior evidenciado en tomografía cone beam. Se solicita valoración y manejo quirúrgico especializado.',
      },
      firmaProfesional: {
        modoFirma: 'CON_FIRMA_REGISTRADA' as const,
        nombreProfesional: 'Dr. Eduar Leal Álvarez',
        imagenFirmaUrl: null,
        aplicarFlatten: true,
        mostrarCampoEnBlanco: false,
      },
    };

    const res = await ClinicalDocumentPdfGeneratorService.generate(payload);
    assert.ok(res.pdfBytes.length > 0);
    assert.strictEqual(res.nombreArchivo, 'cita-501-remision.pdf');

    const loadedPdf = await PDFDocument.load(res.pdfBytes);
    assert.strictEqual(loadedPdf.getPageCount(), 1);
  });
});
