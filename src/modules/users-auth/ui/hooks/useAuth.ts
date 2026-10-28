// src/modules/users-auth/ui/hooks/useAuth.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AuthenticateUserCommand,
  AuthenticateUserResult,
} from '../../application/authenticate-user.use-case';
import {
  RecoverPasswordResult,
  RequestPasswordRecoveryCommand,
  ResetPasswordWithTokenCommand,
} from '../../application/recover-password.use-case';
import {
  RoleDTO,
  SearchUsersFilterDTO,
  UserWithRolesDomainDTO,
} from '../../domain/user.repository.interface';
import { UserFormSubmitPayload } from '../components/UserFormModal';
import { RoleExtendedViewDTO } from '../views/RolesManagementPage';

const SESSION_STORAGE_KEY = 'odontoleal_active_session_v1';
const WARNING_TIME_MS = 29 * 60 * 1000; // Minuto 29 (RF-USR-008)

export interface ActiveSessionState {
  usuario: UserWithRolesDomainDTO;
  permisos: string[];
  authenticatedAt: string;
}

export interface PendingFormDraftTracker {
  formularioId: string;
  datosBorrador: Record<string, unknown>;
}

export function useAuth(options?: {
  apiBaseUrl?: string;
  onInactivityAutoSaveDraft?: (
    idUsuario: number,
    draft: PendingFormDraftTracker
  ) => void;
}) {
  const apiBase = options?.apiBaseUrl ?? '/api/v1';

  const [session, setSession] = useState<ActiveSessionState | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as ActiveSessionState) : null;
    } catch {
      return null;
    }
  });

  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [unsavedFormDraft, setUnsavedFormDraft] =
    useState<PendingFormDraftTracker | null>(null);

  const warningTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (!session || typeof window === 'undefined') return;
    setIsWarningModalOpen(false);
    clearTimers();

    warningTimerRef.current = window.setTimeout(() => {
      setIsWarningModalOpen(true);
    }, WARNING_TIME_MS);
  }, [clearTimers, session]);

  // Escuchar interacciones del usuario para reiniciar el reloj de 30 minutos (RF-USR-008)
  useEffect(() => {
    if (!session || typeof window === 'undefined') {
      clearTimers();
      return;
    }

    resetInactivityTimer();

    const handleUserActivity = () => {
      if (!isWarningModalOpen) {
        resetInactivityTimer();
      }
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((evt) =>
      window.addEventListener(evt, handleUserActivity, { passive: true })
    );

    return () => {
      clearTimers();
      events.forEach((evt) =>
        window.removeEventListener(evt, handleUserActivity)
      );
    };
  }, [session, isWarningModalOpen, resetInactivityTimer, clearTimers]);

  // Impedir que el botón "Atrás" muestre contenido interno tras cerrar sesión (RF-USR-008)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const active = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!active) {
        window.history.replaceState(null, '', '/login');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setActiveSession = useCallback(
    (newSession: { usuario: UserWithRolesDomainDTO; permisos: string[] }) => {
      const state: ActiveSessionState = {
        usuario: newSession.usuario,
        permisos: newSession.permisos,
        authenticatedAt: new Date().toISOString(),
      };
      setSession(state);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
      }
    },
    []
  );

  // RF-USR-005: Autenticar usuario
  const authenticate = useCallback(
    async (command: AuthenticateUserCommand): Promise<AuthenticateUserResult> => {
      const response = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message || 'Correo o contraseña incorrectos');
      }
      return body as AuthenticateUserResult;
    },
    [apiBase]
  );

  // RF-USR-008: Cerrar sesión (manual o por timeout de 30 minutos)
  const logout = useCallback(
    async (
      motivo: 'MANUAL' | 'INACTIVITY_TIMEOUT' = 'MANUAL',
      confirmadoPorUsuario: boolean = false
    ): Promise<{ closed: boolean; requiresConfirmation?: boolean; message?: string }> => {
      if (
        motivo === 'MANUAL' &&
        unsavedFormDraft !== null &&
        !confirmadoPorUsuario
      ) {
        return {
          closed: false,
          requiresConfirmation: true,
          message:
            'Tiene cambios sin guardar. ¿Está seguro de que desea cerrar la sesión?',
        };
      }

      if (
        motivo === 'INACTIVITY_TIMEOUT' &&
        session &&
        unsavedFormDraft &&
        options?.onInactivityAutoSaveDraft
      ) {
        options.onInactivityAutoSaveDraft(
          session.usuario.idUsuario,
          unsavedFormDraft
        );
      }

      try {
        if (session) {
          await fetch(`${apiBase}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idUsuario: session.usuario.idUsuario,
              motivo,
              tieneCambiosSinGuardar: Boolean(unsavedFormDraft),
              confirmadoPorUsuario: true,
              borrador: unsavedFormDraft ?? undefined,
            }),
          });
        }
      } catch {
        // Continúa con limpieza local aunque falle la red
      }

      clearTimers();
      setIsWarningModalOpen(false);
      setUnsavedFormDraft(null);
      setSession(null);

      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
        window.history.pushState(null, '', '/login');
      }

      return { closed: true };
    },
    [apiBase, clearTimers, options, session, unsavedFormDraft]
  );

  // Solicitar enlace y restablecer contraseña
  const requestPasswordRecovery = useCallback(
    async (
      command: RequestPasswordRecoveryCommand
    ): Promise<RecoverPasswordResult> => {
      const origin =
        typeof window !== 'undefined' && window.location.origin
          ? window.location.origin
          : undefined;
      const response = await fetch(`${apiBase}/auth/recovery/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...command,
          baseRecoveryUrl: command.baseRecoveryUrl || origin,
        }),
      });
      return response.json();
    },
    [apiBase]
  );

  const resetPasswordWithToken = useCallback(
    async (
      command: ResetPasswordWithTokenCommand
    ): Promise<RecoverPasswordResult> => {
      const response = await fetch(`${apiBase}/auth/recovery/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(
          body.message || 'El enlace no es válido o ya venció. Solicite uno nuevo'
        );
      }
      return body;
    },
    [apiBase]
  );

  // RF-USR-001 a RF-USR-004: Operaciones de gestión de usuarios contra /api/v1
  const searchUsers = useCallback(
    async (filters: SearchUsersFilterDTO) => {
      const params = new URLSearchParams();
      if (filters.documento) params.set('documento', filters.documento);
      if (filters.nombre) params.set('nombre', filters.nombre);
      if (filters.idRol !== undefined) params.set('idRol', String(filters.idRol));
      if (filters.estado !== undefined) params.set('estado', String(filters.estado));

      const response = await fetch(`${apiBase}/users?${params.toString()}`);
      const body = await response.json();
      if (response.status === 404) {
        return {
          message: body.message || 'ninguna coincidencia encontrada',
          data: [] as UserWithRolesDomainDTO[],
        };
      }
      if (!response.ok) {
        throw new Error(body.message || 'Error al buscar usuarios.');
      }
      return {
        message: body.message,
        data: (body.data ?? []) as UserWithRolesDomainDTO[],
      };
    },
    [apiBase]
  );

  const createUser = useCallback(
    async (payload: UserFormSubmitPayload) => {
      const response = await fetch(`${apiBase}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          contrasenaHash: payload.contrasenaTemporal,
          ejecutadoPorUsuario: session?.usuario.correo ?? 'ROL-ADM',
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message || 'Error al crear el usuario.');
      }
      return body as { message: string; data: UserWithRolesDomainDTO };
    },
    [apiBase, session?.usuario.correo]
  );

  const updateUser = useCallback(
    async (payload: UserFormSubmitPayload) => {
      const response = await fetch(`${apiBase}/users/${payload.idUsuario}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          nuevaContrasenaTemporal: payload.contrasenaTemporal,
          ejecutadoPorUsuario: session?.usuario.correo ?? 'ROL-ADM',
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message || 'Error al actualizar el usuario.');
      }
      return body as { message: string; data: UserWithRolesDomainDTO };
    },
    [apiBase, session?.usuario.correo]
  );

  const toggleUserStatus = useCallback(
    async (idUsuario: number, nuevoEstado: boolean) => {
      const response = await fetch(`${apiBase}/users/${idUsuario}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: nuevoEstado,
          ejecutadoPorUsuario: session?.usuario.correo ?? 'ROL-ADM',
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message || 'Error al cambiar el estado del usuario.');
      }
      return body as { message: string; data: UserWithRolesDomainDTO };
    },
    [apiBase, session?.usuario.correo]
  );

  // RF-USR-007, RF-USR-010, RF-USR-011: Operaciones de gestión de roles contra /api/v1
  const fetchRoles = useCallback(async (): Promise<RoleExtendedViewDTO[]> => {
    const response = await fetch(`${apiBase}/roles`);
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.message || 'Error al obtener roles.');
    }
    return (body.data ?? []).map((r: any) => ({
      id_rol: r.id_rol,
      codigo: r.codigo ?? `ROL-${String(r.nombre_rol).substring(0, 3).toUpperCase()}`,
      nombre_rol: r.nombre_rol,
      descripcion: r.descripcion ?? '',
      permisos: Array.isArray(r.permisos) ? r.permisos : ['RF-AGE-008'],
      usuariosAsignadosCount: Number(r.usuariosAsignadosCount ?? 0),
    }));
  }, [apiBase]);

  const createRole = useCallback(
    async (payload: {
      codigo: string;
      nombreRol: string;
      descripcion: string;
      permisos: string[];
    }) => {
      const response = await fetch(`${apiBase}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message || 'Error al crear el rol.');
      }
      return body as { message: string; data: RoleDTO };
    },
    [apiBase]
  );

  const updateRole = useCallback(
    async (payload: {
      idRol: number;
      nombreRol: string;
      descripcion: string;
      permisos: string[];
    }) => {
      const response = await fetch(`${apiBase}/roles/${payload.idRol}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message || 'Error al actualizar el rol.');
      }
      return body as { message: string; data: RoleDTO };
    },
    [apiBase]
  );

  const deleteRole = useCallback(
    async (idRol: number) => {
      const response = await fetch(`${apiBase}/roles/${idRol}`, {
        method: 'DELETE',
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.message || 'Error al eliminar el rol.');
      }
      return body as { message: string };
    },
    [apiBase]
  );

  // Verificador RBAC en cliente (RQNF-SEG-003)
  const hasPermission = useCallback(
    (rfCode: string): boolean => {
      if (!session) return false;
      const isAdmin = session.usuario.roles.some(
        (r) =>
          r.estadoAsignacion &&
          (r.codigo === 'ROL-ADM' ||
            r.nombreRol.toLowerCase().includes('administrador'))
      );
      if (isAdmin) return true;
      return session.permisos.includes(rfCode);
    },
    [session]
  );

  return {
    session,
    isAuthenticated: Boolean(session),
    isWarningModalOpen,
    unsavedFormDraft,
    setUnsavedFormDraft,
    setActiveSession,
    authenticate,
    logout,
    continueSessionAfterWarning: resetInactivityTimer,
    requestPasswordRecovery,
    resetPasswordWithToken,
    searchUsers,
    createUser,
    updateUser,
    toggleUserStatus,
    fetchRoles,
    createRole,
    updateRole,
    deleteRole,
    hasPermission,
  };
}