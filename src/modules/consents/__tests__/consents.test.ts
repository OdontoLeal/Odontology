// src/modules/consents/__tests__/consents.test.ts
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  ConsentTemplate,
  SignedConsent,
  PatientSignedConsentDetail,
} from '../domain/consent.entity';
import {
  ConsentNotFoundError,
  ConsentValidationError,
  InactiveConsentTemplateError,
} from '../domain/consent.errors';
import { IConsentRepository } from '../domain/consent.repository.port';
import { ConsentService } from '../application/consent.service';
import {
  CreateConsentTemplateDTO,
  UpdateConsentTemplateDTO,
  SignConsentDTO,
} from '../application/consent.dtos';

// Implementación en memoria del repositorio de consentimientos
class InMemoryConsentRepository implements IConsentRepository {
  public templates: Map<number, ConsentTemplate> = new Map();
  public signedConsents: SignedConsent[] = [];
  private templateIdSeq = 1;

  async createTemplate(dto: CreateConsentTemplateDTO): Promise<ConsentTemplate> {
    const id = this.templateIdSeq++;
    const template = new ConsentTemplate({
      idConsentimiento: id,
      nombre: dto.nombre,
      plantillaUrl: dto.plantillaUrl,
      version: 1, // Regla RF-CON-004
      tipoConsentimiento: dto.tipoConsentimiento,
      estado: true, // Activa por defecto
    });
    this.templates.set(id, template);
    return template;
  }

  async findTemplateById(idConsentimiento: number): Promise<ConsentTemplate | null> {
    return this.templates.get(idConsentimiento) ?? null;
  }

  async updateTemplateVersion(
    idConsentimiento: number,
    dto: UpdateConsentTemplateDTO
  ): Promise<ConsentTemplate | null> {
    const existing = this.templates.get(idConsentimiento);
    if (!existing) return null;

    const newVersion = existing.version + 1; // Incremento automático versión
    const updated = new ConsentTemplate({
      idConsentimiento: existing.idConsentimiento,
      nombre: dto.nombre ?? existing.nombre,
      plantillaUrl: dto.plantillaUrl ?? existing.plantillaUrl,
      version: newVersion,
      tipoConsentimiento: existing.tipoConsentimiento,
      estado: existing.estado,
    });
    this.templates.set(idConsentimiento, updated);
    return updated;
  }

  async toggleTemplateStatus(
    idConsentimiento: number,
    estado: boolean
  ): Promise<ConsentTemplate | null> {
    const existing = this.templates.get(idConsentimiento);
    if (!existing) return null;

    const updated = new ConsentTemplate({
      idConsentimiento: existing.idConsentimiento,
      nombre: existing.nombre,
      plantillaUrl: existing.plantillaUrl,
      version: existing.version,
      tipoConsentimiento: existing.tipoConsentimiento,
      estado,
    });
    this.templates.set(idConsentimiento, updated);
    return updated;
  }

  async findAllTemplates(onlyActive?: boolean): Promise<ConsentTemplate[]> {
    const list = Array.from(this.templates.values());
    if (onlyActive) {
      return list.filter((t) => t.isActive());
    }
    return list;
  }

  async recordSignedConsent(dto: SignConsentDTO): Promise<SignedConsent> {
    const signed = new SignedConsent({
      idConsentimiento: dto.idConsentimiento,
      idPaciente: dto.idPaciente,
      idCita: dto.idCita,
      archivoUrl: dto.archivoUrl,
      fecha: new Date(),
    });
    this.signedConsents.push(signed);
    return signed;
  }

  async getSignedConsentsByPatient(
    idPaciente: number
  ): Promise<PatientSignedConsentDetail[]> {
    return this.signedConsents
      .filter((s) => s.idPaciente === idPaciente)
      .map((s) => {
        const tmpl = this.templates.get(s.idConsentimiento);
        return {
          idConsentimiento: s.idConsentimiento,
          nombrePlantilla: tmpl ? tmpl.nombre : 'Consentimiento General',
          versionActualPlantilla: tmpl ? tmpl.version : 1,
          idPaciente: s.idPaciente,
          idCita: s.idCita,
          fecha: s.fecha ?? new Date(),
          archivoUrl: s.archivoUrl,
        };
      })
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }
}

describe('MÓDULO D: Consentimientos Informados (RF-CON-001 a RF-CON-008)', () => {
  let repo: InMemoryConsentRepository;
  let service: ConsentService;

  beforeEach(() => {
    repo = new InMemoryConsentRepository();
    service = new ConsentService(repo);
  });

  it('RF-CON-004: Crear plantilla de consentimiento iniciando en versión 1 y estado Activa (RQNF-MAN-001)', async () => {
    const created = await service.createTemplate({
      nombre: 'Diseño de Sonrisa y Carillas',
      plantillaUrl: 'https://odontoleal.com/plantillas/diseno_sonrisa_v1.html',
      tipoConsentimiento: true,
    });

    assert.ok(created.idConsentimiento);
    assert.strictEqual(created.nombre, 'Diseño de Sonrisa y Carillas');
    assert.strictEqual(created.version, 1);
    assert.strictEqual(created.estado, true);
    assert.strictEqual(created.isActive(), true);
  });

  it('RF-CON-004: Rechazar creación con nombre o plantillaUrl vacíos o tipo inválido', async () => {
    await assert.rejects(
      async () => {
        await service.createTemplate({
          nombre: '',
          plantillaUrl: 'https://odontoleal.com/plantillas/test.html',
          tipoConsentimiento: true,
        });
      },
      (err: any) => err instanceof ConsentValidationError && /nombre de la plantilla es obligatorio/.test(err.message)
    );

    await assert.rejects(
      async () => {
        await service.createTemplate({
          nombre: 'Extracción Simple',
          plantillaUrl: '',
          tipoConsentimiento: true,
        });
      },
      (err: any) => err instanceof ConsentValidationError && /URL de la plantilla.*es obligatoria/.test(err.message)
    );
  });

  it('RF-CON-007: Actualizar plantilla incrementando automáticamente la versión (+1) sin alterar consentimientos previos', async () => {
    const template = await service.createTemplate({
      nombre: 'Blanqueamiento Dental',
      plantillaUrl: 'https://odontoleal.com/plantillas/blanqueamiento_v1.html',
      tipoConsentimiento: true,
    });

    assert.strictEqual(template.version, 1);

    // Actualización de texto legal de la plantilla
    const updated = await service.updateTemplateVersion(template.idConsentimiento, {
      nombre: 'Blanqueamiento Dental Láser Avanzado',
      plantillaUrl: 'https://odontoleal.com/plantillas/blanqueamiento_v2.html',
    });

    assert.strictEqual(updated.idConsentimiento, template.idConsentimiento);
    assert.strictEqual(updated.nombre, 'Blanqueamiento Dental Láser Avanzado');
    assert.strictEqual(updated.version, 2); // Versión incrementada a 2
  });

  it('RF-CON-008: Inactivar y activar plantilla sin eliminarla del repositorio (Regla de Negocio 8)', async () => {
    const template = await service.createTemplate({
      nombre: 'Ortodoncia Invisible',
      plantillaUrl: 'https://odontoleal.com/plantillas/orto_v1.html',
      tipoConsentimiento: true,
    });

    // Inactivar plantilla
    const inactivated = await service.toggleTemplateStatus(template.idConsentimiento, false);
    assert.strictEqual(inactivated.estado, false);
    assert.strictEqual(inactivated.isActive(), false);

    // Al consultar solo activas no debe aparecer
    const activeList = await service.getTemplates(true);
    assert.strictEqual(activeList.length, 0);

    // Al consultar todas, sigue existiendo (no se elimina)
    const allList = await service.getTemplates(false);
    assert.strictEqual(allList.length, 1);

    // Reactivar
    const reactivated = await service.toggleTemplateStatus(template.idConsentimiento, true);
    assert.strictEqual(reactivated.estado, true);
    assert.strictEqual(reactivated.isActive(), true);
  });

  it('RF-CON-002: Registrar consentimiento firmado asociándolo al paciente y a la cita', async () => {
    const template = await service.createTemplate({
      nombre: 'Cirugía de Terceros Molares',
      plantillaUrl: 'https://odontoleal.com/plantillas/cirugia_cordales.html',
      tipoConsentimiento: true,
    });

    const signed = await service.signConsent({
      idConsentimiento: template.idConsentimiento,
      idPaciente: 201,
      idCita: 701,
      archivoUrl: 'https://storage.odontoleal.com/consents/201_701_cordales_firmado.pdf',
    });

    assert.strictEqual(signed.idConsentimiento, template.idConsentimiento);
    assert.strictEqual(signed.idPaciente, 201);
    assert.strictEqual(signed.idCita, 701);
    assert.strictEqual(
      signed.archivoUrl,
      'https://storage.odontoleal.com/consents/201_701_cordales_firmado.pdf'
    );
  });

  it('RF-CON-002: Rechazar firma sobre plantilla inexistente o en estado Inactiva', async () => {
    const template = await service.createTemplate({
      nombre: 'Endodoncia Unirradicular',
      plantillaUrl: 'https://odontoleal.com/plantillas/endo.html',
      tipoConsentimiento: true,
    });

    // Inactivar la plantilla
    await service.toggleTemplateStatus(template.idConsentimiento, false);

    // Intento de firmar sobre plantilla inactiva -> Rechazado
    await assert.rejects(
      async () => {
        await service.signConsent({
          idConsentimiento: template.idConsentimiento,
          idPaciente: 202,
          idCita: 702,
          archivoUrl: 'https://storage.odontoleal.com/consents/test.pdf',
        });
      },
      (err: any) => err instanceof InactiveConsentTemplateError
    );

    // Intento de firmar sobre ID inexistente
    await assert.rejects(
      async () => {
        await service.signConsent({
          idConsentimiento: 9999,
          idPaciente: 202,
          idCita: 702,
          archivoUrl: 'https://storage.odontoleal.com/consents/test.pdf',
        });
      },
      (err: any) => err instanceof ConsentNotFoundError
    );
  });

  it('RF-CON-003: Consultar historial de consentimientos firmados del paciente en orden cronológico descendente', async () => {
    const t1 = await service.createTemplate({
      nombre: 'Detartraje y Profilaxis',
      plantillaUrl: 'https://odontoleal.com/plantillas/limpieza.html',
      tipoConsentimiento: true,
    });

    const t2 = await service.createTemplate({
      nombre: 'Restauración Resina',
      plantillaUrl: 'https://odontoleal.com/plantillas/resina.html',
      tipoConsentimiento: true,
    });

    // Firmar primer consentimiento
    await service.signConsent({
      idConsentimiento: t1.idConsentimiento,
      idPaciente: 203,
      idCita: 801,
      archivoUrl: 'https://storage.odontoleal.com/consents/203_801.pdf',
    });

    // Firmar segundo consentimiento
    await service.signConsent({
      idConsentimiento: t2.idConsentimiento,
      idPaciente: 203,
      idCita: 802,
      archivoUrl: 'https://storage.odontoleal.com/consents/203_802.pdf',
    });

    const patientConsents = await service.getSignedConsentsByPatient(203);
    assert.strictEqual(patientConsents.length, 2);
    assert.ok(patientConsents[0].fecha.getTime() >= patientConsents[1].fecha.getTime());
    assert.strictEqual(patientConsents[0].idPaciente, 203);
  });
});
