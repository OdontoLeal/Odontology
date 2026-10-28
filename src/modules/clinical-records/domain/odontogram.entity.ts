import {
  LowerToothSurfacesDTO,
  OdontogramDataDTO,
  OdontogramQuadrantDTO,
  OdontogramSurfaceFlagsDTO,
  OdontogramTechnicalSymbolsDTO,
  OdontogramToothDTO,
  QuadrantKey,
  UpperToothSurfacesDTO,
} from '../infrastructure/clinical-record.model';
import { ClinicalDomainError } from './clinical-record.entity';

interface QuadrantCatalogMetadata {
  key: QuadrantKey;
  id_cuadrante: number;
  descripcion: string;
  isUpperArch: boolean;
  isTemporary: boolean;
  piezas: Array<{ codigo_fdi: number; nombre_anatomico: string }>;
}

export class OdontogramEntity {
  private static readonly QUADRANT_CATALOG: readonly QuadrantCatalogMetadata[] = [
    {
      key: 'cuadrante_1',
      id_cuadrante: 1,
      descripcion: 'Maxilar Superior Derecho',
      isUpperArch: true,
      isTemporary: false,
      piezas: [
        { codigo_fdi: 18, nombre_anatomico: 'Tercer molar superior derecho' },
        { codigo_fdi: 17, nombre_anatomico: 'Segundo molar superior derecho' },
        { codigo_fdi: 16, nombre_anatomico: 'Primer molar superior derecho' },
        { codigo_fdi: 15, nombre_anatomico: 'Segundo premolar superior derecho' },
        { codigo_fdi: 14, nombre_anatomico: 'Primer premolar superior derecho' },
        { codigo_fdi: 13, nombre_anatomico: 'Canino superior derecho' },
        { codigo_fdi: 12, nombre_anatomico: 'Incisivo lateral superior derecho' },
        { codigo_fdi: 11, nombre_anatomico: 'Incisivo central superior derecho' },
      ],
    },
    {
      key: 'cuadrante_2',
      id_cuadrante: 2,
      descripcion: 'Maxilar Superior Izquierdo',
      isUpperArch: true,
      isTemporary: false,
      piezas: [
        { codigo_fdi: 21, nombre_anatomico: 'Incisivo central superior izquierdo' },
        { codigo_fdi: 22, nombre_anatomico: 'Incisivo lateral superior izquierdo' },
        { codigo_fdi: 23, nombre_anatomico: 'Canino superior izquierdo' },
        { codigo_fdi: 24, nombre_anatomico: 'Primer premolar superior izquierdo' },
        { codigo_fdi: 25, nombre_anatomico: 'Segundo premolar superior izquierdo' },
        { codigo_fdi: 26, nombre_anatomico: 'Primer molar superior izquierdo' },
        { codigo_fdi: 27, nombre_anatomico: 'Segundo molar superior izquierdo' },
        { codigo_fdi: 28, nombre_anatomico: 'Tercer molar superior izquierdo' },
      ],
    },
    {
      key: 'cuadrante_4',
      id_cuadrante: 4,
      descripcion: 'Mandíbula Inferior Derecha',
      isUpperArch: false,
      isTemporary: false,
      piezas: [
        { codigo_fdi: 48, nombre_anatomico: 'Tercer molar inferior derecho' },
        { codigo_fdi: 47, nombre_anatomico: 'Segundo molar inferior derecho' },
        { codigo_fdi: 46, nombre_anatomico: 'Primer molar inferior derecho' },
        { codigo_fdi: 45, nombre_anatomico: 'Segundo premolar inferior derecho' },
        { codigo_fdi: 44, nombre_anatomico: 'Primer premolar inferior derecho' },
        { codigo_fdi: 43, nombre_anatomico: 'Canino inferior derecho' },
        { codigo_fdi: 42, nombre_anatomico: 'Incisivo lateral inferior derecho' },
        { codigo_fdi: 41, nombre_anatomico: 'Incisivo central inferior derecho' },
      ],
    },
    {
      key: 'cuadrante_3',
      id_cuadrante: 3,
      descripcion: 'Mandíbula Inferior Izquierda',
      isUpperArch: false,
      isTemporary: false,
      piezas: [
        { codigo_fdi: 31, nombre_anatomico: 'Incisivo central inferior izquierdo' },
        { codigo_fdi: 32, nombre_anatomico: 'Incisivo lateral inferior izquierdo' },
        { codigo_fdi: 33, nombre_anatomico: 'Canino inferior izquierdo' },
        { codigo_fdi: 34, nombre_anatomico: 'Primer premolar inferior izquierdo' },
        { codigo_fdi: 35, nombre_anatomico: 'Segundo premolar inferior izquierdo' },
        { codigo_fdi: 36, nombre_anatomico: 'Primer molar inferior izquierdo' },
        { codigo_fdi: 37, nombre_anatomico: 'Segundo molar inferior izquierdo' },
        { codigo_fdi: 38, nombre_anatomico: 'Tercer molar inferior izquierdo' },
      ],
    },
    // Cuadrantes temporales (5 a 8) según RF-HCL-007 para menores de 18 años o con hallazgos previos
    {
      key: 'cuadrante_5',
      id_cuadrante: 5,
      descripcion: 'Maxilar Superior Derecho Temporal',
      isUpperArch: true,
      isTemporary: true,
      piezas: [
        { codigo_fdi: 55, nombre_anatomico: 'Segundo molar temporal superior derecho' },
        { codigo_fdi: 54, nombre_anatomico: 'Primer molar temporal superior derecho' },
        { codigo_fdi: 53, nombre_anatomico: 'Canino temporal superior derecho' },
        { codigo_fdi: 52, nombre_anatomico: 'Incisivo lateral temporal superior derecho' },
        { codigo_fdi: 51, nombre_anatomico: 'Incisivo central temporal superior derecho' },
      ],
    },
    {
      key: 'cuadrante_6',
      id_cuadrante: 6,
      descripcion: 'Maxilar Superior Izquierdo Temporal',
      isUpperArch: true,
      isTemporary: true,
      piezas: [
        { codigo_fdi: 61, nombre_anatomico: 'Incisivo central temporal superior izquierdo' },
        { codigo_fdi: 62, nombre_anatomico: 'Incisivo lateral temporal superior izquierdo' },
        { codigo_fdi: 63, nombre_anatomico: 'Canino temporal superior izquierdo' },
        { codigo_fdi: 64, nombre_anatomico: 'Primer molar temporal superior izquierdo' },
        { codigo_fdi: 65, nombre_anatomico: 'Segundo molar temporal superior izquierdo' },
      ],
    },
    {
      key: 'cuadrante_8',
      id_cuadrante: 8,
      descripcion: 'Mandíbula Inferior Derecha Temporal',
      isUpperArch: false,
      isTemporary: true,
      piezas: [
        { codigo_fdi: 85, nombre_anatomico: 'Segundo molar temporal inferior derecho' },
        { codigo_fdi: 84, nombre_anatomico: 'Primer molar temporal inferior derecho' },
        { codigo_fdi: 83, nombre_anatomico: 'Canino temporal inferior derecho' },
        { codigo_fdi: 82, nombre_anatomico: 'Incisivo lateral temporal inferior derecho' },
        { codigo_fdi: 81, nombre_anatomico: 'Incisivo central temporal inferior derecho' },
      ],
    },
    {
      key: 'cuadrante_7',
      id_cuadrante: 7,
      descripcion: 'Mandíbula Inferior Izquierda Temporal',
      isUpperArch: false,
      isTemporary: true,
      piezas: [
        { codigo_fdi: 71, nombre_anatomico: 'Incisivo central temporal inferior izquierdo' },
        { codigo_fdi: 72, nombre_anatomico: 'Incisivo lateral temporal inferior izquierdo' },
        { codigo_fdi: 73, nombre_anatomico: 'Canino temporal inferior izquierdo' },
        { codigo_fdi: 74, nombre_anatomico: 'Primer molar temporal inferior izquierdo' },
        { codigo_fdi: 75, nombre_anatomico: 'Segundo molar temporal inferior izquierdo' },
      ],
    },
  ];

  private snapshot: OdontogramDataDTO;
  private readonly allowTemporaryTeeth: boolean;

  private constructor(snapshot: OdontogramDataDTO, allowTemporaryTeeth: boolean) {
    this.allowTemporaryTeeth = allowTemporaryTeeth;
    this.validateOdontogramSnapshot(snapshot);
    this.snapshot = structuredClone(snapshot);
  }

  /**
   * RF-HCL-007: En la primera historia clínica genera el JSON del odontograma sin hallazgos;
   * en las siguientes parte del último guardado.
   */
  public static fromPreviousOdontogram(params: {
    previousOdontogram?: OdontogramDataDTO | null;
    isMinorUnder18?: boolean;
  }): OdontogramEntity {
    const hasTemporaryQuadrantsInPrevious = Boolean(
      params.previousOdontogram?.cuadrantes &&
        ('cuadrante_5' in params.previousOdontogram.cuadrantes ||
          'cuadrante_6' in params.previousOdontogram.cuadrantes ||
          'cuadrante_7' in params.previousOdontogram.cuadrantes ||
          'cuadrante_8' in params.previousOdontogram.cuadrantes)
    );

    const allowTemporary =
      Boolean(params.isMinorUnder18) || hasTemporaryQuadrantsInPrevious;

    const initialData =
      params.previousOdontogram && params.previousOdontogram.cuadrantes
        ? structuredClone(params.previousOdontogram)
        : this.createBlankOdontogramJSON(allowTemporary);

    return new OdontogramEntity(initialData, allowTemporary);
  }

  /**
   * RF-HCL-007: Actualiza el estado del odontograma validando reglas anatómicas FDI
   * y unicidad de hallazgos por cara dental.
   */
  public applyUpdatedOdontogram(newOdontogram: OdontogramDataDTO): void {
    if (!newOdontogram || typeof newOdontogram !== 'object' || !newOdontogram.cuadrantes) {
      throw new ClinicalDomainError(
        'Seleccione un hallazgo del catálogo',
        'BAD_REQUEST'
      );
    }

    this.validateOdontogramSnapshot(newOdontogram);
    this.snapshot = structuredClone(newOdontogram);
  }

  public getSnapshot(): OdontogramDataDTO {
    return structuredClone(this.snapshot);
  }

  /**
   * Construye el JSON base idéntico a odontograma.json con todos los atributos inicializados en false
   */
  public static createBlankOdontogramJSON(includeTemporaryTeeth = false): OdontogramDataDTO {
    const cuadrantes: Partial<Record<QuadrantKey, OdontogramQuadrantDTO>> = {};

    for (const quadMeta of this.QUADRANT_CATALOG) {
      if (quadMeta.isTemporary && !includeTemporaryTeeth) {
        continue;
      }

      const piezasMap: Record<string, OdontogramToothDTO> = {};
      for (const pieza of quadMeta.piezas) {
        piezasMap[String(pieza.codigo_fdi)] = {
          codigo_fdi: pieza.codigo_fdi,
          nombre_anatomico: pieza.nombre_anatomico,
          caras: quadMeta.isUpperArch
            ? this.createBlankUpperSurfaces()
            : this.createBlankLowerSurfaces(),
          simbolos_tecnicos: this.createBlankTechnicalSymbols(),
          nota_clinica: null,
        };
      }

      cuadrantes[quadMeta.key] = {
        id_cuadrante: quadMeta.id_cuadrante,
        descripcion: quadMeta.descripcion,
        piezas: piezasMap,
      };
    }

    return {
      cuadrantes: cuadrantes as OdontogramDataDTO['cuadrantes'],
    };
  }

  private static createBlankSurfaceFlags(): OdontogramSurfaceFlagsDTO {
    return {
      caries_activa: false,
      restauracion_resina: false,
      sellante_fosas: false,
      desgaste_faceta: false,
    };
  }

  private static createBlankUpperSurfaces(): UpperToothSurfacesDTO {
    return {
      vestibular: this.createBlankSurfaceFlags(),
      palatina: this.createBlankSurfaceFlags(),
      mesial: this.createBlankSurfaceFlags(),
      distal: this.createBlankSurfaceFlags(),
      oclusal_incisal: this.createBlankSurfaceFlags(),
    };
  }

  private static createBlankLowerSurfaces(): LowerToothSurfacesDTO {
    return {
      vestibular: this.createBlankSurfaceFlags(),
      lingual: this.createBlankSurfaceFlags(),
      mesial: this.createBlankSurfaceFlags(),
      distal: this.createBlankSurfaceFlags(),
      oclusal_incisal: this.createBlankSurfaceFlags(),
    };
  }

  private static createBlankTechnicalSymbols(): OdontogramTechnicalSymbolsDTO {
    return {
      diente_extraido: false,
      extraccion_requerida: false,
      corona: false,
      implante: false,
      protesis_fija: false,
      endodoncia: false,
      puente: false,
    };
  }

  private validateOdontogramSnapshot(data: OdontogramDataDTO): void {
    const requiredPermanentQuadrants: QuadrantKey[] = [
      'cuadrante_1',
      'cuadrante_2',
      'cuadrante_3',
      'cuadrante_4',
    ];

    for (const reqKey of requiredPermanentQuadrants) {
      if (!data.cuadrantes[reqKey]) {
        throw new ClinicalDomainError(
          `El JSON del odontograma debe incluir el cuadrante obligatorio "${reqKey}".`,
          'BAD_REQUEST'
        );
      }
    }

    for (const [quadKey, quadrant] of Object.entries(data.cuadrantes)) {
      if (!quadrant) continue;

      const catalogMeta = OdontogramEntity.QUADRANT_CATALOG.find(
        (q) => q.key === quadKey
      );
      if (!catalogMeta) {
        throw new ClinicalDomainError(
          `El cuadrante "${quadKey}" no es válido en la numeración FDI.`,
          'BAD_REQUEST'
        );
      }

      if (catalogMeta.isTemporary && !this.allowTemporaryTeeth) {
        throw new ClinicalDomainError(
          `El cuadrante temporal "${quadKey}" solo está permitido para menores de 18 años o pacientes con hallazgos previos en dentición temporal.`,
          'BAD_REQUEST'
        );
      }

      this.validateQuadrantPieces(catalogMeta, quadrant);
    }
  }

  private validateQuadrantPieces(
    meta: QuadrantCatalogMetadata,
    quadrant: OdontogramQuadrantDTO
  ): void {
    if (!quadrant.piezas || typeof quadrant.piezas !== 'object') {
      throw new ClinicalDomainError(
        `El cuadrante "${meta.key}" debe contener el mapa de "piezas".`,
        'BAD_REQUEST'
      );
    }

    const expectedSurfaceKeys = meta.isUpperArch
      ? ['vestibular', 'palatina', 'mesial', 'distal', 'oclusal_incisal']
      : ['vestibular', 'lingual', 'mesial', 'distal', 'oclusal_incisal'];

    for (const [fdiKey, tooth] of Object.entries(quadrant.piezas)) {
      const validPieceMeta = meta.piezas.find(
        (p) => String(p.codigo_fdi) === fdiKey && p.codigo_fdi === tooth.codigo_fdi
      );

      if (!validPieceMeta) {
        throw new ClinicalDomainError(
          `La pieza FDI "${fdiKey}" no pertenece al ${meta.descripcion} (${meta.key}).`,
          'BAD_REQUEST'
        );
      }

      // Validar las 5 caras anatómicas y que cada superficie tenga máximo un hallazgo vigente (RF-HCL-007)
      for (const surfaceName of expectedSurfaceKeys) {
        const surfaceFlags = (tooth.caras as unknown as Record<string, OdontogramSurfaceFlagsDTO>)?.[
          surfaceName
        ];

        if (!surfaceFlags) {
          throw new ClinicalDomainError(
            `La pieza FDI ${tooth.codigo_fdi} debe incluir la cara "${surfaceName}".`,
            'BAD_REQUEST'
          );
        }

        const activeFindingsCount = [
          surfaceFlags.caries_activa,
          surfaceFlags.restauracion_resina,
          surfaceFlags.sellante_fosas,
          surfaceFlags.desgaste_faceta,
        ].filter(Boolean).length;

        if (activeFindingsCount > 1) {
          throw new ClinicalDomainError(
            `Cada superficie dental puede tener un solo hallazgo vigente (pieza ${tooth.codigo_fdi}, cara ${surfaceName}).`,
            'BAD_REQUEST'
          );
        }
      }

      // Validar coherencia de símbolos técnicos y relación de puente
      if (
        tooth.simbolos_tecnicos.diente_extraido &&
        tooth.simbolos_tecnicos.extraccion_requerida
      ) {
        throw new ClinicalDomainError(
          `La pieza FDI ${tooth.codigo_fdi} no puede marcarse simultáneamente como "diente_extraido" y "extraccion_requerida".`,
          'BAD_REQUEST'
        );
      }

      if (tooth.relacion_puente) {
        if (!tooth.simbolos_tecnicos.puente) {
          throw new ClinicalDomainError(
            `La pieza FDI ${tooth.codigo_fdi} define "relacion_puente" pero tiene el símbolo técnico "puente" en false.`,
            'BAD_REQUEST'
          );
        }
        if (
          !Array.isArray(tooth.relacion_puente.piezas_conectadas) ||
          tooth.relacion_puente.piezas_conectadas.length < 2
        ) {
          throw new ClinicalDomainError(
            `La relación de puente en la pieza ${tooth.codigo_fdi} debe especificar al menos 2 "piezas_conectadas".`,
            'BAD_REQUEST'
          );
        }
      }
    }
  }
}
