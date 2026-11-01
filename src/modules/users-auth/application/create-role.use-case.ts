import { RoleEntity } from '../domain/role.entity';
import {
  IAuditLoggerPort,
  IUserRepository,
  RoleDTO,
} from '../domain/user.repository.interface';

export interface CreateRoleCommand {
  ejecutadoPorUsuario?: string;
  codigo?: string;
  nombreRol: string;
  descripcion?: string;
  permisos?: string[];
}

export interface CreateRoleResult {
  message: string;
  data: RoleDTO;
}

export class CreateRoleUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly auditLogger?: IAuditLoggerPort
  ) {}

  public async execute(command: CreateRoleCommand): Promise<CreateRoleResult> {
    const cleanName = command.nombreRol?.trim();
    if (!cleanName) {
      throw new Error('El campo nombreRol es obligatorio.');
    }

    const roleCode = (
      command.codigo?.trim() ||
      `ROL-${cleanName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6)}`
    ).toUpperCase();

    const permisos =
      command.permisos && command.permisos.length > 0 ? command.permisos : ['RF-AGE-008'];

    const roleEntity = RoleEntity.createNew({
      codigo: roleCode,
      nombreRol: cleanName,
      descripcion: command.descripcion ?? '',
      permisos,
    });

    const existingRoles = await this.userRepository.findAllRoles();
    const isDuplicate = existingRoles.some(
      (r) =>
        r.nombre_rol.trim().toLowerCase() === roleEntity.nombreRol.toLowerCase() ||
        (r.codigo && r.codigo.trim().toUpperCase() === roleEntity.codigo)
    );

    if (isDuplicate) {
      throw new Error(
        `Ya existe un rol con el código "${roleEntity.codigo}" o el nombre "${roleEntity.nombreRol}".`
      );
    }

    const createdRole = await this.userRepository.createRole(roleEntity.nombreRol, {
      codigo: roleEntity.codigo,
      descripcion: roleEntity.descripcion,
      permisos: [...roleEntity.permisos],
    });

    const enrichedRole: RoleDTO = {
      id_rol: createdRole.id_rol,
      codigo: createdRole.codigo ?? roleEntity.codigo,
      nombre_rol: createdRole.nombre_rol,
      descripcion: createdRole.descripcion ?? roleEntity.descripcion,
      permisos: createdRole.permisos ?? [...roleEntity.permisos],
      es_inicial: createdRole.es_inicial ?? false,
    };

    if (this.auditLogger) {
      await this.auditLogger.log({
        usuario: command.ejecutadoPorUsuario || 'ROL-ADM',
        accion: 'Crear rol',
        registroAfectado: `rol:${enrichedRole.id_rol}`,
        valorNuevo: enrichedRole,
      });
    }

    return {
      message: 'Rol creado exitosamente.',
      data: enrichedRole,
    };
  }
}