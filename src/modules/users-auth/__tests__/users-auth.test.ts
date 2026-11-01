// src/modules/users-auth/__tests__/users-auth.test.ts
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { UserEntity } from '../domain/user.entity';
import { RoleEntity, INITIAL_ROLE_CODES } from '../domain/role.entity';
import { OneTimeTokenVO } from '../domain/one-time-token.vo';
import {
  IUserRepository,
  IPasswordHasher,
  IAuditLoggerPort,
  IDraftStorageService,
  IMailerPort,
  RoleDTO,
  UserWithRolesDomainDTO,
  UserAuthCredentialsRecord,
  LoginLockoutRecordDTO,
  CreateUserPersistenceDTO,
  UpdateUserPersistenceDTO,
  SearchUsersFilterDTO,
  SessionDraftDTO,
} from '../domain/user.repository.interface';

import { CreateUserUseCase } from '../application/create-user.use-case';
import { UpdateUserUseCase } from '../application/update-user.use-case';
import { ToggleUserStatusUseCase } from '../application/toggle-user-status.use-case';
import { SearchUsersUseCase } from '../application/search-users.use-case';
import { AuthenticateUserUseCase } from '../application/authenticate-user.use-case';
import { CreateRoleUseCase } from '../application/create-role.use-case';
import { UpdateRoleUseCase } from '../application/update-role.use-case';
import { DeleteRoleUseCase } from '../application/delete-role.use-case';
import { RecoverPasswordUseCase } from '../application/recover-password.use-case';
import { CloseSessionUseCase } from '../application/close-session.use-case';

// Repositorio en memoria para el módulo de Usuarios y Autenticación
class InMemoryUserRepository implements IUserRepository {
  public roles: Map<number, RoleDTO> = new Map();
  public users: Map<number, UserAuthCredentialsRecord> = new Map();
  public lockouts: Map<string, LoginLockoutRecordDTO> = new Map();
  public tokens: Map<string, OneTimeTokenVO> = new Map();
  public drafts: Map<string, SessionDraftDTO> = new Map();

  private roleIdSeq = 1;
  private userIdSeq = 1;

  async createRole(
    nombreRol: string,
    metadata?: { codigo: string; descripcion: string; permisos: string[] }
  ): Promise<RoleDTO> {
    const id = this.roleIdSeq++;
    const role: RoleDTO = {
      id_rol: id,
      codigo: metadata?.codigo ?? `ROL-${id}`,
      nombre_rol: nombreRol,
      descripcion: metadata?.descripcion ?? '',
      permisos: metadata?.permisos ?? [],
    };
    this.roles.set(id, role);
    return role;
  }

  async updateRole(
    idRol: number,
    data: { nombreRol: string; descripcion: string; permisos: string[] }
  ): Promise<RoleDTO> {
    const existing = this.roles.get(idRol);
    if (!existing) throw new Error(`Rol con ID ${idRol} no encontrado.`);
    existing.nombre_rol = data.nombreRol;
    existing.descripcion = data.descripcion;
    existing.permisos = data.permisos;
    return existing;
  }

  async findAllRoles(): Promise<RoleDTO[]> {
    return Array.from(this.roles.values());
  }

  async findRoleById(idRol: number): Promise<RoleDTO | null> {
    return this.roles.get(idRol) ?? null;
  }

  async countUsersByRole(idRol: number): Promise<number> {
    return Array.from(this.users.values()).filter((u) =>
      u.roles.some((r) => r.idRol === idRol)
    ).length;
  }

  async deleteRole(idRol: number): Promise<boolean> {
    return this.roles.delete(idRol);
  }

  async createUser(dto: CreateUserPersistenceDTO): Promise<UserWithRolesDomainDTO> {
    const id = this.userIdSeq++;
    const assignedRoles = dto.rolesIds.map((rId) => {
      const r = this.roles.get(rId);
      return {
        idRol: rId,
        codigo: r?.codigo,
        nombreRol: r?.nombre_rol ?? 'Rol',
        descripcion: r?.descripcion,
        permisos: r?.permisos ?? [],
        estadoAsignacion: true,
      };
    });

    const record: UserAuthCredentialsRecord = {
      idUsuario: id,
      nombreCompleto: dto.nombreCompleto,
      documentoIdentidad: dto.documentoIdentidad,
      correo: dto.correo.toLowerCase(),
      telefono: dto.telefono ?? null,
      contrasenaHash: dto.contrasenaHash,
      esContrasenaTemporal: dto.esContrasenaTemporal ?? true,
      estado: true,
      firmaUrl: dto.firmaUrl ?? null,
      intentosFallidos: 0,
      bloqueadoHasta: null,
      roles: assignedRoles,
    };
    this.users.set(id, record);
    return record;
  }

  async updateUser(dto: UpdateUserPersistenceDTO): Promise<UserWithRolesDomainDTO> {
    const existing = this.users.get(dto.idUsuario);
    if (!existing) throw new Error(`Usuario ${dto.idUsuario} no encontrado.`);

    existing.nombreCompleto = dto.nombreCompleto;
    existing.documentoIdentidad = dto.documentoIdentidad;
    existing.correo = dto.correo.toLowerCase();
    existing.telefono = dto.telefono ?? null;
    if (dto.contrasenaHash) existing.contrasenaHash = dto.contrasenaHash;
    if (dto.esContrasenaTemporal !== undefined) existing.esContrasenaTemporal = dto.esContrasenaTemporal;
    if (dto.firmaUrl !== undefined) existing.firmaUrl = dto.firmaUrl;

    existing.roles = dto.rolesIds.map((rId) => {
      const r = this.roles.get(rId);
      return {
        idRol: rId,
        codigo: r?.codigo,
        nombreRol: r?.nombre_rol ?? 'Rol',
        descripcion: r?.descripcion,
        permisos: r?.permisos ?? [],
        estadoAsignacion: true,
      };
    });

    return existing;
  }

  async findById(idUsuario: number): Promise<UserWithRolesDomainDTO | null> {
    return this.users.get(idUsuario) ?? null;
  }

  async findByDocument(documentoIdentidad: string): Promise<UserWithRolesDomainDTO | null> {
    return (
      Array.from(this.users.values()).find(
        (u) => u.documentoIdentidad === documentoIdentidad
      ) ?? null
    );
  }

  async findByEmail(correo: string): Promise<UserWithRolesDomainDTO | null> {
    return (
      Array.from(this.users.values()).find(
        (u) => u.correo.toLowerCase() === correo.toLowerCase()
      ) ?? null
    );
  }

  async searchUsers(filters: SearchUsersFilterDTO): Promise<UserWithRolesDomainDTO[]> {
    return Array.from(this.users.values()).filter((u) => {
      if (filters.documento && u.documentoIdentidad !== filters.documento) return false;
      if (filters.nombre) {
        const normFilter = filters.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const normName = u.nombreCompleto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!normName.includes(normFilter)) return false;
      }
      if (filters.estado !== undefined && u.estado !== filters.estado) return false;
      if (filters.codigoRol) {
        if (!u.roles.some((r) => r.codigo === filters.codigoRol)) return false;
      }
      return true;
    });
  }

  async updateStatus(idUsuario: number, nuevoEstado: boolean): Promise<UserWithRolesDomainDTO | null> {
    const existing = this.users.get(idUsuario);
    if (!existing) return null;
    existing.estado = nuevoEstado;
    return existing;
  }

  async countActiveAdmins(excludeUserId?: number): Promise<number> {
    return Array.from(this.users.values()).filter((u) => {
      if (!u.estado) return false;
      if (excludeUserId && u.idUsuario === excludeUserId) return false;
      return u.roles.some((r) => r.codigo === 'ROL-ADM');
    }).length;
  }

  async findActiveAppointmentsByProfessional(idUsuario: number): Promise<any[]> {
    return []; // Para simulación, configurable en test si se requiere
  }

  async findAuthCredentialsByEmail(correo: string): Promise<UserAuthCredentialsRecord | null> {
    return (
      Array.from(this.users.values()).find(
        (u) => u.correo.toLowerCase() === correo.toLowerCase()
      ) ?? null
    );
  }

  async getLoginLockoutByEmail(correo: string): Promise<LoginLockoutRecordDTO | null> {
    return this.lockouts.get(correo.toLowerCase()) ?? null;
  }

  async saveLoginLockoutByEmail(record: LoginLockoutRecordDTO): Promise<void> {
    this.lockouts.set(record.correo.toLowerCase(), record);
  }

  async updatePassword(
    idUsuario: number,
    nuevoHash: string,
    esContrasenaTemporal: boolean
  ): Promise<void> {
    const u = this.users.get(idUsuario);
    if (u) {
      u.contrasenaHash = nuevoHash;
      u.esContrasenaTemporal = esContrasenaTemporal;
      u.intentosFallidos = 0;
      u.bloqueadoHasta = null;
    }
  }

  async invalidatePreviousRecoveryTokens(idUsuario: number): Promise<void> {
    for (const [key, vo] of this.tokens.entries()) {
      if (vo.idUsuario === idUsuario) {
        this.tokens.delete(key);
      }
    }
  }

  async saveRecoveryToken(tokenVo: OneTimeTokenVO): Promise<void> {
    this.tokens.set(tokenVo.token, tokenVo);
  }

  async findRecoveryToken(token: string): Promise<OneTimeTokenVO | null> {
    return this.tokens.get(token) ?? null;
  }

  async updateRecoveryToken(tokenVo: OneTimeTokenVO): Promise<void> {
    this.tokens.set(tokenVo.token, tokenVo);
  }
}

class MockPasswordHasher implements IPasswordHasher {
  async hash(plainText: string): Promise<string> {
    return `hashed_${plainText}`;
  }
  async compare(plainText: string, hash: string): Promise<boolean> {
    return hash === `hashed_${plainText}` || hash === plainText;
  }
}

class MockAuditLogger implements IAuditLoggerPort {
  public logs: any[] = [];
  async log(entry: any): Promise<void> {
    this.logs.push(entry);
  }
}

class MockMailer implements IMailerPort {
  public recoveryMails: any[] = [];
  async sendPasswordRecoveryEmail(params: any): Promise<void> {
    this.recoveryMails.push(params);
  }
}

class MockDraftStorage implements IDraftStorageService {
  public drafts: SessionDraftDTO[] = [];
  async saveDraft(draft: SessionDraftDTO): Promise<void> {
    this.drafts.push(draft);
  }
  async getDraftByUser(idUsuario: number): Promise<SessionDraftDTO[]> {
    return this.drafts.filter((d) => d.idUsuario === idUsuario);
  }
  async deleteDraft(idUsuario: number, formularioId: string): Promise<void> {
    this.drafts = this.drafts.filter(
      (d) => !(d.idUsuario === idUsuario && d.formularioId === formularioId)
    );
  }
}

describe('MÓDULO A: Gestión de Usuarios y Roles (RF-USR-001 a RF-USR-011)', () => {
  let repo: InMemoryUserRepository;
  let hasher: MockPasswordHasher;
  let auditLogger: MockAuditLogger;
  let mailer: MockMailer;
  let draftStorage: MockDraftStorage;

  let rolAdmId: number;
  let rolOdoId: number;
  let rolCoaId: number;
  let rolPacId: number;

  beforeEach(async () => {
    repo = new InMemoryUserRepository();
    hasher = new MockPasswordHasher();
    auditLogger = new MockAuditLogger();
    mailer = new MockMailer();
    draftStorage = new MockDraftStorage();

    // Crear los 6 roles iniciales del sistema (ERS sección 2.2)
    const rAdm = await repo.createRole('Administrador del sistema', {
      codigo: 'ROL-ADM',
      descripcion: 'Acceso a gestión de usuarios y roles',
      permisos: ['RF-USR-001', 'RF-USR-002', 'RF-USR-003', 'RF-USR-004', 'RF-USR-007', 'RF-USR-010', 'RF-USR-011'],
    });
    rolAdmId = rAdm.id_rol;

    const rOdo = await repo.createRole('Odontólogo General', {
      codigo: 'ROL-ODO',
      descripcion: 'Odontólogo tratante',
      permisos: ['RF-AGE-008', 'RF-AGE-009', 'RF-HCL-005', 'RF-HCL-006', 'RF-HCL-007', 'RF-HCL-008', 'RF-HCL-009'],
    });
    rolOdoId = rOdo.id_rol;

    const rCoa = await repo.createRole('Coordinadora de Agendamiento', {
      codigo: 'ROL-COA',
      descripcion: 'Gestión de citas y solicitudes',
      permisos: ['RF-AGE-001', 'RF-AGE-002', 'RF-AGE-005', 'RF-AGE-006', 'RF-AGE-007', 'RF-AGE-008', 'RF-HCL-001', 'RF-HCL-003', 'RF-HCL-004'],
    });
    rolCoaId = rCoa.id_rol;

    const rPac = await repo.createRole('Paciente', {
      codigo: 'ROL-PAC',
      descripcion: 'Usuario externo sin cuenta interna',
      permisos: ['RF-USR-006', 'RF-AGE-003'],
    });
    rolPacId = rPac.id_rol;
  });

  it('RF-USR-001: Crear usuario con validaciones de documento, teléfono, correo y contraseña temporal', async () => {
    const useCase = new CreateUserUseCase(repo, hasher, auditLogger);

    const result = await useCase.execute({
      ejecutadoPorUsuario: 'Dr. Eduar Leal Álvarez',
      nombreCompleto: 'Daniela Guerrero',
      documentoIdentidad: '1076543210',
      correo: 'agenda@odontoleal.com',
      telefono: '3201112233',
      contrasenaTemporal: 'Temporal123',
      rolesIds: [rolCoaId],
    });

    assert.ok(result.data.idUsuario);
    assert.strictEqual(result.data.nombreCompleto, 'Daniela Guerrero');
    assert.strictEqual(result.data.documentoIdentidad, '1076543210');
    assert.strictEqual(result.data.estado, true);
    assert.strictEqual(result.data.roles[0].codigo, 'ROL-COA');
  });

  it('RF-USR-001: Rechazar creación de usuario con rol ROL-PAC (Regla ERS sección 2.2)', async () => {
    const useCase = new CreateUserUseCase(repo, hasher, auditLogger);

    await assert.rejects(
      async () => {
        await useCase.execute({
          ejecutadoPorUsuario: 'Dr. Eduar Leal Álvarez',
          nombreCompleto: 'Paciente Con Cuenta',
          documentoIdentidad: '1020304050',
          correo: 'paciente@test.com',
          contrasenaTemporal: 'Temporal123',
          rolesIds: [rolPacId],
        });
      },
      /ROL-PAC no puede asignarse a ninguna cuenta/
    );
  });

  it('RF-USR-001: Rechazar creación con documento duplicado o correo duplicado', async () => {
    const useCase = new CreateUserUseCase(repo, hasher, auditLogger);

    await useCase.execute({
      ejecutadoPorUsuario: 'Dr. Eduar Leal',
      nombreCompleto: 'Primer Usuario',
      documentoIdentidad: '1122334455',
      correo: 'duplicado@odontoleal.com',
      contrasenaTemporal: 'Temporal123',
      rolesIds: [rolCoaId],
    });

    // Mismo documento
    await assert.rejects(
      async () => {
        await useCase.execute({
          ejecutadoPorUsuario: 'Dr. Eduar Leal',
          nombreCompleto: 'Segundo Usuario',
          documentoIdentidad: '1122334455',
          correo: 'otro@odontoleal.com',
          contrasenaTemporal: 'Temporal123',
          rolesIds: [rolCoaId],
        });
      },
      /ya está registrado/
    );

    // Mismo correo
    await assert.rejects(
      async () => {
        await useCase.execute({
          ejecutadoPorUsuario: 'Dr. Eduar Leal',
          nombreCompleto: 'Tercer Usuario',
          documentoIdentidad: '9988776655',
          correo: 'duplicado@odontoleal.com',
          contrasenaTemporal: 'Temporal123',
          rolesIds: [rolCoaId],
        });
      },
      /ya está registrado/
    );
  });

  it('RF-USR-002: Editar usuario modificando datos y asignación de roles', async () => {
    const createUseCase = new CreateUserUseCase(repo, hasher, auditLogger);
    const updateUseCase = new UpdateUserUseCase(repo, hasher, auditLogger);

    const created = await createUseCase.execute({
      ejecutadoPorUsuario: 'Dr. Leal',
      nombreCompleto: 'Milena Torres',
      documentoIdentidad: '1099887711',
      correo: 'milena@odontoleal.com',
      telefono: '3009998877',
      contrasenaTemporal: 'Temporal123',
      rolesIds: [rolCoaId],
    });

    const updated = await updateUseCase.execute({
      ejecutadoPorUsuario: 'Dr. Leal',
      idUsuario: created.data.idUsuario,
      nombreCompleto: 'Milena Torres Actualizada',
      documentoIdentidad: '1099887711',
      correo: 'milena.torres@odontoleal.com',
      telefono: '3001112233',
      rolesIds: [rolCoaId, rolOdoId],
    });

    assert.strictEqual(updated.data.nombreCompleto, 'Milena Torres Actualizada');
    assert.strictEqual(updated.data.correo, 'milena.torres@odontoleal.com');
    assert.strictEqual(updated.data.roles.length, 2);
  });

  it('RF-USR-003: Activar e inactivar usuario impidiendo inactivar al único administrador activo', async () => {
    const createUseCase = new CreateUserUseCase(repo, hasher, auditLogger);
    const toggleUseCase = new ToggleUserStatusUseCase(repo, auditLogger);

    // Crear único administrador
    const adminUser = await createUseCase.execute({
      ejecutadoPorUsuario: 'Sistema',
      nombreCompleto: 'Dr. Eduar Leal',
      documentoIdentidad: '1098765432',
      correo: 'admin@odontoleal.com',
      contrasenaTemporal: 'Admin12345',
      rolesIds: [rolAdmId],
    });

    // Intentar inactivar al único administrador debe ser rechazado
    await assert.rejects(
      async () => {
        await toggleUseCase.execute({
          ejecutadoPorUsuario: 'Dr. Eduar Leal',
          idUsuario: adminUser.data.idUsuario,
          nuevoEstado: false,
        });
      },
      /No se puede inactivar al único usuario activo con rol Administrador/
    );

    // Crear segundo usuario (asistente) y validar activación/inactivación
    const coaUser = await createUseCase.execute({
      ejecutadoPorUsuario: 'Dr. Eduar Leal',
      nombreCompleto: 'Asistente Temporal',
      documentoIdentidad: '1033445566',
      correo: 'asistente@odontoleal.com',
      contrasenaTemporal: 'Asist12345',
      rolesIds: [rolCoaId],
    });

    const inactRes = await toggleUseCase.execute({
      ejecutadoPorUsuario: 'Dr. Eduar Leal',
      idUsuario: coaUser.data.idUsuario,
      nuevoEstado: false,
    });
    assert.strictEqual(inactRes.data.estado, false);

    const actRes = await toggleUseCase.execute({
      ejecutadoPorUsuario: 'Dr. Eduar Leal',
      idUsuario: coaUser.data.idUsuario,
      nuevoEstado: true,
    });
    assert.strictEqual(actRes.data.estado, true);
  });

  it('RF-USR-004: Buscar usuarios por coincidencia exacta de documento o parcial sin tildes/mayúsculas', async () => {
    const createUseCase = new CreateUserUseCase(repo, hasher, auditLogger);
    const searchUseCase = new SearchUsersUseCase(repo);

    await createUseCase.execute({
      ejecutadoPorUsuario: 'Admin',
      nombreCompleto: 'Natalia Díaz Rodríguez',
      documentoIdentidad: '1087654321',
      correo: 'dra.diaz@odontoleal.com',
      contrasenaTemporal: 'Clave12345',
      rolesIds: [rolOdoId],
    });

    // Búsqueda parcial sin tildes ni mayúsculas ("diaz")
    const searchByPartial = await searchUseCase.execute({ nombre: 'diaz' });
    assert.strictEqual(searchByPartial.data.length, 1);
    assert.strictEqual(searchByPartial.data[0].documentoIdentidad, '1087654321');

    // Búsqueda exacta por documento
    const searchByDoc = await searchUseCase.execute({ documento: '1087654321' });
    assert.strictEqual(searchByDoc.data.length, 1);

    // Sin coincidencias
    const searchEmpty = await searchUseCase.execute({ nombre: 'NombreInexistente' });
    assert.strictEqual(searchEmpty.data.length, 0);
    assert.strictEqual(searchEmpty.message, 'ninguna coincidencia encontrada');
  });

  it('RF-USR-005: Autenticar usuario con credenciales válidas y detección de contraseña temporal', async () => {
    const createUseCase = new CreateUserUseCase(repo, hasher, auditLogger);
    const authUseCase = new AuthenticateUserUseCase(repo, hasher, auditLogger);

    await createUseCase.execute({
      ejecutadoPorUsuario: 'Admin',
      nombreCompleto: 'Daniela Guerrero',
      documentoIdentidad: '1076543210',
      correo: 'daniela.auth@odontoleal.com',
      contrasenaTemporal: 'Temporal123',
      rolesIds: [rolCoaId],
    });

    // Primer login: detecta contraseña temporal
    const authResult = await authUseCase.execute({
      correo: 'daniela.auth@odontoleal.com',
      contrasena: 'Temporal123',
    });

    assert.strictEqual(authResult.requiereCambioContrasena, true);

    // Realizar cambio de contraseña obligatorio
    const changeResult = await authUseCase.execute({
      correo: 'daniela.auth@odontoleal.com',
      contrasena: 'Temporal123',
      nuevaContrasena: 'Definitiva2026',
      confirmacionNuevaContrasena: 'Definitiva2026',
    });

    assert.strictEqual(changeResult.requiereCambioContrasena, false);
    assert.ok(changeResult.permisos?.includes('RF-AGE-001'));
  });

  it('RF-USR-005: Bloqueo de 15 minutos tras 5 intentos fallidos consecutivos', async () => {
    const authUseCase = new AuthenticateUserUseCase(repo, hasher, auditLogger);
    const targetEmail = 'ataque.fuerza.bruta@odontoleal.com';
    AuthenticateUserUseCase.clearLockoutForEmail(targetEmail);

    // 5 intentos fallidos
    for (let i = 1; i <= 5; i++) {
      await assert.rejects(
        async () => {
          await authUseCase.execute({
            correo: targetEmail,
            contrasena: `IntentoErroneo_${i}`,
          });
        },
        /Correo o contraseña incorrectos|Demasiados intentos fallidos/
      );
    }

    // El 6to intento debe ser bloqueado con mensaje estandarizado de 15 minutos
    await assert.rejects(
      async () => {
        await authUseCase.execute({
          correo: targetEmail,
          contrasena: 'CualquierContrasena',
        });
      },
      /Demasiados intentos fallidos\. Intente de nuevo en 15 minutos/
    );
  });

  it('RF-USR-007: Crear rol configurable sin modificar código y rechazar permisos clínicos', async () => {
    const createRole = new CreateRoleUseCase(repo, auditLogger);

    // Creación válida de rol administrativo personalizado
    const customRole = await createRole.execute({
      ejecutadoPorUsuario: 'Admin',
      codigo: 'ROL-AUDIT',
      nombreRol: 'Auditor Administrativo',
      descripcion: 'Auditoría externa de agenda',
      permisos: ['RF-AGE-008', 'RF-HCL-004'],
    });

    assert.strictEqual(customRole.data.codigo, 'ROL-AUDIT');
    assert.strictEqual(customRole.data.nombre_rol, 'Auditor Administrativo');

    // Intento de asignar permiso clínico a rol no profesional -> Rechazado (RF-USR-007)
    await assert.rejects(
      async () => {
        await createRole.execute({
          ejecutadoPorUsuario: 'Admin',
          codigo: 'ROL-TESTCLINIC',
          nombreRol: 'Rol Clínico Inválido',
          permisos: ['RF-HCL-005'],
        });
      },
      /No está permitido asignar el permiso clínico/
    );
  });

  it('RF-USR-008 & RF-USR-009: Recuperar contraseña con token de un solo uso (30 min) y borrador de sesión', async () => {
    const createUseCase = new CreateUserUseCase(repo, hasher, auditLogger);
    const recoverUseCase = new RecoverPasswordUseCase(repo, hasher, mailer, auditLogger);
    const closeSessionUseCase = new CloseSessionUseCase(repo, draftStorage, auditLogger);

    const user = await createUseCase.execute({
      ejecutadoPorUsuario: 'Admin',
      nombreCompleto: 'Usuario Recuperacion',
      documentoIdentidad: '7766554433',
      correo: 'recuperar@odontoleal.com',
      contrasenaTemporal: 'Original123',
      rolesIds: [rolCoaId],
    });

    // Guardar borrador al cerrar sesión por inactividad
    await closeSessionUseCase.execute({
      idUsuario: user.data.idUsuario,
      motivo: 'INACTIVITY_TIMEOUT',
      tieneCambiosSinGuardar: true,
      borrador: {
        formularioId: 'form_agendamiento',
        datosBorrador: { paciente: 'Pedro Perez', hora: '10:00' },
      },
    });

    const drafts = await draftStorage.getDraftByUser(user.data.idUsuario);
    assert.strictEqual(drafts.length, 1);
    assert.strictEqual(drafts[0].formularioId, 'form_agendamiento');

    // Solicitar enlace de recuperación
    const reqLink = await recoverUseCase.requestRecoveryLink({
      correo: 'recuperar@odontoleal.com',
    });
    assert.strictEqual(reqLink.message, RecoverPasswordUseCase.GENERIC_RESPONSE_MESSAGE);
    assert.strictEqual(mailer.recoveryMails.length, 1);

    const tokenVo = Array.from(repo.tokens.values())[0];
    assert.ok(tokenVo);
    assert.strictEqual(tokenVo.isExpired(), false);

    // Cambiar contraseña con el enlace
    const resetRes = await recoverUseCase.resetPassword({
      token: tokenVo.token,
      nuevaContrasena: 'NuevaSegura2026',
      confirmacionContrasena: 'NuevaSegura2026',
    });
    assert.ok(resetRes.message.includes('Contraseña restablecida exitosamente'));

    // Segundo uso del token debe fallar (token de un solo uso)
    await assert.rejects(
      async () => {
        await recoverUseCase.resetPassword({
          token: tokenVo.token,
          nuevaContrasena: 'OtraClave2026',
          confirmacionContrasena: 'OtraClave2026',
        });
      },
      /El enlace no es válido o ya venció/
    );
  });

  it('RF-USR-010 & RF-USR-011: Editar y eliminar roles protegiendo roles iniciales y roles asignados', async () => {
    const createRole = new CreateRoleUseCase(repo, auditLogger);
    const updateRole = new UpdateRoleUseCase(repo, auditLogger);
    const deleteRole = new DeleteRoleUseCase(repo, auditLogger);
    const createUser = new CreateUserUseCase(repo, hasher, auditLogger);

    // 1. Prohibido eliminar cualquiera de los 6 roles iniciales
    await assert.rejects(
      async () => {
        await deleteRole.execute({ idRol: rolAdmId });
      },
      /pertenece a la configuración inicial del sistema y no puede ser eliminado/
    );

    // 2. Crear rol temporal y asignarlo a un usuario
    const tempRole = await createRole.execute({
      nombreRol: 'Rol Asignado Temp',
      codigo: 'ROL-ASIGN',
      permisos: ['RF-AGE-008'],
    });

    await createUser.execute({
      ejecutadoPorUsuario: 'Admin',
      nombreCompleto: 'Usuario Rol Temp',
      documentoIdentidad: '5544332211',
      correo: 'roltemp@odontoleal.com',
      contrasenaTemporal: 'Clave12345',
      rolesIds: [tempRole.data.id_rol],
    });

    // Intento de eliminar rol asignado debe fallar
    await assert.rejects(
      async () => {
        await deleteRole.execute({ idRol: tempRole.data.id_rol });
      },
      /No se puede eliminar el rol porque está asignado/
    );

    // 3. Crear rol no asignado y eliminarlo exitosamente
    const unassignedRole = await createRole.execute({
      nombreRol: 'Rol Sin Asignar',
      codigo: 'ROL-LIBRE',
      permisos: ['RF-AGE-008'],
    });

    const delRes = await deleteRole.execute({ idRol: unassignedRole.data.id_rol });
    assert.strictEqual(delRes.eliminado, true);
  });
});
