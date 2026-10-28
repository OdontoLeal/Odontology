import {
  ClinicalEvolutionPayload,
  OdontogramDataDTO,
} from '../infrastructure/clinical-record.model';

export type UserRoleCode =
  | 'ROL-PAC'
  | 'ROL-ODO'
  | 'ROL-ESP'
  | 'ROL-COA'
  | 'ROL-AUX'
  | 'ROL-ADM';

export type AppointmentState =
  | 'Solicitada'
  | 'Confirmada'
  | 'Rechazada'
  | 'En consulta'
  | 'Atendida'
  | 'Cancelada'
  | 'Inasistencia';

export interface AntecedentEntry {
  aplica: boolean;
  observacion?: string;
}

export type AntecedentsMap = Record<string, AntecedentEntry>;

export interface AuthorshipMetadata {
  idUsuario: number;
  nombreUsuario: string;
  idProfesionalResponsable: number;
  fechaHoraISO: string;
}

export interface ActorContext {
  idUsuario: number;
  nombreUsuario: string;
  roles: UserRoleCode[];
}

export class ClinicalDomainError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: 'BAD_REQUEST' | 'FORBIDDEN' | 'NOT_FOUND' = 'BAD_REQUEST'
  ) {
    super(message);
    this.name = 'ClinicalDomainError';
  }
}

export class ClinicalRecordEntity {
  public static readonly UNAUTHORIZED_MESSAGE =
    'No tiene permiso para realizar esta acción';
  public static readonly EXPIRED_EDIT_WINDOW_MESSAGE =
    'La historia clínica solo se puede editar el día en que fue creada';
  public static readonly DELETION_FORBIDDEN_MESSAGE =
    'Ninguna historia clínica guardada ni sus anexos pueden ser eliminados (Regla de Negocio 8).';

  constructor(
    public readonly idPaciente: number,
    public readonly idCita: number,
    private _motivoConsulta: string,
    private _antecedentes: AntecedentsMap,
    private readonly _diligenciadoPor: AuthorshipMetadata,
    private readonly _fechaCreacion: Date = new Date(),
    private _odontograma?: OdontogramDataDTO,
    private _procedimientoRealizado?: string,
    private _notaEvolucion?: string,
    public readonly idEvolucion?: number
  ) {
    this.validateAuthorship(this._diligenciadoPor);
    this.validateMotivoConsulta(this._motivoConsulta);
    this.validateAntecedentes(this._antecedentes);
  }

  // RF-HCL-005: Crear instancia de apertura de historia clínica validando rol, estado de cita y precarga
  public static createForConsultation(params: {
    idPaciente: number;
    idCita: number;
    estadoCita: AppointmentState | string;
    idProfesionalResponsableCita: number;
    actor: ActorContext;
    motivoConsulta: string;
    antecedentesInput?: AntecedentsMap;
    marcarTodoNoAplica?: boolean;
    catalogoAntecedentes?: string[];
    antecedentesPrevios?: AntecedentsMap;
    odontogramaInicial?: OdontogramDataDTO;
  }): ClinicalRecordEntity {
    this.assertIsResponsibleProfessional(params.actor, params.idProfesionalResponsableCita);

    if (params.estadoCita !== 'En consulta') {
      throw new ClinicalDomainError(
        'Solo se puede crear o abrir la historia clínica cuando la cita está "En consulta".',
        'BAD_REQUEST'
      );
    }

    let antecedentesFinales: AntecedentsMap = {};

    if (params.antecedentesPrevios && Object.keys(params.antecedentesPrevios).length > 0) {
      antecedentesFinales = structuredClone(params.antecedentesPrevios);
    }

    if (params.marcarTodoNoAplica && params.catalogoAntecedentes) {
      antecedentesFinales = this.buildNoAplicaAntecedents(params.catalogoAntecedentes);
    }

    if (params.antecedentesInput && Object.keys(params.antecedentesInput).length > 0) {
      antecedentesFinales = {
        ...antecedentesFinales,
        ...params.antecedentesInput,
      };
    }

    if (Object.keys(antecedentesFinales).length === 0) {
      throw new ClinicalDomainError(
        'Debe registrar los antecedentes personales y familiares o seleccionar "No aplica".',
        'BAD_REQUEST'
      );
    }

    const nowColombiaISO = this.getColombiaISOString(new Date());

    const authorship: AuthorshipMetadata = {
      idUsuario: params.actor.idUsuario,
      nombreUsuario: params.actor.nombreUsuario,
      idProfesionalResponsable: params.idProfesionalResponsableCita,
      fechaHoraISO: nowColombiaISO,
    };

    return new ClinicalRecordEntity(
      params.idPaciente,
      params.idCita,
      params.motivoConsulta,
      antecedentesFinales,
      authorship,
      new Date(),
      params.odontogramaInicial
    );
  }

  public static buildNoAplicaAntecedents(catalogoKeys: string[]): AntecedentsMap {
    return catalogoKeys.reduce<AntecedentsMap>((acc, key) => {
      acc[key] = { aplica: false };
      return acc;
    }, {});
  }

  // RF-HCL-006 & RQNF-FUN-001: Actualizar historia clínica dentro del mismo día calendario en Colombia (UTC-5)
  public updateClinicalData(params: {
    actor: ActorContext;
    idProfesionalResponsableCita: number;
    motivoConsulta?: string;
    antecedentes?: AntecedentsMap;
    odontograma?: OdontogramDataDTO;
    now?: Date;
  }): ClinicalEvolutionPayload {
    ClinicalRecordEntity.assertIsResponsibleProfessional(
      params.actor,
      params.idProfesionalResponsableCita
    );
    ClinicalRecordEntity.assertSameDayInColombia(this._fechaCreacion, params.now ?? new Date());

    if (params.motivoConsulta !== undefined) {
      this.validateMotivoConsulta(params.motivoConsulta);
      this._motivoConsulta = params.motivoConsulta.trim();
    }

    if (params.antecedentes !== undefined) {
      this.validateAntecedentes(params.antecedentes);
      this._antecedentes = params.antecedentes;
    }

    if (params.odontograma !== undefined) {
      this._odontograma = params.odontograma;
    }

    const updatedAuthorship: AuthorshipMetadata = {
      idUsuario: params.actor.idUsuario,
      nombreUsuario: params.actor.nombreUsuario,
      idProfesionalResponsable: params.idProfesionalResponsableCita,
      fechaHoraISO: ClinicalRecordEntity.getColombiaISOString(params.now ?? new Date()),
    };

    return {
      tipoRegistro: 'APERTURA_CONSULTA',
      motivoConsulta: this._motivoConsulta,
      antecedentes: this._antecedentes,
      odontograma: this._odontograma,
      procedimientoRealizado: this._procedimientoRealizado,
      notaEvolucion: this._notaEvolucion,
      diligenciadoPor: updatedAuthorship,
    };
  }

  public static assertIsResponsibleProfessional(
    actor: ActorContext,
    idProfesionalResponsableCita: number
  ): void {
    const isProfessionalRole =
      actor.roles.includes('ROL-ODO') || actor.roles.includes('ROL-ESP');

    if (!isProfessionalRole || actor.idUsuario !== idProfesionalResponsableCita) {
      throw new ClinicalDomainError(this.UNAUTHORIZED_MESSAGE, 'FORBIDDEN');
    }
  }

  public static assertCanViewClinicalHistory(actor: ActorContext): void {
    const canView =
      actor.roles.includes('ROL-ODO') || actor.roles.includes('ROL-ESP');

    if (!canView) {
      throw new ClinicalDomainError(this.UNAUTHORIZED_MESSAGE, 'FORBIDDEN');
    }
  }

  public static assertCanOperateInConsultation(params: {
    actor: ActorContext;
    idProfesionalResponsableCita: number;
    estadoCita: AppointmentState | string;
    fechaCreacionRegistro?: Date;
    now?: Date;
  }): void {
    const isResponsibleProf =
      (params.actor.roles.includes('ROL-ODO') ||
        params.actor.roles.includes('ROL-ESP')) &&
      params.actor.idUsuario === params.idProfesionalResponsableCita;

    const isAuxiliary = params.actor.roles.includes('ROL-AUX');

    if (isResponsibleProf) {
      if (params.fechaCreacionRegistro) {
        this.assertSameDayInColombia(
          params.fechaCreacionRegistro,
          params.now ?? new Date()
        );
      }
      return;
    }

    if (isAuxiliary && params.estadoCita === 'En consulta') {
      return;
    }

    throw new ClinicalDomainError(this.UNAUTHORIZED_MESSAGE, 'FORBIDDEN');
  }

  public static assertSameDayInColombia(fechaCreacion: Date, fechaActual: Date = new Date()): void {
    const createdDay = this.toColombiaDateKey(fechaCreacion);
    const currentDay = this.toColombiaDateKey(fechaActual);

    if (createdDay !== currentDay) {
      throw new ClinicalDomainError(this.EXPIRED_EDIT_WINDOW_MESSAGE, 'FORBIDDEN');
    }
  }

  public static toColombiaDateKey(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  public static getColombiaISOString(date: Date = new Date()): string {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
    return `${parts.replace(' ', 'T')}-05:00`;
  }

  private validateMotivoConsulta(motivo: string): void {
    if (!motivo || motivo.trim().length === 0) {
      throw new ClinicalDomainError(
        'El campo "motivoConsulta" es obligatorio para registrar la historia clínica.',
        'BAD_REQUEST'
      );
    }
  }

  private validateAntecedentes(antecedentes: AntecedentsMap): void {
    if (!antecedentes || typeof antecedentes !== 'object') {
      throw new ClinicalDomainError(
        'Los antecedentes médicos son obligatorios.',
        'BAD_REQUEST'
      );
    }

    for (const [nombreAntecedente, valor] of Object.entries(antecedentes)) {
      if (valor.aplica && (!valor.observacion || valor.observacion.trim().length === 0)) {
        throw new ClinicalDomainError(
          `El antecedente "${nombreAntecedente}" marcado como "Sí" requiere una observación obligatoria.`,
          'BAD_REQUEST'
        );
      }
    }
  }

  private validateAuthorship(diligenciadoPor: AuthorshipMetadata): void {
    if (
      !diligenciadoPor ||
      !diligenciadoPor.idUsuario ||
      !diligenciadoPor.nombreUsuario ||
      !diligenciadoPor.idProfesionalResponsable ||
      !diligenciadoPor.fechaHoraISO
    ) {
      throw new ClinicalDomainError(
        'Los metadatos inmutables de autoría "diligenciadoPor" son obligatorios (Regla de Negocio 10).',
        'BAD_REQUEST'
      );
    }
  }

  public delete(): never {
    throw new ClinicalDomainError(
      ClinicalRecordEntity.DELETION_FORBIDDEN_MESSAGE,
      'FORBIDDEN'
    );
  }

  public toEvolutionPayload(): ClinicalEvolutionPayload {
    return {
      tipoRegistro: 'APERTURA_CONSULTA',
      motivoConsulta: this._motivoConsulta.trim(),
      antecedentes: this._antecedentes,
      odontograma: this._odontograma,
      procedimientoRealizado: this._procedimientoRealizado,
      notaEvolucion: this._notaEvolucion,
      diligenciadoPor: this._diligenciadoPor,
    };
  }
}