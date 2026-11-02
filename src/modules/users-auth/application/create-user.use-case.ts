import { RoleEntity } from '../domain/role.entity';
import { SignatureImageInput, UserEntity } from '../domain/user.entity';
import {
  IAuditLoggerPort,
  IPasswordHasher,
  IUserRepository,
  UserWithRolesDomainDTO,
} from '../domain/user.repository.interface';

export interface CreateUserCommand {
  ejecutadoPorUsuario: string;
  nombreCompleto: string;
  documentoIdentidad: string;
  correo: string;
  telefono?: string;
  contrasenaTemporal?: string;
  contrasenaHash?: string;
  rolesIds: number[];
  firma?: SignatureImageInput | null;
}

export interface CreateUserResult {
  message: string;
  data: UserWithRolesDomainDTO;
}

export class CreateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher?: IPasswordHasher,
    private readonly auditLogger?: IAuditLoggerPort
  ) {}

  public async execute(command: CreateUserCommand): Promise<CreateUserResult> {
    if (!Array.isArray(command.rolesIds) || command.rolesIds.length === 0) {
      throw new Error('Campo rolesIds: Debe asignar al menos un rol al usuario.');
    }

    // Verificar duplicidad de documento de identidad
    const existingByDoc = this.userRepository.findByDocument
      ? await this.userRepository.findByDocument(command.documentoIdentidad.trim())
      : (
          await this.userRepository.searchUsers({
            documento: command.documentoIdentidad.trim(),
          })
        )[0] ?? null;

    if (existingByDoc) {
      throw new Error(
        `Campo documentoIdentidad: El documento ${command.documentoIdentidad.trim()} ya está registrado en el sistema.`
      );
    }

    // Verificar duplicidad de correo electrónico
    const normalizedEmail = command.correo?.trim().toLowerCase();
    const existingByEmail = this.userRepository.findByEmail
      ? await this.userRepository.findByEmail(normalizedEmail)
      : (await this.userRepository.searchUsers({})).find(
          (u) => u.correo.toLowerCase() === normalizedEmail
        ) ?? null;

    if (existingByEmail) {
      throw new Error(
        `Campo correo: El correo electrónico ${normalizedEmail} ya está registrado en el sistema.`
      );
    }

    // Resolver roles del catálogo y construir entidades de dominio
    const catalogRoles = await this.userRepository.findAllRoles();
    const assignedRoleEntities: RoleEntity[] = [];

    for (const idRol of command.rolesIds) {
      const foundRole = catalogRoles.find((r) => Number(r.id_rol) === Number(idRol));
      if (!foundRole) {
        throw new Error(`Campo rolesIds: El rol con ID ${idRol} no existe en el catálogo.`);
      }
      assignedRoleEntities.push(
        RoleEntity.reconstitute({
          idRol: foundRole.id_rol,
          codigo: foundRole.codigo ?? foundRole.nombre_rol.toUpperCase(),
          nombreRol: foundRole.nombre_rol,
          descripcion: foundRole.descripcion ?? '',
          permisos: foundRole.permisos ?? [],
          estadoAsignacion: true,
        })
      );
    }

    // Validar y generar hash de contraseña temporal si se envía en texto plano
    let finalPasswordHash = command.contrasenaHash ?? '';
    if (command.contrasenaTemporal !== undefined) {
      UserEntity.validatePlainPassword(command.contrasenaTemporal);
      finalPasswordHash = this.passwordHasher
        ? await this.passwordHasher.hash(command.contrasenaTemporal)
        : command.contrasenaTemporal;
    } else if (!finalPasswordHash) {
      throw new Error('Campo contrasena: La contraseña temporal es obligatoria.');
    }

    const userEntity = UserEntity.createNew({
      nombreCompleto: command.nombreCompleto,
      documentoIdentidad: command.documentoIdentidad,
      correo: command.correo,
      telefono: command.telefono,
      contrasenaTemporalPlana: command.contrasenaTemporal,
      contrasenaHash: finalPasswordHash,
      roles: assignedRoleEntities,
      firma: command.firma,
    });

    const createdUser = await this.userRepository.createUser({
      nombreCompleto: userEntity.nombreCompleto,
      documentoIdentidad: userEntity.documentoIdentidad,
      correo: userEntity.correo,
      telefono: userEntity.telefono ?? undefined,
      contrasenaHash: userEntity.contrasenaHash,
      esContrasenaTemporal: true,
      firmaUrl: userEntity.firmaUrl,
      rolesIds: command.rolesIds,
    });

    if (this.auditLogger) {
      await this.auditLogger.log({
        usuario: command.ejecutadoPorUsuario || 'ROL-ADM',
        accion: 'Crear usuario',
        registroAfectado: `usuario:${createdUser.idUsuario}`,
        valorNuevo: {
          idUsuario: createdUser.idUsuario,
          documentoIdentidad: createdUser.documentoIdentidad,
          correo: createdUser.correo,
          estado: createdUser.estado,
          rolesIds: command.rolesIds,
        },
      });
    }

    return {
      message: 'Usuario creado en estado Activo.',
      data: createdUser,
    };
  }
}