// src/shared/infrastructure/security/access-control.ts
import crypto from 'crypto';
import { Request } from 'express';
import { db } from '../database/database';
import { auditLog } from '../audit/audit-log.service';

/** Mensaje único de acceso denegado (RQNF-SEG-003, D-18). */
export const ACCESS_DENIED_MESSAGE = 'No tiene permiso para realizar esta acción';

/** Error de dominio para accesos no permitidos: el manejador HTTP lo traduce a 403. */
export class ForbiddenError extends Error {
  public readonly statusCode = 403;
  constructor(message: string = ACCESS_DENIED_MESSAGE) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** Usuario de la sesión, leído de la BD en cada petición (RF-USR-002, RF-USR-003). */
export interface SessionUser {
  idUsuario: number;
  correo: string;
  nombreCompleto: string;
  roles: string[];
  permisos: string[];
}

export function getSessionUser(req: Request): SessionUser | undefined {
  return (req as any).user as SessionUser | undefined;
}

export function hasRole(user: SessionUser | undefined, ...roles: string[]): boolean {
  return Boolean(user && user.roles.some((r) => roles.includes(r)));
}

export function hasPermission(user: SessionUser | undefined, ...permisos: string[]): boolean {
  return Boolean(user && user.permisos.some((p) => permisos.includes(p)));
}

/**
 * Carga el usuario activo con sus roles y permisos vigentes. Devuelve null si
 * no existe, está inactivo o es el usuario técnico "Sistema".
 */
export async function loadActiveSessionUser(idUsuario: number): Promise<SessionUser | null> {
  const { rows } = await db.query<{
    id_usuario: number;
    correo: string;
    nombre_completo: string;
    roles: string[] | null;
    permisos: string[] | null;
  }>(
    `SELECT u.id_usuario, u.correo, u.nombre_completo,
            COALESCE(array_agg(DISTINCT r.codigo_rol) FILTER (WHERE r.codigo_rol IS NOT NULL), '{}') AS roles,
            COALESCE(
              (SELECT array_agg(DISTINCT p)
                 FROM public.usuario_rol ur2
                 JOIN public.rol r2 ON r2.id_rol = ur2.id_rol
                 CROSS JOIN LATERAL jsonb_array_elements_text(r2.permisos) AS t(p)
                WHERE ur2.id_usuario = u.id_usuario AND ur2.estado = true),
              '{}'
            ) AS permisos
       FROM public.usuario u
       LEFT JOIN public.usuario_rol ur ON ur.id_usuario = u.id_usuario AND ur.estado = true
       LEFT JOIN public.rol r ON r.id_rol = ur.id_rol
      WHERE u.id_usuario = $1 AND u.estado = true AND u.es_sistema = false
      GROUP BY u.id_usuario;`,
    [idUsuario]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    idUsuario: row.id_usuario,
    correo: row.correo,
    nombreCompleto: row.nombre_completo,
    roles: row.roles ?? [],
    permisos: row.permisos ?? [],
  };
}

/** Registra un acceso bloqueado (RQNF-SEG-003 + RQNF-SEG-009). */
export async function recordBlockedAccess(
  req: Request,
  detalle: Record<string, unknown> = {}
): Promise<void> {
  const user = getSessionUser(req);
  await auditLog.record({
    idUsuario: user?.idUsuario ?? null,
    actor: user?.correo ?? 'Anónimo',
    accion: 'ACCESO_BLOQUEADO',
    entidad: 'rbac',
    idRegistro: req.originalUrl.slice(0, 60),
    detalle: { metodo: req.method, ruta: req.originalUrl, roles: user?.roles ?? [], ...detalle },
  });
}

// ----------------------------------------------------------------------
// Revocación de sesiones (RF-USR-008): se guarda solo el hash del token.
// ----------------------------------------------------------------------
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function isTokenRevoked(token: string): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT 1 FROM public.sesion_revocada WHERE token_hash = $1;`,
    [hashToken(token)]
  );
  return rows.length > 0;
}

export async function revokeToken(
  token: string,
  idUsuario: number | null,
  expiresAtEpochSeconds: number
): Promise<void> {
  await db.query(
    `INSERT INTO public.sesion_revocada (token_hash, id_usuario, expira_en)
     VALUES ($1, $2, to_timestamp($3))
     ON CONFLICT (token_hash) DO NOTHING;`,
    [hashToken(token), idUsuario, expiresAtEpochSeconds]
  );
  // Limpieza de revocaciones ya vencidas (el token ya no sería válido de todos modos).
  await db.query(`DELETE FROM public.sesion_revocada WHERE expira_en < now();`);
}

/** Extrae el token de la cabecera Bearer o de la cookie de sesión. */
export function extractToken(req: Request): { token?: string; malformed: boolean } {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return { token: parts[1], malformed: false };
    }
    return { malformed: true };
  }
  if (req.headers.cookie) {
    for (const cookie of req.headers.cookie.split(';')) {
      const [name, ...rest] = cookie.trim().split('=');
      if (name === 'session_token') {
        return { token: decodeURIComponent(rest.join('=')), malformed: false };
      }
    }
  }
  return { malformed: false };
}
