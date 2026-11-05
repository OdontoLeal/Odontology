// src/shared/infrastructure/security/auth.middleware.ts
import { NextFunction, Request, Response } from 'express';
import { JwtTokenService } from './token.service';
import {
  ACCESS_DENIED_MESSAGE,
  extractToken,
  getSessionUser,
  hasPermission,
  isTokenRevoked,
  loadActiveSessionUser,
  recordBlockedAccess,
} from './access-control';

/**
 * Autenticación (RQNF-SEG-003, RF-USR-008).
 *
 * - Valida la firma y vigencia del token y que no haya sido revocado al cerrar sesión.
 * - Carga el usuario, sus roles y permisos desde la BD en cada petición: los
 *   cambios de roles (RF-USR-002) y la inactivación (RF-USR-003) se aplican
 *   desde la siguiente acción del usuario.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, malformed } = extractToken(req);

    if (malformed) {
      res.status(401).json({ message: 'Formato de autorización no válido. Debe ser Bearer <token>.' });
      return;
    }
    if (!token) {
      res.status(401).json({ message: 'Sesión no iniciada. Inicie sesión para continuar.' });
      return;
    }

    const payload = JwtTokenService.verifyToken(token);
    if (!payload) {
      res.status(401).json({ message: 'La sesión no es válida o expiró. Inicie sesión nuevamente.' });
      return;
    }

    if (await isTokenRevoked(token)) {
      res.status(401).json({ message: 'La sesión fue cerrada. Inicie sesión nuevamente.' });
      return;
    }

    const user = await loadActiveSessionUser(payload.idUsuario);
    if (!user) {
      res.status(401).json({ message: 'Usuario inactivo. Comuníquese con el administrador del sistema' });
      return;
    }

    (req as any).user = user;
    (req as any).sessionToken = { token, exp: payload.exp };
    next();
  } catch (error) {
    console.error('Error validando la sesión:', (error as Error).message);
    res.status(500).json({ message: 'Error interno en el servidor. Por favor intente más tarde.' });
  }
}

/**
 * Autorización por permiso (RBAC). Basta con que el usuario tenga uno de los
 * permisos indicados (códigos de RF, configurables en `rol.permisos`).
 * Todo intento bloqueado se audita y responde 403 sin datos.
 */
export function requirePermission(...permisos: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = getSessionUser(req);
    if (!user) {
      res.status(401).json({ message: 'Sesión no iniciada. Inicie sesión para continuar.' });
      return;
    }
    if (hasPermission(user, ...permisos)) {
      next();
      return;
    }
    try {
      await recordBlockedAccess(req, { permisoRequerido: permisos });
    } catch (error) {
      console.error('No se pudo auditar el acceso bloqueado:', (error as Error).message);
      res.status(500).json({ message: 'Error interno en el servidor. Por favor intente más tarde.' });
      return;
    }
    res.status(403).json({ message: ACCESS_DENIED_MESSAGE });
  };
}
