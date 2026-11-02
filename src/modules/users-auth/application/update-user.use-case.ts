import { RoleEntity } from '../domain/role.entity';
import { SignatureImageInput, UserEntity } from '../domain/user.entity';
import {
  ActiveAppointmentSummaryDTO,
  IAuditLoggerPort,
  IPasswordHasher,
  IUserRepository,
  UserWithRolesDomainDTO,
} from '../domain/user.repository.interface';

export interface UpdateUserCommand {
  ejecutadoPorUsuario: string;
  idUsuario: number;
  nombreCompleto: string;
  documentoIdentidad: string;
  correo: string;
  telefono?: string | null;
  nuevaContrasenaTemporal?: string;
  rolesIds: number[];
  firma?: SignatureImageInput | null;
}

export interface UpdateUserResult {
  message: string;
  data: UserWithRolesDomainDTO;
  citasPendientes?: ActiveAppointmentSummaryDTO[];
}

export class UpdateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher?: IPasswordHasher,
    private readonly auditLogger?: IAuditLoggerPort
  ) {}

  public async execute(command: UpdateUserCommand): Promise<UpdateUserResult> {
    if (!this.userRepository.updateUser) {
      throw new Error('El repositorio no implementa la operación updateUser.');
    }

    const currentUserRecord = await this.userRepository.findById(command.idUsuario);
    if (!currentUserRecord) {
      throw new Error(`El usuario con ID ${command.idUsuario} no existe.`);
    }

    if (!Array.isArray(command.rolesIds) || command.rolesIds.length === 0) {
      throw new Error('El usuario no puede quedar sin roles asignados.');
    }

    // Validar unicidad de documento frente a otros usuarios
    const cleanDoc = command.documentoIdentidad?.trim();
    if (cleanDoc && cleanDoc !== currentUserRecord.documentoIdentidad) {
      const userWithSameDoc = this.userRepository.findByDocument
        ? await this.userRepository.findByDocument(cleanDoc)
        : (await this.userRepository.searchUsers({ documento: cleanDoc }))[0] ?? null;

      if (userWithSameDoc && userWithSameDoc.idUsuario !== command.idUsuario) {
        throw new Error(
          `El documento de identidad ya está registrado en el sistema.`
        );
      }
    }

    // Validar unicidad de correo frente a otros usuarios
    const cleanEmail = command.correo?.trim().toLowerCase();
    if (cleanEmail && cleanEmail !== currentUserRecord.correo.toLowerCase()) {
      const userWithSameEmail = this.userRepository.findByEmail
        ? await this.userRepository.findByEmail(cleanEmail)
        : (await this.userRepository.searchUsers({})).find(
            (u) => u.correo.toLowerCase() === cleanEmail
          ) ?? null;

      if (userWithSameEmail && userWithSameEmail.idUsuario !== command.idUsuario) {
        throw new Error(
          `El correo electrónico ya está registrado en el sistema.`
        );
      }
    }

    const catalogRoles = await this.userRepository.findAllRoles();
    const nextRoleEntities: RoleEntity[] = [];

    for (const idRol of command.rolesIds) {
      const foundRole = catalogRoles.find((r) => Number(r.id_rol) === Number(idRol));
      if (!foundRole) {
        throw new Error(`El rol con ID ${idRol} no existe en el catálogo.`);
      }
      nextRoleEntities.push(
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

    const currentRoleEntities = currentUserRecord.roles.map((r) =>
      RoleEntity.reconstitute({
        idRol: r.idRol,
        codigo: r.codigo ?? r.nombreRol.toUpperCase(),
        nombreRol: r.nombreRol,
        descripcion: r.descripcion ?? '',
        permisos: r.permisos ?? [],
        estadoAsignacion: r.estadoAsignacion,
      })
    );

    const domainUser = UserEntity.reconstitute({
      idUsuario: currentUserRecord.idUsuario,
      nombreCompleto: currentUserRecord.nombreCompleto,
      documentoIdentidad: currentUserRecord.documentoIdentidad,
      correo: currentUserRecord.correo,
      telefono: currentUserRecord.telefono,
      contrasenaHash: 'EXISTING_HASH_PLACEHOLDER',
      esContrasenaTemporal: currentUserRecord.esContrasenaTemporal ?? false,
      estado: currentUserRecord.estado,
      firmaUrl: currentUserRecord.firmaUrl ?? null,
      roles: currentRoleEntities,
    });

    const wasAdmin = domainUser.isAdmin();
    const wasProfessional = domainUser.isProfessional();

    let nuevoHash: string | undefined;
    const nuevaClavePlana =
      command.nuevaContrasenaTemporal && command.nuevaContrasenaTemporal.trim() !== ''
        ? command.nuevaContrasenaTemporal
        : undefined;

    if (nuevaClavePlana) {
      UserEntity.validatePlainPassword(nuevaClavePlana);
      nuevoHash = this.passwordHasher
        ? await this.passwordHasher.hash(nuevaClavePlana)
        : nuevaClavePlana;
    }

    domainUser.updateProfile({
      nombreCompleto: command.nombreCompleto,
      documentoIdentidad: command.documentoIdentidad,
      correo: command.correo,
      telefono: command.telefono,
      nuevaContrasenaTemporalPlana: nuevaClavePlana,
      nuevoContrasenaHash: nuevoHash,
      roles: nextRoleEntities,
      firma: command.firma,
    });

    // Verificar que no se quite ROL-ADM al único administrador activo
    if (wasAdmin && !domainUser.isAdmin() && currentUserRecord.estado) {
      const remainingAdmins = await this.countRemainingActiveAdmins(command.idUsuario);
      if (remainingAdmins === 0) {
        throw new Error(
          'No se puede retirar el rol de Administrador (ROL-ADM) al único administrador activo del sistema.'
        );
      }
    }

    // Verificar que un profesional con citas activas no quede sin ROL-ODO ni ROL-ESP
    if (wasProfessional && !domainUser.isProfessional()) {
      const activeAppointments = this.userRepository.findActiveAppointmentsByProfessional
        ? await this.userRepository.findActiveAppointmentsByProfessional(command.idUsuario)
        : [];

      if (activeAppointments.length > 0) {
        const citasDetalle = activeAppointments
          .map((c) => `#${c.idCita} (${c.titulo} - ${c.estado})`)
          .join(', ');
        throw new Error(
          `No se pueden retirar los roles profesionales (ROL-ODO / ROL-ESP) porque el usuario tiene ${activeAppointments.length} cita(s) en estado Solicitada, Confirmada o En consulta: [${citasDetalle}].`
        );
      }
    }

    const updatedUser = await this.userRepository.updateUser({
      idUsuario: command.idUsuario,
      nombreCompleto: domainUser.nombreCompleto,
      documentoIdentidad: domainUser.documentoIdentidad,
      correo: domainUser.correo,
      telefono: domainUser.telefono,
      contrasenaHash: nuevoHash,
      esContrasenaTemporal: nuevaClavePlana ? true : undefined,
      firmaUrl: domainUser.firmaUrl,
      rolesIds: command.rolesIds,
    });

    if (this.auditLogger) {
      await this.auditLogger.log({
        usuario: command.ejecutadoPorUsuario || 'ROL-ADM',
        accion: 'Editar usuario',
        registroAfectado: `usuario:${command.idUsuario}`,
        valorAnterior: currentUserRecord,
        valorNuevo: updatedUser,
      });
    }

    return {
      message: 'Datos del usuario actualizados exitosamente.',
      data: updatedUser,
    };
  }

  private async countRemainingActiveAdmins(excludeUserId: number): Promise<number> {
    if (this.userRepository.countActiveAdmins) {
      return this.userRepository.countActiveAdmins(excludeUserId);
    }
    const activeUsers = await this.userRepository.searchUsers({ estado: true });
    return activeUsers.filter(
      (u) =>
        u.idUsuario !== excludeUserId &&
        u.roles.some(
          (r) =>
            r.estadoAsignacion &&
            (r.codigo === 'ROL-ADM' || r.nombreRol.toLowerCase().includes('administrador'))
        )
    ).length;
  }
}