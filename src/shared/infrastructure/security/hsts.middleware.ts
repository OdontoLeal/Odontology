// src/shared/infrastructure/security/hsts.middleware.ts
import { NextFunction, Request, Response } from 'express';
import { envConfig } from '../../../app/config/env.config';

export interface HstsOptions {
  enabled?: boolean;
  maxAge?: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}

/**
 * Middleware para inyectar la cabecera HTTP Strict Transport Security (HSTS) - RFC 6797.
 * Requisito: RQNF-SEG-001 (Cifrado de datos en tránsito).
 *
 * - Le indica al navegador que durante el periodo especificado (maxAge)
 *   debe comunicarse exclusivamente a través de HTTPS.
 * - Previene ataques de degradación de cifrado (SSL Stripping / MitM).
 * - RFC 6797 Sección 7.2: Solo debe enviarse sobre conexiones seguras (HTTPS).
 * - No se inyecta en entornos locales (localhost / 127.0.0.1) para evitar almacenar
 *   políticas irreversibles en los navegadores de los desarrolladores.
 */
export function createHstsMiddleware(options: HstsOptions = {}) {
  const maxAge = options.maxAge ?? envConfig.security.hstsMaxAge;
  const includeSubDomains = options.includeSubDomains ?? envConfig.security.hstsIncludeSubDomains;
  const preload = options.preload ?? envConfig.security.hstsPreload;

  const directives = [`max-age=${maxAge}`];
  if (includeSubDomains) {
    directives.push('includeSubDomains');
  }
  if (preload) {
    directives.push('preload');
  }
  const headerValue = directives.join('; ');

  return (req: Request, res: Response, next: NextFunction): void => {
    const isEnabled = options.enabled ?? (envConfig.security.forceHttps || envConfig.isProduction);

    // Si no está habilitado, omitir
    if (!isEnabled) {
      return next();
    }

    // Evitar aplicar HSTS a hosts locales directos
    const rawHost = req.get('host') || req.hostname || '';
    const hostname = rawHost.split(':')[0];
    if (
      (hostname === 'localhost' || hostname === '127.0.0.1') &&
      options.enabled === undefined &&
      process.env.NODE_ENV !== 'production'
    ) {
      return next();
    }

    // RFC 6797 §7.2: Solo enviar HSTS si la conexión es segura
    const isSecure =
      req.secure ||
      req.protocol === 'https' ||
      req.headers['x-forwarded-proto'] === 'https';

    if (isSecure) {
      res.setHeader('Strict-Transport-Security', headerValue);
    }

    next();
  };
}

export const hstsMiddleware = createHstsMiddleware();
