// src/modules/users-auth/infrastructure/user.model.ts

export interface RoleRow {
  id_rol: number;
  nombre_rol: string;
  permisos?: string[] | any;
  es_inicial?: boolean;
}

export interface UserRow {
  id_usuario: number;
  nombre_completo: string;
  documento_identidad: string;
  correo: string;
  telefono: string | null;
  contrasena_hash: string;
  estado: boolean;
  firma_base64?: string | null;
}

export interface UserWithRolesDTO {
  idUsuario: number;
  nombreCompleto: string;
  documentoIdentidad: string;
  correo: string;
  telefono: string | null;
  estado: boolean;
  roles: { idRol: number; nombreRol: string; estadoAsignacion: boolean; permisos?: string[]; esInicial?: boolean }[];
}

export interface CreateUserDTO {
  nombreCompleto: string;
  documentoIdentidad: string;
  correo: string;
  telefono?: string;
  contrasenaHash: string;
  rolesIds: number[];
  firmaBase64?: string;
}
