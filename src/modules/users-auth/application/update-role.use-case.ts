import { RoleEntity } from '../domain/role.entity';
import {
  IAuditLoggerPort,
  IUserRepository,
  RoleDTO,
} from '../domain/user.repository.interface';

export interface UpdateRoleCommand {
  ejecutadoPorUsuario?: string;
  idRol: number;
  nombreRol: string;
  descripcion: string;
  permisos: string[];
}

export interface UpdateRoleResult {
  message: string;
  data: RoleDTO;
}

export class UpdateRoleUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly auditLogger?: IAuditLoggerPort
  ) {}

  public async execute(command: UpdateRoleCommand): Promise<UpdateRoleResult> {
    if (!this.userRepository.updateRole) {
      throw new Error('El repositorio no implementa la actualización de roles (updateRole).');
    }

    const allRoles = await this.userRepository.findAllRoles();
    const currentRole = allRoles.find((r) => Number(r.id_rol) === Number(command.idRol));

    if (!currentRole) {
      throw new Error(`El rol con ID ${command.idRol} no existe.`);
    }

    const duplicateNameRole = allRoles.find(
      (r) =>
        Number(r.id_rol) !== Number(command.idRol) &&
        r.nombre_rol.trim().toLowerCase() === command.nombreRol?.trim().toLowerCase()
    );

    if (duplicateNameRole) {
      throw new Error(
        `El nombre de rol "${command.nombreRol.trim()}" ya está en uso por otro rol.`
      );
    }

    const roleEntity = RoleEntity.reconstitute({
      idRol: currentRole.id_rol,
      codigo: currentRole.codigo ?? currentRole.nombre_rol.toUpperCase(),
      nombreRol: currentRole.nombre_rol,
      descripcion: currentRole.descripcion ?? '',
      permisos: currentRole.permisos ?? [],
      esInicial: currentRole.es_inicial,
    });

    roleEntity.update({
      nombreRol: command.nombreRol,
      descripcion: command.descripcion,
      permisos: command.permisos,
    });

    const updatedRole = await this.userRepository.updateRole(command.idRol, {
      nombreRol: roleEntity.nombreRol,
      descripcion: roleEntity.descripcion,
      permisos: [...roleEntity.permisos],
    });

    if (this.auditLogger) {
      await this.auditLogger.log({
        usuario: command.ejecutadoPorUsuario || 'ROL-ADM',
        accion: 'Editar rol',
        registroAfectado: `rol:${command.idRol}`,
        valorAnterior: currentRole,
        valorNuevo: updatedRole,
      });
    }

    return {
      message: 'Rol actualizado exitosamente.',
      data: updatedRole,
    };
  }
}