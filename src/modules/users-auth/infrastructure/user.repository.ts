// src/modules/users-auth/infrastructure/user.repository.ts
import fs from 'fs';
import path from 'path';
import { db } from '../../../shared/infrastructure/database/database';
import { OneTimeTokenVO } from '../domain/one-time-token.vo';
import {
  ADMIN_USER_ROLE_PERMISSIONS,
  CLINICAL_PERMISSIONS,
  INITIAL_ROLE_CODES,
} from '../domain/role.entity';
import {
  ActiveAppointmentSummaryDTO,
  CreateUserPersistenceDTO,
  IUserRepository,
  RoleDTO,
  SearchUsersFilterDTO,
  UpdateUserPersistenceDTO,
  UserAuthCredentialsRecord,
  UserWithRolesDomainDTO,
} from '../domain/user.repository.interface';
import { RoleRow } from './user.model';

interface RoleJsonConfigMeta {
  codigo: string;
  descripcion: string;
  permisos: string[];
}

interface UserExtendedMeta {
  esContrasenaTemporal: boolean;
  firmaUrl: string | null;
}

export class UserRepository implements IUserRepository {
  // Almacén configurable JSON en caliente (RQNF-MAN-002) sincronizado con public.rol
  private static readonly roleMetadataStore = new Map<string, RoleJsonConfigMeta>([
    [
      'administrador del sistema',
      {
        codigo: 'ROL-ADM',
        descripcion: 'Administrador general de usuarios, roles, plantillas y agenda.',
        permisos: [
          ...ADMIN_USER_ROLE_PERMISSIONS,
          'RF-AGE-001',
          'RF-AGE-002',
          'RF-AGE-005',
          'RF-AGE-006',
          'RF-AGE-007',
          'RF-AGE-008',
          'RF-AGE-012',
          'RF-AGE-013',
          'RF-HCL-001',
          'RF-HCL-002',
          'RF-HCL-003',
          'RF-HCL-004',
          'RF-HCL-010',
          'RF-CON-004',
          'RF-CON-007',
          'RF-CON-008',
        ],
      },
    ],
    [
      'odontólogo general',
      {
        codigo: 'ROL-ODO',
        descripcion: 'Odontólogo general responsable de consulta e historia clínica.',
        permisos: [
          'RF-AGE-008',
          'RF-AGE-009',
          'RF-AGE-013',
          'RF-HCL-001',
          'RF-HCL-002',
          'RF-HCL-003',
          'RF-HCL-004',
          ...CLINICAL_PERMISSIONS,
        ],
      },
    ],
    [
      'especialista en ortodoncia',
      {
        codigo: 'ROL-ESP',
        descripcion: 'Especialista en ortodoncia responsable de consulta e historia clínica.',
        permisos: [
          'RF-AGE-008',
          'RF-AGE-009',
          'RF-AGE-013',
          'RF-HCL-001',
          'RF-HCL-002',
          'RF-HCL-003',
          'RF-HCL-004',
          ...CLINICAL_PERMISSIONS,
        ],
      },
    ],
    [
      'coordinadora de agendamiento',
      {
        codigo: 'ROL-COA',
        descripcion: 'Gestiona la agenda de todos los profesionales y datos de pacientes.',
        permisos: [
          'RF-AGE-001',
          'RF-AGE-002',
          'RF-AGE-005',
          'RF-AGE-006',
          'RF-AGE-007',
          'RF-AGE-008',
          'RF-AGE-012',
          'RF-AGE-013',
          'RF-HCL-001',
          'RF-HCL-002',
          'RF-HCL-003',
          'RF-HCL-004',
          'RF-HCL-010',
        ],
      },
    ],
    [
      'auxiliar de odontología',
      {
        codigo: 'ROL-AUX',
        descripcion: 'Apoya en agendamiento y asiste en consulta en curso.',
        permisos: [
          'RF-AGE-001',
          'RF-AGE-002',
          'RF-AGE-005',
          'RF-AGE-006',
          'RF-AGE-007',
          'RF-AGE-008',
          'RF-AGE-012',
          'RF-AGE-013',
          'RF-HCL-001',
          'RF-HCL-002',
          'RF-HCL-003',
          'RF-HCL-004',
          'RF-HCL-007',
          'RF-HCL-009',
          'RF-CON-001',
          'RF-CON-003',
          'RF-CON-006',
          'RF-DOC-005',
        ],
      },
    ],
    [
      'paciente',
      {
        codigo: 'ROL-PAC',
        descripcion: 'Rol público sin sesión para solicitud de citas y firma en tablet.',
        permisos: [],
      },
    ],
  ]);

  private static readonly METADATA_FILE = path.join(process.cwd(), 'storage', 'users_metadata.json');
  private static readonly userExtendedMetaStore = new Map<number, UserExtendedMeta>();
  private static userMetaLoaded = false;
  private static ensureUserMetaLoaded(): void {
    if (UserRepository.userMetaLoaded) return;
    try {
      const storageDir = path.dirname(UserRepository.METADATA_FILE);
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      if (fs.existsSync(UserRepository.METADATA_FILE)) {
        const raw = fs.readFileSync(UserRepository.METADATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        for (const [key, value] of Object.entries(parsed)) {
          UserRepository.userExtendedMetaStore.set(Number(key), value as UserExtendedMeta);
        }
      }
    } catch {
      // Ignorar fallback
    }
    UserRepository.userMetaLoaded = true;
  }

  private static persistUserMetadata(): void {
    try {
      const storageDir = path.dirname(UserRepository.METADATA_FILE);
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      const obj: Record<number, UserExtendedMeta> = {};
      for (const [key, value] of UserRepository.userExtendedMetaStore.entries()) {
        obj[key] = value;
      }
      fs.writeFileSync(UserRepository.METADATA_FILE, JSON.stringify(obj, null, 2), 'utf8');
    } catch {
      // Ignorar
    }
  }
  private static rolesTableSynced = false;

  private async ensureRolesTableSync(): Promise<void> {
    if (UserRepository.rolesTableSynced) return;
    try {
      await db.query(`
        UPDATE public.rol
        SET es_inicial = TRUE
        WHERE id_rol IN (1, 2, 3, 4, 5)
           OR LOWER(nombre_rol) IN (
             'administrador del sistema',
             'odontólogo general',
             'odontologo general',
             'especialista en ortodoncia',
             'coordinadora de agendamiento',
             'auxiliar de odontología',
             'auxiliar de odontologia',
             'paciente'
           );
      `);

      for (const [name, meta] of UserRepository.roleMetadataStore.entries()) {
        await db.query(
          `UPDATE public.rol
           SET permisos = CASE
                 WHEN permisos IS NULL OR permisos = '[]'::jsonb THEN $1::jsonb
                 ELSE permisos
               END,
               codigo_rol = COALESCE(codigo_rol, $2),
               descripcion = COALESCE(descripcion, $3)
           WHERE LOWER(nombre_rol) = $4;`,
          [JSON.stringify(meta.permisos), meta.codigo, meta.descripcion, name]
        );
      }
      UserRepository.rolesTableSynced = true;
    } catch (err) {
      console.warn('Advertencia al sincronizar estado inicial de roles en BD:', err);
    }
  }

  private enrichRoleRow(row: RoleRow): RoleDTO {
    const key = row.nombre_rol.trim().toLowerCase();
    const meta = UserRepository.roleMetadataStore.get(key);

    let parsedPermisos: string[] = [];
    if (Array.isArray(row.permisos)) {
      parsedPermisos = row.permisos;
    } else if (typeof row.permisos === 'string') {
      try {
        const parsed = JSON.parse(row.permisos);
        if (Array.isArray(parsed)) parsedPermisos = parsed;
      } catch {
        parsedPermisos = [];
      }
    }

    const permisosFinal =
      parsedPermisos.length > 0
        ? parsedPermisos
        : (meta?.permisos ?? ['RF-AGE-008']);

    const isInitialName = [
      'administrador del sistema',
      'odontólogo general',
      'odontologo general',
      'especialista en ortodoncia',
      'coordinadora de agendamiento',
      'auxiliar de odontología',
      'auxiliar de odontologia',
      'paciente',
    ].includes(key);

    const esInicialFinal =
      row.es_inicial !== undefined
        ? Boolean(row.es_inicial)
        : (meta?.codigo && INITIAL_ROLE_CODES.includes(meta.codigo as any)) || isInitialName;

    const codigoFinal =
      row.codigo_rol ??
      meta?.codigo ??
      `ROL-${row.nombre_rol
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 4)
        .toUpperCase()}`;

    const descripcionFinal =
      row.descripcion ??
      meta?.descripcion ??
      'Rol configurable del sistema OdontoLeal.';

    return {
      id_rol: row.id_rol,
      codigo: codigoFinal,
      nombre_rol: row.nombre_rol,
      descripcion: descripcionFinal,
      permisos: permisosFinal,
      es_inicial: esInicialFinal,
    };
  }

  // RF-USR-007: Crear rol
  async createRole(
    nombreRol: string,
    metadata?: { codigo: string; descripcion: string; permisos: string[] }
  ): Promise<RoleDTO> {
    await this.ensureRolesTableSync();
    const permisosJson = JSON.stringify(metadata?.permisos ?? ['RF-AGE-008']);
    const sql = `
      INSERT INTO public.rol (nombre_rol, permisos, es_inicial, codigo_rol, descripcion)
      VALUES ($1, $2::jsonb, FALSE, $3, $4)
      RETURNING id_rol, nombre_rol, permisos, es_inicial, codigo_rol, descripcion;
    `;
    const { rows } = await db.query<RoleRow>(sql, [
      nombreRol,
      permisosJson,
      metadata?.codigo ?? null,
      metadata?.descripcion ?? null,
    ]);
    const created = rows[0];

    if (metadata) {
      UserRepository.roleMetadataStore.set(nombreRol.trim().toLowerCase(), {
        codigo: metadata.codigo,
        descripcion: metadata.descripcion,
        permisos: metadata.permisos,
      });
    }

    return this.enrichRoleRow(created);
  }

  // RF-USR-010: Editar rol
  async updateRole(
    idRol: number,
    data: { nombreRol: string; descripcion: string; permisos: string[] }
  ): Promise<RoleDTO> {
    await this.ensureRolesTableSync();
    const prevRole = await this.findRoleById(idRol);
    const permisosJson = JSON.stringify(data.permisos);
    const sql = `
      UPDATE public.rol
      SET nombre_rol = $1, permisos = $2::jsonb, descripcion = $3
      WHERE id_rol = $4
      RETURNING id_rol, nombre_rol, permisos, es_inicial, codigo_rol, descripcion;
    `;
    const { rows } = await db.query<RoleRow>(sql, [data.nombreRol, permisosJson, data.descripcion, idRol]);
    if (rows.length === 0) {
      throw new Error(`El rol con ID ${idRol} no existe.`);
    }

    const codigoActual = prevRole?.codigo ?? 'ROL-GEN';
    if (prevRole) {
      UserRepository.roleMetadataStore.delete(prevRole.nombre_rol.trim().toLowerCase());
    }
    UserRepository.roleMetadataStore.set(data.nombreRol.trim().toLowerCase(), {
      codigo: codigoActual,
      descripcion: data.descripcion,
      permisos: data.permisos,
    });

    return this.enrichRoleRow(rows[0]);
  }

  async findAllRoles(): Promise<RoleDTO[]> {
    await this.ensureRolesTableSync();
    const { rows } = await db.query<RoleRow>(
      'SELECT id_rol, nombre_rol, permisos, es_inicial, codigo_rol, descripcion FROM public.rol ORDER BY id_rol ASC;'
    );
    return rows.map((r) => this.enrichRoleRow(r));
  }

  async findRoleById(idRol: number): Promise<RoleDTO | null> {
    await this.ensureRolesTableSync();
    const { rows } = await db.query<RoleRow>(
      'SELECT id_rol, nombre_rol, permisos, es_inicial, codigo_rol, descripcion FROM public.rol WHERE id_rol = $1;',
      [idRol]
    );
    return rows[0] ? this.enrichRoleRow(rows[0]) : null;
  }

  async countUsersByRole(idRol: number): Promise<number> {
    const countRes = await db.query<{ total: string }>(
      'SELECT COUNT(*) AS total FROM public.usuario_rol WHERE id_rol = $1;',
      [idRol]
    );
    return Number(countRes.rows[0]?.total ?? 0);
  }

  // RF-USR-011: Eliminar rol verificando que no sea rol inicial y que no tenga usuarios asignados
  async deleteRole(idRol: number): Promise<boolean> {
    await this.ensureRolesTableSync();
    const role = await this.findRoleById(idRol);
    if (!role) {
      throw new Error(`El rol con ID ${idRol} no existe.`);
    }
    if (role.es_inicial) {
      throw new Error(
        `El rol "${role.nombre_rol}" pertenece a la configuración inicial del sistema y no puede ser eliminado.`
      );
    }
    const total = await this.countUsersByRole(idRol);
    if (total > 0) {
      throw new Error(
        `No se puede eliminar el rol porque está asignado a ${total} usuario(s).`
      );
    }
    const { rowCount } = await db.query(
      'DELETE FROM public.rol WHERE id_rol = $1;',
      [idRol]
    );
    return (rowCount ?? 0) > 0;
  }

  // RF-USR-001: Crear usuario y asignarle roles en una transacción
  async createUser(dto: CreateUserPersistenceDTO): Promise<UserWithRolesDomainDTO> {
    return db.withTransaction(async (client) => {
      const insertUserSql = `
        INSERT INTO public.usuario (nombre_completo, documento_identidad, correo, telefono, contrasena_hash, estado, firma_base64)
        VALUES ($1, $2, $3, $4, $5, TRUE, $6)
        RETURNING id_usuario;
      `;
      const userRes = await client.query<{ id_usuario: number }>(insertUserSql, [
        dto.nombreCompleto,
        dto.documentoIdentidad,
        dto.correo,
        dto.telefono || null,
        dto.contrasenaHash,
        dto.firmaUrl || null,
      ]);
      const idUsuario = userRes.rows[0].id_usuario;

      for (const idRol of dto.rolesIds) {
        await client.query(
          `INSERT INTO public.usuario_rol (id_usuario, id_rol, estado) VALUES ($1, $2, TRUE);`,
          [idUsuario, idRol]
        );
      }

      UserRepository.userExtendedMetaStore.set(idUsuario, {
        esContrasenaTemporal: dto.esContrasenaTemporal ?? true,
        firmaUrl: dto.firmaUrl ?? null,
      });

      UserRepository.persistUserMetadata();
      const created = await this.findById(idUsuario, client);
      if (!created) throw new Error('Error al recuperar el usuario creado.');
      return created;
    });
  }

  // RF-USR-002: Editar usuario y actualizar sus roles en una transacción
  async updateUser(dto: UpdateUserPersistenceDTO): Promise<UserWithRolesDomainDTO> {
    return db.withTransaction(async (client) => {
      if (dto.contrasenaHash) {
        await client.query(
          `UPDATE public.usuario
           SET nombre_completo = $1,
               documento_identidad = $2,
               correo = $3,
               telefono = $4,
               contrasena_hash = $5,
               firma_base64 = CASE WHEN $6::text IS NOT NULL THEN $6 ELSE firma_base64 END
           WHERE id_usuario = $7;`,
          [
            dto.nombreCompleto,
            dto.documentoIdentidad,
            dto.correo,
            dto.telefono || null,
            dto.contrasenaHash,
            dto.firmaUrl !== undefined ? dto.firmaUrl : null,
            dto.idUsuario,
          ]
        );
      } else {
        await client.query(
          `UPDATE public.usuario
           SET nombre_completo = $1,
               documento_identidad = $2,
               correo = $3,
               telefono = $4,
               firma_base64 = CASE WHEN $5::text IS NOT NULL THEN $5 ELSE firma_base64 END
           WHERE id_usuario = $6;`,
          [
            dto.nombreCompleto,
            dto.documentoIdentidad,
            dto.correo,
            dto.telefono || null,
            dto.firmaUrl !== undefined ? dto.firmaUrl : null,
            dto.idUsuario,
          ]
        );
      }

      await client.query(`DELETE FROM public.usuario_rol WHERE id_usuario = $1;`, [
        dto.idUsuario,
      ]);

      for (const idRol of dto.rolesIds) {
        await client.query(
          `INSERT INTO public.usuario_rol (id_usuario, id_rol, estado) VALUES ($1, $2, TRUE);`,
          [dto.idUsuario, idRol]
        );
      }

      const prevMeta = UserRepository.userExtendedMetaStore.get(dto.idUsuario);
      UserRepository.userExtendedMetaStore.set(dto.idUsuario, {
        esContrasenaTemporal:
          dto.esContrasenaTemporal ?? prevMeta?.esContrasenaTemporal ?? false,
        firmaUrl:
          dto.firmaUrl !== undefined ? dto.firmaUrl : prevMeta?.firmaUrl ?? null,
      });

      UserRepository.persistUserMetadata();
      const updated = await this.findById(dto.idUsuario, client);
      if (!updated) throw new Error('Error al recuperar el usuario actualizado.');
      return updated;
    });
  }

  // RF-USR-004: Buscar usuarios con sus roles
  async searchUsers(filters: SearchUsersFilterDTO): Promise<UserWithRolesDomainDTO[]> {
    await this.ensureRolesTableSync();
    const params: any[] = [];
    const conditions: string[] = [];

    if (filters.documento) {
      params.push(filters.documento);
      conditions.push(`u.documento_identidad = $${params.length}`);
    }
    if (filters.nombre) {
      params.push(`%${filters.nombre}%`);
      conditions.push(`u.nombre_completo ILIKE $${params.length}`);
    }
    if (filters.estado !== undefined) {
      params.push(filters.estado);
      conditions.push(`u.estado = $${params.length}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        u.id_usuario AS "idUsuario",
        u.nombre_completo AS "nombreCompleto",
        u.documento_identidad AS "documentoIdentidad",
        u.correo,
        u.telefono,
        u.estado,
        u.firma_base64 AS "firmaUrl",
        COALESCE(
          json_agg(
            json_build_object(
              'idRol', r.id_rol,
              'nombreRol', r.nombre_rol,
              'codigoRol', r.codigo_rol,
              'descripcion', r.descripcion,
              'estadoAsignacion', ur.estado,
              'permisos', r.permisos,
              'esInicial', r.es_inicial
            )
          ) FILTER (WHERE r.id_rol IS NOT NULL), '[]'
        ) AS roles
      FROM public.usuario u
      LEFT JOIN public.usuario_rol ur ON u.id_usuario = ur.id_usuario
      LEFT JOIN public.rol r ON ur.id_rol = r.id_rol
      ${whereClause}
      GROUP BY u.id_usuario
      ORDER BY u.nombre_completo ASC;
    `;

    const { rows } = await db.query<UserWithRolesDomainDTO>(sql, params);
    return rows.map((user) => this.enrichUserWithMeta(user));
  }

  async findById(
    idUsuario: number,
    customClient?: any
  ): Promise<UserWithRolesDomainDTO | null> {
    const executor = customClient || db;
    const sql = `
      SELECT 
        u.id_usuario AS "idUsuario",
        u.nombre_completo AS "nombreCompleto",
        u.documento_identidad AS "documentoIdentidad",
        u.correo,
        u.telefono,
        u.estado,
        u.firma_base64 AS "firmaUrl",
        COALESCE(
          json_agg(
            json_build_object(
              'idRol', r.id_rol,
              'nombreRol', r.nombre_rol,
              'codigoRol', r.codigo_rol,
              'descripcion', r.descripcion,
              'estadoAsignacion', ur.estado,
              'permisos', r.permisos,
              'esInicial', r.es_inicial
            )
          ) FILTER (WHERE r.id_rol IS NOT NULL), '[]'
        ) AS roles
      FROM public.usuario u
      LEFT JOIN public.usuario_rol ur ON u.id_usuario = ur.id_usuario
      LEFT JOIN public.rol r ON ur.id_rol = r.id_rol
      WHERE u.id_usuario = $1
      GROUP BY u.id_usuario;
    `;
    const { rows } = await executor.query(sql, [idUsuario]);
    return rows[0] ? this.enrichUserWithMeta(rows[0]) : null;
  }

  async findByDocument(documentoIdentidad: string): Promise<UserWithRolesDomainDTO | null> {
    const results = await this.searchUsers({ documento: documentoIdentidad });
    return results[0] ?? null;
  }

  async findByEmail(correo: string): Promise<UserWithRolesDomainDTO | null> {
    const all = await this.searchUsers({});
    return (
      all.find((u) => u.correo.trim().toLowerCase() === correo.trim().toLowerCase()) ??
      null
    );
  }

  // RF-USR-005: Obtener credenciales completas para autenticación
  async findAuthCredentialsByEmail(
    correo: string
  ): Promise<UserAuthCredentialsRecord | null> {
    const sql = `
      SELECT 
        u.id_usuario AS "idUsuario",
        u.nombre_completo AS "nombreCompleto",
        u.documento_identidad AS "documentoIdentidad",
        u.correo,
        u.telefono,
        u.contrasena_hash AS "contrasenaHash",
        u.estado,
        u.firma_base64 AS "firmaUrl",
        COALESCE(
          json_agg(
            json_build_object(
              'idRol', r.id_rol,
              'nombreRol', r.nombre_rol,
              'codigoRol', r.codigo_rol,
              'descripcion', r.descripcion,
              'estadoAsignacion', ur.estado,
              'permisos', r.permisos,
              'esInicial', r.es_inicial
            )
          ) FILTER (WHERE r.id_rol IS NOT NULL), '[]'
        ) AS roles
      FROM public.usuario u
      LEFT JOIN public.usuario_rol ur ON u.id_usuario = ur.id_usuario
      LEFT JOIN public.rol r ON ur.id_rol = r.id_rol
      WHERE LOWER(u.correo) = LOWER($1)
      GROUP BY u.id_usuario;
    `;
    const { rows } = await db.query<any>(sql, [correo.trim()]);
    if (!rows[0]) return null;

    const enriched = this.enrichUserWithMeta(rows[0]);
    const meta = UserRepository.userExtendedMetaStore.get(enriched.idUsuario);

    return {
      ...enriched,
      contrasenaHash: rows[0].contrasenaHash,
      esContrasenaTemporal: meta?.esContrasenaTemporal ?? false,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    };
  }

  async updatePassword(
    idUsuario: number,
    nuevoHash: string,
    esContrasenaTemporal: boolean
  ): Promise<void> {
    await db.query(
      `UPDATE public.usuario SET contrasena_hash = $1 WHERE id_usuario = $2;`,
      [nuevoHash, idUsuario]
    );
    UserRepository.ensureUserMetaLoaded();
    const prev = UserRepository.userExtendedMetaStore.get(idUsuario);
    UserRepository.userExtendedMetaStore.set(idUsuario, {
      esContrasenaTemporal,
      firmaUrl: prev?.firmaUrl ?? null,
    });
    UserRepository.persistUserMetadata();
  }

  async findActiveAppointmentsByProfessional(
    idUsuario: number
  ): Promise<ActiveAppointmentSummaryDTO[]> {
    const { rows } = await db.query<{
      id_cita: number;
      titulo: string;
      estado: 'Solicitada' | 'Confirmada' | 'En consulta';
    }>(
      `SELECT id_cita, titulo, estado FROM public.cita 
       WHERE id_usuario = $1 AND estado IN ('Solicitada', 'Confirmada', 'En consulta');`,
      [idUsuario]
    );
    return rows.map((r) => ({
      idCita: r.id_cita,
      titulo: r.titulo,
      estado: r.estado,
    }));
  }

  // RF-USR-003: Activar / Inactivar usuario verificando que no tenga citas activas
  async updateStatus(
    idUsuario: number,
    nuevoEstado: boolean
  ): Promise<UserWithRolesDomainDTO | null> {
    if (!nuevoEstado) {
      const activeAppointments =
        await this.findActiveAppointmentsByProfessional(idUsuario);
      if (activeAppointments.length > 0) {
        throw new Error(
          `No se puede inactivar al profesional porque tiene ${activeAppointments.length} cita(s) pendiente(s) por atender.`
        );
      }
    }

    await db.query(
      `UPDATE public.usuario SET estado = $1 WHERE id_usuario = $2;`,
      [nuevoEstado, idUsuario]
    );
    return this.findById(idUsuario);
  }

  private enrichUserWithMeta(user: UserWithRolesDomainDTO): UserWithRolesDomainDTO {
    UserRepository.ensureUserMetaLoaded();
    const userMeta = UserRepository.userExtendedMetaStore.get(user.idUsuario);
    const enrichedRoles = (user.roles ?? []).map((r) => {
      const roleMeta = UserRepository.roleMetadataStore.get(
        r.nombreRol.trim().toLowerCase()
      );

      let parsedPermisos: string[] = [];
      if (Array.isArray(r.permisos)) {
        parsedPermisos = r.permisos;
      } else if (typeof (r as any).permisos === 'string') {
        try {
          const parsed = JSON.parse((r as any).permisos);
          if (Array.isArray(parsed)) parsedPermisos = parsed;
        } catch {
          parsedPermisos = [];
        }
      }

      const permisosFinal =
        parsedPermisos.length > 0
          ? parsedPermisos
          : (roleMeta?.permisos ?? ['RF-AGE-008']);

      const esInicialFinal =
        r.es_inicial !== undefined
          ? Boolean(r.es_inicial)
          : ((r as any).esInicial !== undefined
              ? Boolean((r as any).esInicial)
              : Boolean(roleMeta?.codigo && INITIAL_ROLE_CODES.includes(roleMeta.codigo as any)));

      return {
        ...r,
        codigo: (r as any).codigoRol ?? r.codigo ?? roleMeta?.codigo,
        descripcion: (r as any).descripcion ?? r.descripcion ?? roleMeta?.descripcion,
        permisos: permisosFinal,
        es_inicial: esInicialFinal,
      };
    });

    return {
      ...user,
      esContrasenaTemporal: userMeta?.esContrasenaTemporal ?? false,
      firmaUrl: (user as any).firmaUrl ?? userMeta?.firmaUrl ?? null,
      roles: enrichedRoles,
    };
  }

  // RF-USR-009: Persistencia de tokens de recuperación de contraseña (I8-007)
  private static tokenTableInitialized = false;

  private async ensureTokenTable(): Promise<void> {
    if (UserRepository.tokenTableInitialized) return;
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS public.token_recuperacion (
          token VARCHAR(255) PRIMARY KEY,
          id_usuario INTEGER NOT NULL,
          correo VARCHAR(150) NOT NULL,
          creado_en TIMESTAMP NOT NULL,
          expira_en TIMESTAMP NOT NULL,
          usado BOOLEAN DEFAULT FALSE NOT NULL,
          invalidado BOOLEAN DEFAULT FALSE NOT NULL
        );
      `);
      UserRepository.tokenTableInitialized = true;
    } catch (err) {
      console.warn('No se pudo inicializar la tabla token_recuperacion en BD:', err);
    }
  }

  async saveRecoveryToken(tokenVo: OneTimeTokenVO): Promise<void> {
    await this.ensureTokenTable();
    try {
      await db.query(
        `INSERT INTO public.token_recuperacion (token, id_usuario, correo, creado_en, expira_en, usado, invalidado)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (token) DO UPDATE SET
           usado = EXCLUDED.usado,
           invalidado = EXCLUDED.invalidado;`,
        [
          tokenVo.token,
          tokenVo.idUsuario,
          tokenVo.correo,
          tokenVo.creadoEn,
          tokenVo.expiraEn,
          tokenVo.usado,
          tokenVo.invalidado,
        ]
      );
    } catch (err) {
      console.warn('Error al guardar token de recuperación en BD:', err);
    }
  }

  async findRecoveryToken(token: string): Promise<OneTimeTokenVO | null> {
    await this.ensureTokenTable();
    try {
      const { rows } = await db.query<{
        token: string;
        id_usuario: number;
        correo: string;
        creado_en: string | Date;
        expira_en: string | Date;
        usado: boolean;
        invalidado: boolean;
      }>(
        `SELECT token, id_usuario, correo, creado_en, expira_en, usado, invalidado
         FROM public.token_recuperacion
         WHERE token = $1;`,
        [token]
      );
      if (rows.length === 0) return null;
      const r = rows[0];
      return OneTimeTokenVO.reconstitute({
        token: r.token,
        idUsuario: Number(r.id_usuario),
        correo: r.correo,
        creadoEn: new Date(r.creado_en),
        expiraEn: new Date(r.expira_en),
        usado: Boolean(r.usado),
        invalidado: Boolean(r.invalidado),
      });
    } catch (err) {
      console.warn('Error al buscar token de recuperación en BD:', err);
      return null;
    }
  }

  async updateRecoveryToken(tokenVo: OneTimeTokenVO): Promise<void> {
    await this.ensureTokenTable();
    try {
      await db.query(
        `UPDATE public.token_recuperacion
         SET usado = $1, invalidado = $2
         WHERE token = $3;`,
        [tokenVo.usado, tokenVo.invalidado, tokenVo.token]
      );
    } catch (err) {
      console.warn('Error al actualizar token de recuperación en BD:', err);
    }
  }

  async invalidatePreviousRecoveryTokens(idUsuario: number): Promise<void> {
    await this.ensureTokenTable();
    try {
      await db.query(
        `UPDATE public.token_recuperacion
         SET invalidado = TRUE
         WHERE id_usuario = $1 AND invalidado = FALSE;`,
        [idUsuario]
      );
    } catch (err) {
      console.warn('Error al invalidar tokens anteriores en BD:', err);
    }
  }
}