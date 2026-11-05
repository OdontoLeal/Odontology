// src/modules/users-auth/infrastructure/users-auth.controller.ts
import { Request, Response } from 'express';
import { handleHttpError } from '../../../shared/infrastructure/http/http-error.handler';
import { AuthenticateUserUseCase } from '../application/authenticate-user.use-case';
import { CloseSessionUseCase } from '../application/close-session.use-case';
import { CreateRoleUseCase } from '../application/create-role.use-case';
import { CreateUserUseCase } from '../application/create-user.use-case';
import { DeleteRoleUseCase } from '../application/delete-role.use-case';
import { RecoverPasswordUseCase } from '../application/recover-password.use-case';
import { SearchUsersUseCase } from '../application/search-users.use-case';
import { ToggleUserStatusUseCase } from '../application/toggle-user-status.use-case';
import { UpdateRoleUseCase } from '../application/update-role.use-case';
import { UpdateUserUseCase } from '../application/update-user.use-case';
import { IAuditLoggerPort } from '../domain/user.repository.interface';
import { DraftStorageService } from './draft-storage.service';
import { HybridPasswordHasherService } from './password-hasher.service';
import { MailerService } from '../../../shared/infrastructure/mail/mailer.service';
import { envConfig } from '../../../app/config/env.config';
import { UserRepository } from './user.repository';
import { JwtTokenService } from '../../../shared/infrastructure/security/token.service';
import { UsersAuditAdapter } from '../../../shared/infrastructure/audit/users-audit.adapter';
import { getSessionUser, revokeToken } from '../../../shared/infrastructure/security/access-control';

const SESSION_HOURS = 8;

/** Actor de las operaciones: siempre el usuario de la sesión, nunca el cuerpo de la petición. */
const actorOf = (req: Request): string => getSessionUser(req)?.correo ?? 'Anónimo';

export class UsersAuthController {
  private readonly createRoleUseCase: CreateRoleUseCase;
  private readonly updateRoleUseCase: UpdateRoleUseCase;
  private readonly deleteRoleUseCase: DeleteRoleUseCase;
  private readonly createUserUseCase: CreateUserUseCase;
  private readonly updateUserUseCase: UpdateUserUseCase;
  private readonly toggleUserStatusUseCase: ToggleUserStatusUseCase;
  private readonly searchUsersUseCase: SearchUsersUseCase;
  private readonly authenticateUserUseCase: AuthenticateUserUseCase;
  private readonly closeSessionUseCase: CloseSessionUseCase;
  private readonly recoverPasswordUseCase: RecoverPasswordUseCase;

  constructor(
    private readonly userRepo: UserRepository,
    private readonly draftStorage = new DraftStorageService(),
    private readonly passwordHasher = new HybridPasswordHasherService(),
    private readonly mailerService = new MailerService(),
    private readonly audit: IAuditLoggerPort = new UsersAuditAdapter()
  ) {
    this.createRoleUseCase = new CreateRoleUseCase(this.userRepo, this.audit);
    this.updateRoleUseCase = new UpdateRoleUseCase(this.userRepo, this.audit);
    this.deleteRoleUseCase = new DeleteRoleUseCase(this.userRepo, this.audit);
    this.createUserUseCase = new CreateUserUseCase(this.userRepo, this.passwordHasher, this.audit);
    // Antes no recibía el hasher: la nueva contraseña temporal se guardaba sin cifrar.
    this.updateUserUseCase = new UpdateUserUseCase(this.userRepo, this.passwordHasher, this.audit);
    this.toggleUserStatusUseCase = new ToggleUserStatusUseCase(this.userRepo, this.audit);
    this.searchUsersUseCase = new SearchUsersUseCase(this.userRepo);
    this.authenticateUserUseCase = new AuthenticateUserUseCase(this.userRepo, this.passwordHasher, this.audit);
    this.closeSessionUseCase = new CloseSessionUseCase(this.userRepo, this.draftStorage, this.audit);
    this.recoverPasswordUseCase = new RecoverPasswordUseCase(
      this.userRepo,
      this.passwordHasher,
      this.mailerService,
      this.audit
    );
  }

  // RF-USR-007: Crear rol
  createRole = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
        res.status(400).json({ message: 'El cuerpo de la solicitud es obligatorio y no puede estar vacío.' });
        return;
      }
      const rawCodigo = req.body.codigo || req.body.codigo_rol;
      const rawNombreRol = req.body?.nombreRol || req.body?.nombre_rol;
      const rawDescripcion = req.body?.descripcion ?? '';
      const rawPermisos = req.body?.permisos;
      const ejecutadoPorUsuario = actorOf(req);

      if (!rawCodigo || typeof rawCodigo !== 'string' || !rawCodigo.trim()) {
        res.status(400).json({ message: "El campo 'codigo' es obligatorio." });
        return;
      }
      if (!rawNombreRol || typeof rawNombreRol !== 'string' || !rawNombreRol.trim()) {
        res.status(400).json({ message: "El campo 'nombreRol' es obligatorio." });
        return;
      }
      const result = await this.createRoleUseCase.execute({
        codigo: rawCodigo.trim(),
        nombreRol: rawNombreRol.trim(),
        descripcion: rawDescripcion,
        permisos: rawPermisos,
        ejecutadoPorUsuario,
      });
      res.status(201).json(result);
    } catch (error: any) {
      handleHttpError(res, error, 400);
    }
  };

  // RF-USR-010: Editar rol
  updateRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const idRol = Number(req.params.id || req.body.idRol || req.body.id_rol);
      if (!idRol || Number.isNaN(idRol)) {
        res.status(400).json({ message: 'El identificador del rol es inválido.' });
        return;
      }
      const rawNombreRol = req.body.nombreRol || req.body.nombre_rol;
      const rawDescripcion = req.body.descripcion ?? '';
      const rawPermisos = req.body.permisos;
      const ejecutadoPorUsuario = actorOf(req);

      if (!rawNombreRol || typeof rawNombreRol !== 'string' || !rawNombreRol.trim()) {
        res.status(400).json({ message: "El campo 'nombreRol' es obligatorio." });
        return;
      }

      const result = await this.updateRoleUseCase.execute({
        idRol,
        nombreRol: rawNombreRol.trim(),
        descripcion: rawDescripcion,
        permisos: rawPermisos,
        ejecutadoPorUsuario,
      });
      res.json(result);
    } catch (error: any) {
      handleHttpError(res, error, 400);
    }
  };

  // Listar roles
  getRoles = async (_req: Request, res: Response): Promise<void> => {
    try {
      const roles = await this.userRepo.findAllRoles();
      const rolesWithCounts = await Promise.all(
        roles.map(async (r) => ({
          ...r,
          es_inicial: Boolean(r.es_inicial),
          usuariosAsignadosCount: await this.userRepo.countUsersByRole(r.id_rol),
        }))
      );
      res.json({ data: rolesWithCounts });
    } catch (error: any) {
      handleHttpError(res, error, 500);
    }
  };

  // RF-USR-011: Eliminar rol
  deleteRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const idRol = Number(req.params?.id || req.body?.idRol || req.body?.id_rol);
      if (!idRol || Number.isNaN(idRol)) {
        res.status(400).json({ message: 'El identificador del rol es inválido.' });
        return;
      }
      const ejecutadoPorUsuario = actorOf(req);
      const result = await this.deleteRoleUseCase.execute({
        idRol,
        confirmado: true,
        ejecutadoPorUsuario,
      });
      res.json({ message: result.message, eliminado: result.eliminado });
    } catch (error: any) {
      handleHttpError(res, error, 400);
    }
  };

  // RF-USR-001: Crear usuario (la ruta exige el permiso RF-USR-001)
  createUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        nombreCompleto,
        documentoIdentidad,
        correo,
        telefono,
        contrasenaTemporal,
        rolesIds,
        firma,
      } = req.body ?? {};

      const result = await this.createUserUseCase.execute({
        ejecutadoPorUsuario: actorOf(req),
        nombreCompleto,
        documentoIdentidad,
        correo,
        telefono,
        contrasenaTemporal,
        rolesIds,
        firma,
      });
      res.status(201).json(result);
    } catch (error: any) {
      handleHttpError(res, error, 400);
    }
  };

  // RF-USR-002: Editar usuario
  updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const idUsuario = Number(req.params.id);
      const {
        nombreCompleto,
        documentoIdentidad,
        correo,
        telefono,
        nuevaContrasenaTemporal,
        contrasenaTemporal,
        rolesIds,
        firma,
      } = req.body ?? {};

      const result = await this.updateUserUseCase.execute({
        ejecutadoPorUsuario: actorOf(req),
        idUsuario,
        nombreCompleto,
        documentoIdentidad,
        correo,
        telefono,
        // La pantalla envía 'contrasenaTemporal' también al editar.
        nuevaContrasenaTemporal: nuevaContrasenaTemporal ?? contrasenaTemporal,
        rolesIds,
        firma,
      });
      res.json(result);
    } catch (error: any) {
      handleHttpError(res, error, 400);
    }
  };

  // RF-USR-003: Activar o inactivar usuario
  toggleUserStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const idUsuario = Number(req.params.id);
      if (Number.isNaN(idUsuario)) {
        res.status(400).json({ message: 'El ID de usuario debe ser numérico.' });
        return;
      }
      if (!req.body || typeof req.body.estado !== 'boolean') {
        res.status(400).json({
          message: "El campo 'estado' es obligatorio y debe ser estrictamente de tipo booleano (true o false).",
        });
        return;
      }
      const result = await this.toggleUserStatusUseCase.execute({
        ejecutadoPorUsuario: actorOf(req),
        idUsuario,
        nuevoEstado: req.body.estado,
      });
      res.json(result);
    } catch (error: any) {
      handleHttpError(res, error, 400);
    }
  };

  // RF-USR-004: Buscar usuarios
  searchUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const queryParam = String(req.query.query || req.query.q || req.query.search || '');
      const docParam = String(req.query.documento || '');
      const nameParam = String(req.query.nombre || '');
      const idRol = req.query.idRol ? Number(req.query.idRol) : undefined;
      const estado = req.query.estado !== undefined ? req.query.estado === 'true' : undefined;

      const cleanQuery = queryParam.trim();
      const isDoc = Boolean(cleanQuery) && /^\d+$/.test(cleanQuery);
      const searchResult = await this.searchUsersUseCase.execute({
        documento: docParam ? docParam.trim() : isDoc ? cleanQuery : undefined,
        nombre: nameParam ? nameParam.trim() : !isDoc && cleanQuery ? cleanQuery : undefined,
        idRol,
        estado,
      });
      res.json({ data: searchResult.data, message: searchResult.message });
    } catch (error: any) {
      handleHttpError(res, error, 500);
    }
  };

  // RF-USR-005: Iniciar sesión
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
        res.status(400).json({ message: 'El cuerpo de la solicitud es obligatorio y no puede estar vacío.' });
        return;
      }
      const { correo, contrasena, nuevaContrasena, confirmacionNuevaContrasena } = req.body ?? {};
      if (!correo || typeof correo !== 'string' || !correo.trim()) {
        res.status(400).json({ message: "El campo 'correo' es obligatorio." });
        return;
      }
      if (!contrasena || typeof contrasena !== 'string') {
        res.status(400).json({ message: "El campo 'contrasena' es obligatorio." });
        return;
      }
      const result = await this.authenticateUserUseCase.execute({
        correo,
        contrasena,
        nuevaContrasena,
        confirmacionNuevaContrasena,
      });

      if (!result.usuario) {
        res.json(result);
        return;
      }

      // El token solo identifica al usuario; roles y permisos se leen de la BD en cada petición.
      const token = JwtTokenService.generateToken(
        {
          idUsuario: result.usuario.idUsuario,
          correo: result.usuario.correo,
          nombreCompleto: result.usuario.nombreCompleto,
          roles: (result.usuario.roles ?? []).map((r) => r.codigo || r.nombreRol),
        },
        SESSION_HOURS
      );

      res.cookie('session_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_HOURS * 60 * 60 * 1000,
        path: '/',
      });
      res.json({ ...result, token });
    } catch (error: any) {
      const message = String(error?.message || '');
      const isAuthError = /Correo o contraseña|inactivo|Demasiados intentos|contraseña/i.test(message);
      if (isAuthError) {
        res.status(401).json({ message });
        return;
      }
      handleHttpError(res, error, 500);
    }
  };

  // RF-USR-008: Cerrar sesión (invalida el token en el servidor)
  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = getSessionUser(req)!;
      const session = (req as any).sessionToken as { token: string; exp: number } | undefined;
      const { motivo, tieneCambiosSinGuardar, confirmadoPorUsuario, borrador } = req.body ?? {};

      const result = await this.closeSessionUseCase.execute({
        idUsuario: user.idUsuario,
        motivo: motivo === 'INACTIVITY_TIMEOUT' ? 'INACTIVITY_TIMEOUT' : 'MANUAL',
        tieneCambiosSinGuardar,
        confirmadoPorUsuario,
        borrador,
      });

      if (result.sesionCerrada && session) {
        await revokeToken(session.token, user.idUsuario, session.exp);
        res.clearCookie('session_token', { path: '/' });
      }
      res.json(result);
    } catch (error: any) {
      handleHttpError(res, error, 400);
    }
  };

  // RF-USR-008: borradores pendientes del usuario de la sesión
  getDrafts = async (req: Request, res: Response): Promise<void> => {
    try {
      const drafts = await this.draftStorage.getDraftByUser(getSessionUser(req)!.idUsuario);
      res.json({ data: drafts });
    } catch (error: any) {
      handleHttpError(res, error, 500);
    }
  };

  deleteDraft = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.draftStorage.deleteDraft(getSessionUser(req)!.idUsuario, String(req.params.formularioId));
      res.json({ message: 'Borrador descartado.' });
    } catch (error: any) {
      handleHttpError(res, error, 500);
    }
  };

  // RF-USR-009: Solicitar enlace de recuperación
  requestPasswordRecovery = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.recoverPasswordUseCase.requestRecoveryLink({
        correo: req.body?.correo,
        baseRecoveryUrl: envConfig.frontendUrl,
      });
      res.json(result);
    } catch (error: any) {
      handleHttpError(res, error, 400);
    }
  };

  // RF-USR-009: Restablecer contraseña con token de un solo uso
  resetPasswordWithToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, nuevaContrasena, confirmacionContrasena } = req.body ?? {};
      const result = await this.recoverPasswordUseCase.resetPassword({
        token,
        nuevaContrasena,
        confirmacionContrasena,
      });
      res.json(result);
    } catch (error: any) {
      handleHttpError(res, error, 400);
    }
  };
}
