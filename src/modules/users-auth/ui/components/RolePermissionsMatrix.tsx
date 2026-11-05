import React, { useMemo, useState } from 'react';
import {
  ADMIN_USER_ROLE_PERMISSIONS,
  CLINICAL_PERMISSIONS,
} from '../../domain/role.entity';

export interface PermissionCatalogItem {
  code: string;
  name: string;
  moduleName: string;
  description: string;
}

export const ERS_PERMISSIONS_CATALOG: ReadonlyArray<PermissionCatalogItem> = [
  // Módulo A: Gestión de Usuarios y Roles
  { code: 'RF-USR-001', name: 'Crear usuario', moduleName: 'Usuarios y Roles', description: 'Registrar nuevos usuarios con contraseña temporal y firma.' },
  { code: 'RF-USR-002', name: 'Editar usuario', moduleName: 'Usuarios y Roles', description: 'Modificar datos, roles e imagen de firma de usuarios.' },
  { code: 'RF-USR-003', name: 'Gestionar estado usuario', moduleName: 'Usuarios y Roles', description: 'Activar o inactivar cuentas verificando citas pendientes.' },
  { code: 'RF-USR-004', name: 'Buscar usuarios', moduleName: 'Usuarios y Roles', description: 'Consultar y filtrar el directorio de usuarios del sistema.' },
  { code: 'RF-USR-007', name: 'Crear rol', moduleName: 'Usuarios y Roles', description: 'Crear nuevos roles configurables en formato JSON.' },
  { code: 'RF-USR-010', name: 'Editar rol', moduleName: 'Usuarios y Roles', description: 'Modificar nombre, descripción y permisos no clínicos de un rol.' },
  { code: 'RF-USR-011', name: 'Eliminar rol', moduleName: 'Usuarios y Roles', description: 'Eliminar roles personalizados sin usuarios asignados.' },

  // Módulo B: Agendamiento de Citas
  { code: 'RF-AGE-001', name: 'Gestionar bloques horario', moduleName: 'Agendamiento de Citas', description: 'Habilitar o deshabilitar bloques de 30 minutos de la agenda del consultorio.' },
  { code: 'RF-AGE-002', name: 'Agendar citas', moduleName: 'Agendamiento de Citas', description: 'Crear citas confirmadas internamente en máximo 5 pasos.' },
  { code: 'RF-AGE-005', name: 'Gestionar solicitud', moduleName: 'Agendamiento de Citas', description: 'Confirmar, reprogramar o rechazar solicitudes públicas.' },
  { code: 'RF-AGE-006', name: 'Editar cita', moduleName: 'Agendamiento de Citas', description: 'Modificar fecha, bloques o profesional de citas Confirmadas.' },
  { code: 'RF-AGE-007', name: 'Cancelar cita', moduleName: 'Agendamiento de Citas', description: 'Anular citas Confirmadas con motivo y gestión de bloques.' },
  { code: 'RF-AGE-008', name: 'Consultar agenda', moduleName: 'Agendamiento de Citas', description: 'Visualizar calendario semanal en tiempo real.' },
  { code: 'RF-AGE-009', name: 'Iniciar / finalizar atención', moduleName: 'Agendamiento de Citas', description: 'Cambiar estado de cita a En consulta y Atendida.' },
  { code: 'RF-AGE-012', name: 'Marcar inasistencia', moduleName: 'Agendamiento de Citas', description: 'Registrar inasistencia de citas desde su hora de inicio.' },

  // Módulo C (Parte 1): Pacientes y Habeas Data
  { code: 'RF-HCL-001', name: 'Crear paciente', moduleName: 'Pacientes y Habeas Data', description: 'Registrar identificación y contacto (sexo, fecha de nacimiento, teléfono y correo).' },
  { code: 'RF-HCL-002', name: 'Editar paciente', moduleName: 'Pacientes y Habeas Data', description: 'Actualizar datos de contacto y subsanar Datos incompletos.' },
  { code: 'RF-HCL-003', name: 'Buscar pacientes', moduleName: 'Pacientes y Habeas Data', description: 'Buscar por documento exacto o nombre sin distinguir tildes.' },
  { code: 'RF-HCL-004', name: 'Visualizar pacientes', moduleName: 'Pacientes y Habeas Data', description: 'Ver ficha administrativa e historial de citas con "Agendado por".' },
  { code: 'RF-HCL-010', name: 'Consultar datos del titular', moduleName: 'Pacientes y Habeas Data', description: 'Datos del titular como paciente o solicitante, sus autorizaciones y citas (PDF), sin datos clínicos.' },

  // Módulo C (Parte 2): Historia Clínica y Odontograma (Clínicos protegidos)
  { code: 'RF-HCL-005', name: 'Crear historia clínica', moduleName: 'Historia Clínica (Restringido)', description: 'Registrar motivo de consulta y antecedentes al iniciar atención.' },
  { code: 'RF-HCL-006', name: 'Editar historia clínica', moduleName: 'Historia Clínica (Restringido)', description: 'Modificar la historia clínica solo mientras la cita está En consulta.' },
  { code: 'RF-HCL-007', name: 'Gestionar odontograma', moduleName: 'Historia Clínica (Restringido)', description: 'Registrar hallazgos dentales por superficie según numeración FDI.' },
  { code: 'RF-HCL-008', name: 'Consultar historial clínico', moduleName: 'Historia Clínica (Restringido)', description: 'Acceder en solo lectura a historias clínicas previas.' },
  { code: 'RF-HCL-009', name: 'Registrar evolución', moduleName: 'Historia Clínica (Restringido)', description: 'Agregar notas de evolución y notas aclaratorias.' },

  // Módulo D: Consentimientos Informados
  { code: 'RF-CON-001', name: 'Seleccionar consentimiento', moduleName: 'Consentimientos Informados', description: 'Elegir una plantilla activa desde la ficha del paciente, sin cita.' },
  { code: 'RF-CON-002', name: 'Firmar consentimiento', moduleName: 'Consentimientos Informados', description: 'Tomar la firma del paciente o acudiente dentro de la sesión (tablet o computador).' },
  { code: 'RF-CON-003', name: 'Consultar consentimiento', moduleName: 'Consentimientos Informados', description: 'Visualizar y descargar PDF de consentimientos firmados.' },
  { code: 'RF-CON-004', name: 'Crear plantilla consentimiento', moduleName: 'Consentimientos Informados', description: 'Registrar plantillas en versión 1 (procedimiento, autorización de datos o menores).' },
  { code: 'RF-CON-005', name: 'Firmar por acudiente', moduleName: 'Consentimientos Informados', description: 'Firma del acudiente o representante legal con la plantilla de menores.' },
  { code: 'RF-CON-007', name: 'Editar plantilla consentimiento', moduleName: 'Consentimientos Informados', description: 'Generar nueva versión incremental de plantilla activa.' },
  { code: 'RF-CON-008', name: 'Cambiar estado de plantilla', moduleName: 'Consentimientos Informados', description: 'Activar o inactivar plantillas sin eliminarlas.' },

  // Módulo E: Documentos Clínicos
  { code: 'RF-DOC-001', name: 'Generar orden de medicamentos', moduleName: 'Documentos Clínicos (Restringido)', description: 'Emitir fórmula médica en PDF con firma fusionada.' },
  { code: 'RF-DOC-002', name: 'Generar incapacidad', moduleName: 'Documentos Clínicos (Restringido)', description: 'Emitir incapacidad odontológica de 1 a 30 días en PDF.' },
  { code: 'RF-DOC-003', name: 'Generar remisión', moduleName: 'Documentos Clínicos (Restringido)', description: 'Emitir remisión a especialidad extramural en PDF.' },
  { code: 'RF-DOC-004', name: 'Insertar firma profesional', moduleName: 'Documentos Clínicos (Restringido)', description: 'Fusionar firma digitalizada del profesional (flatten) en PDF.' },
];

export interface RolePermissionsMatrixProps {
  roleCode?: string;
  selectedPermissions: string[];
  onChange: (nextPermissions: string[]) => void;
  disabled?: boolean;
  errorMessage?: string;
}

export const RolePermissionsMatrix: React.FC<RolePermissionsMatrixProps> = ({
  roleCode = '',
  selectedPermissions,
  onChange,
  disabled = false,
  errorMessage,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const normalizedRoleCode = roleCode.trim().toUpperCase();
  const isPatientRole = normalizedRoleCode === 'ROL-PAC';
  const isAdminRole = normalizedRoleCode === 'ROL-ADM';

  const groupedPermissions = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();
    const groups = new Map<string, PermissionCatalogItem[]>();

    for (const item of ERS_PERMISSIONS_CATALOG) {
      const matchesSearch =
        !query ||
        item.code.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.moduleName.toLowerCase().includes(query);

      if (!matchesSearch) continue;

      const list = groups.get(item.moduleName) ?? [];
      list.push(item);
      groups.set(item.moduleName, list);
    }
    return Array.from(groups.entries());
  }, [searchFilter]);

  const getLockReason = (permCode: string): string | null => {
    if (disabled) return 'Modo de solo lectura';
    if (isPatientRole) {
      return 'Bloqueado: El rol Paciente no puede tener permisos internos';
    }
    if (CLINICAL_PERMISSIONS.includes(permCode)) {
      return 'Fijo por normativa clínica: reservado a odontólogos';
    }
    if (isAdminRole && ADMIN_USER_ROLE_PERMISSIONS.includes(permCode)) {
      return 'Protegido: obligatorio para Administrador';
    }
    return null;
  };

  const handleTogglePermission = (permCode: string) => {
    if (getLockReason(permCode) !== null) return;

    const exists = selectedPermissions.includes(permCode);
    const updated = exists
      ? selectedPermissions.filter((p) => p !== permCode)
      : [...selectedPermissions, permCode];

    onChange(updated);
  };

  const handleToggleModuleGroup = (items: PermissionCatalogItem[]) => {
    if (disabled || isPatientRole) return;

    const editableCodes = items
      .map((i) => i.code)
      .filter((code) => getLockReason(code) === null);

    if (editableCodes.length === 0) return;

    const allEditableSelected = editableCodes.every((code) =>
      selectedPermissions.includes(code)
    );

    if (allEditableSelected) {
      onChange(selectedPermissions.filter((code) => !editableCodes.includes(code)));
    } else {
      const merged = Array.from(new Set([...selectedPermissions, ...editableCodes]));
      onChange(merged);
    }
  };

  return (
    <section
      aria-label="Matriz de permisos del rol"
      className="w-full rounded-2xl border border-[#E2E6EA] bg-white p-4 sm:p-5 shadow-2xs"
    >
      {/* Cabecera e indicadores de estado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#E2E6EA] pb-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-[#1E242B]">
            Matriz de Permisos del Sistema
          </h3>
          <p className="text-[13px] text-[#687380] mt-0.5">
            Los permisos clínicos son reservados por normativa y no pueden asignarse a roles nuevos ni alterarse.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBF6E6] border border-[#D4AF37]/40 px-3 py-1 text-[12px] font-bold text-[#B8942A]">
            <span className="h-2 w-2 rounded-full bg-[#D4AF37]" aria-hidden="true" />
            {selectedPermissions.length} permiso(s) activo(s)
          </span>
        </div>
      </div>

      {/* Buscador de permisos */}
      <div className="mt-4">
        <label
          htmlFor="permission-search-input"
          className="block text-[12px] font-bold uppercase tracking-wider text-[#1E242B] mb-1.5"
        >
          Filtrar permisos
        </label>
        <div className="relative">
          <input
            id="permission-search-input"
            type="search"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Buscar por nombre de acción o módulo..."
            className="w-full min-h-[42px] rounded-xl border border-[#E2E6EA] bg-[#F8F9FA] px-4 py-2 text-sm text-[#1E242B] placeholder-[#94A3B8] transition-colors focus:border-[#D4AF37] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20"
          />
        </div>
      </div>

      {/* Alerta de error de validación (color + ícono + texto según RQNF-USA-001) */}
      {errorMessage && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#B91C1C]/30 bg-[#FEE2E2] p-3.5 text-[13px] sm:text-sm font-medium text-[#B91C1C]"
        >
          <svg
            className="h-5 w-5 shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"
            />
          </svg>
          <span>Error de validación: {errorMessage}</span>
        </div>
      )}

      {/* Listado de módulos y permisos */}
      <div className="mt-5 space-y-6 max-h-[460px] overflow-y-auto pr-1">
        {groupedPermissions.length === 0 ? (
          <div className="rounded-xl border border-[#E2E6EA] bg-[#F8F9FA] p-6 text-center text-sm text-[#687380]">
            Ninguna coincidencia encontrada para &ldquo;{searchFilter}&rdquo;.
          </div>
        ) : (
          groupedPermissions.map(([moduleName, items]) => {
            const editableInGroup = items.filter((i) => getLockReason(i.code) === null);
            const allEditableChecked =
              editableInGroup.length > 0 &&
              editableInGroup.every((i) => selectedPermissions.includes(i.code));

            return (
              <div
                key={moduleName}
                className="rounded-xl border border-[#E2E6EA] bg-[#F8F9FA] overflow-hidden"
              >
                {/* Encabezado del grupo */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-3 border-b border-[#E2E6EA]">
                  <h4 className="text-sm font-bold text-[#1E242B]">{moduleName}</h4>

                  {editableInGroup.length > 0 && !disabled && !isPatientRole && (
                    <button
                      type="button"
                      onClick={() => handleToggleModuleGroup(items)}
                      className="min-h-[36px] rounded-lg border border-[#E2E6EA] bg-[#F8F9FA] px-3 py-1 text-[13px] font-semibold text-[#1E242B] hover:border-[#D4AF37] hover:bg-[#FBF6E6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] transition-colors"
                    >
                      {allEditableChecked
                        ? 'Desmarcar habilitados del módulo'
                        : 'Seleccionar habilitados del módulo'}
                    </button>
                  )}
                </div>

                {/* Grilla responsiva 1 col en 360px, 2 cols desde md (768px) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 sm:p-4">
                  {items.map((perm) => {
                    const isSelected = selectedPermissions.includes(perm.code);
                    const lockReason = getLockReason(perm.code);
                    const isLocked = lockReason !== null;

                    return (
                      <div
                        key={perm.code}
                        onClick={() => !isLocked && handleTogglePermission(perm.code)}
                        onKeyDown={(e) => {
                          if (!isLocked && (e.key === ' ' || e.key === 'Enter')) {
                            e.preventDefault();
                            handleTogglePermission(perm.code);
                          }
                        }}
                        role="checkbox"
                        aria-checked={isSelected}
                        aria-disabled={isLocked}
                        tabIndex={isLocked ? -1 : 0}
                        className={`flex flex-col justify-between rounded-xl border p-3.5 transition-all min-h-[88px] ${
                          isLocked
                            ? 'cursor-not-allowed border-[#E2E6EA] bg-[#F3F5F7]/80 opacity-85'
                            : isSelected
                            ? 'cursor-pointer border-[#D4AF37] bg-[#FBF6E6]/70 shadow-sm'
                            : 'cursor-pointer border-[#E2E6EA] bg-white hover:border-[#D4AF37]/60'
                        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Casilla visual accesible */}
                          <div
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              isSelected
                                ? 'border-[#D4AF37] bg-[#D4AF37] text-white'
                                : isLocked
                                ? 'border-[#C4C9CF] bg-[#E2E6EA]'
                                : 'border-[#687380] bg-white'
                            }`}
                            aria-hidden="true"
                          >
                            {isSelected && (
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h5 className="text-sm font-bold text-[#1E242B]">
                              {perm.name}
                            </h5>
                            <p className="mt-1 text-[13px] text-[#687380] leading-snug">
                              {perm.description}
                            </p>
                          </div>
                        </div>

                        {/* Etiqueta textual explícita de estado (RQNF-USA-001: Color + Texto) */}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E2E6EA]/70">
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#DCFCE7] px-2 py-0.5 text-[13px] font-semibold text-[#15803D]">
                              ✓ Estado: Asignado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#F3F5F7] px-2 py-0.5 text-[13px] font-medium text-[#687380]">
                              ○ Estado: No asignado
                            </span>
                          )}

                          {lockReason && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#DBEAFE] px-2 py-0.5 text-[13px] font-medium text-[#1D4ED8]">
                              🔒 {lockReason}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};