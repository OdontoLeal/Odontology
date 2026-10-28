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

export class UsersAuthController {
  private readonly createRoleUseCase: CreateRoleUseCase;
  private readonly updateRoleUseCase: UpdateRoleUseCase;
  private readonly deleteRoleUseCase: DeleteRoleUseCase;
  private readonly createUserUseCase: CreateUserUseCase;
  private readonly updateUserUseCase: UpdateUserUseCase;
  private readonly searchUsersUseCase: SearchUsersUseCase;
  private readonly toggleUserStatusUseCase: ToggleUserStatusUseCase;
  private readonly authenticateUserUseCase: AuthenticateUserUseCase;
  private readonly closeSessionUseCase: CloseSessionUseCase;
  private readonly recoverPasswordUseCase: RecoverPasswordUseCase;

  constructor(private readonly userRepo: UserRepository) {
    const draftStorage = new DraftStorageService();
    const passwordHasher = new HybridPasswordHasherService();
    const mailer = new MailerService();

    this.createRoleUseCase = new CreateRoleUseCase(this.userRepo);
    this.updateRoleUseCase = new UpdateRoleUseCase(this.userRepo);
    this.deleteRoleUseCase = new DeleteRoleUseCase(this.userRepo);
    this.createUserUseCase = new CreateUserUseCase(this.userRepo, passwordHasher);
    this.updateUserUseCase = new UpdateUserUseCase(this.userRepo, passwordHasher);
    this.searchUsersUseCase = new SearchUsersUseCase(this.userRepo);
    this.toggleUserStatusUseCase = new ToggleUserStatusUseCase(this.userRepo);
    this.authenticateUserUseCase = new AuthenticateUserUseCase(
      this.userRepo,
      passwordHasher
    );
    this.closeSessionUseCase = new CloseSessionUseCase(this.userRepo, draftStorage);
    this.recoverPasswordUseCase = new RecoverPasswordUseCase(
      this.userRepo,
      passwordHasher,
      mailer
    );
  }

  // RF-USR-007: Crear rol
  createRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const { codigo, nombreRol, descripcion, permisos } = req.body;
      const result = await this.createRoleUseCase.execute({
        codigo,
        nombreRol,
        descripcion,
        permisos,
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
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
        nuevaContrasenaTemporal,
        contrasenaTemporal,
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
        nuevaContrasenaTemporal: nuevaContrasenaTemporal ?? contrasenaTemporal,
        rolesIds,
        firma,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  // RF-USR-004: Buscar usuarios
  searchUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documento, nombre, idRol, codigoRol, estado } = req.query;
      const result = await this.searchUsersUseCase.execute({
        documento: documento ? String(documento) : undefined,
        nombre: nombre ? String(nombre) : undefined,
        idRol: idRol !== undefined ? Number(idRol) : undefined,
        codigoRol: codigoRol ? String(codigoRol) : undefined,
        estado: estado !== undefined ? estado === 'true' : undefined,
      });

      res.status(200).json({
        data: result.data || [],
        message: result.message,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  };

  // RF-USR-003: Activar / Inactivar usuario
  toggleUserStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const idUsuario = Number(req.params.id);
      const { estado, ejecutadoPorUsuario } = req.body;
      const result = await this.toggleUserStatusUseCase.execute({
        ejecutadoPorUsuario: ejecutadoPorUsuario ?? 'ROL-ADM',
        idUsuario,
        nuevoEstado: Boolean(estado),
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  // RF-USR-005: Autenticar usuario
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        correo,
        contrasena,
        nuevaContrasena,
        confirmacionNuevaContrasena,
      } = req.body;
      const result = await this.authenticateUserUseCase.execute({
        correo,
        contrasena,
        nuevaContrasena,
        confirmacionNuevaContrasena,
      });
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
      const result = await this.closeSessionUseCase.execute({
        idUsuario: Number(idUsuario),
        motivo: motivo ?? 'MANUAL',
        tieneCambiosSinGuardar,
        confirmadoPorUsuario,
        borrador,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  // Solicitar enlace de recuperación
  requestPasswordRecovery = async (req: Request, res: Response): Promise<void> => {
    try {
      const { correo, baseRecoveryUrl } = req.body;
      const origin = req.protocol + "://" + req.get("host");
      const result = await this.recoverPasswordUseCase.requestRecoveryLink({
        correo,
        baseRecoveryUrl: baseRecoveryUrl || envConfig.frontendUrl || origin,
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