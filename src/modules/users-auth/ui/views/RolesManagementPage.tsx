// src/modules/users-auth/ui/views/RolesManagementPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  ADMIN_USER_ROLE_PERMISSIONS,
  CLINICAL_PERMISSIONS,
  INITIAL_ROLE_CODES,
} from '../../domain/role.entity';
import { RoleDTO } from '../../domain/user.repository.interface';
import { RolePermissionsMatrix } from '../components/RolePermissionsMatrix';

export interface RoleExtendedViewDTO extends RoleDTO {
  codigo: string;
  descripcion: string;
  permisos: string[];
  usuariosAsignadosCount?: number;
}

export interface RolesManagementPageProps {
  initialRoles?: RoleExtendedViewDTO[];
  onCreateRole?: (payload: {
    codigo: string;
    nombreRol: string;
    descripcion: string;
    permisos: string[];
  }) => Promise<{ message: string; data: RoleDTO }>;
  onUpdateRole?: (payload: {
    idRol: number;
    nombreRol: string;
    descripcion: string;
    permisos: string[];
  }) => Promise<{ message: string; data: RoleDTO }>;
  onDeleteRole?: (idRol: number) => Promise<{ message: string }>;
}

const INITIAL_ROLES_SEED: RoleExtendedViewDTO[] = [
  {
    id_rol: 1,
    codigo: 'ROL-ADM',
    nombre_rol: 'Administrador del Sistema',
    descripcion:
      'Gestiona usuarios, roles, permisos, plantillas de consentimiento, agenda y datos de pacientes.',
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
    usuariosAsignadosCount: 1,
  },
  {
    id_rol: 2,
    codigo: 'ROL-ODO',
    nombre_rol: 'Odontólogo General',
    descripcion:
      'Atiende Odontología general, gestiona su agenda, historia clínica, odontograma, consentimientos y documentos clínicos.',
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
    usuariosAsignadosCount: 1,
  },
  {
    id_rol: 3,
    codigo: 'ROL-ESP',
    nombre_rol: 'Especialista en Ortodoncia',
    descripcion:
      'Atiende Ortodoncia, gestiona su agenda, historia clínica, odontograma, consentimientos y documentos clínicos.',
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
    usuariosAsignadosCount: 1,
  },
  {
    id_rol: 4,
    codigo: 'ROL-COA',
    nombre_rol: 'Coordinadora de Agendamiento',
    descripcion:
      'Gestiona la agenda de todos los profesionales, solicitudes de cita y datos administrativos de pacientes.',
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
    usuariosAsignadosCount: 1,
  },
  {
    id_rol: 5,
    codigo: 'ROL-AUX',
    nombre_rol: 'Auxiliar de Odontología',
    descripcion:
      'Apoya en agendamiento y asiste al profesional durante una cita En consulta.',
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
    usuariosAsignadosCount: 1,
  },
  {
    id_rol: 6,
    codigo: 'ROL-PAC',
    nombre_rol: 'Paciente',
    descripcion:
      'Rol público sin cuenta ni inicio de sesión para solicitar citas y firmar consentimientos en tablet.',
    permisos: [],
    usuariosAsignadosCount: 0,
  },
];

const ITEMS_PER_PAGE = 5;

export const RolesManagementPage: React.FC<RolesManagementPageProps> = ({
  initialRoles = INITIAL_ROLES_SEED,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
}) => {
  const [roles, setRoles] = useState<RoleExtendedViewDTO[]>(initialRoles);

  // Filtros reactivos (idénticos a Doctores)
  const [searchQuery, setSearchQuery] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'ALL' | 'SYSTEM' | 'CUSTOM'>('ALL');

  // Paginación sincronizada (máximo 5 elementos por página)
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Estados del modal de Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [editingRole, setEditingRole] = useState<RoleExtendedViewDTO | null>(null);

  // Estado del formulario dentro del modal
  const [codigo, setCodigo] = useState('');
  const [nombreRol, setNombreRol] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [permisos, setPermisos] = useState<string[]>([]);

  // Mensajes de retroalimentación
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(null);

  // Modal de confirmación de eliminación
  const [roleToDelete, setRoleToDelete] = useState<RoleExtendedViewDTO | null>(null);

  const isInitialProtectedRole = (code: string): boolean =>
    INITIAL_ROLE_CODES.includes(code.trim().toUpperCase() as any);

  // Reset de página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, tipoFilter]);

  // Actualizar roles si las props iniciales cambian
  useEffect(() => {
    if (initialRoles && initialRoles.length > 0) {
      setRoles(initialRoles);
    }
  }, [initialRoles]);

  // Filtrado de roles
  const filteredRoles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return roles.filter((role) => {
      // Filtro por tipo
      const isProtected = isInitialProtectedRole(role.codigo);
      if (tipoFilter === 'SYSTEM' && !isProtected) return false;
      if (tipoFilter === 'CUSTOM' && isProtected) return false;

      // Filtro por búsqueda
      if (!query) return true;
      return (
        role.nombre_rol.toLowerCase().includes(query) ||
        role.codigo.toLowerCase().includes(query) ||
        (role.descripcion && role.descripcion.toLowerCase().includes(query))
      );
    });
  }, [roles, searchQuery, tipoFilter]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredRoles.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedRoles = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredRoles.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRoles, safeCurrentPage]);

  // Abrir modal de creación
  const handleOpenCreateModal = () => {
    setModalMode('CREATE');
    setEditingRole(null);
    setCodigo('ROL-');
    setNombreRol('');
    setDescripcion('');
    setPermisos(['RF-AGE-008']);
    setModalErrorMessage(null);
    setIsModalOpen(true);
  };

  // Abrir modal de edición
  const handleOpenEditModal = (role: RoleExtendedViewDTO) => {
    setModalMode('EDIT');
    setEditingRole(role);
    setCodigo(role.codigo);
    setNombreRol(role.nombre_rol);
    setDescripcion(role.descripcion ?? '');
    setPermisos([...(role.permisos ?? [])]);
    setModalErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setModalErrorMessage(null);
  };

  // Guardar rol (Crear o Editar)
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalErrorMessage(null);

    const cleanCode = codigo.trim().toUpperCase();
    const cleanName = nombreRol.trim();
    const cleanDesc = descripcion.trim();

    if (!cleanCode || !cleanName) {
      setModalErrorMessage('El código y el nombre del rol son obligatorios.');
      return;
    }

    if (cleanCode !== 'ROL-PAC' && permisos.length === 0) {
      setModalErrorMessage('El rol no puede quedar sin permisos asignados.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (modalMode === 'CREATE') {
        // Validar que no tenga permisos clínicos al crear
        const hasClinical = permisos.some((p) => CLINICAL_PERMISSIONS.includes(p));
        if (hasClinical) {
          throw new Error('No está permitido asignar permisos clínicos a un nuevo rol.');
        }

        if (onCreateRole) {
          const result = await onCreateRole({
            codigo: cleanCode,
            nombreRol: cleanName,
            descripcion: cleanDesc,
            permisos,
          });
          const newEntry: RoleExtendedViewDTO = {
            id_rol: result.data.id_rol,
            codigo: cleanCode,
            nombre_rol: result.data.nombre_rol,
            descripcion: cleanDesc,
            permisos,
            usuariosAsignadosCount: 0,
          };
          setRoles((prev) => [...prev, newEntry]);
          setSuccessMessage(result.message || 'Rol creado exitosamente.');
        } else {
          const res = await fetch('/api/v1/roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              codigo: cleanCode,
              nombreRol: cleanName,
              descripcion: cleanDesc,
              permisos,
            }),
          });
          const body = await res.json();
          if (!res.ok) throw new Error(body.message);

          const newId = body.data?.id_rol ?? Date.now();
          const newEntry: RoleExtendedViewDTO = {
            id_rol: newId,
            codigo: cleanCode,
            nombre_rol: cleanName,
            descripcion: cleanDesc,
            permisos,
            usuariosAsignadosCount: 0,
          };
          setRoles((prev) => [...prev, newEntry]);
          setSuccessMessage(body.message || 'Rol creado exitosamente.');
        }
        setIsModalOpen(false);
      } else if (editingRole) {
        if (onUpdateRole) {
          const result = await onUpdateRole({
            idRol: editingRole.id_rol,
            nombreRol: cleanName,
            descripcion: cleanDesc,
            permisos,
          });
          setRoles((prev) =>
            prev.map((r) =>
              r.id_rol === editingRole.id_rol
                ? {
                    ...r,
                    nombre_rol: cleanName,
                    descripcion: cleanDesc,
                    permisos: [...permisos],
                  }
                : r
            )
          );
          setSuccessMessage(result.message || 'Rol actualizado exitosamente.');
        } else {
          const res = await fetch(`/api/v1/roles/${editingRole.id_rol}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idRol: editingRole.id_rol,
              nombreRol: cleanName,
              descripcion: cleanDesc,
              permisos,
            }),
          });
          const body = await res.json();
          if (!res.ok) throw new Error(body.message);

          setRoles((prev) =>
            prev.map((r) =>
              r.id_rol === editingRole.id_rol
                ? {
                    ...r,
                    nombre_rol: cleanName,
                    descripcion: cleanDesc,
                    permisos: [...permisos],
                  }
                : r
            )
          );
          setSuccessMessage(body.message || 'Rol actualizado exitosamente.');
        }
        setIsModalOpen(false);
      }
    } catch (error: any) {
      setModalErrorMessage(error?.message || 'No se pudo guardar el rol.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirmar eliminación
  const handleConfirmDeleteRole = async () => {
    if (!roleToDelete) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    if (isInitialProtectedRole(roleToDelete.codigo)) {
      setErrorMessage(
        `El rol ${roleToDelete.codigo} (${roleToDelete.nombre_rol}) pertenece a la configuración inicial y no puede eliminarse.`
      );
      setRoleToDelete(null);
      return;
    }

    if ((roleToDelete.usuariosAsignadosCount ?? 0) > 0) {
      setErrorMessage(
        `No se puede eliminar el rol porque está asignado a ${roleToDelete.usuariosAsignadosCount} usuario(s).`
      );
      setRoleToDelete(null);
      return;
    }

    setIsSubmitting(true);
    try {
      if (onDeleteRole) {
        const res = await onDeleteRole(roleToDelete.id_rol);
        setSuccessMessage(res.message);
      } else {
        const res = await fetch(`/api/v1/roles/${roleToDelete.id_rol}`, {
          method: 'DELETE',
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.message);
        setSuccessMessage(body.message || 'Rol eliminado exitosamente.');
      }

      const remaining = roles.filter((r) => r.id_rol !== roleToDelete.id_rol);
      setRoles(remaining);
      setRoleToDelete(null);
    } catch (error: any) {
      setErrorMessage(error?.message || 'No fue posible eliminar el rol.');
      setRoleToDelete(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F8F9FA] text-[#1E242B] p-4 sm:p-6 lg:p-8 overflow-x-hidden">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Cabecera idéntica en layout y estilo a Doctores */}
        <header className="rounded-2xl border border-[#E2E6EA] bg-white p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="inline-flex items-center rounded-full bg-[#FBF3D5] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#B8942A]">
              CONTROL DE ACCESO Y SEGURIDAD
            </span>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#1E242B]">
              Roles y Permisos
            </h1>
            <p className="mt-1 text-[13px] sm:text-sm text-[#687380]">
              Configuración de perfiles del sistema, privilegios operativos y asignación de permisos para el equipo clínico y administrativo.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="min-h-[44px] self-start sm:self-end inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#DDB93E] to-[#C9A227] px-5 py-2.5 text-[14px] font-bold text-[#111111] shadow-[0_2px_6px_rgba(184,148,42,0.35)] hover:bg-[#B8942A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] transition-colors"
          >
            <span className="text-lg leading-none font-normal" aria-hidden="true">
              +
            </span>
            <span>Nuevo Rol</span>
          </button>
        </header>

        {/* Mensajes de retroalimentación semánticos */}
        {successMessage && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-2xl border border-[#15803D]/30 bg-[#DCFCE7] px-5 py-3.5 text-sm font-semibold text-[#15803D]"
          >
            <span>✓ {successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              aria-label="Cerrar mensaje de éxito"
              className="min-h-[32px] px-2 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-2xl border border-[#B91C1C]/30 bg-[#FEE2E2] px-5 py-3.5 text-sm font-semibold text-[#B91C1C]"
          >
            <span>✕ {errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              aria-label="Cerrar mensaje de error"
              className="min-h-[32px] px-2 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Barra de Filtros horizontal idéntica a Doctores */}
        <section
          aria-label="Filtros de roles"
          className="rounded-2xl border border-[#E2E6EA] bg-white p-3 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
        >
          {/* Buscador de roles */}
          <div className="relative flex-1">
            <span
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]"
              aria-hidden="true"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre de rol, código o descripción..."
              aria-label="Buscar por nombre de rol, código o descripción"
              className="w-full min-h-[42px] rounded-xl border border-[#E2E6EA] bg-[#F8F9FA] pl-10 pr-4 py-2 text-[13px] sm:text-sm text-[#1E242B] placeholder-[#94A3B8] focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
            />
          </div>

          {/* Selector segmentado: Todos / Iniciales del Sistema / Personalizados */}
          <div
            role="group"
            aria-label="Filtrar por tipo de rol"
            className="inline-flex items-center rounded-xl border border-[#E2E6EA] bg-[#F8F9FA] p-1 self-start sm:self-auto"
          >
            {(
              [
                { id: 'ALL', label: 'Todos' },
                { id: 'SYSTEM', label: 'Iniciales del Sistema' },
                { id: 'CUSTOM', label: 'Personalizados' },
              ] as const
            ).map((tab) => {
              const isSelected = tipoFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTipoFilter(tab.id)}
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
        </section>

        {/* Listado de Tarjetas Horizontales (Mismo patrón visual de Doctores) */}
        <section aria-label="Catálogo de roles del consultorio" className="space-y-3">
          {filteredRoles.length === 0 ? (
            <div
              role="status"
              className="rounded-2xl border border-[#E2E6EA] bg-white p-10 text-center space-y-2"
            >
              <p className="text-base font-bold text-[#1E242B]">
                Ninguna coincidencia encontrada
              </p>
              <p className="text-[13px] text-[#687380]">
                No se encontraron roles que coincidan con los criterios seleccionados.
              </p>
            </div>
          ) : (
            paginatedRoles.map((role) => {
              const isProtected = isInitialProtectedRole(role.codigo);

              return (
                <article
                  key={role.id_rol}
                  className="rounded-2xl border border-[#E2E6EA] bg-white px-5 py-4 shadow-2xs transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-[#D4AF37]/50"
                >
                  {/* Izquierda: Icono en cuadro + Código + Nombre + Badges + Metadatos */}
                  <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                    {/* Caja de ícono con estilo OdontoLeal */}
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-[#D4AF37] border border-[#D4AF37]/30 shadow-xs"
                      aria-hidden="true"
                    >
                      <svg
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.8}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Fila 1: Nombre del rol + Código de Rol + Badge Inicial / Personalizado */}
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[15px] font-bold leading-snug text-[#1E242B]">
                          {role.nombre_rol}
                        </h2>

                        <span className="inline-flex items-center rounded-md bg-[#111111] px-2 py-0.5 text-[11px] font-mono font-bold text-[#D4AF37]">
                          {role.codigo}
                        </span>

                        {isProtected ? (
                          <span className="inline-flex items-center rounded-full bg-[#DBEAFE] px-2.5 py-0.5 text-[11px] font-bold text-[#1D4ED8]">
                            🔒 Inicial del Sistema
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-[11px] font-bold text-[#15803D]">
                            ✓ Personalizado
                          </span>
                        )}
                      </div>

                      {/* Fila 2: Descripción del rol */}
                      <p className="mt-1 text-[13px] text-[#687380] line-clamp-1 sm:line-clamp-2">
                        {role.descripcion || 'Sin descripción registrada.'}
                      </p>

                      {/* Fila 3: Chips de resumen de permisos y usuarios asignados */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-[#687380]">
                        <span className="inline-flex items-center gap-1 rounded-lg border border-[#E2E6EA] bg-[#F8F9FA] px-2.5 py-1 font-semibold">
                          <svg
                            className="h-3.5 w-3.5 text-[#D4AF37]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span>{role.permisos.length} permisos asignados</span>
                        </span>

                        <span className="inline-flex items-center gap-1 rounded-lg border border-[#E2E6EA] bg-[#F8F9FA] px-2.5 py-1 font-semibold">
                          <svg
                            className="h-3.5 w-3.5 text-[#687380]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                          <span>
                            {role.usuariosAsignadosCount ?? 0} usuario(s) activo(s)
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Derecha: Botones de Acción (Configurar permisos y Eliminar) */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(role)}
                      className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-[#DADAD5] bg-white px-4 py-2 text-[13px] font-bold text-[#1E242B] hover:border-[#D4AF37] hover:bg-[#FBF6E6]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] transition-colors"
                    >
                      <svg
                        className="h-4 w-4 text-[#D4AF37]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      <span>Configurar permisos</span>
                    </button>

                    {!isProtected && (
                      <button
                        type="button"
                        onClick={() => setRoleToDelete(role)}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#B91C1C]/25 bg-white px-3.5 py-2 text-[13px] font-bold text-[#B91C1C] hover:bg-[#FEE2E2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B91C1C] transition-colors"
                      >
                        <svg
                          className="h-4 w-4 text-[#B91C1C]"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        <span>Eliminar</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>

        {/* Paginación idéntica a Doctores (Máximo 5 elementos por página) */}
        {filteredRoles.length > ITEMS_PER_PAGE && (
          <nav
            aria-label="Paginación de roles"
            className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-[#E2E6EA] bg-white px-5 py-3.5 shadow-2xs text-sm"
          >
            <p className="text-[13px] text-[#687380]">
              Mostrando{' '}
              <span className="font-bold text-[#1E242B]">
                {(safeCurrentPage - 1) * ITEMS_PER_PAGE + 1}
              </span>
              –
              <span className="font-bold text-[#1E242B]">
                {Math.min(safeCurrentPage * ITEMS_PER_PAGE, filteredRoles.length)}
              </span>{' '}
              de{' '}
              <span className="font-bold text-[#1E242B]">
                {filteredRoles.length}
              </span>{' '}
              roles registrados
            </p>

            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                className="min-h-[36px] inline-flex items-center gap-1 rounded-xl border border-[#E2E6EA] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#1E242B] hover:bg-[#F8F9FA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Anterior
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => {
                const isActive = num === safeCurrentPage;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCurrentPage(num)}
                    className={`min-h-[36px] min-w-[36px] rounded-xl text-[13px] font-bold transition-all ${
                      isActive
                        ? 'bg-[#111111] text-white shadow-2xs'
                        : 'border border-[#E2E6EA] bg-white text-[#1E242B] hover:bg-[#F8F9FA]'
                    }`}
                  >
                    {num}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="min-h-[36px] inline-flex items-center gap-1 rounded-xl border border-[#E2E6EA] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#1E242B] hover:bg-[#F8F9FA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente →
              </button>
            </div>
          </nav>
        )}
      </div>

      {/* Modal Centrado para Crear / Editar Rol */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/60 p-4 backdrop-blur-xs overflow-y-auto"
        >
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border-t-4 border-t-[#D4AF37] bg-white shadow-2xl overflow-hidden">
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between border-b border-[#E2E6EA] bg-white px-6 py-4">
              <div>
                <span className="inline-flex items-center rounded-full bg-[#FBF3D5] px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[#B8942A]">
                  {modalMode === 'CREATE' ? 'NUEVO ROL' : 'CONFIGURACIÓN DE ROL'}
                </span>
                <h2
                  id="role-modal-title"
                  className="mt-1 text-lg sm:text-xl font-bold text-[#1E242B]"
                >
                  {modalMode === 'CREATE'
                    ? 'Crear Nuevo Rol'
                    : `Editar Rol: ${editingRole?.nombre_rol ?? ''}`}
                </h2>
                <p className="text-[13px] text-[#687380]">
                  {modalMode === 'CREATE'
                    ? 'Defina el código, nombre, descripción y configure los permisos para el nuevo perfil.'
                    : 'Modifique el nombre, alcance y active o desactive permisos para este rol.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isSubmitting}
                aria-label="Cerrar modal de configuración de rol"
                className="min-h-[40px] min-w-[40px] rounded-xl border border-[#E2E6EA] bg-[#F8F9FA] text-[#1E242B] flex items-center justify-center hover:bg-[#E2E6EA] transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Formulario y Matriz dentro del Modal */}
            <form onSubmit={handleSaveRole} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {modalErrorMessage && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-[#B91C1C]/30 bg-[#FEE2E2] p-3.5 text-[13px] font-medium text-[#B91C1C]"
                  >
                    <span className="font-bold">✕</span>
                    <span>{modalErrorMessage}</span>
                  </div>
                )}

                {/* Campos del Rol */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="modal-role-code"
                      className="block text-[13px] font-bold uppercase tracking-wider text-[#1E242B] mb-1.5"
                    >
                      Código del Rol * {modalMode === 'EDIT' && '(No editable)'}
                    </label>
                    <input
                      id="modal-role-code"
                      type="text"
                      maxLength={20}
                      disabled={modalMode === 'EDIT'}
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                      placeholder="Ej. ROL-AUD"
                      className="w-full min-h-[44px] rounded-xl border border-[#E2E6EA] bg-[#F3F5F7] px-3.5 py-2.5 text-sm font-mono font-bold text-[#1E242B] focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 disabled:opacity-75 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="modal-role-name"
                      className="block text-[13px] font-bold uppercase tracking-wider text-[#1E242B] mb-1.5"
                    >
                      Nombre del Rol * (Máx. 40 caracteres)
                    </label>
                    <input
                      id="modal-role-name"
                      type="text"
                      maxLength={40}
                      value={nombreRol}
                      onChange={(e) => setNombreRol(e.target.value)}
                      placeholder="Ej. Auditor de Calidad"
                      className="w-full min-h-[44px] rounded-xl border border-[#E2E6EA] bg-[#F3F5F7] px-3.5 py-2.5 text-sm text-[#1E242B] focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="modal-role-desc"
                      className="block text-[13px] font-bold uppercase tracking-wider text-[#1E242B] mb-1.5"
                    >
                      Descripción del Rol
                    </label>
                    <textarea
                      id="modal-role-desc"
                      rows={2}
                      maxLength={250}
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      placeholder="Describa el alcance operativo de este rol dentro del consultorio..."
                      className="w-full rounded-xl border border-[#E2E6EA] bg-[#F3F5F7] p-3.5 text-sm text-[#1E242B] focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
                    />
                  </div>
                </div>

                {/* Separador elegante */}
                <div className="border-t border-[#E2E6EA] pt-4">
                  <div className="mb-3">
                    <h3 className="text-base font-bold text-[#1E242B]">
                      Matriz de Permisos del Rol
                    </h3>
                    <p className="text-[13px] text-[#687380]">
                      Seleccione o desmarque los permisos correspondientes. Los permisos fijos por normativa clínica o seguridad de administración están protegidos automáticamente.
                    </p>
                  </div>

                  <RolePermissionsMatrix
                    roleCode={codigo}
                    selectedPermissions={permisos}
                    onChange={setPermisos}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Pie del Modal con Botones */}
              <div className="border-t border-[#E2E6EA] bg-[#F8F9FA] px-6 py-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="min-h-[44px] rounded-xl border border-[#DADAD5] bg-white px-5 py-2 text-sm font-semibold text-[#1E242B] hover:bg-[#F8F9FA] transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-[#DDB93E] to-[#C9A227] px-6 py-2.5 text-sm font-bold text-[#111111] shadow-[0_2px_6px_rgba(184,148,42,0.35)] hover:bg-[#B8942A] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting
                    ? 'Guardando...'
                    : modalMode === 'CREATE'
                    ? 'Guardar nuevo rol'
                    : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación de Rol */}
      {roleToDelete && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-role-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border-t-4 border-[#B91C1C] bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FEE2E2] text-[#B91C1C] font-bold text-lg">
                ⚠
              </div>
              <div>
                <h3 id="delete-role-title" className="text-lg font-bold text-[#1E242B]">
                  Confirmar eliminación de rol
                </h3>
                <p className="text-[13px] text-[#687380]">
                  Código: <span className="font-mono font-bold">{roleToDelete.codigo}</span>
                </p>
              </div>
            </div>

            <p className="text-sm text-[#1E242B] leading-relaxed">
              ¿Está seguro de que desea eliminar el rol{' '}
              <strong>{roleToDelete.nombre_rol}</strong> del catálogo? Esta acción no se puede deshacer.
            </p>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRoleToDelete(null)}
                className="min-h-[44px] rounded-xl border border-[#E2E6EA] bg-white px-4 py-2 text-sm font-semibold text-[#1E242B] hover:bg-[#F8F9FA] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRole}
                disabled={isSubmitting}
                className="min-h-[44px] rounded-xl bg-[#B91C1C] px-5 py-2 text-sm font-bold text-white hover:opacity-95 transition-opacity"
              >
                Sí, eliminar rol
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};