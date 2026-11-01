// src/modules/users-auth/ui/views/UsersManagementPage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActiveAppointmentSummaryDTO,
  RoleDTO,
  SearchUsersFilterDTO,
  SessionDraftDTO,
  UserWithRolesDomainDTO,
} from '../../domain/user.repository.interface';
import { UserFormModal, UserFormSubmitPayload } from '../components/UserFormModal';

export interface UsersManagementPageProps {
  currentAdminUsername?: string;
  initialUsers?: UserWithRolesDomainDTO[];
  initialRoles?: RoleDTO[];
  savedUserDraft?: SessionDraftDTO | null;
  onDiscardUserDraft?: () => void;
  onSearchUsers?: (filters: SearchUsersFilterDTO) => Promise<{
    message?: string;
    data: UserWithRolesDomainDTO[];
  }>;
  onCreateUser?: (payload: UserFormSubmitPayload) => Promise<{
    message: string;
    data: UserWithRolesDomainDTO;
  }>;
  onUpdateUser?: (payload: UserFormSubmitPayload) => Promise<{
    message: string;
    data: UserWithRolesDomainDTO;
  }>;
  onToggleUserStatus?: (
    idUsuario: number,
    nuevoEstado: boolean
  ) => Promise<{
    message: string;
    data: UserWithRolesDomainDTO;
  }>;
  canCreateUser?: boolean;
}

// Constantes estáticas fuera del componente para evitar nuevas referencias en cada render
const EMPTY_USERS: UserWithRolesDomainDTO[] = [];

const DEFAULT_ROLES_FALLBACK: RoleDTO[] = [
  { id_rol: 1, codigo: 'ROL-ADM', nombre_rol: 'Administrador del Sistema' },
  { id_rol: 2, codigo: 'ROL-ODO', nombre_rol: 'Odontólogo General' },
  { id_rol: 3, codigo: 'ROL-ESP', nombre_rol: 'Especialista en Ortodoncia' },
  { id_rol: 4, codigo: 'ROL-COA', nombre_rol: 'Coordinadora de Agendamiento' },
  { id_rol: 5, codigo: 'ROL-AUX', nombre_rol: 'Auxiliar de Odontología' },
];

const ITEMS_PER_PAGE = 5;

export const UsersManagementPage: React.FC<UsersManagementPageProps> = ({
  initialUsers = EMPTY_USERS,
  initialRoles = DEFAULT_ROLES_FALLBACK,
  savedUserDraft,
  onDiscardUserDraft,
  onSearchUsers,
  onCreateUser,
  onUpdateUser,
  onToggleUserStatus,
  canCreateUser = true,
}) => {
  const [allLoadedUsers, setAllLoadedUsers] = useState<UserWithRolesDomainDTO[]>(initialUsers);
  const [roles, setRoles] = useState<RoleDTO[]>(initialRoles);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(
    initialUsers.length === 0
  );
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);

  // Filtros del diseño (buscador unificado, pestañas Todos/Activos/Inactivos y selector de rol)
  const [searchQuery, setSearchQuery] = useState('');
  const [rolIdFilter, setRolIdFilter] = useState<string>('ALL');
  const [estadoFilter, setEstadoFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Estado de paginación (máximo 5 elementos por página)
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Resetear a la página 1 cuando cualquier filtro cambie
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rolIdFilter, estadoFilter]);

  // Mensajes de estado
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Estados del modal de Crear / Editar (RF-USR-001 / RF-USR-002)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [selectedUser, setSelectedUser] = useState<UserWithRolesDomainDTO | null>(null);
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);
  const [modalServerError, setModalServerError] = useState<string | null>(null);
  const [conflictingAppointments, setConflictingAppointments] = useState<
    ActiveAppointmentSummaryDTO[]
  >([]);

  // Ref estable para evitar que cambios de identidad de función disparen useEffect en bucle
  const onSearchUsersRef = useRef(onSearchUsers);
  useEffect(() => {
    onSearchUsersRef.current = onSearchUsers;
  }, [onSearchUsers]);

  const fetchUsersDirectory = useCallback(async (showSkeleton: boolean = false) => {
    if (showSkeleton) {
      setIsInitialLoading(true);
    }
    setBannerError(null);

    try {
      if (onSearchUsersRef.current) {
        const result = await onSearchUsersRef.current({});
        setAllLoadedUsers(Array.isArray(result.data) ? result.data : []);
      } else {
        const res = await fetch('/api/v1/users');
        if (res.status === 404) {
          setAllLoadedUsers([]);
          return;
        }
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body.message || 'Error al consultar el directorio de usuarios.');
        }
        setAllLoadedUsers(Array.isArray(body.data) ? body.data : []);
      }
    } catch (error: any) {
      setBannerError(error?.message || 'Error al consultar la lista de usuarios.');
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  // Carga única al montar el componente (sin bucles de re-renderizado)
  useEffect(() => {
    if (initialUsers.length > 0) {
      setAllLoadedUsers(initialUsers);
      setIsInitialLoading(false);
      return;
    }
    fetchUsersDirectory(true);
  }, [fetchUsersDirectory, initialUsers]);

  useEffect(() => {
    if (initialRoles && initialRoles.length > 0) {
      setRoles(initialRoles);
    }
  }, [initialRoles]);

  const normalizeText = (text: string): string =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  // Filtrado reactivo instantáneo según RF-USR-004 y barra de herramientas del diseño
  const filteredUsers = useMemo(() => {
    const cleanQuery = searchQuery.trim();
    const normalizedQuery = normalizeText(cleanQuery);
    const isNumericDocumentQuery = /^\d+$/.test(cleanQuery);
    const idRolNumber = rolIdFilter === 'ALL' ? undefined : Number(rolIdFilter);
    const estadoBoolean =
      estadoFilter === 'ALL' ? undefined : estadoFilter === 'ACTIVE';

    return allLoadedUsers
      .filter((user) => {
        if (cleanQuery) {
          if (isNumericDocumentQuery) {
            // Coincidencia exacta por documento o coincidencia en teléfono (RF-USR-004)
            const matchesDoc =
              user.documentoIdentidad === cleanQuery ||
              user.documentoIdentidad.includes(cleanQuery);
            if (!matchesDoc) return false;
          } else {
            const matchesName = normalizeText(user.nombreCompleto).includes(
              normalizedQuery
            );
            const matchesEmail = normalizeText(user.correo).includes(
              normalizedQuery
            );
            const matchesRoleName = user.roles.some(
              (r) =>
                r.estadoAsignacion &&
                normalizeText(r.nombreRol).includes(normalizedQuery)
            );
            if (!matchesName && !matchesEmail && !matchesRoleName) {
              return false;
            }
          }
        }

        if (idRolNumber !== undefined) {
          const hasRole = user.roles.some(
            (r) => r.estadoAsignacion && Number(r.idRol) === idRolNumber
          );
          if (!hasRole) return false;
        }

        if (estadoBoolean !== undefined && user.estado !== estadoBoolean) {
          return false;
        }

        return true;
      })
      .sort((a, b) =>
        a.nombreCompleto.localeCompare(b.nombreCompleto, 'es-CO', {
          sensitivity: 'base',
        })
      );
  }, [allLoadedUsers, searchQuery, rolIdFilter, estadoFilter]);

  // Cálculos de paginación para máximo 5 elementos por página
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedUsers = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredUsers, safeCurrentPage]);

  const startIndex = filteredUsers.length === 0 ? 0 : (safeCurrentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(safeCurrentPage * ITEMS_PER_PAGE, filteredUsers.length);

  const handleOpenCreateModal = () => {
    setModalMode('CREATE');
    setSelectedUser(null);
    setModalServerError(null);
    setConflictingAppointments([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: UserWithRolesDomainDTO) => {
    setModalMode('EDIT');
    setSelectedUser(user);
    setModalServerError(null);
    setConflictingAppointments([]);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (payload: UserFormSubmitPayload) => {
    setIsSubmittingModal(true);
    setModalServerError(null);
    setConflictingAppointments([]);
    setBannerSuccess(null);

    try {
      if (modalMode === 'CREATE') {
        if (onCreateUser) {
          const result = await onCreateUser(payload);
          setBannerSuccess(result.message);
        } else {
          const res = await fetch('/api/v1/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...payload,
              contrasenaHash: payload.contrasenaTemporal,
            }),
          });
          const body = await res.json();
          if (!res.ok) throw new Error(body.message);
          setBannerSuccess(body.message || 'Usuario creado en estado Activo.');
        }
      } else {
        if (onUpdateUser) {
          const result = await onUpdateUser(payload);
          setBannerSuccess(result.message);
        } else {
          const res = await fetch(`/api/v1/users/${payload.idUsuario}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const body = await res.json();
          if (!res.ok) {
            if (Array.isArray(body.citasPendientes)) {
              setConflictingAppointments(body.citasPendientes);
            }
            throw new Error(body.message);
          }
          setBannerSuccess(
            body.message || 'Datos del usuario actualizados exitosamente.'
          );
        }
      }

      setIsModalOpen(false);
      await fetchUsersDirectory(false);
    } catch (error: any) {
      setModalServerError(
        error?.message || 'No fue posible guardar los datos del usuario.'
      );
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const handleToggleStatus = async (user: UserWithRolesDomainDTO) => {
    setBannerError(null);
    setBannerSuccess(null);
    setTogglingUserId(user.idUsuario);
    const nuevoEstado = !user.estado;

    try {
      if (onToggleUserStatus) {
        const result = await onToggleUserStatus(user.idUsuario, nuevoEstado);
        setBannerSuccess(result.message);
      } else {
        const res = await fetch(`/api/v1/users/${user.idUsuario}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: nuevoEstado }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.message);
        setBannerSuccess(
          body.message ||
            `Usuario ${nuevoEstado ? 'activado' : 'inactivado'} exitosamente.`
        );
      }
      await fetchUsersDirectory(false);
    } catch (error: any) {
      setBannerError(
        error?.message ||
          'No se pudo cambiar el estado del usuario (verifique si es el último administrador o tiene citas activas).'
      );
    } finally {
      setTogglingUserId(null);
    }
  };

  // Helpers visuales fieles al diseño image_8285bb.png
  const getInitials = (fullName: string): string => {
    const parts = fullName
      .replace(/^(Dr\.|Dra\.)\s*/i, '')
      .trim()
      .split(/\s+/);
    if (parts.length === 0) return 'US';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  };

  const formatColombianPhone = (phone: string | null): string => {
    if (!phone) return 'Sin teléfono';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+57 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}–${digits.slice(6)}`;
    }
    return phone;
  };

  const getRoleBadgeStyle = (roleName: string, isUserActive: boolean) => {
    if (!isUserActive) {
      return 'bg-[#F3F5F7] text-[#94A3B8]';
    }
    const lower = roleName.toLowerCase();
    if (lower.includes('especialista') || lower.includes('ortodon')) {
      return 'bg-[#FBF6E6] text-[#B8942A]';
    }
    if (lower.includes('odont')) {
      return 'bg-[#DBEAFE] text-[#1D4ED8]';
    }
    if (lower.includes('administrador')) {
      return 'bg-[#FBF6E6] text-[#B8942A]';
    }
    if (lower.includes('coordinador')) {
      return 'bg-[#FCE7F3] text-[#BE185D]';
    }
    if (lower.includes('auxiliar')) {
      return 'bg-[#CCFBF1] text-[#0F766E]';
    }
    return 'bg-[#F3F5F7] text-[#1E242B]';
  };

  const getAvatarCircleStyle = (user: UserWithRolesDomainDTO) => {
    if (!user.estado) {
      return 'bg-[#F3F5F7] text-[#94A3B8] border-[#E2E6EA]';
    }
    const firstRole = user.roles[0]?.nombreRol.toLowerCase() ?? '';
    if (firstRole.includes('administrador') || firstRole.includes('odont')) {
      return 'bg-[#FBF6E6] text-[#B8942A] border-[#D4AF37]/30';
    }
    if (firstRole.includes('coordinador')) {
      return 'bg-[#FCE7F3] text-[#BE185D] border-[#FBCFE8]';
    }
    if (firstRole.includes('auxiliar')) {
      return 'bg-[#CCFBF1] text-[#0F766E] border-[#99F6E4]';
    }
    return 'bg-[#F3F5F7] text-[#1E242B] border-[#E2E6EA]';
  };

  const formatShortRoleLabel = (roleName: string): string => {
    const lower = roleName.toLowerCase();
    if (lower.includes('especialista')) return 'Especialista';
    if (lower.includes('odontólogo') || lower.includes('odontologo')) return 'Odontólogo';
    if (lower.includes('administrador')) return 'Administrador';
    if (lower.includes('coordinador')) return 'Coordinador de agenda';
    if (lower.includes('auxiliar')) return 'Auxiliar';
    return roleName;
  };

  return (
    <div className="min-h-full w-full bg-[#F8F9FA] text-[#1E242B] px-4 py-6 sm:px-8 sm:py-7 overflow-x-hidden">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Cabecera estilo "Doctores y Equipo" según diseño adjunto */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-[#E2E6EA] pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBF6E6] border border-[#D4AF37]/30 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#B8942A]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" aria-hidden="true" />
                DIRECTORIO CLÍNICO
              </span>
              <span className="text-[13px] font-medium text-[#687380]">
                • OdontoLeal Sede Principal
              </span>
            </div>

            <h1 className="mt-2.5 text-3xl sm:text-[34px] font-extrabold tracking-tight text-[#1E242B] leading-tight">
              Doctores y Equipo
            </h1>
            <p className="mt-1 text-[14px] text-[#687380]">
              Gestión del cuerpo facultativo, odontólogos, especialistas y personal asistencial acreditado.
            </p>
          </div>

          {canCreateUser && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="min-h-[44px] self-start sm:self-end inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-2.5 text-[14px] font-bold text-[#111111] shadow-xs hover:bg-[#B8942A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] transition-colors"
            >
              <span className="text-lg leading-none font-normal" aria-hidden="true">
                +
              </span>
              <span>Nuevo Usuario</span>
            </button>
          )}
        </header>

        {/* Aviso de borrador pendiente si aplica (RF-USR-008) */}
        {savedUserDraft && (
          <div
            role="region"
            aria-label="Borrador de usuario disponible"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#1D4ED8]/30 bg-[#DBEAFE] p-4 text-[13px] sm:text-sm text-[#1D4ED8]"
          >
            <div>
              <p className="font-bold">
                💾 Tiene un borrador sin guardar del formulario de usuarios
              </p>
              <p className="mt-0.5">
                Conservado tras el cierre automático de su sesión anterior.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="min-h-[40px] rounded-xl bg-[#1D4ED8] px-4 py-2 text-[13px] font-bold text-white"
              >
                Revisar borrador
              </button>
              {onDiscardUserDraft && (
                <button
                  type="button"
                  onClick={onDiscardUserDraft}
                  className="min-h-[40px] rounded-xl border border-[#1D4ED8]/40 bg-white px-3.5 py-2 text-[13px] font-semibold text-[#1D4ED8]"
                >
                  Descartar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Mensajes de retroalimentación semánticos */}
        {bannerSuccess && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-2xl border border-[#15803D]/30 bg-[#DCFCE7] px-5 py-3.5 text-sm font-semibold text-[#15803D]"
          >
            <span>✓ {bannerSuccess}</span>
            <button
              type="button"
              onClick={() => setBannerSuccess(null)}
              aria-label="Cerrar mensaje de éxito"
              className="min-h-[32px] px-2 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {bannerError && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-2xl border border-[#B91C1C]/30 bg-[#FEE2E2] px-5 py-3.5 text-sm font-semibold text-[#B91C1C]"
          >
            <span>✕ {bannerError}</span>
            <button
              type="button"
              onClick={() => setBannerError(null)}
              aria-label="Cerrar mensaje de error"
              className="min-h-[32px] px-2 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Barra de Filtros horizontal idéntica al diseño adjunto */}
        <section
          aria-label="Filtros del directorio clínico"
          className="rounded-2xl border border-[#E2E6EA] bg-white p-3 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center gap-3"
        >
          {/* Buscador por nombre, documento, especialidad o correo */}
          <div className="relative flex-1">
            <span
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]"
              aria-hidden="true"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, especialidad, documento o correo..."
              aria-label="Buscar por nombre, especialidad, documento o correo"
              className="w-full min-h-[42px] rounded-xl border border-[#E2E6EA] bg-[#F8F9FA] pl-10 pr-4 py-2 text-[13px] sm:text-sm text-[#1E242B] placeholder-[#94A3B8] focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
            />
          </div>

          {/* Selector segmentado: Todos / Activos / Inactivos */}
          <div
            role="group"
            aria-label="Filtrar por estado del usuario"
            className="inline-flex items-center rounded-xl border border-[#E2E6EA] bg-[#F8F9FA] p-1 self-start lg:self-auto"
          >
            {(
              [
                { id: 'ALL', label: 'Todos' },
                { id: 'ACTIVE', label: 'Activos' },
                { id: 'INACTIVE', label: 'Inactivos' },
              ] as const
            ).map((tab) => {
              const isSelected = estadoFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setEstadoFilter(tab.id)}
                  className={`min-h-[34px] rounded-lg px-4 py-1.5 text-[13px] transition-all ${
                    isSelected
                      ? 'bg-[#111827] font-bold text-white shadow-2xs'
                      : 'font-medium text-[#687380] hover:text-[#1E242B]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Selector desplegable: Todos los roles */}
          <div className="w-full lg:w-52">
            <select
              value={rolIdFilter}
              onChange={(e) => setRolIdFilter(e.target.value)}
              aria-label="Filtrar por rol"
              className="w-full min-h-[42px] rounded-xl border border-[#E2E6EA] bg-white px-3.5 py-2 text-[13px] sm:text-sm font-medium text-[#1E242B] focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
            >
              <option value="ALL">Todos los roles</option>
              {roles
                .filter((r) => r.codigo !== 'ROL-PAC')
                .map((r) => (
                  <option key={r.id_rol} value={String(r.id_rol)}>
                    {r.nombre_rol}
                  </option>
                ))}
            </select>
          </div>
        </section>

        {/* Listado de Tarjetas Horizontales según diseño image_8285bb.png */}
        <section aria-label="Listado del equipo clínico" className="space-y-3">
          {isInitialLoading ? (
            <div className="rounded-2xl border border-[#E2E6EA] bg-white p-12 text-center space-y-4 shadow-2xs">
              <div className="h-12 w-12 mx-auto rounded-2xl bg-[#FFFBEB] text-[#D4AF37] flex items-center justify-center border border-[#FDE68A]">
                <div className="w-5 h-5 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-sm font-bold text-[#1E242B]">Cargando directorio de doctores y usuarios...</p>
              <p className="text-xs text-[#687380]">Consultando el equipo registrado en el sistema...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div
              role="status"
              className="rounded-2xl border border-[#E2E6EA] bg-white p-10 text-center space-y-2"
            >
              <p className="text-base font-bold text-[#1E242B]">
                ninguna coincidencia encontrada
              </p>
              <p className="text-[13px] text-[#687380]">
                No se encontraron usuarios que coincidan con los criterios seleccionados.
              </p>
            </div>
          ) : (
            paginatedUsers.map((user) => {
              const isInactive = !user.estado;
              const isBusy = togglingUserId === user.idUsuario;
              const activeRoles = user.roles.filter((r) => r.estadoAsignacion);

              return (
                <article
                  key={user.idUsuario}
                  className={`rounded-2xl border border-[#E2E6EA] bg-white px-5 py-4 shadow-2xs transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                    isInactive ? 'opacity-80 bg-[#F8F9FA]/60' : 'hover:border-[#D4AF37]/50'
                  }`}
                >
                  {/* Izquierda: Avatar Circular + Nombre + Badges + Teléfono y Correo */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-[14px] font-extrabold tracking-tight ${getAvatarCircleStyle(
                        user
                      )}`}
                      aria-hidden="true"
                    >
                      {getInitials(user.nombreCompleto)}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Fila 1: Nombre completo + Píldoras de rol + Píldora INACTIVO */}
                      <div className="flex flex-wrap items-center gap-2">
                        <h2
                          className={`text-[15px] font-bold leading-snug ${
                            isInactive ? 'text-[#94A3B8]' : 'text-[#1E242B]'
                          }`}
                        >
                          {user.nombreCompleto}
                        </h2>

                        {activeRoles.map((role) => (
                          <span
                            key={role.idRol}
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${getRoleBadgeStyle(
                              role.nombreRol,
                              user.estado
                            )}`}
                          >
                            {formatShortRoleLabel(role.nombreRol)}
                          </span>
                        ))}

                        {isInactive && (
                          <span className="inline-flex items-center rounded-md bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#B91C1C]">
                            INACTIVO
                          </span>
                        )}
                      </div>

                      {/* Fila 2: Teléfono + Correo + Documento */}
                      <div
                        className={`mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] ${
                          isInactive ? 'text-[#94A3B8]' : 'text-[#687380]'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <svg
                            className={`h-3.5 w-3.5 ${
                              isInactive ? 'text-[#94A3B8]' : 'text-[#D4AF37]'
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                            />
                          </svg>
                          <span>{formatColombianPhone(user.telefono)}</span>
                        </span>

                        <span className="inline-flex items-center gap-1.5 break-all">
                          <span
                            className="font-semibold text-[#94A3B8]"
                            aria-hidden="true"
                          >
                            @
                          </span>
                          <span>{user.correo}</span>
                        </span>

                        <span className="inline-flex items-center gap-1 text-[12px] font-mono text-[#94A3B8]">
                          • Doc: {user.documentoIdentidad}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Derecha: Botones Editar y Desactivar / Reactivar */}
                  <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(user)}
                      className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[#E2E6EA] bg-white px-3.5 py-1.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
                        isInactive
                          ? 'text-[#687380] hover:text-[#1E242B]'
                          : 'text-[#1E242B] hover:border-[#D4AF37] hover:bg-[#FBF6E6]/40'
                      }`}
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                      <span>Editar</span>
                    </button>

                    {user.estado ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleStatus(user)}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[#FEE2E2] bg-white px-3.5 py-1.5 text-[13px] font-bold text-[#B91C1C] hover:bg-[#FEE2E2] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B91C1C] transition-colors"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                          />
                        </svg>
                        <span>{isBusy ? 'Procesando...' : 'Desactivar'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleStatus(user)}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[#DCFCE7] bg-[#F0FDF4] px-3.5 py-1.5 text-[13px] font-bold text-[#15803D] hover:bg-[#DCFCE7] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803D] transition-colors"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>{isBusy ? 'Procesando...' : 'Reactivar'}</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}

          {/* Barra de Controles de Paginación (Máximo 5 elementos) */}
          {!isInitialLoading && filteredUsers.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-[#E2E6EA] bg-white px-5 py-4 shadow-2xs mt-4">
              <div className="text-[13px] text-[#687380]">
                Mostrando <strong className="text-[#1E242B]">{startIndex}–{endIndex}</strong> de{' '}
                <strong className="text-[#1E242B]">{filteredUsers.length}</strong> {filteredUsers.length === 1 ? 'doctor registrado' : 'doctores y equipo'}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  aria-label="Página anterior"
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[#E2E6EA] bg-white px-3.5 py-1.5 text-[13px] font-bold text-[#1E242B] hover:border-[#D4AF37] hover:bg-[#FBF6E6]/40 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                >
                  <span aria-hidden="true">←</span>
                  <span>Anterior</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                    const isPageActive = pageNum === safeCurrentPage;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        aria-label={`Ir a la página ${pageNum}`}
                        aria-current={isPageActive ? 'page' : undefined}
                        className={`min-h-[36px] min-w-[36px] rounded-xl px-2.5 py-1 text-[13px] font-bold transition-all ${
                          isPageActive
                            ? 'bg-[#111111] text-white shadow-xs'
                            : 'border border-[#E2E6EA] bg-white text-[#1E242B] hover:border-[#D4AF37] hover:bg-[#FBF6E6]/40'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  aria-label="Página siguiente"
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[#E2E6EA] bg-white px-3.5 py-1.5 text-[13px] font-bold text-[#1E242B] hover:border-[#D4AF37] hover:bg-[#FBF6E6]/40 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                >
                  <span>Siguiente</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Modal de Creación y Edición de Usuario */}
      <UserFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        initialUser={selectedUser}
        availableRoles={roles}
        isSubmitting={isSubmittingModal}
        serverError={modalServerError}
        conflictingAppointments={conflictingAppointments}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
      />
    </div>
  );
};