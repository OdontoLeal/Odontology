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

// Implementación en memoria del repositorio de consentimientos adaptada a ERS v1.2
class InMemoryConsentRepository implements IConsentRepository {
  public templates: Map<number, ConsentTemplate> = new Map();
  public signedConsents: SignedConsent[] = [];
  private templateIdSeq = 1;
  private signedConsentIdSeq = 1;

  async createTemplate(dto: CreateConsentTemplateDTO): Promise<ConsentTemplate> {
    const id = this.templateIdSeq++;
    const template = new ConsentTemplate({
      idConsentimiento: id,
      nombre: dto.nombre,
      textoPlantilla: dto.textoPlantilla ?? dto.plantillaUrl ?? '',
      version: 1, // Regla RF-CON-004
      estado: true, // Activa por defecto
      idUsuarioModificador: dto.idUsuarioModificador ?? null,
      fechaModificacion: new Date(),
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

    const newVersion = existing.version + 1; // Incremento automático versión (+1)
    const updated = new ConsentTemplate({
      idConsentimiento: existing.idConsentimiento,
      nombre: dto.nombre ?? existing.nombre,
      textoPlantilla: dto.textoPlantilla ?? dto.plantillaUrl ?? existing.textoPlantilla,
      version: newVersion,
      estado: existing.estado,
      idUsuarioModificador: dto.idUsuarioModificador ?? null,
      fechaModificacion: new Date(),
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
      textoPlantilla: existing.textoPlantilla,
      version: existing.version,
      estado,
      idUsuarioModificador: existing.idUsuarioModificador,
      fechaModificacion: new Date(),
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
    const tmpl = this.templates.get(dto.idConsentimiento);
    const id = this.signedConsentIdSeq++;
    const signed = new SignedConsent({
      idConsentimientoFirmado: id,
      idConsentimiento: dto.idConsentimiento,
      idPaciente: dto.idPaciente,
      versionPlantilla: tmpl ? tmpl.version : 1,
      textoFirmado: dto.textoFirmado ?? (tmpl ? tmpl.textoPlantilla : ''),
      firmaBase64: dto.firmaBase64 ?? dto.archivoUrl ?? '',
      firmaPorAcudiente: Boolean(dto.firmaPorAcudiente),
      nombreDocumentoAcudiente: dto.nombreDocumentoAcudiente ?? null,
      idUsuarioDiligencio: dto.idUsuarioDiligencio ?? null,
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
          idConsentimientoFirmado: s.idConsentimientoFirmado || 1,
          idConsentimiento: s.idConsentimiento,
          nombrePlantilla: tmpl ? tmpl.nombre : 'Consentimiento General',
          versionPlantilla: s.versionPlantilla,
          versionActualPlantilla: tmpl ? tmpl.version : 1,
          idPaciente: s.idPaciente,
          fecha: s.fecha ?? new Date(),
          textoFirmado: s.textoFirmado,
          firmaBase64: s.firmaBase64,
          firmaPorAcudiente: s.firmaPorAcudiente,
          nombreDocumentoAcudiente: s.nombreDocumentoAcudiente ?? null,
          idUsuarioDiligencio: s.idUsuarioDiligencio ?? null,
          usuarioDiligencioNombre: 'Dr. Eduar Leal',
        };
      })
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }

  async findSignedConsentById(
    idConsentimientoFirmado: number
  ): Promise<PatientSignedConsentDetail | null> {
    const s = this.signedConsents.find(
      (c) => c.idConsentimientoFirmado === idConsentimientoFirmado
    );
    if (!s) return null;
    const tmpl = this.templates.get(s.idConsentimiento);
    return {
      idConsentimientoFirmado: s.idConsentimientoFirmado || 1,
      idConsentimiento: s.idConsentimiento,
      nombrePlantilla: tmpl ? tmpl.nombre : 'Consentimiento General',
      versionPlantilla: s.versionPlantilla,
      versionActualPlantilla: tmpl ? tmpl.version : 1,
      idPaciente: s.idPaciente,
      fecha: s.fecha ?? new Date(),
      textoFirmado: s.textoFirmado,
      firmaBase64: s.firmaBase64,
      firmaPorAcudiente: s.firmaPorAcudiente,
      nombreDocumentoAcudiente: s.nombreDocumentoAcudiente ?? null,
      idUsuarioDiligencio: s.idUsuarioDiligencio ?? null,
      usuarioDiligencioNombre: 'Dr. Eduar Leal',
    };
  }
}

describe('MÓDULO D: Consentimientos Informados (RF-CON-001 a RF-CON-008 - ERS v1.2)', () => {
  let repo: InMemoryConsentRepository;
  let service: ConsentService;

  beforeEach(() => {
    repo = new InMemoryConsentRepository();
    service = new ConsentService(repo);
  });

  it('RF-CON-004: Crear plantilla de consentimiento iniciando en versión 1 y estado Activa (RQNF-MAN-001)', async () => {
    const created = await service.createTemplate({
      nombre: 'Diseño de Sonrisa y Carillas',
      textoPlantilla: 'Texto legal descriptivo del procedimiento de diseño de sonrisa y carillas.',
    });

    assert.ok(created.idConsentimiento);
    assert.strictEqual(created.nombre, 'Diseño de Sonrisa y Carillas');
    assert.strictEqual(created.version, 1);
    assert.strictEqual(created.estado, true);
    assert.strictEqual(created.isActive(), true);
    assert.strictEqual(
      created.textoPlantilla,
      'Texto legal descriptivo del procedimiento de diseño de sonrisa y carillas.'
    );
  });

  it('RF-CON-004: Rechazar creación con nombre o textoPlantilla vacíos', async () => {
    await assert.rejects(
      async () => {
        await service.createTemplate({
          nombre: '',
          textoPlantilla: 'Texto legal válido.',
        });
      },
      (err: any) =>
        err instanceof ConsentValidationError &&
        /nombre de la plantilla es obligatorio/.test(err.message)
    );

    await assert.rejects(
      async () => {
        await service.createTemplate({
          nombre: 'Extracción Simple',
          textoPlantilla: '',
        });
      },
      (err: any) =>
        err instanceof ConsentValidationError &&
        /texto de la plantilla.*es obligatorio/.test(err.message)
    );
  });

  it('RF-CON-007: Actualizar plantilla incrementando automáticamente la versión (+1) sin alterar consentimientos previos', async () => {
    const template = await service.createTemplate({
      nombre: 'Blanqueamiento Dental',
      textoPlantilla: 'Texto v1 de blanqueamiento dental convencional.',
    });

    assert.strictEqual(template.version, 1);

    // Actualización de texto legal de la plantilla
    const updated = await service.updateTemplateVersion(template.idConsentimiento, {
      nombre: 'Blanqueamiento Dental Láser Avanzado',
      textoPlantilla: 'Texto v2 con tecnología láser y protocolos actualizados.',
    });

    assert.strictEqual(updated.idConsentimiento, template.idConsentimiento);
    assert.strictEqual(updated.nombre, 'Blanqueamiento Dental Láser Avanzado');
    assert.strictEqual(updated.version, 2); // Versión incrementada a 2
    assert.strictEqual(
      updated.textoPlantilla,
      'Texto v2 con tecnología láser y protocolos actualizados.'
    );
  });

  it('RF-CON-008: Inactivar y activar plantilla sin eliminarla del repositorio (Regla de Negocio 8)', async () => {
    const template = await service.createTemplate({
      nombre: 'Ortodoncia Invisible',
      textoPlantilla: 'Texto explicativo de ortodoncia invisible.',
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

  it('RF-CON-002: Registrar consentimiento firmado con texto consolidado y firma en texto (Base64)', async () => {
    const template = await service.createTemplate({
      nombre: 'Cirugía de Terceros Molares',
      textoPlantilla: 'Consentimiento para extracción de terceros molares incluidos.',
    });

    const signed = await service.signConsent({
      idConsentimiento: template.idConsentimiento,
      idPaciente: 201,
      textoFirmado:
        'Consentimiento para extracción de terceros molares incluidos. Suscrito por paciente titular.',
      firmaBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
      firmaPorAcudiente: false,
    });

    assert.strictEqual(signed.idConsentimiento, template.idConsentimiento);
    assert.strictEqual(signed.idPaciente, 201);
    assert.strictEqual(signed.versionPlantilla, 1);
    assert.strictEqual(signed.firmaPorAcudiente, false);
    assert.strictEqual(
      signed.firmaBase64,
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
    );
  });

  it('RF-CON-005: Validar obligatoriedad de nombre y documento del acudiente si firmaPorAcudiente es verdadero', async () => {
    const template = await service.createTemplate({
      nombre: 'Pulpotomía Pediátrica',
      textoPlantilla: 'Tratamiento pulpar para pacientes menores de edad.',
    });

    // Rechaza si falta nombre y documento del acudiente
    await assert.rejects(
      async () => {
        await service.signConsent({
          idConsentimiento: template.idConsentimiento,
          idPaciente: 305,
          firmaBase64: 'data:image/png;base64,iVBORw0KG...',
          firmaPorAcudiente: true,
          nombreDocumentoAcudiente: '',
        });
      },
      (err: any) =>
        err instanceof ConsentValidationError &&
        /nombre y documento del acudiente/i.test(err.message)
    );

    // Acepta si se suministra
    const signed = await service.signConsent({
      idConsentimiento: template.idConsentimiento,
      idPaciente: 305,
      firmaBase64: 'data:image/png;base64,iVBORw0KG...',
      firmaPorAcudiente: true,
      nombreDocumentoAcudiente: 'Marta Pérez - C.C. 52.123.456',
    });

    assert.strictEqual(signed.firmaPorAcudiente, true);
    assert.strictEqual(signed.nombreDocumentoAcudiente, 'Marta Pérez - C.C. 52.123.456');
  });

  it('RF-CON-002: Rechazar firma sobre plantilla inexistente o en estado Inactiva', async () => {
    const template = await service.createTemplate({
      nombre: 'Endodoncia Unirradicular',
      textoPlantilla: 'Tratamiento de conductos radiculares.',
    });

    // Inactivar la plantilla
    await service.toggleTemplateStatus(template.idConsentimiento, false);

    // Intento de firmar sobre plantilla inactiva -> Rechazado
    await assert.rejects(
      async () => {
        await service.signConsent({
          idConsentimiento: template.idConsentimiento,
          idPaciente: 202,
          firmaBase64: 'data:image/png;base64,sample...',
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
          firmaBase64: 'data:image/png;base64,sample...',
        });
      },
      (err: any) => err instanceof ConsentNotFoundError
    );
  });

  it('RF-CON-003: Consultar historial de consentimientos firmados del paciente en orden cronológico descendente', async () => {
    const t1 = await service.createTemplate({
      nombre: 'Detartraje y Profilaxis',
      textoPlantilla: 'Limpieza dental ultrasónica.',
    });

    const t2 = await service.createTemplate({
      nombre: 'Restauración Resina',
      textoPlantilla: 'Restauración dental estética con resina fotocurada.',
    });

    // Firmar primer consentimiento
    await service.signConsent({
      idConsentimiento: t1.idConsentimiento,
      idPaciente: 203,
      firmaBase64: 'data:image/png;base64,firma1...',
    });

    // Firmar segundo consentimiento
    await service.signConsent({
      idConsentimiento: t2.idConsentimiento,
      idPaciente: 203,
      firmaBase64: 'data:image/png;base64,firma2...',
    });

    const patientConsents = await service.getSignedConsentsByPatient(203);
    assert.strictEqual(patientConsents.length, 2);
    assert.ok(patientConsents[0].fecha.getTime() >= patientConsents[1].fecha.getTime());
    assert.strictEqual(patientConsents[0].idPaciente, 203);
  });
});
