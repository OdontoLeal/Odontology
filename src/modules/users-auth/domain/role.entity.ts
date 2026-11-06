export type InitialRoleCode =
  | 'ROL-PAC'
  | 'ROL-ODO'
  | 'ROL-ESP'
  | 'ROL-COA'
  | 'ROL-AUX'
  | 'ROL-ADM';

export const INITIAL_ROLE_CODES: ReadonlyArray<InitialRoleCode> = [
  'ROL-PAC',
  'ROL-ODO',
  'ROL-ESP',
  'ROL-COA',
  'ROL-AUX',
  'ROL-ADM',
];

// Permisos clínicos según RF-USR-007 (ERS v1.3): no se asignan a roles nuevos
// ni se cambian en los roles existentes (RF-USR-010).
export const CLINICAL_PERMISSIONS: ReadonlyArray<string> = [
  'RF-HCL-005',
  'RF-HCL-006',
  'RF-HCL-007',
  'RF-HCL-008',
  'RF-HCL-009',
  'RF-CON-001',
  'RF-CON-002',
  'RF-CON-003',
  'RF-DOC-001',
  'RF-DOC-002',
  'RF-DOC-003',
  'RF-DOC-004',
];

// Permisos de administración de usuarios y roles requeridos para ROL-ADM (RF-USR-010)
export const ADMIN_USER_ROLE_PERMISSIONS: ReadonlyArray<string> = [
  'RF-USR-001',
  'RF-USR-002',
  'RF-USR-003',
  'RF-USR-004',
  'RF-USR-007',
  'RF-USR-010',
  'RF-USR-011',
];

/**
 * Catálogo de permisos (RF-USR-007): uno por cada requisito funcional usado con
 * sesión iniciada, salvo cerrar sesión. ERS v1.3: RF-AGE-012 es "Marcar
 * inasistencia"; ya no existen RF-AGE-013, RF-CON-006 ni RF-DOC-005.
 */
export const VALID_SESSION_PERMISSIONS: ReadonlyArray<string> = [
  ...ADMIN_USER_ROLE_PERMISSIONS,
  'RF-AGE-001',
  'RF-AGE-002',
  'RF-AGE-005',
  'RF-AGE-006',
  'RF-AGE-007',
  'RF-AGE-008',
  'RF-AGE-009',
  'RF-AGE-012',
  'RF-HCL-001',
  'RF-HCL-002',
  'RF-HCL-003',
  'RF-HCL-004',
  'RF-HCL-005',
  'RF-HCL-006',
  'RF-HCL-007',
  'RF-HCL-008',
  'RF-HCL-009',
  'RF-HCL-010',
  'RF-CON-001',
  'RF-CON-002',
  'RF-CON-003',
  'RF-CON-004',
  'RF-CON-005',
  'RF-CON-007',
  'RF-CON-008',
  'RF-DOC-001',
  'RF-DOC-002',
  'RF-DOC-003',
  'RF-DOC-004',
];

export interface RoleProps {
  idRol?: number;
  codigo: string;
  nombreRol: string;
  descripcion: string;
  permisos: string[];
  estadoAsignacion?: boolean;
  esInicial?: boolean;
}

export class RoleEntity {
  public readonly idRol?: number;
  public readonly codigo: string;
  private _nombreRol: string;
  private _descripcion: string;
  private _permisos: string[];
  public readonly estadoAsignacion: boolean;
  public readonly esInicial: boolean;

  private constructor(props: RoleProps) {
    this.idRol = props.idRol;
    this.codigo = props.codigo.trim().toUpperCase();
    this._nombreRol = props.nombreRol.trim();
    this._descripcion = props.descripcion.trim();
    this._permisos = Array.from(new Set(props.permisos));
    this.estadoAsignacion = props.estadoAsignacion ?? true;
    this.esInicial = props.esInicial ?? INITIAL_ROLE_CODES.includes(this.codigo as InitialRoleCode);
  }

  public get nombreRol(): string {
    return this._nombreRol;
  }

  public get descripcion(): string {
    return this._descripcion;
  }

  public get permisos(): ReadonlyArray<string> {
    return [...this._permisos];
  }

  public static createNew(props: Omit<RoleProps, 'idRol'>): RoleEntity {
    const codigo = props.codigo?.trim().toUpperCase();
    const nombreRol = props.nombreRol?.trim();
    const descripcion = props.descripcion?.trim() ?? '';
    const permisos = props.permisos ?? [];

    if (!codigo) {
      throw new Error('El código del rol es obligatorio.');
    }
    if (codigo.length > 20) {
      throw new Error('El código del rol no puede exceder los 20 caracteres.');
    }
    if (INITIAL_ROLE_CODES.includes(codigo as InitialRoleCode)) {
      throw new Error(
        `El código "${codigo}" está reservado para los roles iniciales del sistema y no puede ser usado en nuevos roles.`
      );
    }
    if (!nombreRol) {
      throw new Error('El nombre del rol es obligatorio.');
    }
    if (nombreRol.length > 40) {
      throw new Error('El nombre del rol no puede exceder los 40 caracteres.');
    }
    if (descripcion.length > 250) {
      throw new Error('La descripción del rol no puede exceder los 250 caracteres.');
    }
    if (!Array.isArray(permisos) || permisos.length === 0) {
      throw new Error('Debe asignar al menos un permiso al rol.');
    }

    for (const perm of permisos) {
      if (!VALID_SESSION_PERMISSIONS.includes(perm)) {
        throw new Error(`El permiso "${perm}" no es válido o no pertenece al catálogo.`);
      }
      if (CLINICAL_PERMISSIONS.includes(perm)) {
        throw new Error(
          `No está permitido asignar el permiso clínico "${perm}" a un nuevo rol.`
        );
      }
    }

    return new RoleEntity({
      codigo,
      nombreRol,
      descripcion,
      permisos,
      estadoAsignacion: props.estadoAsignacion ?? true,
      esInicial: false,
    });
  }

  public static reconstitute(props: RoleProps): RoleEntity {
    return new RoleEntity(props);
  }

  public update(params: {
    nombreRol: string;
    descripcion: string;
    permisos: string[];
  }): void {
    const nuevoNombre = params.nombreRol?.trim();
    const nuevaDescripcion = params.descripcion?.trim() ?? '';
    const nuevosPermisos = Array.from(new Set(params.permisos ?? []));

    if (!nuevoNombre) {
      throw new Error('El nombre del rol no puede quedar vacío.');
    }
    if (nuevoNombre.length > 40) {
      throw new Error('El nombre del rol no puede exceder los 40 caracteres.');
    }

    // ROL-PAC no puede recibir permisos internos
    if (this.codigo === 'ROL-PAC') {
      if (nuevosPermisos.length > 0) {
        throw new Error('No se pueden asignar permisos internos al rol ROL-PAC.');
      }
      this._nombreRol = nuevoNombre;
      this._descripcion = nuevaDescripcion;
      return;
    }

    if (nuevosPermisos.length === 0) {
      throw new Error('El rol no puede quedar sin permisos.');
    }

    for (const perm of nuevosPermisos) {
      if (!VALID_SESSION_PERMISSIONS.includes(perm)) {
        throw new Error(`El permiso "${perm}" no pertenece al catálogo válido.`);
      }
    }

    // Prohibición de quitar permisos de administración de usuarios y roles a ROL-ADM
    if (this.codigo === 'ROL-ADM') {
      const missingAdminPerms = ADMIN_USER_ROLE_PERMISSIONS.filter(
        (adminPerm) => !nuevosPermisos.includes(adminPerm)
      );
      if (missingAdminPerms.length > 0) {
        throw new Error(
          `No se pueden quitar a ROL-ADM los permisos de administración de usuarios y roles: ${missingAdminPerms.join(', ')}.`
        );
      }
    }

    // Prohibición de cambiar los permisos clínicos de cualquier rol
    const currentClinical = this._permisos.filter((p) => CLINICAL_PERMISSIONS.includes(p)).sort();
    const nextClinical = nuevosPermisos.filter((p) => CLINICAL_PERMISSIONS.includes(p)).sort();

    if (
      currentClinical.length !== nextClinical.length ||
      currentClinical.some((perm, idx) => perm !== nextClinical[idx])
    ) {
      throw new Error(
        'No está permitido modificar los permisos clínicos de ningún rol.'
      );
    }

    this._nombreRol = nuevoNombre;
    this._descripcion = nuevaDescripcion;
    this._permisos = nuevosPermisos;
  }

  public isInitialRole(): boolean {
    return Boolean(this.esInicial) || INITIAL_ROLE_CODES.includes(this.codigo as InitialRoleCode);
  }

  public ensureCanBeDeleted(assignedUsersCount: number): void {
    if (this.isInitialRole()) {
      throw new Error(
        `El rol ${this.codigo} (${this._nombreRol}) pertenece a la configuración inicial del sistema y no puede ser eliminado.`
      );
    }
    if (assignedUsersCount > 0) {
      throw new Error(
        `No se puede eliminar el rol porque está asignado a ${assignedUsersCount} usuario(s).`
      );
    }
  }

  public toJSON() {
    return {
      idRol: this.idRol,
      codigo: this.codigo,
      nombreRol: this._nombreRol,
      descripcion: this._descripcion,
      permisos: [...this._permisos],
      estadoAsignacion: this.estadoAsignacion,
      esInicial: this.isInitialRole(),
    };
  }
}