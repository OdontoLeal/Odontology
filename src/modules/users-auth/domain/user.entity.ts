import { RoleEntity } from './role.entity';

export interface SignatureImageInput {
  mimeType: string;
  sizeInBytes: number;
  urlOrBase64: string;
}

export interface UserProps {
  idUsuario?: number;
  nombreCompleto: string;
  documentoIdentidad: string;
  correo: string;
  telefono: string | null;
  contrasenaHash: string;
  esContrasenaTemporal?: boolean;
  estado?: boolean;
  firmaUrl?: string | null;
  intentosFallidos?: number;
  bloqueadoHasta?: Date | null;
  roles: RoleEntity[];
}

export class UserEntity {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly DOCUMENT_REGEX = /^\d+$/;
  private static readonly PHONE_REGEX = /^\d{10}$/;
  private static readonly PASSWORD_MIN_LENGTH = 8;
  private static readonly MAX_SIGNATURE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
  private static readonly ALLOWED_SIGNATURE_MIMES = ['image/png', 'image/jpeg', 'image/jpg'];
  public static readonly MAX_FAILED_ATTEMPTS = 5;
  public static readonly LOCKOUT_DURATION_MINUTES = 15;

  public readonly idUsuario?: number;
  private _nombreCompleto: string;
  private _documentoIdentidad: string;
  private _correo: string;
  private _telefono: string | null;
  private _contrasenaHash: string;
  private _esContrasenaTemporal: boolean;
  private _estado: boolean;
  private _firmaUrl: string | null;
  private _intentosFallidos: number;
  private _bloqueadoHasta: Date | null;
  private _roles: RoleEntity[];

  private constructor(props: UserProps) {
    this.idUsuario = props.idUsuario;
    this._nombreCompleto = props.nombreCompleto.trim();
    this._documentoIdentidad = props.documentoIdentidad.trim();
    this._correo = props.correo.trim().toLowerCase();
    this._telefono = props.telefono ? props.telefono.trim() : null;
    this._contrasenaHash = props.contrasenaHash;
    this._esContrasenaTemporal = props.esContrasenaTemporal ?? true;
    this._estado = props.estado ?? true;
    this._firmaUrl = props.firmaUrl ?? null;
    this._intentosFallidos = props.intentosFallidos ?? 0;
    this._bloqueadoHasta = props.bloqueadoHasta ?? null;
    this._roles = [...props.roles];
  }

  public get nombreCompleto(): string {
    return this._nombreCompleto;
  }

  public get documentoIdentidad(): string {
    return this._documentoIdentidad;
  }

  public get correo(): string {
    return this._correo;
  }

  public get telefono(): string | null {
    return this._telefono;
  }

  public get contrasenaHash(): string {
    return this._contrasenaHash;
  }

  public get esContrasenaTemporal(): boolean {
    return this._esContrasenaTemporal;
  }

  public get estado(): boolean {
    return this._estado;
  }

  public get firmaUrl(): string | null {
    return this._firmaUrl;
  }

  public get intentosFallidos(): number {
    return this._intentosFallidos;
  }

  public get bloqueadoHasta(): Date | null {
    return this._bloqueadoHasta;
  }

  public get roles(): ReadonlyArray<RoleEntity> {
    return [...this._roles];
  }

  public static validatePlainPassword(plainPassword: string): void {
    if (!plainPassword || plainPassword.length < UserEntity.PASSWORD_MIN_LENGTH) {
      throw new Error(
        'Contraseña: La contraseña debe tener mínimo 8 caracteres con al menos una letra y un número.'
      );
    }
    const hasLetter = /[a-zA-Z]/.test(plainPassword);
    const hasNumber = /\d/.test(plainPassword);
    if (!hasLetter || !hasNumber) {
      throw new Error(
        'Contraseña: La contraseña debe tener mínimo 8 caracteres con al menos una letra y un número.'
      );
    }
  }

  public static validateProfileFields(params: {
    nombreCompleto: string;
    documentoIdentidad: string;
    correo: string;
    telefono?: string | null;
  }): void {
    if (!params.nombreCompleto || !params.nombreCompleto.trim()) {
      throw new Error('Nombre completo: El nombre completo es obligatorio.');
    }
    if (params.nombreCompleto.trim().length > 150) {
      throw new Error('Nombre completo: No puede superar los 150 caracteres.');
    }
    if (!params.documentoIdentidad || !UserEntity.DOCUMENT_REGEX.test(params.documentoIdentidad.trim())) {
      throw new Error(
        'Documento de identidad: Es obligatorio y debe contener solo dígitos numéricos.'
      );
    }
    if (params.documentoIdentidad.trim().length > 20) {
      throw new Error('Documento de identidad: No puede superar los 20 dígitos numéricos.');
    }
    if (!params.correo || !UserEntity.EMAIL_REGEX.test(params.correo.trim())) {
      throw new Error(
        'Correo electrónico: Es obligatorio y debe tener un formato válido (usuario@dominio).'
      );
    }
    if (params.telefono !== undefined && params.telefono !== null && params.telefono.trim() !== '') {
      if (!UserEntity.PHONE_REGEX.test(params.telefono.trim())) {
        throw new Error(
          'Teléfono: El teléfono debe contener exactamente 10 dígitos numéricos.'
        );
      }
    }
  }

  public static validateRolesAndSignature(
    roles: RoleEntity[],
    signature?: SignatureImageInput | null
  ): void {
    if (!Array.isArray(roles) || roles.length === 0) {
      throw new Error('Roles de usuario: Debe asignar al menos un rol al usuario.');
    }

    const hasPatientRole = roles.some(
      (r) => r.codigo === 'ROL-PAC' || r.nombreRol.toUpperCase() === 'PACIENTE'
    );
    if (hasPatientRole) {
      throw new Error('Roles de usuario: El rol ROL-PAC no puede asignarse a ninguna cuenta de usuario.');
    }

    if (signature) {
      const isProfessional = roles.some(
        (r) =>
          r.codigo === 'ROL-ODO' ||
          r.codigo === 'ROL-ESP' ||
          r.nombreRol.toLowerCase().includes('odont') ||
          r.nombreRol.toLowerCase().includes('especialista') ||
          r.nombreRol.toLowerCase().includes('ortodon')
      );

      if (!isProfessional) {
        throw new Error(
          'Firma digital: La imagen de firma solo puede cargarse a usuarios con rol ROL-ODO o ROL-ESP.'
        );
      }

      if (!UserEntity.ALLOWED_SIGNATURE_MIMES.includes(signature.mimeType.toLowerCase())) {
        throw new Error(
          'Firma digital: La imagen de firma debe estar en formato PNG o JPG.'
        );
      }

      if (signature.sizeInBytes > UserEntity.MAX_SIGNATURE_SIZE_BYTES) {
        throw new Error(
          'Firma digital: La imagen de firma no puede superar el tamaño máximo de 2 MB.'
        );
      }
    }
  }

  public static createNew(params: {
    nombreCompleto: string;
    documentoIdentidad: string;
    correo: string;
    telefono?: string | null;
    contrasenaTemporalPlana?: string;
    contrasenaHash: string;
    roles: RoleEntity[];
    firma?: SignatureImageInput | null;
  }): UserEntity {
    UserEntity.validateProfileFields(params);
    if (params.contrasenaTemporalPlana !== undefined) {
      UserEntity.validatePlainPassword(params.contrasenaTemporalPlana);
    }
    if (!params.contrasenaHash) {
      throw new Error('Contraseña: El hash de la contraseña es obligatorio.');
    }
    UserEntity.validateRolesAndSignature(params.roles, params.firma);

    return new UserEntity({
      nombreCompleto: params.nombreCompleto,
      documentoIdentidad: params.documentoIdentidad,
      correo: params.correo,
      telefono: params.telefono ?? null,
      contrasenaHash: params.contrasenaHash,
      esContrasenaTemporal: true,
      estado: true,
      firmaUrl: params.firma ? params.firma.urlOrBase64 : null,
      intentosFallidos: 0,
      bloqueadoHasta: null,
      roles: params.roles,
    });
  }

  public static reconstitute(props: UserProps): UserEntity {
    return new UserEntity(props);
  }

  public hasRoleCode(code: string): boolean {
    const normalized = code.toUpperCase();
    return this._roles.some(
      (r) =>
        r.estadoAsignacion &&
        (r.codigo.toUpperCase() === normalized || r.nombreRol.toUpperCase() === normalized)
    );
  }

  public isAdmin(): boolean {
    return (
      this.hasRoleCode('ROL-ADM') ||
      this._roles.some(
        (r) => r.estadoAsignacion && r.nombreRol.toLowerCase().includes('administrador')
      )
    );
  }

  public isProfessional(): boolean {
    return (
      this.hasRoleCode('ROL-ODO') ||
      this.hasRoleCode('ROL-ESP') ||
      this._roles.some(
        (r) =>
          r.estadoAsignacion &&
          (r.nombreRol.toLowerCase().includes('odont') ||
            r.nombreRol.toLowerCase().includes('especialista') ||
            r.nombreRol.toLowerCase().includes('ortodon'))
      )
    );
  }

  public getAggregatedPermissions(): string[] {
    const permissions = new Set<string>();
    for (const role of this._roles) {
      if (role.estadoAsignacion) {
        for (const perm of role.permisos) {
          permissions.add(perm);
        }
      }
    }
    return Array.from(permissions);
  }

  public isLockedOut(now: Date = new Date()): boolean {
    return Boolean(this._bloqueadoHasta && this._bloqueadoHasta.getTime() > now.getTime());
  }

  public registerFailedLoginAttempt(now: Date = new Date()): void {
    this._intentosFallidos += 1;
    if (this._intentosFallidos >= UserEntity.MAX_FAILED_ATTEMPTS) {
      this._bloqueadoHasta = new Date(
        now.getTime() + UserEntity.LOCKOUT_DURATION_MINUTES * 60 * 1000
      );
    }
  }

  public resetLoginAttempts(): void {
    this._intentosFallidos = 0;
    this._bloqueadoHasta = null;
  }

  public changePassword(newPasswordHash: string, isTemporary: boolean = false): void {
    if (!newPasswordHash) {
      throw new Error('El hash de la nueva contraseña no puede estar vacío.');
    }
    this._contrasenaHash = newPasswordHash;
    this._esContrasenaTemporal = isTemporary;
    this.resetLoginAttempts();
  }

  public updateProfile(params: {
    nombreCompleto: string;
    documentoIdentidad: string;
    correo: string;
    telefono?: string | null;
    nuevaContrasenaTemporalPlana?: string;
    nuevoContrasenaHash?: string;
    roles: RoleEntity[];
    firma?: SignatureImageInput | null;
  }): void {
    UserEntity.validateProfileFields(params);
    UserEntity.validateRolesAndSignature(params.roles, params.firma);

    if (params.nuevaContrasenaTemporalPlana && params.nuevoContrasenaHash) {
      UserEntity.validatePlainPassword(params.nuevaContrasenaTemporalPlana);
      this._contrasenaHash = params.nuevoContrasenaHash;
      this._esContrasenaTemporal = true;
    }

    this._nombreCompleto = params.nombreCompleto.trim();
    this._documentoIdentidad = params.documentoIdentidad.trim();
    this._correo = params.correo.trim().toLowerCase();
    this._telefono = params.telefono ? params.telefono.trim() : null;
    this._roles = [...params.roles];

    if (params.firma !== undefined) {
      this._firmaUrl = params.firma ? params.firma.urlOrBase64 : null;
    }
  }

  public setStatus(nuevoEstado: boolean): void {
    this._estado = nuevoEstado;
  }
}