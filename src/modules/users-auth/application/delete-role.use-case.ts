import { INITIAL_ROLE_CODES, RoleEntity } from '../domain/role.entity';
import { IAuditLoggerPort, IUserRepository } from '../domain/user.repository.interface';

export interface DeleteRoleCommand {
  ejecutadoPorUsuario?: string;
  idRol: number;
  confirmado?: boolean;
}

export interface DeleteRoleResult {
  eliminado: boolean;
  message: string;
}

export class DeleteRoleUseCase {
  private static readonly INITIAL_ROLE_NAMES = [
    'paciente',
    'odontólogo general',
    'odontologo general',
    'especialista en ortodoncia',
    'coordinadora de agendamiento',
    'auxiliar de odontología',
    'auxiliar de odontologia',
    'administrador del sistema',
  ];

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly auditLogger?: IAuditLoggerPort
  ) {}

  public async execute(command: DeleteRoleCommand): Promise<DeleteRoleResult> {
    if (!command.idRol || Number.isNaN(Number(command.idRol))) {
      throw new Error('El identificador del rol es inválido.');
    }

    if (command.confirmado === false) {
      return {
        eliminado: false,
        message: 'Eliminación de rol cancelada por el usuario.',
      };
    }

    const roles = await this.userRepository.findAllRoles();
    const targetRole = roles.find((r) => Number(r.id_rol) === Number(command.idRol));

    if (!targetRole) {
      throw new Error(`El rol con ID ${command.idRol} no existe.`);
    }

    const resolvedCode = this.resolveRoleCode(targetRole.codigo, targetRole.nombre_rol);
    const roleEntity = RoleEntity.reconstitute({
      idRol: targetRole.id_rol,
      codigo: resolvedCode,
      nombreRol: targetRole.nombre_rol,
      descripcion: targetRole.descripcion ?? '',
      permisos: targetRole.permisos ?? [],
      esInicial: targetRole.es_inicial,
    });

    const assignedUsersCount = this.userRepository.countUsersByRole
      ? await this.userRepository.countUsersByRole(command.idRol)
      : 0;

    roleEntity.ensureCanBeDeleted(assignedUsersCount);

    const deleted = await this.userRepository.deleteRole(command.idRol);
    if (!deleted) {
      throw new Error('No fue posible eliminar el rol.');
    }

    if (this.auditLogger) {
      await this.auditLogger.log({
        usuario: command.ejecutadoPorUsuario || 'ROL-ADM',
        accion: 'Eliminar rol',
        registroAfectado: `rol:${command.idRol}`,
        valorAnterior: targetRole,
      });
    }

    return {
      eliminado: true,
      message: 'Rol eliminado exitosamente.',
    };
  }

  private resolveRoleCode(codigo?: string, nombreRol?: string): string {
    if (codigo && INITIAL_ROLE_CODES.includes(codigo.toUpperCase() as any)) {
      return codigo.toUpperCase();
    }
    const lowerName = (nombreRol ?? '').trim().toLowerCase();
    if (
      INITIAL_ROLE_CODES.includes(lowerName.toUpperCase() as any) ||
      DeleteRoleUseCase.INITIAL_ROLE_NAMES.includes(lowerName)
    ) {
      return 'ROL-ADM'; // Marca como rol inicial protegido
    }
    return codigo ?? nombreRol ?? '';
  }
}