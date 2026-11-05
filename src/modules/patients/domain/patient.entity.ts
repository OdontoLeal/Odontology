// src/modules/patients/domain/patient.entity.ts

export type PatientSex = 'Femenino' | 'Masculino' | 'Indeterminado';

/**
 * Datos del paciente según RF-HCL-001 v1.3: identificación y contacto, sin
 * datos clínicos. La ERS v1.3 retiró de la ficha el acudiente, el contacto de
 * respaldo y la autorización de datos: la autorización y todo trato con
 * menores se hacen con plantillas del Módulo D (RF-CON-004, RF-CON-005).
 */
export interface PatientProps {
  idPaciente?: number;
  nombreCompleto: string;
  documentoIdentidad: string;
  fechaNacimiento: string; // YYYY-MM-DD
  sexo?: PatientSex | null;
  telefono?: string | null;
  correo?: string | null;
}

export type PatientChanges = Partial<Omit<PatientProps, 'idPaciente'>>;

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
  private static readonly VALID_SEX_VALUES: PatientSex[] = ['Femenino', 'Masculino', 'Indeterminado'];
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

  private constructor(props: PatientProps) {
    this._idPaciente = props.idPaciente;
    this._nombreCompleto = (props.nombreCompleto ?? '').trim();
    this._documentoIdentidad = (props.documentoIdentidad ?? '').trim();
    this._fechaNacimiento = (props.fechaNacimiento ?? '').trim();
    this._sexo = props.sexo ?? null;
    this._telefono = props.telefono?.trim() || null;
    this._correo = props.correo?.trim().toLowerCase() || null;
  }

  /** RF-HCL-001: todos los datos son obligatorios al registrar un paciente. */
  public static create(props: PatientProps): Patient {
    const patient = new Patient(props);
    patient.validate();
    return patient;
  }

  /** Reconstruye desde la BD sin validar (p. ej. pacientes creados desde una solicitud sin sexo). */
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

  /** Edad en años cumplidos a la fecha de referencia. */
  public getAge(referenceDate: Date = new Date()): number {
    const [year, month, day] = this._fechaNacimiento.split('-').map(Number);
    const birthDate = new Date(year, month - 1, day);
    let age = referenceDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = referenceDate.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  /** Ley 27 de 1977: menor de 18 años (determina la plantilla de menores, RF-CON-005). */
  public isMinor(referenceDate: Date = new Date()): boolean {
    return this.getAge(referenceDate) < 18;
  }

  /**
   * Paciente creado desde una solicitud pública al que le falta el sexo
   * (RF-AGE-005; la solicitud no lo pide). Es un dato derivado: no se guarda,
   * y deja de aplicar al completar el dato con RF-HCL-002.
   * Mientras aplique, no se generan documentos clínicos (RF-DOC-001 a 003).
   */
  public get datosIncompletos(): boolean {
    return !this._sexo;
  }

  /** RF-HCL-002: modifica los datos con las reglas de RF-HCL-001. */
  public update(changes: PatientChanges): void {
    if (changes.nombreCompleto !== undefined) this._nombreCompleto = changes.nombreCompleto.trim();
    if (changes.documentoIdentidad !== undefined) this._documentoIdentidad = changes.documentoIdentidad.trim();
    if (changes.fechaNacimiento !== undefined) this._fechaNacimiento = changes.fechaNacimiento.trim();
    if (changes.sexo !== undefined) this._sexo = changes.sexo;
    if (changes.telefono !== undefined) this._telefono = changes.telefono ? changes.telefono.trim() : null;
    if (changes.correo !== undefined) this._correo = changes.correo ? changes.correo.trim().toLowerCase() : null;
    this.validate();
  }

  private validate(): void {
    if (!this._nombreCompleto) {
      throw new PatientDomainError('nombreCompleto', 'El nombre completo del paciente es obligatorio.');
    }
    if (this._nombreCompleto.length > 150) {
      throw new PatientDomainError('nombreCompleto', 'El nombre completo no puede superar 150 caracteres.');
    }
    if (!this._documentoIdentidad) {
      throw new PatientDomainError('documentoIdentidad', 'El documento de identidad es obligatorio.');
    }
    if (!Patient.DOCUMENT_REGEX.test(this._documentoIdentidad) || this._documentoIdentidad.length > 20) {
      throw new PatientDomainError(
        'documentoIdentidad',
        'El documento de identidad debe contener únicamente dígitos (máximo 20).'
      );
    }
    this.validateBirthDate();

    if (!this._sexo) {
      throw new PatientDomainError('sexo', 'El sexo del paciente es obligatorio.');
    }
    if (!Patient.VALID_SEX_VALUES.includes(this._sexo)) {
      throw new PatientDomainError('sexo', 'El sexo debe ser Femenino, Masculino o Indeterminado.');
    }
    if (!this._telefono) {
      throw new PatientDomainError('telefono', 'El teléfono del paciente es obligatorio.');
    }
    if (!Patient.PHONE_REGEX.test(this._telefono)) {
      throw new PatientDomainError('telefono', 'El teléfono debe contener exactamente 10 dígitos numéricos.');
    }
    if (!this._correo) {
      throw new PatientDomainError('correo', 'El correo electrónico del paciente es obligatorio.');
    }
    if (!Patient.EMAIL_REGEX.test(this._correo) || this._correo.length > 150) {
      throw new PatientDomainError(
        'correo',
        'El correo electrónico debe tener un formato válido (usuario@dominio).'
      );
    }
  }

  private validateBirthDate(): void {
    if (!this._fechaNacimiento || !Patient.DATE_REGEX.test(this._fechaNacimiento)) {
      throw new PatientDomainError(
        'fechaNacimiento',
        'La fecha de nacimiento es obligatoria y debe tener el formato YYYY-MM-DD.'
      );
    }
    const [year, month, day] = this._fechaNacimiento.split('-').map(Number);
    const birthDate = new Date(year, month - 1, day);
    if (
      isNaN(birthDate.getTime()) ||
      birthDate.getFullYear() !== year ||
      birthDate.getMonth() !== month - 1 ||
      birthDate.getDate() !== day
    ) {
      throw new PatientDomainError('fechaNacimiento', 'La fecha de nacimiento no es una fecha calendario válida.');
    }
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (birthDate > today) {
      throw new PatientDomainError('fechaNacimiento', 'La fecha de nacimiento no puede ser una fecha futura.');
    }
  }

  public toPrimitives() {
    return {
      idPaciente: this._idPaciente,
      nombreCompleto: this._nombreCompleto,
      documentoIdentidad: this._documentoIdentidad,
      fechaNacimiento: this._fechaNacimiento,
      edad: this._fechaNacimiento ? this.getAge() : null,
      esMenorDeEdad: this._fechaNacimiento ? this.isMinor() : false,
      sexo: this._sexo,
      telefono: this._telefono,
      correo: this._correo,
      datosIncompletos: this.datosIncompletos,
    };
  }
}
