// src/modules/users-auth/infrastructure/user.repository.ts
import { db } from '../../../shared/infrastructure/database/database';
import { OneTimeTokenVO } from '../domain/one-time-token.vo';
import {
  ActiveAppointmentSummaryDTO,
  CreateUserPersistenceDTO,
  IUserRepository,
  LoginLockoutRecordDTO,
  RoleDTO,
  SearchUsersFilterDTO,
  UpdateUserPersistenceDTO,
  UserAuthCredentialsRecord,
  UserWithRolesDomainDTO,
} from '../domain/user.repository.interface';
import { RoleRow } from './user.model';

/**
 * Persistencia de usuarios, roles y credenciales.
 *
 * Todo vive en PostgreSQL (DEF-23, T-2): la marca de contraseña temporal en
 * `usuario.es_contrasena_temporal`, los permisos solo en `rol.permisos`
 * (RQNF-MAN-002) y el bloqueo por intentos en `intento_login`. El usuario
 * técnico "Sistema" (`es_sistema`) nunca se lista ni inicia sesión.
 */
const USER_WITH_ROLES_SELECT = `
  SELECT
    u.id_usuario AS "idUsuario",
    u.nombre_completo AS "nombreCompleto",
    u.documento_identidad AS "documentoIdentidad",
    u.correo,
    u.telefono,
    u.estado,
    u.es_contrasena_temporal AS "esContrasenaTemporal",
    u.firma_base64 AS "firmaUrl",
    COALESCE(
      json_agg(
        json_build_object(
          'idRol', r.id_rol,
          'nombreRol', r.nombre_rol,
          'codigo', r.codigo_rol,
          'descripcion', r.descripcion,
          'estadoAsignacion', ur.estado,
          'permisos', r.permisos,
          'es_inicial', r.es_inicial
        ) ORDER BY r.id_rol
      ) FILTER (WHERE r.id_rol IS NOT NULL), '[]'
    ) AS roles
  FROM public.usuario u
  LEFT JOIN public.usuario_rol ur ON u.id_usuario = ur.id_usuario
  LEFT JOIN public.rol r ON ur.id_rol = r.id_rol
`;

const ROLE_COLUMNS = 'id_rol, nombre_rol, permisos, es_inicial, codigo_rol, descripcion';

function parsePermisos(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export class UserRepository implements IUserRepository {
  private mapRole(row: RoleRow): RoleDTO {
    return {
      id_rol: row.id_rol,
      codigo: row.codigo_rol ?? undefined,
      nombre_rol: row.nombre_rol,
      descripcion: row.descripcion ?? '',
      permisos: parsePermisos(row.permisos),
      es_inicial: Boolean(row.es_inicial),
    };
  }

  private mapUser(row: any): UserWithRolesDomainDTO {
    return {
      idUsuario: row.idUsuario,
      nombreCompleto: row.nombreCompleto,
      documentoIdentidad: row.documentoIdentidad,
      correo: row.correo,
      telefono: row.telefono,
      estado: row.estado,
      esContrasenaTemporal: Boolean(row.esContrasenaTemporal),
      firmaUrl: row.firmaUrl ?? null,
      roles: (row.roles ?? []).map((r: any) => ({
        idRol: r.idRol,
        codigo: r.codigo ?? undefined,
        codigoRol: r.codigo ?? undefined,
        nombreRol: r.nombreRol,
        descripcion: r.descripcion ?? '',
        permisos: parsePermisos(r.permisos),
        es_inicial: Boolean(r.es_inicial),
        estadoAsignacion: Boolean(r.estadoAsignacion),
      })),
    };
  }

  // ------------------------------------------------------------------
  // Roles (RF-USR-007, RF-USR-010, RF-USR-011)
  // ------------------------------------------------------------------
  async createRole(
    nombreRol: string,
    metadata?: { codigo: string; descripcion: string; permisos: string[] }
  ): Promise<RoleDTO> {
    const { rows } = await db.query<RoleRow>(
      `INSERT INTO public.rol (nombre_rol, permisos, es_inicial, codigo_rol, descripcion)
       VALUES ($1, $2::jsonb, FALSE, $3, $4)
       RETURNING ${ROLE_COLUMNS};`,
      [
        nombreRol,
        JSON.stringify(metadata?.permisos ?? []),
        metadata?.codigo ?? null,
        metadata?.descripcion ?? null,
      ]
    );
    return this.mapRole(rows[0]);
  }

  async updateRole(
    idRol: number,
    data: { nombreRol: string; descripcion: string; permisos: string[] }
  ): Promise<RoleDTO> {
    const { rows } = await db.query<RoleRow>(
      `UPDATE public.rol
          SET nombre_rol = $1, permisos = $2::jsonb, descripcion = $3
        WHERE id_rol = $4
        RETURNING ${ROLE_COLUMNS};`,
      [data.nombreRol, JSON.stringify(data.permisos), data.descripcion, idRol]
    );
    if (rows.length === 0) {
      throw new Error(`El rol con ID ${idRol} no existe.`);
    }
    return this.mapRole(rows[0]);
  }

  async findAllRoles(): Promise<RoleDTO[]> {
    const { rows } = await db.query<RoleRow>(
      `SELECT ${ROLE_COLUMNS} FROM public.rol ORDER BY id_rol ASC;`
    );
    return rows.map((r) => this.mapRole(r));
  }

  async findRoleById(idRol: number): Promise<RoleDTO | null> {
    const { rows } = await db.query<RoleRow>(
      `SELECT ${ROLE_COLUMNS} FROM public.rol WHERE id_rol = $1;`,
      [idRol]
    );
    return rows[0] ? this.mapRole(rows[0]) : null;
  }

  async findRoleByCodeOrName(codigo?: string, nombreRol?: string): Promise<RoleDTO | null> {
    const { rows } = await db.query<RoleRow>(
      `SELECT ${ROLE_COLUMNS} FROM public.rol
        WHERE ($1::text IS NOT NULL AND UPPER(codigo_rol) = UPPER($1))
           OR ($2::text IS NOT NULL AND LOWER(nombre_rol) = LOWER($2))
        LIMIT 1;`,
      [codigo?.trim() || null, nombreRol?.trim() || null]
    );
    return rows[0] ? this.mapRole(rows[0]) : null;
  }

  async countUsersByRole(idRol: number): Promise<number> {
    const { rows } = await db.query<{ total: string }>(
      'SELECT COUNT(*) AS total FROM public.usuario_rol WHERE id_rol = $1;',
      [idRol]
    );
    return Number(rows[0]?.total ?? 0);
  }

  // RF-USR-011: no se eliminan roles iniciales ni roles asignados
  async deleteRole(idRol: number): Promise<boolean> {
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
      throw new Error(`No se puede eliminar el rol porque está asignado a ${total} usuario(s).`);
    }
    const { rowCount } = await db.query('DELETE FROM public.rol WHERE id_rol = $1;', [idRol]);
    return (rowCount ?? 0) > 0;
  }

  // ------------------------------------------------------------------
  // Usuarios (RF-USR-001 a RF-USR-004)
  // ------------------------------------------------------------------
  async createUser(dto: CreateUserPersistenceDTO): Promise<UserWithRolesDomainDTO> {
    return db.withTransaction(async (client) => {
      const userRes = await client.query<{ id_usuario: number }>(
        `INSERT INTO public.usuario
           (nombre_completo, documento_identidad, correo, telefono, contrasena_hash, estado, firma_base64, es_contrasena_temporal)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7)
         RETURNING id_usuario;`,
        [
          dto.nombreCompleto,
          dto.documentoIdentidad,
          dto.correo,
          dto.telefono || null,
          dto.contrasenaHash,
          dto.firmaUrl || null,
          dto.esContrasenaTemporal ?? true,
        ]
      );
      const idUsuario = userRes.rows[0].id_usuario;

      for (const idRol of dto.rolesIds) {
        await client.query(
          `INSERT INTO public.usuario_rol (id_usuario, id_rol, estado) VALUES ($1, $2, TRUE);`,
          [idUsuario, idRol]
        );
      }

      const created = await this.findById(idUsuario, client);
      if (!created) throw new Error('Error al recuperar el usuario creado.');
      return created;
    });
  }

  async updateUser(dto: UpdateUserPersistenceDTO): Promise<UserWithRolesDomainDTO> {
    return db.withTransaction(async (client) => {
      await client.query(
        `UPDATE public.usuario
            SET nombre_completo = $1,
                documento_identidad = $2,
                correo = $3,
                telefono = $4,
                contrasena_hash = COALESCE($5, contrasena_hash),
                firma_base64 = CASE WHEN $6::text IS NOT NULL THEN $6 ELSE firma_base64 END,
                es_contrasena_temporal = COALESCE($7, es_contrasena_temporal)
          WHERE id_usuario = $8;`,
        [
          dto.nombreCompleto,
          dto.documentoIdentidad,
          dto.correo,
          dto.telefono || null,
          dto.contrasenaHash || null,
          dto.firmaUrl !== undefined ? dto.firmaUrl : null,
          dto.esContrasenaTemporal ?? null,
          dto.idUsuario,
        ]
      );

      await client.query(`DELETE FROM public.usuario_rol WHERE id_usuario = $1;`, [dto.idUsuario]);
      for (const idRol of dto.rolesIds) {
        await client.query(
          `INSERT INTO public.usuario_rol (id_usuario, id_rol, estado) VALUES ($1, $2, TRUE);`,
          [dto.idUsuario, idRol]
        );
      }

      const updated = await this.findById(dto.idUsuario, client);
      if (!updated) throw new Error('Error al recuperar el usuario actualizado.');
      return updated;
    });
  }

  // RF-USR-004: filtros combinables por documento, nombre (sin tildes), rol y estado
  async searchUsers(filters: SearchUsersFilterDTO): Promise<UserWithRolesDomainDTO[]> {
    const params: unknown[] = [];
    const conditions: string[] = ['u.es_sistema = false'];

    if (filters.documento) {
      params.push(filters.documento);
      conditions.push(`u.documento_identidad = $${params.length}`);
    }
    if (filters.nombre) {
      params.push(`%${filters.nombre}%`);
      conditions.push(
        `TRANSLATE(LOWER(u.nombre_completo), 'áéíóúäëïöüàèìòù', 'aeiouaeiouaeiou')
           LIKE TRANSLATE(LOWER($${params.length}), 'áéíóúäëïöüàèìòù', 'aeiouaeiouaeiou')`
      );
    }
    if (filters.estado !== undefined) {
      params.push(filters.estado);
      conditions.push(`u.estado = $${params.length}`);
    }
    if (filters.idRol !== undefined) {
      params.push(filters.idRol);
      conditions.push(
        `EXISTS (SELECT 1 FROM public.usuario_rol ur_f WHERE ur_f.id_usuario = u.id_usuario AND ur_f.id_rol = $${params.length})`
      );
    }
    if (filters.codigoRol) {
      params.push(filters.codigoRol);
      conditions.push(
        `EXISTS (SELECT 1 FROM public.usuario_rol ur_f JOIN public.rol r_f ON r_f.id_rol = ur_f.id_rol
                  WHERE ur_f.id_usuario = u.id_usuario AND r_f.codigo_rol = $${params.length})`
      );
    }

    const { rows } = await db.query(
      `${USER_WITH_ROLES_SELECT}
       WHERE ${conditions.join(' AND ')}
       GROUP BY u.id_usuario
       ORDER BY u.nombre_completo ASC;`,
      params
    );
    return rows.map((row) => this.mapUser(row));
  }

  async findById(idUsuario: number, customClient?: any): Promise<UserWithRolesDomainDTO | null> {
    const executor = customClient || db;
    const { rows } = await executor.query(
      `${USER_WITH_ROLES_SELECT}
       WHERE u.id_usuario = $1 AND u.es_sistema = false
       GROUP BY u.id_usuario;`,
      [idUsuario]
    );
    return rows[0] ? this.mapUser(rows[0]) : null;
  }

  async findByDocument(documentoIdentidad: string): Promise<UserWithRolesDomainDTO | null> {
    const results = await this.searchUsers({ documento: documentoIdentidad });
    return results[0] ?? null;
  }

  async findByEmail(correo: string): Promise<UserWithRolesDomainDTO | null> {
    const { rows } = await db.query(
      `${USER_WITH_ROLES_SELECT}
       WHERE LOWER(u.correo) = LOWER($1) AND u.es_sistema = false
       GROUP BY u.id_usuario;`,
      [correo.trim()]
    );
    return rows[0] ? this.mapUser(rows[0]) : null;
  }

  // RF-USR-002/003: no se deja el sistema sin administrador activo
  async countActiveAdmins(excludeUserId?: number): Promise<number> {
    const { rows } = await db.query<{ total: string }>(
      `SELECT COUNT(DISTINCT u.id_usuario) AS total
         FROM public.usuario u
         JOIN public.usuario_rol ur ON ur.id_usuario = u.id_usuario AND ur.estado = true
         JOIN public.rol r ON r.id_rol = ur.id_rol
        WHERE r.codigo_rol = 'ROL-ADM' AND u.estado = true AND u.es_sistema = false
          AND ($1::int IS NULL OR u.id_usuario <> $1);`,
      [excludeUserId ?? null]
    );
    return Number(rows[0]?.total ?? 0);
  }

  async findActiveAppointmentsByProfessional(idUsuario: number): Promise<ActiveAppointmentSummaryDTO[]> {
    const { rows } = await db.query<{
      id_cita: number;
      titulo: string;
      estado: 'Solicitada' | 'Confirmada' | 'En consulta';
    }>(
      `SELECT id_cita, titulo, estado FROM public.cita
        WHERE id_usuario = $1 AND estado IN ('Solicitada', 'Confirmada', 'En consulta');`,
      [idUsuario]
    );
    return rows.map((r) => ({ idCita: r.id_cita, titulo: r.titulo, estado: r.estado }));
  }

  // RF-USR-003: no se inactiva a un profesional con citas por atender
  async updateStatus(idUsuario: number, nuevoEstado: boolean): Promise<UserWithRolesDomainDTO | null> {
    if (!nuevoEstado) {
      const activeAppointments = await this.findActiveAppointmentsByProfessional(idUsuario);
      if (activeAppointments.length > 0) {
        const listado = activeAppointments.map((c) => `#${c.idCita} (${c.estado})`).join(', ');
        throw new Error(
          `No se puede inactivar al profesional porque tiene ${activeAppointments.length} cita(s) por atender: ${listado}.`
        );
      }
    }
    await db.query(
      `UPDATE public.usuario SET estado = $1 WHERE id_usuario = $2 AND es_sistema = false;`,
      [nuevoEstado, idUsuario]
    );
    return this.findById(idUsuario);
  }

  // ------------------------------------------------------------------
  // Autenticación (RF-USR-005, RF-USR-009)
  // ------------------------------------------------------------------
  async findAuthCredentialsByEmail(correo: string): Promise<UserAuthCredentialsRecord | null> {
    const { rows } = await db.query(
      `SELECT base.*, u2.contrasena_hash AS "contrasenaHash"
         FROM (
           ${USER_WITH_ROLES_SELECT}
           WHERE LOWER(u.correo) = LOWER($1) AND u.es_sistema = false
           GROUP BY u.id_usuario
         ) base
         JOIN public.usuario u2 ON u2.id_usuario = base."idUsuario";`,
      [correo.trim()]
    );
    if (!rows[0]) return null;

    const user = this.mapUser(rows[0]);
    const lockout = await this.getLoginLockoutByEmail(correo);
    return {
      ...user,
      contrasenaHash: rows[0].contrasenaHash,
      esContrasenaTemporal: Boolean(user.esContrasenaTemporal),
      intentosFallidos: lockout?.intentosFallidos ?? 0,
      bloqueadoHasta: lockout?.bloqueadoHasta ?? null,
    };
  }

  async getLoginLockoutByEmail(correo: string): Promise<LoginLockoutRecordDTO | null> {
    const { rows } = await db.query<{
      correo: string;
      intentos_fallidos: number;
      bloqueado_hasta: string | Date | null;
    }>(
      `SELECT correo, intentos_fallidos, bloqueado_hasta FROM public.intento_login WHERE correo = LOWER($1);`,
      [correo.trim()]
    );
    if (!rows[0]) return null;
    return {
      correo: rows[0].correo,
      intentosFallidos: Number(rows[0].intentos_fallidos),
      bloqueadoHasta: rows[0].bloqueado_hasta ? new Date(rows[0].bloqueado_hasta) : null,
    };
  }

  async saveLoginLockoutByEmail(record: LoginLockoutRecordDTO): Promise<void> {
    await db.query(
      `INSERT INTO public.intento_login (correo, intentos_fallidos, bloqueado_hasta)
       VALUES (LOWER($1), $2, $3)
       ON CONFLICT (correo) DO UPDATE
         SET intentos_fallidos = EXCLUDED.intentos_fallidos,
             bloqueado_hasta = EXCLUDED.bloqueado_hasta;`,
      [record.correo.trim(), record.intentosFallidos, record.bloqueadoHasta]
    );
  }

  async updatePassword(idUsuario: number, nuevoHash: string, esContrasenaTemporal: boolean): Promise<void> {
    await db.query(
      `UPDATE public.usuario
          SET contrasena_hash = $1, es_contrasena_temporal = $2
        WHERE id_usuario = $3 AND es_sistema = false;`,
      [nuevoHash, esContrasenaTemporal, idUsuario]
    );
  }

  // ------------------------------------------------------------------
  // Enlaces de recuperación de un solo uso (RF-USR-009)
  // ------------------------------------------------------------------
  async saveRecoveryToken(tokenVo: OneTimeTokenVO): Promise<void> {
    await db.query(
      `INSERT INTO public.token_recuperacion (token, id_usuario, correo, creado_en, expira_en, usado, invalidado)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (token) DO UPDATE SET usado = EXCLUDED.usado, invalidado = EXCLUDED.invalidado;`,
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
  }

  async findRecoveryToken(token: string): Promise<OneTimeTokenVO | null> {
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
         FROM public.token_recuperacion WHERE token = $1;`,
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
  }

  async updateRecoveryToken(tokenVo: OneTimeTokenVO): Promise<void> {
    await db.query(
      `UPDATE public.token_recuperacion SET usado = $1, invalidado = $2 WHERE token = $3;`,
      [tokenVo.usado, tokenVo.invalidado, tokenVo.token]
    );
  }

  async invalidatePreviousRecoveryTokens(idUsuario: number): Promise<void> {
    await db.query(
      `UPDATE public.token_recuperacion SET invalidado = TRUE
        WHERE id_usuario = $1 AND invalidado = FALSE;`,
      [idUsuario]
    );
  }
}
