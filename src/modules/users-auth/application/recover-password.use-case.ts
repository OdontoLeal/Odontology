// src/modules/users-auth/application/recover-password.use-case.ts
import { OneTimeTokenVO } from '../domain/one-time-token.vo';
import { UserEntity } from '../domain/user.entity';
import {
  IAuditLoggerPort,
  IMailerPort,
  IPasswordHasher,
  IUserRepository,
} from '../domain/user.repository.interface';
import { AuthenticateUserUseCase } from './authenticate-user.use-case';

export interface RequestPasswordRecoveryCommand {
  correo: string;
  baseRecoveryUrl?: string;
  now?: Date;
}

export interface ResetPasswordWithTokenCommand {
  token: string;
  nuevaContrasena: string;
  confirmacionContrasena: string;
  now?: Date;
}

export interface RecoverPasswordResult {
  message: string;
}

export class RecoverPasswordUseCase {
  public static readonly GENERIC_RESPONSE_MESSAGE =
    'Si el correo está registrado, recibirá un enlace para restablecer su contraseña';

  private static readonly memoryTokenStore = new Map<string, OneTimeTokenVO>();

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher?: IPasswordHasher,
    private readonly mailer?: IMailerPort,
    private readonly auditLogger?: IAuditLoggerPort
  ) {}

  // Paso 1: Solicitar enlace de recuperación (RF-USR-009)
  public async requestRecoveryLink(
    command: RequestPasswordRecoveryCommand
  ): Promise<RecoverPasswordResult> {
    const now = command.now ?? new Date();
    const normalizedEmail = (command.correo ?? '').trim().toLowerCase();

    if (!normalizedEmail) {
      return { message: RecoverPasswordUseCase.GENERIC_RESPONSE_MESSAGE };
    }

    const user = this.userRepository.findByEmail
      ? await this.userRepository.findByEmail(normalizedEmail)
      : (await this.userRepository.searchUsers({})).find(
          (u) => u.correo.toLowerCase() === normalizedEmail
        ) ?? null;

    // Solo si el correo pertenece a un usuario Activo se genera y envía el enlace (RF-USR-009)
    if (user && user.estado) {
      await this.invalidatePreviousTokens(user.idUsuario);

      const rawToken = this.generateSecureHexToken(32);
      const tokenVo = OneTimeTokenVO.create({
        token: rawToken,
        idUsuario: user.idUsuario,
        correo: user.correo,
        now,
      });

      RecoverPasswordUseCase.memoryTokenStore.set(rawToken, tokenVo);
      if (this.userRepository.saveRecoveryToken) {
        await this.userRepository.saveRecoveryToken(tokenVo);
      }

      const rawBase = command.baseRecoveryUrl ?? 'http://localhost:5173';
      const cleanBase = rawBase.replace(/\/+$/, '');
      const recoveryLink = cleanBase.includes('?')
        ? `${cleanBase}&token=${rawToken}`
        : `${cleanBase}/?token=${rawToken}`;

      let previewUrl: string | null = null;
      if (this.mailer) {
        const mailRes = await this.mailer.sendPasswordRecoveryEmail({
          to: user.correo,
          nombreCompleto: user.nombreCompleto,
          recoveryLink,
          expiresInMinutes: OneTimeTokenVO.EXPIRATION_MINUTES,
        });
        if (mailRes && typeof mailRes === 'object' && 'previewUrl' in mailRes) {
          previewUrl = mailRes.previewUrl ?? null;
        }
      }

      if (this.auditLogger) {
        await this.auditLogger.log({
          usuario: user.correo,
          accion: 'Generación de enlace de recuperación de contraseña',
          registroAfectado: `usuario:${user.idUsuario}`,
        });
      }

      return {
        message: RecoverPasswordUseCase.GENERIC_RESPONSE_MESSAGE,
      };
    }

    return {
      message: RecoverPasswordUseCase.GENERIC_RESPONSE_MESSAGE,
    };
  }

  // Paso 2: Restablecer la contraseña usando el enlace de un solo uso
  public async resetPassword(
    command: ResetPasswordWithTokenCommand
  ): Promise<RecoverPasswordResult> {
    const now = command.now ?? new Date();
    const cleanToken = (command.token ?? '').trim();

    if (!cleanToken) {
      throw new Error('El enlace no es válido o ya venció. Solicite uno nuevo');
    }

    const tokenVo = await this.findToken(cleanToken);
    if (!tokenVo) {
      throw new Error('El enlace no es válido o ya venció. Solicite uno nuevo');
    }

    tokenVo.assertIsValid(now);

    // Validar formato de contraseña ANTES de consumir o modificar el token (I8-006)
    UserEntity.validatePlainPassword(command.nuevaContrasena);

    if (command.nuevaContrasena !== command.confirmacionContrasena) {
      throw new Error('Las contraseñas ingresadas no coinciden.');
    }

    const newHash = this.passwordHasher
      ? await this.passwordHasher.hash(command.nuevaContrasena)
      : command.nuevaContrasena;

    if (this.userRepository.updatePassword) {
      await this.userRepository.updatePassword(tokenVo.idUsuario, newHash, false);
    }

    // Invalidar enlace tras su uso (RF-USR-009)
    const usedToken = tokenVo.markAsUsed();
    RecoverPasswordUseCase.memoryTokenStore.set(cleanToken, usedToken);
    if (this.userRepository.updateRecoveryToken) {
      await this.userRepository.updateRecoveryToken(usedToken);
    }

    // Levantar el bloqueo de inicio de sesión de RF-USR-005
    AuthenticateUserUseCase.clearLockoutForEmail(tokenVo.correo);
    if (this.userRepository.saveLoginLockoutByEmail) {
      await this.userRepository.saveLoginLockoutByEmail({
        correo: tokenVo.correo,
        intentosFallidos: 0,
        bloqueadoHasta: null,
      });
    }

    if (this.auditLogger) {
      await this.auditLogger.log({
        usuario: tokenVo.correo,
        accion: 'Contraseña restablecida con enlace de un solo uso',
        registroAfectado: `usuario:${tokenVo.idUsuario}`,
      });
    }

    return {
      message: 'Contraseña restablecida exitosamente.',
    };
  }

  /**
   * Generador criptográfico isomórfico (compatible con Node.js y Navegadores sin importar 'crypto')
   */
  private generateSecureHexToken(byteLength: number = 32): string {
    const bytes = new Uint8Array(byteLength);
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < byteLength; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  private async findToken(token: string): Promise<OneTimeTokenVO | null> {
    if (this.userRepository.findRecoveryToken) {
      const dbToken = await this.userRepository.findRecoveryToken(token);
      if (dbToken) return dbToken;
    }
    return RecoverPasswordUseCase.memoryTokenStore.get(token) ?? null;
  }

  private async invalidatePreviousTokens(idUsuario: number): Promise<void> {
    for (const [key, value] of RecoverPasswordUseCase.memoryTokenStore.entries()) {
      if (value.idUsuario === idUsuario && !value.invalidado) {
        RecoverPasswordUseCase.memoryTokenStore.set(key, value.invalidate());
      }
    }
    if (this.userRepository.invalidatePreviousRecoveryTokens) {
      await this.userRepository.invalidatePreviousRecoveryTokens(idUsuario);
    }
  }
}