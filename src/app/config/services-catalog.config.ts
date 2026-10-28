// src/app/config/services-catalog.config.ts
import { DentalServiceType } from '../../modules/appointments/domain/appointment.entity';

export interface DentalServiceConfig {
  codigo: string;
  nombre: DentalServiceType;
  descripcion: string;
  profesionalPorDefecto: {
    nombre: string;
    rolRequerido: 'ROL-ODO' | 'ROL-ESP';
    documentoIdentidad?: string;
  };
  colorIdentificador: string;
  duracionBloquesPorDefecto: number; // Cantidad de bloques de 30 min sugeridos
}

/**
 * Catálogo configurable de servicios odontológicos ofrecidos (RF-AGE-012 / RQNF-MAN-001).
 * Permite actualizar o agregar servicios y asignación de profesionales por configuración
 * sin necesidad de alterar la lógica central del agendamiento.
 */
export const SERVICES_CATALOG: DentalServiceConfig[] = [
  {
    codigo: 'ODO-GEN',
    nombre: 'Odontología general',
    descripcion: 'Valoración inicial, operatoria dental, resinas, limpiezas y tratamientos generales.',
    profesionalPorDefecto: {
      nombre: 'Dr. Eduar Leal Álvarez',
      rolRequerido: 'ROL-ODO',
    },
    colorIdentificador: '#2563EB', // Azul profesional
    duracionBloquesPorDefecto: 1, // 30 minutos
  },
  {
    codigo: 'ORT-ESP',
    nombre: 'Ortodoncia',
    descripcion: 'Control y tratamiento de ortodoncia, brackets, alineación y estética oclusal.',
    profesionalPorDefecto: {
      nombre: 'Dra. Natalia Díaz',
      rolRequerido: 'ROL-ESP',
    },
    colorIdentificador: '#7C3AED', // Violeta especialista
    duracionBloquesPorDefecto: 1, // 30 minutos
  },
];

export function findServiceConfigByName(serviceName: string): DentalServiceConfig | undefined {
  return SERVICES_CATALOG.find(
    (s) => s.nombre.toLowerCase().trim() === serviceName.toLowerCase().trim()
  );
}
