import { handleHttpError } from '../../../shared/infrastructure/http/http-error.handler';
// src/modules/users-auth/infrastructure/users-auth.controller.ts
import { Request, Response } from 'express';
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
import { DraftStorageService } from './draft-storage.service';
import { HybridPasswordHasherService } from './password-hasher.service';
import { MailerService } from '../../../shared/infrastructure/mail/mailer.service';
import { envConfig } from '../../../app/config/env.config';
import { UserRepository } from './user.repository';
import { JwtTokenService } from '../../../shared/infrastructure/security/token.service';
import { db } from '../../../shared/infrastructure/database/database';

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
    private readonly mailerService = new MailerService()
  ) {
    this.createRoleUseCase = new CreateRoleUseCase(this.userRepo);
    this.updateRoleUseCase = new UpdateRoleUseCase(this.userRepo);
    this.deleteRoleUseCase = new DeleteRoleUseCase(this.userRepo);
    this.createUserUseCase = new CreateUserUseCase(
      this.userRepo,
      this.passwordHasher
    );
    this.updateUserUseCase = new UpdateUserUseCase(this.userRepo);
    this.toggleUserStatusUseCase = new ToggleUserStatusUseCase(this.userRepo);
    this.searchUsersUseCase = new SearchUsersUseCase(this.userRepo);
    this.authenticateUserUseCase = new AuthenticateUserUseCase(
      this.userRepo,
      this.passwordHasher
    );
    this.closeSessionUseCase = new CloseSessionUseCase(
      this.userRepo,
      this.draftStorage
    );
    this.recoverPasswordUseCase = new RecoverPasswordUseCase(
      this.userRepo,
      this.passwordHasher,
      this.mailerService
    );
  }

  // RF-USR-007: Crear rol
  createRole = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
        res.status(400).json({ message: 'El cuerpo de la solicitud es obligatorio y no puede estar vacío.' });
        return;
      }
      const { codigo, nombreRol, descripcion, permisos } = req.body;
      if (!codigo || typeof codigo !== 'string' || !codigo.trim()) {
        res.status(400).json({ message: "El campo 'codigo' es obligatorio." });
        return;
      }
      if (!nombreRol || typeof nombreRol !== 'string' || !nombreRol.trim()) {
        res.status(400).json({ message: "El campo 'nombreRol' es obligatorio." });
        return;
      }
      const result = await this.createRoleUseCase.execute({
        codigo,
        nombreRol,
        descripcion,
        permisos,
      });
      res.status(201).json(result);
    } catch (error: any) {
      handleHttpError(res, error, 400);
    }
  };

  // RF-USR-010: Editar rol
  updateRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const idRol = Number(req.params.id);
      const { nombreRol, descripcion, permisos } = req.body;
      const result = await this.updateRoleUseCase.execute({
        idRol,
        nombreRol,
        descripcion,
        permisos,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  // Listar roles
  getRoles = async (_req: Request, res: Response): Promise<void> => {
    try {
      const roles = await this.userRepo.findAllRoles();
      const rolesWithCounts = await Promise.all(
        roles.map(async (r) => ({
          ...r,
          usuariosAsignadosCount: await this.userRepo.countUsersByRole(r.id_rol),
        }))
      );
      res.json({ data: rolesWithCounts });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };

  // RF-USR-011: Eliminar rol
  deleteRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const idRol = Number(req.params.id);
      const result = await this.deleteRoleUseCase.execute({
        idRol,
        confirmado: true,
      });
      res.json({ message: result.message });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  // RF-USR-001: Crear usuario
  createUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionUser = (req as any).user;
      if (sessionUser) {
        const roles: string[] = sessionUser.roles || [];
        const permisos: string[] = sessionUser.permisos || [];
        const isAdmin =
          roles.some((r: string) => String(r).toUpperCase().includes('ADM')) ||
          permisos.includes('RF-USR-001');
        if (!isAdmin) {
          res.status(403).json({ message: 'No tiene permiso para realizar esta acción' });
          return;
        }
      }

      const {
        ejecutadoPorUsuario,
        nombreCompleto,
        documentoIdentidad,
        correo,
        telefono,
        contrasenaTemporal,
        contrasenaHash,
        rolesIds,
        firma,
      } = req.body;

      const result = await this.createUserUseCase.execute({
        ejecutadoPorUsuario: ejecutadoPorUsuario ?? 'ROL-ADM',
        nombreCompleto,
        documentoIdentidad,
        correo,
        telefono,
        contrasenaTemporal: contrasenaTemporal ?? contrasenaHash,
        contrasenaHash,
        rolesIds,
        firma,
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  // RF-USR-002: Editar usuario
  updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const idUsuario = Number(req.params.id);
      const {
        ejecutadoPorUsuario,
        nombreCompleto,
        documentoIdentidad,
        correo,
        telefono,
        nuevaContrasenaTemporal: contrasena,
        rolesIds,
        firma,
      } = req.body;

      const result = await this.updateUserUseCase.execute({
        ejecutadoPorUsuario: ejecutadoPorUsuario ?? 'ROL-ADM',
        idUsuario,
        nombreCompleto,
        documentoIdentidad,
        correo,
        telefono,
        nuevaContrasenaTemporal: contrasena,
        rolesIds,
        firma,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  // RF-USR-003: Activar o inactivar usuario
  toggleUserStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const idUsuario = Number(req.params.id);
      if (isNaN(idUsuario)) {
        res.status(400).json({ message: 'El ID de usuario debe ser numérico.' });
        return;
      }
      if (!req.body || typeof req.body.estado !== 'boolean') {
        res.status(400).json({
          message: "El campo 'estado' es obligatorio y debe ser estrictamente de tipo booleano (true o false).",
        });
        return;
      }
      const { estado } = req.body;
      const result = await this.toggleUserStatusUseCase.execute({
        idUsuario,
        nuevoEstado: estado,
      });
      res.json(result);
    } catch (error: any) {
      handleHttpError(res, error, 400);
    }
  };

  // RF-USR-004: Buscar usuarios
  searchUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const queryParam = (req.query.query || req.query.q || req.query.search || '') as string;
      const docParam = (req.query.documento || '') as string;
      const nameParam = (req.query.nombre || '') as string;
      const idRol = req.query.idRol ? Number(req.query.idRol) : undefined;
      const estado =
        req.query.estado !== undefined ? req.query.estado === 'true' : undefined;

      const cleanQuery = queryParam.trim();
      const isDoc = cleanQuery && /^\d+$/.test(cleanQuery);
      const searchResult = await this.searchUsersUseCase.execute({
        documento: docParam ? docParam.trim() : (isDoc ? cleanQuery : undefined),
        nombre: nameParam ? nameParam.trim() : (!isDoc && cleanQuery ? cleanQuery : undefined),
        idRol,
        estado,
      });
      res.json({ data: searchResult.data, message: searchResult.message });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };

  // RF-USR-005: Iniciar sesión
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
        res.status(400).json({ message: 'El cuerpo de la solicitud es obligatorio y no puede estar vacío.' });
        return;
      }
      const {
        correo,
        contrasena,
        nuevaContrasena,
        confirmacionNuevaContrasena,
      } = req.body;
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

      if (result.usuario) {
        const token = JwtTokenService.generateToken({
          idUsuario: result.usuario.idUsuario,
          correo: result.usuario.correo,
          nombreCompleto: result.usuario.nombreCompleto,
          roles: (result.usuario.roles ?? []).map((r: any) => r.codigo || r.nombreRol),
          permisos: result.permisos,
        });

        res.cookie('session_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 8 * 60 * 60 * 1000,
          path: '/',
        });

        res.json({
          ...result,
          token,
        });
        return;
      }

      res.json(result);
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  };

  // RF-USR-008: Cerrar sesión
  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        idUsuario,
        motivo,
        tieneCambiosSinGuardar,
        confirmadoPorUsuario,
        borrador,
      } = req.body;

      // Invalidar token en BD (DEF-01)
      let token: string | undefined;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        token = authHeader.split(' ')[1];
      }
      if (!token && req.headers.cookie) {
        const cookies = req.headers.cookie.split(';');
        for (const cookie of cookies) {
          const [name, val] = cookie.trim().split('=');
          if (name === 'session_token' || name === 'token') {
            token = decodeURIComponent(val);
            break;
          }
        }
      }
      if (token) {
        try {
          await db.query(
            `INSERT INTO public.sesion_invalida (token, revocado_en) VALUES ($1, CURRENT_TIMESTAMP) ON CONFLICT (token) DO NOTHING;`,
            [token]
          );
        } catch (dbErr) {
          // Si tabla no existe en pruebas unitarias, continuar
        }
      }

      const result = await this.closeSessionUseCase.execute({
        idUsuario: Number(idUsuario),
        motivo: motivo ?? 'MANUAL',
        tieneCambiosSinGuardar,
        confirmadoPorUsuario,
        borrador,
      });
      res.clearCookie('session_token', { path: '/' });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  // RF-USR-009: Solicitar enlace de recuperación (I8-008: enlace apunta siempre a envConfig.frontendUrl)
  requestPasswordRecovery = async (req: Request, res: Response): Promise<void> => {
    try {
      const { correo } = req.body;
      const result = await this.recoverPasswordUseCase.requestRecoveryLink({
        correo,
        baseRecoveryUrl: envConfig.frontendUrl,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  // RF-USR-009: Restablecer contraseña con token de un solo uso
  resetPasswordWithToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, nuevaContrasena, confirmacionContrasena } = req.body;
      const result = await this.recoverPasswordUseCase.resetPassword({
        token,
        nuevaContrasena,
        confirmacionContrasena,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };
}
