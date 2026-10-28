import { DataAuthorizationVO } from './data-authorization.vo';

export type PatientSex = 'Femenino' | 'Masculino' | 'Indeterminado';

export interface GuardianInfo {
  nombreCompleto: string;
  documentoIdentidad: string;
  parentesco: string;
  telefono: string;
}

export interface BackupContactInfo {
  nombreCompleto: string;
  telefono: string;
  parentesco?: string;
}

export interface PatientProps {
  idPaciente?: number;
  nombreCompleto: string;
  documentoIdentidad: string;
  fechaNacimiento: string; // YYYY-MM-DD
  sexo?: PatientSex | null;
  telefono?: string | null;
  correo?: string | null;
  contactoRespaldo?: BackupContactInfo | null;
  acudiente?: GuardianInfo | null;
  autorizacionDatos?: DataAuthorizationVO | null;
  creadoDesdeSolicitud?: boolean;
}

export class PatientDomainError extends Error {
  constructor(
    public readonly field: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'PatientDomainError';
  }
}

export class Patient {
  private static readonly VALID_SEX_VALUES: PatientSex[] = [
    'Femenino',
    'Masculino',
    'Indeterminado',
  ];
  private static readonly DOCUMENT_REGEX = /^\d+$/;
  private static readonly PHONE_REGEX = /^\d{10}$/;
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

  private _idPaciente?: number;
  private _nombreCompleto: string;
  private _documentoIdentidad: string;
  private _fechaNacimiento: string;
  private _sexo: PatientSex | null;
  private _telefono: string | null;
  private _correo: string | null;
  private _contactoRespaldo: BackupContactInfo | null;
  private _acudiente: GuardianInfo | null;
  private _autorizacionDatos: DataAuthorizationVO | null;
  private _creadoDesdeSolicitud: boolean;

  private constructor(props: PatientProps) {
    this._idPaciente = props.idPaciente;
    this._nombreCompleto = props.nombreCompleto.trim();
    this._documentoIdentidad = props.documentoIdentidad.trim();
    this._fechaNacimiento = props.fechaNacimiento.trim();
    this._sexo = props.sexo ?? null;
    this._telefono = props.telefono?.trim() || null;
    this._correo = props.correo?.trim().toLowerCase() || null;
    this._contactoRespaldo = props.contactoRespaldo ?? null;
    this._acudiente = props.acudiente ?? null;
    this._autorizacionDatos = props.autorizacionDatos ?? null;
    this._creadoDesdeSolicitud = Boolean(props.creadoDesdeSolicitud);
  }

  public static create(props: PatientProps): Patient {
    const patient = new Patient(props);
    patient.validate();
    return patient;
  }

  public static reconstitute(props: PatientProps): Patient {
    return new Patient(props);
  }

  public get idPaciente(): number | undefined {
    return this._idPaciente;
  }

  public get nombreCompleto(): string {
    return this._nombreCompleto;
  }

  public get documentoIdentidad(): string {
    return this._documentoIdentidad;
  }

  public get fechaNacimiento(): string {
    return this._fechaNacimiento;
  }

  public get sexo(): PatientSex | null {
    return this._sexo;
  }

  public get telefono(): string | null {
    return this._telefono;
  }

  public get correo(): string | null {
    return this._correo;
  }

  public get contactoRespaldo(): BackupContactInfo | null {
    return this._contactoRespaldo;
  }

  public get acudiente(): GuardianInfo | null {
    return this._acudiente;
  }

  public get autorizacionDatos(): DataAuthorizationVO | null {
    return this._autorizacionDatos;
  }

  /**
   * Calcula la edad exacta en años cumplidos respecto a la fecha actual (UTC-5 Colombia)
   */
  public getAge(referenceDate: Date = new Date()): number {
    const [year, month, day] = this._fechaNacimiento.split('-').map(Number);
    const birthDate = new Date(year, month - 1, day);

    let age = referenceDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = referenceDate.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  }

  /**
   * Ley 27 de 1977 y RF-CON-005: Menor de 18 años requiere acudiente
   */
  public isMinor(referenceDate: Date = new Date()): boolean {
    return this.getAge(referenceDate) < 18;
  }

  /**
   * Verifica si los datos del acudiente están completos
   */
  public hasCompleteGuardian(): boolean {
    if (!this._acudiente) return false;
    const { nombreCompleto, documentoIdentidad, parentesco, telefono } =
      this._acudiente;
    return Boolean(
      nombreCompleto?.trim() &&
        documentoIdentidad?.trim() &&
        Patient.DOCUMENT_REGEX.test(documentoIdentidad.trim()) &&
        parentesco?.trim() &&
        telefono?.trim() &&
        Patient.PHONE_REGEX.test(telefono.trim())
    );
  }

  /**
   * Sección 1.3 ERS: Marca del paciente creado desde una solicitud (RF-AGE-005)
   * al que le faltan el sexo o, si es menor, los datos del acudiente; se retira al completarlos.
   */
  public get datosIncompletos(): boolean {
    if (!this._sexo) return true;
    if (this.isMinor() && !this.hasCompleteGuardian()) return true;
    return false;
  }

  /**
   * RF-HCL-002: Actualiza los datos del paciente validando las reglas de RF-HCL-001.
   * Si tenía "Datos incompletos" y se completan los campos requeridos, la marca se retira automáticamente.
   */
  public update(changes: {
    nombreCompleto?: string;
    documentoIdentidad?: string;
    fechaNacimiento?: string;
    sexo?: PatientSex | null;
    telefono?: string | null;
    correo?: string | null;
    contactoRespaldo?: BackupContactInfo | null;
    acudiente?: GuardianInfo | null;
  }): void {
    if (changes.nombreCompleto !== undefined) {
      this._nombreCompleto = changes.nombreCompleto.trim();
    }
    if (changes.documentoIdentidad !== undefined) {
      this._documentoIdentidad = changes.documentoIdentidad.trim();
    }
    if (changes.fechaNacimiento !== undefined) {
      this._fechaNacimiento = changes.fechaNacimiento.trim();
    }
    if (changes.sexo !== undefined) {
      this._sexo = changes.sexo;
    }
    if (changes.telefono !== undefined) {
      this._telefono = changes.telefono ? changes.telefono.trim() : null;
    }
    if (changes.correo !== undefined) {
      this._correo = changes.correo
        ? changes.correo.trim().toLowerCase()
        : null;
    }
    if (changes.contactoRespaldo !== undefined) {
      this._contactoRespaldo = changes.contactoRespaldo;
    }
    if (changes.acudiente !== undefined) {
      this._acudiente = changes.acudiente;
    }

    // Si en la edición ya cuenta con sexo y (si aplica) acudiente, deja de ser un registro preliminar de solicitud
    if (this._sexo && (!this.isMinor() || this.hasCompleteGuardian())) {
      this._creadoDesdeSolicitud = false;
    }

    this.validate();
  }

  private validate(): void {
    if (!this._nombreCompleto) {
      throw new PatientDomainError(
        'nombreCompleto',
        'El nombre completo del paciente es obligatorio.'
      );
    }

    if (!this._documentoIdentidad) {
      throw new PatientDomainError(
        'documentoIdentidad',
        'El documento de identidad es obligatorio.'
      );
    }

    if (!Patient.DOCUMENT_REGEX.test(this._documentoIdentidad)) {
      throw new PatientDomainError(
        'documentoIdentidad',
        'El documento de identidad debe contener únicamente dígitos.'
      );
    }

    if (
      !this._fechaNacimiento ||
      !Patient.DATE_REGEX.test(this._fechaNacimiento)
    ) {
      throw new PatientDomainError(
        'fechaNacimiento',
        'La fecha de nacimiento es obligatoria y debe tener el formato YYYY-MM-DD.'
      );
    }

    const [year, month, day] = this._fechaNacimiento.split('-').map(Number);
    const birthDateObj = new Date(year, month - 1, day);
    if (
      isNaN(birthDateObj.getTime()) ||
      birthDateObj.getFullYear() !== year ||
      birthDateObj.getMonth() !== month - 1 ||
      birthDateObj.getDate() !== day
    ) {
      throw new PatientDomainError(
        'fechaNacimiento',
        'La fecha de nacimiento no es una fecha calendario válida.'
      );
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (birthDateObj > today) {
      throw new PatientDomainError(
        'fechaNacimiento',
        'La fecha de nacimiento no puede ser una fecha futura.'
      );
    }

    if (
      this._sexo !== null &&
      !Patient.VALID_SEX_VALUES.includes(this._sexo)
    ) {
      throw new PatientDomainError(
        'sexo',
        'El sexo debe ser Femenino, Masculino o Indeterminado.'
      );
    }

    if (!this._creadoDesdeSolicitud && !this._sexo) {
      throw new PatientDomainError(
        'sexo',
        'El sexo del paciente es obligatorio.'
      );
    }

    if (this._telefono !== null) {
      if (!Patient.PHONE_REGEX.test(this._telefono)) {
        throw new PatientDomainError(
          'telefono',
          'El teléfono debe contener exactamente 10 dígitos numéricos.'
        );
      }
    } else if (!this._creadoDesdeSolicitud) {
      throw new PatientDomainError(
        'telefono',
        'El teléfono del paciente es obligatorio.'
      );
    }

    if (this._correo !== null) {
      if (!Patient.EMAIL_REGEX.test(this._correo)) {
        throw new PatientDomainError(
          'correo',
          'El correo electrónico debe tener un formato válido (usuario@dominio).'
        );
      }
    } else if (!this._creadoDesdeSolicitud) {
      throw new PatientDomainError(
        'correo',
        'El correo electrónico del paciente es obligatorio.'
      );
    }

    if (this._contactoRespaldo) {
      if (!this._contactoRespaldo.nombreCompleto?.trim()) {
        throw new PatientDomainError(
          'contactoRespaldo.nombreCompleto',
          'El nombre del contacto de respaldo es obligatorio si se suministra contacto de respaldo.'
        );
      }
      if (
        !this._contactoRespaldo.telefono?.trim() ||
        !Patient.PHONE_REGEX.test(this._contactoRespaldo.telefono.trim())
      ) {
        throw new PatientDomainError(
          'contactoRespaldo.telefono',
          'El teléfono del contacto de respaldo debe tener 10 dígitos.'
        );
      }
    }

    // Regla RF-HCL-001 y RF-CON-005: Acudiente obligatorio para menores de 18 años
    if (this.isMinor() && !this._creadoDesdeSolicitud) {
      if (!this._acudiente) {
        throw new PatientDomainError(
          'acudiente',
          'El paciente es menor de 18 años; los datos del acudiente (nombre, documento, parentesco y teléfono) son obligatorios.'
        );
      }
      if (!this._acudiente.nombreCompleto?.trim()) {
        throw new PatientDomainError(
          'acudiente.nombreCompleto',
          'El nombre completo del acudiente es obligatorio.'
        );
      }
      if (
        !this._acudiente.documentoIdentidad?.trim() ||
        !Patient.DOCUMENT_REGEX.test(this._acudiente.documentoIdentidad.trim())
      ) {
        throw new PatientDomainError(
          'acudiente.documentoIdentidad',
          'El documento del acudiente es obligatorio y debe contener solo dígitos.'
        );
      }
      if (!this._acudiente.parentesco?.trim()) {
        throw new PatientDomainError(
          'acudiente.parentesco',
          'El parentesco del acudiente es obligatorio.'
        );
      }
      if (
        !this._acudiente.telefono?.trim() ||
        !Patient.PHONE_REGEX.test(this._acudiente.telefono.trim())
      ) {
        throw new PatientDomainError(
          'acudiente.telefono',
          'El teléfono del acudiente es obligatorio y debe tener 10 dígitos.'
        );
      }
    }
  }

  public toPrimitives() {
    return {
      idPaciente: this._idPaciente,
      nombreCompleto: this._nombreCompleto,
      documentoIdentidad: this._documentoIdentidad,
      fechaNacimiento: this._fechaNacimiento,
      edad: this.getAge(),
      esMenorDeEdad: this.isMinor(),
      sexo: this._sexo,
      telefono: this._telefono,
      correo: this._correo,
      contactoRespaldo: this._contactoRespaldo,
      acudiente: this._acudiente,
      autorizacionDatos: this._autorizacionDatos
        ? this._autorizacionDatos.toPrimitives()
        : null,
      datosIncompletos: this.datosIncompletos,
    };
  }
}