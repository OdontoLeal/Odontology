import { OneTimeTokenVO } from './one-time-token.vo';

export interface RoleDTO {
  id_rol: number;
  codigo?: string;
  nombre_rol: string;
  descripcion?: string;
  permisos?: string[];
  es_inicial?: boolean;
}

export interface UserRoleAssignmentDTO {
  idRol: number;
  codigo?: string;
  nombreRol: string;
  descripcion?: string;
  permisos?: string[];
  es_inicial?: boolean;
  estadoAsignacion: boolean;
}

export interface UserWithRolesDomainDTO {
  idUsuario: number;
  nombreCompleto: string;
  documentoIdentidad: string;
  correo: string;
  telefono: string | null;
  estado: boolean;
  esContrasenaTemporal?: boolean;
  firmaUrl?: string | null;
  roles: UserRoleAssignmentDTO[];
}

export interface UserAuthCredentialsRecord extends UserWithRolesDomainDTO {
  contrasenaHash: string;
  esContrasenaTemporal: boolean;
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
}

export interface CreateUserPersistenceDTO {
  nombreCompleto: string;
  documentoIdentidad: string;
  correo: string;
  telefono?: string;
  contrasenaHash: string;
  esContrasenaTemporal?: boolean;
  firmaUrl?: string | null;
  rolesIds: number[];
}

export interface UpdateUserPersistenceDTO {
  idUsuario: number;
  nombreCompleto: string;
  documentoIdentidad: string;
  correo: string;
  telefono?: string | null;
  contrasenaHash?: string;
  esContrasenaTemporal?: boolean;
  firmaUrl?: string | null;
  rolesIds: number[];
}

export interface SearchUsersFilterDTO {
  documento?: string;
  nombre?: string;
  idRol?: number;
  codigoRol?: string;
  estado?: boolean;
}

export interface ActiveAppointmentSummaryDTO {
  idCita: number;
  titulo: string;
  estado: 'Solicitada' | 'Confirmada' | 'En consulta';
  fechaInicio?: Date;
}

export interface LoginLockoutRecordDTO {
  correo: string;
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
}

export interface SessionDraftDTO {
  idUsuario: number;
  formularioId: string;
  datosBorrador: Record<string, unknown>;
  fechaGuardado: Date;
}

export interface IUserRepository {
  // Gestión de Roles (RF-USR-007, RF-USR-010, RF-USR-011)
  createRole(
    nombreRol: string,
    metadata?: { codigo: string; descripcion: string; permisos: string[] }
  ): Promise<RoleDTO>;
  updateRole?(
    idRol: number,
    data: { nombreRol: string; descripcion: string; permisos: string[] }
  ): Promise<RoleDTO>;
  findAllRoles(): Promise<RoleDTO[]>;
  findRoleById?(idRol: number): Promise<RoleDTO | null>;
  findRoleByCodeOrName?(codigo?: string, nombreRol?: string): Promise<RoleDTO | null>;
  countUsersByRole?(idRol: number): Promise<number>;
  deleteRole(idRol: number): Promise<boolean>;

  // Gestión de Usuarios (RF-USR-001, RF-USR-002, RF-USR-003, RF-USR-004)
  createUser(dto: CreateUserPersistenceDTO): Promise<UserWithRolesDomainDTO>;
  updateUser?(dto: UpdateUserPersistenceDTO): Promise<UserWithRolesDomainDTO>;
  findById(idUsuario: number): Promise<UserWithRolesDomainDTO | null>;
  findByDocument?(documentoIdentidad: string): Promise<UserWithRolesDomainDTO | null>;
  findByEmail?(correo: string): Promise<UserWithRolesDomainDTO | null>;
  searchUsers(filters: SearchUsersFilterDTO): Promise<UserWithRolesDomainDTO[]>;
  updateStatus(idUsuario: number, nuevoEstado: boolean): Promise<UserWithRolesDomainDTO | null>;
  countActiveAdmins?(excludeUserId?: number): Promise<number>;
  findActiveAppointmentsByProfessional?(idUsuario: number): Promise<ActiveAppointmentSummaryDTO[]>;

  // Autenticación, Sesiones y Recuperación de Contraseña (RF-USR-005, RF-USR-008, RF-USR-009)
  findAuthCredentialsByEmail?(correo: string): Promise<UserAuthCredentialsRecord | null>;
  getLoginLockoutByEmail?(correo: string): Promise<LoginLockoutRecordDTO | null>;
  saveLoginLockoutByEmail?(record: LoginLockoutRecordDTO): Promise<void>;
  updatePassword?(
    idUsuario: number,
    nuevoHash: string,
    esContrasenaTemporal: boolean
  ): Promise<void>;
  invalidateUserSessions?(idUsuario: number): Promise<void>;

  // Enlaces de un solo uso para recuperación (RF-USR-009)
  invalidatePreviousRecoveryTokens?(idUsuario: number): Promise<void>;
  saveRecoveryToken?(tokenVo: OneTimeTokenVO): Promise<void>;
  findRecoveryToken?(token: string): Promise<OneTimeTokenVO | null>;
  updateRecoveryToken?(tokenVo: OneTimeTokenVO): Promise<void>;
}

export interface IPasswordHasher {
  hash(plainText: string): Promise<string>;
  compare(plainText: string, hash: string): Promise<boolean>;
}

export interface IDraftStorageService {
  saveDraft(draft: SessionDraftDTO): Promise<void>;
  getDraftByUser(idUsuario: number): Promise<SessionDraftDTO[]>;
  deleteDraft(idUsuario: number, formularioId: string): Promise<void>;
}

export interface IMailerPort {
  sendPasswordRecoveryEmail(params: {
    to: string;
    nombreCompleto: string;
    recoveryLink: string;
    expiresInMinutes: number;
  }): Promise<{ messageId?: string; previewUrl?: string | null } | void>;
}

export interface IAuditLoggerPort {
  log(entry: {
    usuario: string;
    accion: string;
    registroAfectado: string;
    valorAnterior?: unknown;
    valorNuevo?: unknown;
  }): Promise<void>;
}