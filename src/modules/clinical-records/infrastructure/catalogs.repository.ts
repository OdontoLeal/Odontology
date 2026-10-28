// src/modules/clinical-records/infrastructure/catalogs.repository.ts
import { EvolutionNoteEntity, EvolutionTemplateDefinition } from '../domain/evolution-note.entity';

export interface OdontogramFindingCatalogItem {
  codigo: string;
  nombre: string;
  tipo: 'SUPERFICIE' | 'SIMBOLO_TECNICO';
  colorHex: string;
  descripcion: string;
}

export interface AntecedentCatalogItem {
  codigo: string;
  nombre: string;
  categoria: 'PERSONAL' | 'FAMILIAR' | 'GENERAL';
  requiereObservacionEnSi: boolean;
}

/**
 * RQNF-MAN-001: Repositorio de catálogos configurables para el módulo clínico.
 * Permite consultar y extender hallazgos del odontograma con sus colores (RF-HCL-007),
 * antecedentes médicos (RF-HCL-005) y plantillas de evolución (RF-HCL-009) sin alterar la lógica de negocio.
 */
export class ClinicalCatalogsRepository {
  private static readonly ODONTOGRAM_FINDINGS: OdontogramFindingCatalogItem[] = [
    {
      codigo: 'caries_activa',
      nombre: 'Caries activa',
      tipo: 'SUPERFICIE',
      colorHex: '#EF4444', // Rojo
      descripcion: 'Lesión cariosa activa cavitada o microcavitada en superficie dental.',
    },
    {
      codigo: 'restauracion_resina',
      nombre: 'Restauración en resina',
      tipo: 'SUPERFICIE',
      colorHex: '#3B82F6', // Azul
      descripcion: 'Obturación estética definitiva en resina compuesta en buen estado.',
    },
    {
      codigo: 'sellante_fosas',
      nombre: 'Sellante de fosas y fisuras',
      tipo: 'SUPERFICIE',
      colorHex: '#10B981', // Verde
      descripcion: 'Sellante preventivo o terapéutico en fosas y fisuras anatómicas.',
    },
    {
      codigo: 'desgaste_faceta',
      nombre: 'Desgaste / Faceta oclusal',
      tipo: 'SUPERFICIE',
      colorHex: '#F59E0B', // Ámbar / Amarillo
      descripcion: 'Pérdida de estructura dental por atrición, bruxismo o erosión.',
    },
    {
      codigo: 'diente_extraido',
      nombre: 'Diente ausente / extraído',
      tipo: 'SIMBOLO_TECNICO',
      colorHex: '#111827', // Negro
      descripcion: 'Pieza dental ausente clínicamente por exodoncia previa o agenesia.',
    },
    {
      codigo: 'extraccion_requerida',
      nombre: 'Extracción indicada / requerida',
      tipo: 'SIMBOLO_TECNICO',
      colorHex: '#DC2626', // Rojo carmesí
      descripcion: 'Pieza dental con indicación de exodoncia simple o quirúrgica.',
    },
    {
      codigo: 'corona',
      nombre: 'Corona protésica',
      tipo: 'SIMBOLO_TECNICO',
      colorHex: '#D97706', // Dorado
      descripcion: 'Prótesis fija unitaria metal-cerámica, zirconio o disilicato.',
    },
    {
      codigo: 'implante',
      nombre: 'Implante osteointegrado',
      tipo: 'SIMBOLO_TECNICO',
      colorHex: '#4B5563', // Gris titanio
      descripcion: 'Fijación de titanio osteointegrada en hueso maxilar o mandibular.',
    },
    {
      codigo: 'protesis_fija',
      nombre: 'Prótesis fija',
      tipo: 'SIMBOLO_TECNICO',
      colorHex: '#8B5CF6', // Púrpura
      descripcion: 'Estructura protésica fija plural sobre dientes o implantes.',
    },
    {
      codigo: 'endodoncia',
      nombre: 'Tratamiento de conductos (Endodoncia)',
      tipo: 'SIMBOLO_TECNICO',
      colorHex: '#06B6D4', // Cian
      descripcion: 'Conductometría y obturación radicular tridimensional realizada.',
    },
    {
      codigo: 'puente',
      nombre: 'Puente dental',
      tipo: 'SIMBOLO_TECNICO',
      colorHex: '#6366F1', // Índigo
      descripcion: 'Prótesis fija plural con pilares y pónticos intermedios.',
    },
  ];

  private static readonly ANTECEDENTS: AntecedentCatalogItem[] = [
    {
      codigo: 'hipertension_arterial',
      nombre: 'Hipertensión arterial',
      categoria: 'PERSONAL',
      requiereObservacionEnSi: true,
    },
    {
      codigo: 'diabetes',
      nombre: 'Diabetes mellitus',
      categoria: 'PERSONAL',
      requiereObservacionEnSi: true,
    },
    {
      codigo: 'cardiopatias',
      nombre: 'Cardiopatías / Valvulopatías',
      categoria: 'PERSONAL',
      requiereObservacionEnSi: true,
    },
    {
      codigo: 'alergias_medicamentos',
      nombre: 'Alergias a medicamentos o anestésicos',
      categoria: 'PERSONAL',
      requiereObservacionEnSi: true,
    },
    {
      codigo: 'alteraciones_coagulacion',
      nombre: 'Alteraciones de la coagulación o hemorragias',
      categoria: 'PERSONAL',
      requiereObservacionEnSi: true,
    },
    {
      codigo: 'embarazo',
      nombre: 'Embarazo (semanas de gestación)',
      categoria: 'PERSONAL',
      requiereObservacionEnSi: true,
    },
    {
      codigo: 'antecedentes_familiares_relevantes',
      nombre: 'Antecedentes familiares de relevancia sistémica',
      categoria: 'FAMILIAR',
      requiereObservacionEnSi: true,
    },
  ];

  public getOdontogramFindings(): OdontogramFindingCatalogItem[] {
    return [...ClinicalCatalogsRepository.ODONTOGRAM_FINDINGS];
  }

  public getAntecedentsCatalog(): AntecedentCatalogItem[] {
    return [...ClinicalCatalogsRepository.ANTECEDENTS];
  }

  public getEvolutionTemplates(): EvolutionTemplateDefinition[] {
    return Object.values(EvolutionNoteEntity.TEMPLATES);
  }
}
